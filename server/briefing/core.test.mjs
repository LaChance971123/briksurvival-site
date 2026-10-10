import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, assembleSnapshot, plainText, safeURL, emptyState, NORMALIZATION_VERSION, MAX_ACTIVE_NWS_EVENTS, MAX_PUBLIC_EVENTS, MAX_PUBLIC_EVENT_BYTES } from './core.mjs';
import { editorialFor } from './editorial.mjs';
import { readFileSync, existsSync } from 'node:fs';
const now = '2026-10-10T12:00:00.000Z';
const source = {id:'nws',name:'NWS',kind:'official',website:'https://weather.gov',allowedHosts:['weather.gov'],rights:{label:'US government',url:'https://www.weather.gov/disclaimer'},coverage:'US weather'};
const raw = {id:'notice-1',title:'Flood Warning',summary:'Read the notice',instructions:'Source protective instruction.',category:'weather',url:'https://api.weather.gov/alerts/notice-1',publishedAt:'2026-10-10T08:00:00Z',updatedAt:'2026-10-10T09:00:00Z',expiresAt:'2026-10-10T18:00:00Z',location:{label:'Brevard County, Florida',scope:'US',codes:['FL'],precision:'source area'},urgency:'immediate'};
const result = (events=[raw],extra={}) => ({source,ok:true,events,coverage:{status:'ok'},...extra});

test('normalization strips hostile markup and validates safe outbound URL, no inferred geography', () => {
 const event = normalizeEvent({...raw,title:'<img src=x onerror=alert(1)> Flood <script>steal()</script>',summary:'&lt;img src=x onerror=alert(1)&gt;Safe',location:null},source,now);
 assert.equal(event.title,'Flood'); assert.equal(event.summary,'Safe'); assert.equal(event.location.scope,'Unknown');assert.deepEqual(event.location.codes,[]);
 for (const url of ['javascript:alert(1)','data:text/html,evil','https://weather.gov.evil.test/x','https://user:pass@weather.gov/x','http://weather.gov/x','https://localhost/']) assert.equal(normalizeEvent({...raw,url},source,now),null);
 assert.equal(safeURL('https://www.weather.gov/a?utm_source=test&x=1',['weather.gov']),'https://www.weather.gov/a?x=1');
 assert.equal(plainText('A\u202e B'),'A B');
});
test('expiry is distinct from cancellation and never claims the hazard ended', () => {
 const event = normalizeEvent({...raw,expiresAt:'2026-10-10T11:00:00Z'},source,now);
 assert.equal(event.status,'expired');assert.equal(event.cancelledAt,null); assert.equal(event.endsAt,null);
});
test('deduplication keeps latest source revision and useful update history', () => {
 const first = assembleSnapshot(null,[result([raw,{...raw,title:'Older duplicate',updatedAt:'2026-10-10T08:00:00Z'}])],now);
 assert.equal(first.snapshot.events.length,1);assert.equal(first.snapshot.events[0].title,'Flood Warning');
 const second = assembleSnapshot(first,[result([{...raw,title:'Flood Warning revised',updatedAt:'2026-10-10T12:10:00Z'}])],'2026-10-10T13:00:00Z');
 assert.equal(second.snapshot.events[0].id,first.snapshot.events[0].id);assert.equal(second.snapshot.events[0].updates.length,2);
});
test('absence from active list never means cancellation', () => {
 const first = assembleSnapshot(null,[result()],now);
 const second = assembleSnapshot(first,[result([])],'2026-10-10T13:00:00Z');
 assert.equal(second.snapshot.events[0].status,'no-longer-listed');assert.equal(second.snapshot.events[0].cancelledAt,null);
});
test('explicit cancellation references affect prior source event across NWS lanes', () => {
 const first = assembleSnapshot(null,[result()],now);
 const cancellationSource = {...source,id:'nws-cancellations'};
 const cancel = {...raw,id:'cancel-1',url:'https://api.weather.gov/alerts/cancel-1',title:'Cancellation',status:'cancelled',cancelledAt:'2026-10-10T12:30:00Z',relatedIds:['notice-1']};
 const second = assembleSnapshot(first,[result([]),{source:cancellationSource,ok:true,events:[cancel]}],'2026-10-10T13:00:00Z');
 const event = second.snapshot.events.find(e => e.sourceEventId === 'notice-1');
 assert.equal(event.status,'cancelled');assert.equal(event.cancelledAt,'2026-10-10T12:30:00.000Z');
});
test('one source outage preserves last good data, news failure cannot erase official lanes', () => {
 const news = {...source,id:'news',kind:'news'};
 const first = assembleSnapshot(null,[result(),{source:news,ok:true,events:[{...raw,id:'news-1',url:'https://weather.gov/news'}]}],now);
 const second = assembleSnapshot(first,[result(),{source:news,ok:false,error:'HTTP 500'}],'2026-10-10T13:00:00Z');
 assert.equal(second.snapshot.events.length,2);assert.equal(second.sources.news.status,'stale');assert.equal(second.sources.nws.status,'ok');
 assert.equal(second.sources.news.lastSuccessAt,now);assert.equal(second.sources.news.events[0].lastCheckedAt,now);
 const third = assembleSnapshot(second,[{source,ok:false},{source:news,ok:false}],'2026-10-11T00:00:00Z');
 assert.equal(third.snapshot.lastSuccessfulAt,second.snapshot.lastSuccessfulAt);
 assert.equal(third.snapshot.events.find(e=>e.source.id==='nws').status,'expired');
});
test('304 uses previous items and refreshes check, first failure stays unavailable', () => {
 const first = assembleSnapshot(null,[result()],now);
 const next = assembleSnapshot(first,[result(undefined,{notModified:true})],'2026-10-10T14:00:00Z');
 assert.equal(next.snapshot.events[0].lastCheckedAt,'2026-10-10T14:00:00Z');
 assert.equal(assembleSnapshot(emptyState(),[{source,ok:false}],now).sources.nws.status,'unavailable');
});
test('news cannot inherit urgent styling or authoritative safety instructions', () => {
 const event = normalizeEvent(raw,{...source,kind:'news'},now);
 assert.equal(event.urgency,'unknown');
});
test('all mapped guides exist and no specific incident recommendations are invented', () => {
 for (const category of ['weather','earthquake','recall','cyber','news']) {
  const mapped = editorialFor({category,title:'Tornado Warning'});
  assert.ok(mapped.guides.length>=2 && mapped.guides.length<=4);
  for (const g of mapped.guides) assert.ok(existsSync(new URL('../../'+g.url.replace(/^\//,'')+'index.html',import.meta.url)),g.url);
 }
 const cyber = editorialFor({category:'cyber',title:'CVE-2026-0000'});
 assert.match(cyber.whatThisMeans,/not a report of a breach/);
});
test('distinct official records may share a catalog URL without collapsing',()=>{
 const state=assembleSnapshot(null,[result([{...raw,id:'cve-1',url:'https://weather.gov/catalog'},{...raw,id:'cve-2',url:'https://weather.gov/catalog'}])],now);
 assert.equal(state.snapshot.events.length,2);
});
test('all rejected normalized source records preserve last known version',()=>{
 const first=assembleSnapshot(null,[result()],now);
 const next=assembleSnapshot(first,[result([{...raw,url:'javascript:bad'}])],'2026-10-10T13:00:00Z');
 assert.equal(next.snapshot.events.length,1);assert.equal(next.sources.nws.status,'stale');assert.equal(next.sources.nws.lastSuccessAt,now);
});
test('a successful news refresh removes omitted rights-filtered records',()=>{
 const news={...source,id:'news',kind:'news'};
 const first=assembleSnapshot(null,[{source:news,ok:true,events:[raw]}],now);
 const next=assembleSnapshot(first,[{source:news,ok:true,events:[]}],'2026-10-10T13:00:00Z');
 assert.equal(next.snapshot.events.length,0);
});
test('source end time remains passed when validity expiry is in the future',()=>{
 const ended={...raw,endsAt:'2026-10-10T11:00:00Z'};
 assert.equal(normalizeEvent(ended,source,now).status,'expired');
 const first=assembleSnapshot(null,[result([{...raw,endsAt:'2026-10-10T13:00:00Z'}])],now);
 assert.equal(first.snapshot.events[0].status,'current');
 const second=assembleSnapshot(first,[{source,ok:false}],'2026-10-10T14:00:00Z');
 assert.equal(second.snapshot.events[0].status,'expired');
});
test('rights exclusions remove retained official-feed records',()=>{
 const first=assembleSnapshot(null,[result()],now);
 const next=assembleSnapshot(first,[result([],{excludedIds:['notice-1']})],'2026-10-10T13:00:00Z');
 assert.equal(next.snapshot.events.length,0);
});
test('oversized official instructions are omitted in full, not silently truncated',()=>{
 const event=normalizeEvent({...raw,instructions:'A'.repeat(13000)},source,now);
 assert.equal(event.instructions,'');assert.equal(event.instructionsOmitted,true);
});
test('public snapshot stays below API payload budget and discloses caps',()=>{
 const results=Array.from({length:5},(_,lane)=>({source:{...source,id:`lane-${lane}`},ok:true,events:Array.from({length:120},(_,i)=>({...raw,id:`notice-${i}`,instructions:'x'.repeat(11999)})),coverage:{receivedCount:120,status:'ok'}}));
 const state=assembleSnapshot(null,results,now);
 assert.ok(state.snapshot.events.length<500);assert.ok(Buffer.byteLength(JSON.stringify(state.snapshot))<3.1*1024*1024);assert.ok(state.snapshot.sources.some(s=>s.coverage.snapshotCapped));
});
test('rights exclusions override allowed duplicates and failed normalization',()=>{
 const first=assembleSnapshot(null,[result()],now);
 const duplicate=assembleSnapshot(first,[result([raw],{excludedIds:['notice-1']})],now);
 assert.equal(duplicate.snapshot.events.length,0);
 const invalid=assembleSnapshot(first,[result([{...raw,id:'future',publishedAt:'2099-01-01T00:00:00Z'}],{excludedIds:['notice-1']})],now);
 assert.equal(invalid.snapshot.events.length,0);
});

test('normalized geo only trusts NWS SAME or C-zone evidence and preserves subdivision metadata',()=>{
 const supplied={countyFips:['99999'],sameCodes:['006001','106001','099001'],zoneIds:['CAC001','CAZ003'],evidence:'<script>fake</script>'};
 const event=normalizeEvent({...raw,geo:supplied},source,now);
 assert.deepEqual(event.geo.countyFips,['06001']);assert.deepEqual(event.geo.sameCodes,['006001','106001','099001']);
 assert.equal(event.geo.incomplete,true);assert.doesNotMatch(event.geo.evidence,/script|fake/);
 for(const untrusted of [{...source,kind:'news'},{...source,id:'cpsc'},{...source,id:'nws-unregistered'}]) {
  assert.deepEqual(normalizeEvent({...raw,geo:supplied},untrusted,now).geo.countyFips,[]);
 }
 assert.deepEqual(normalizeEvent({...raw,geo:null},source,now).geo.countyFips,[]);
});

test('partial geography warning survives normalization and stale-source retention',()=>{
 const first=assembleSnapshot(null,[result([{...raw,geo:{sameCodes:['006001','099001']}}])],now);
 assert.equal(first.sources.nws.coverage.incompleteGeography,1);assert.equal(first.sources.nws.coverage.status,'partial');
 const stale=assembleSnapshot(first,[{source,ok:false}],now);
 assert.equal(stale.snapshot.events[0].geo.incomplete,true);assert.equal(stale.sources.nws.coverage.status,'partial');
});

test('active NWS retains up to800 while other lanes keep120, with exact count disclosure',()=>{
 const raws=Array.from({length:805},(_,i)=>({...raw,id:`active-${i}`,instructions:'',summary:''}));
 const other={...source,id:'other-official'};
 const state=assembleSnapshot(null,[result(raws),{source:other,ok:true,events:raws.slice(0,121)}],now);
 assert.equal(MAX_ACTIVE_NWS_EVENTS,800);assert.equal(state.sources.nws.events.length,800);
 assert.equal(state.sources.nws.coverage.sourceDroppedCount,5);assert.equal(state.sources.nws.coverage.limit,800);
 assert.equal(state.sources['other-official'].events.length,120);assert.equal(state.sources['other-official'].coverage.sourceDroppedCount,1);
 assert.equal(state.sources.nws.coverage.status,'partial');assert.equal(state.sources['other-official'].coverage.status,'partial');
});

test('cancellation references apply before capping without displacing current records',()=>{
 const active=Array.from({length:801},(_,i)=>({...raw,id:`active-${i}`,instructions:'',summary:''}));
 active[800]={...active[800],updatedAt:'2026-10-01T00:00:00Z'};
 const cancelSource={...source,id:'nws-cancellations'};
 const cancel={...raw,id:'cancel',status:'cancelled',cancelledAt:now,relatedIds:['active-800'],updatedAt:'2026-10-01T00:00:00Z'};
 const state=assembleSnapshot(null,[result(active),{source:cancelSource,ok:true,events:[cancel]}],now);
 assert.equal(state.sources.nws.events.find(event=>event.sourceEventId==='active-800'),undefined);
 assert.equal(state.sources.nws.events.filter(event=>event.status==='current').length,800);
 assert.ok(state.snapshot.events.some(event=>event.source.id==='nws-cancellations'));
});

test('public1000 cap marks only sources that lose actual records and separates public from stored counts',()=>{
 const results=Array.from({length:9},(_,lane)=>({source:{...source,id:`lane-${lane}`},ok:true,events:Array.from({length:120},(_,i)=>({...raw,id:`notice-${i}`,title:'Notice',summary:'',instructions:'',location:null}))}));
 const state=assembleSnapshot(null,results,now);
 assert.equal(MAX_PUBLIC_EVENTS,1000);assert.equal(state.snapshot.events.length,1000);
 assert.equal(Object.values(state.sources).reduce((sum,s)=>sum+s.coverage.publicDroppedCount,0),80);
 for(const s of Object.values(state.sources)) {
  const displayed=state.snapshot.events.filter(event=>event.source.id===s.id).length;
  assert.equal(s.coverage.publicCount,displayed);assert.equal(s.coverage.storedCount,120);
  assert.equal(s.coverage.publicDroppedCount,120-displayed);
  assert.equal(s.coverage.status,displayed<120?'partial':'ok');
 }
});

test('byte capping keeps current notices ahead of older cancellations and attributes every drop',()=>{
 const results=Array.from({length:3},(_,lane)=>({source:{...source,id:lane===2?'nws-cancellations':`lane-${lane}`},ok:true,events:Array.from({length:120},(_,i)=>({...raw,id:`notice-${i}`,instructions:'x'.repeat(11999),...(lane===2?{status:'cancelled',cancelledAt:now,updatedAt:'2026-10-01T00:00:00Z'}:{})}))}));
 const state=assembleSnapshot(null,results,now);
 assert.equal(state.snapshot.events.filter(event=>event.source.id==='nws-cancellations').length,0);
 assert.ok(state.snapshot.events.length>120);assert.ok(state.snapshot.events.every(event=>event.status==='current'));
 assert.ok(state.snapshot.events.reduce((sum,event)=>sum+Buffer.byteLength(JSON.stringify(event)),0)<=MAX_PUBLIC_EVENT_BYTES);
 for(const s of Object.values(state.sources)) {
  const count=state.snapshot.events.filter(event=>event.source.id===s.id).length;
  assert.equal(s.coverage.publicDroppedCount,s.events.length-count);
  if(count<s.events.length) {assert.equal(s.coverage.status,'partial');assert.equal(s.coverage.snapshotCapped,true);}
 }
});

test('800 old cancellations cannot starve a newly current NWS warning',()=>{
 const cancelled=Array.from({length:800},(_,i)=>({...raw,id:`old-${i}`,status:'cancelled',cancelledAt:'2026-10-01T00:00:00Z',publishedAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',instructions:'',summary:''}));
 const first=assembleSnapshot(null,[result(cancelled)],now);
 const next=assembleSnapshot(first,[result([{...raw,id:'new-current-warning'}])],now);
 assert.equal(next.sources.nws.events.length,800);
 assert.equal(next.sources.nws.events[0].sourceEventId,'new-current-warning');
 assert.equal(next.sources.nws.events[0].status,'current');
 assert.ok(next.snapshot.events.some(event=>event.sourceEventId==='new-current-warning'));
 assert.equal(next.sources.nws.coverage.sourceDroppedCount,1);
});

test('new normalization version is only acknowledged after a fresh successful source parse',()=>{
 const first=assembleSnapshot(null,[result()],now);
 assert.equal(first.sources.nws.normalizationVersion,NORMALIZATION_VERSION);
 const legacy=structuredClone(first);delete legacy.sources.nws.normalizationVersion;delete legacy.sources.nws.events[0].geo;
 const failed=assembleSnapshot(legacy,[{source,ok:false}],now);
 assert.equal(failed.sources.nws.normalizationVersion,null);assert.equal(failed.snapshot.events[0].geo,undefined);
 const refreshed=assembleSnapshot(legacy,[result([{...raw,geo:{sameCodes:['006001']}}])],now);
 assert.equal(refreshed.sources.nws.normalizationVersion,NORMALIZATION_VERSION);
 assert.deepEqual(refreshed.snapshot.events[0].geo.countyFips,['06001']);
});
