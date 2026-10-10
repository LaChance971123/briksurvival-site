/* Non-published test fixtures. They are inert schema tests, not source reports. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const api=require('../briefing.js');
const code=fs.readFileSync('briefing.js','utf8');
const now=Date.now(), iso=delta=>new Date(now+delta).toISOString();
const record={id:'test-only-record',title:'Test-only inert record',source:{id:'test-source',name:'Test-only source',kind:'official'},category:'weather',url:'https://example.com/source',summary:'Literal <script> text must stay text.',instructions:'Test-only source instructions.',location:{scope:'US',label:'Test-only location',codes:['FL']},publishedAt:iso(-3600000),updatedAt:iso(-3600000),lastCheckedAt:iso(-3600000),expiresAt:iso(3600000),status:'current',whatThisMeans:'Test-only context',preparedness:['Test-only reviewed step'],guides:[{title:'Power outage',url:'/emergencies/power-outage/'},{title:'Household planning',url:'/preparedness/household-emergency-plan/'}],resources:[],updates:[]};
const snapshot={schemaVersion:1,generatedAt:iso(0),lastSuccessfulAt:iso(-3600000),storageStatus:'ok',events:[record],sources:[{id:'test-source',name:'Test-only source',status:'ok',lastSuccessAt:iso(-3600000),lastAttemptAt:iso(-3600000),website:'https://example.com/',coverage:{label:'Test-only coverage',status:'ok'}}]};
assert.equal(api.snapshotState(snapshot,now).state,'current');
assert.equal(api.snapshotState({...snapshot,lastSuccessfulAt:iso(-15*3600000)},now).state,'stale');
assert.equal(api.snapshotState({...snapshot,sources:[{...snapshot.sources[0],lastSuccessAt:iso(-15*3600000)}]},now).state,'partial');
assert.equal(api.snapshotState({...snapshot,sources:[{...snapshot.sources[0],coverage:{status:'partial'}}]},now).state,'partial');
assert.equal(api.snapshotState({...snapshot,storageStatus:'initial-snapshot'},now).state,'partial');
assert.equal(api.snapshotState({...snapshot,sources:[],events:[],lastSuccessfulAt:null},now).state,'unavailable');
assert.match(api.recordState({...record,expiresAt:iso(-1)},now).note,/does not mean the threat has ended/);
assert.match(api.recordState({...record,status:'no-longer-listed'},now).note,/not an all-clear/);
assert.match(api.recordState({...record,status:'cancelled'},now).note,/does not establish current safety/);
assert.equal(api.locationLabel({...record,location:{scope:'Unknown',label:'Do not infer this'}}),'Location unknown');
assert.deepEqual(api.sourceStates({...record,location:{scope:'Unknown',codes:['FL']}}),[]);
assert.equal(api.filterEvents([record],'weather','US:FL').length,1);
assert.equal(api.filterEvents([record],'weather','US:CA').length,0);
assert.equal(api.filterEvents([record],'all','Unknown').length,0);
assert.equal(api.externalUrl('javascript:alert(1)'),null);
assert.equal(api.externalUrl('https://user:password@example.com'),null);
assert.equal(api.guideUrl('//example.com/'),null);
assert.equal(api.guideUrl('/emergencies/power-outage/?place=home'),null);
assert.equal(api.exactGuides({...record,guides:[...record.guides,record.guides[0],{title:'bad',url:'https://example.com'}]}).length,2);
assert.throws(()=>api.normalizeSnapshot({events:[],sources:[]}));
assert.equal(api.normalizeSnapshot({...snapshot,events:[record,{...record,url:'javascript:alert(1)'}]}).events.length,1);
assert.equal(api.stamp(null),'Not provided');
assert.equal(api.normalizeSnapshot({...snapshot,events:[{...record,source:{...record.source,kind:'news'}}]}).events.length,0,'News without attribution and licensed source URLs must fail closed');
const selectionSources=[snapshot.sources[0],{...snapshot.sources[0],id:'test-second-source'},{...snapshot.sources[0],id:'test-news-source'}];
const selectionRecords=[record,{...record,id:'test-second',category:'recall',source:{...record.source,id:'test-second-source'},updatedAt:iso(-7200000)},{...record,id:'test-news',category:'news',source:{...record.source,id:'test-news-source',kind:'news'},updatedAt:iso(-10800000)},{...record,id:'test-duplicate-category',updatedAt:iso(-1000)},{...record,id:'test-expired',category:'earthquake',expiresAt:iso(-1000),updatedAt:iso(0)}];
const selected=api.selectHomeEvents({...snapshot,sources:selectionSources,events:selectionRecords},now);
assert.equal(selected.length,3);assert.equal(selected.filter(event=>event.source.kind==='news').length,1);
assert.equal(new Set(selected.map(event=>event.category)).size,3,'Homepage should diversify categories');
assert(!selected.some(event=>event.id==='test-expired'),'Expired records must not displace available current records');
assert.deepEqual(selected.map(event=>event.id),api.selectHomeEvents({...snapshot,sources:selectionSources,events:[...selectionRecords].reverse()},now).map(event=>event.id),'Homepage selection is deterministic independent of input order');
assert.equal(api.selectHomeEvents({...snapshot,sources:selectionSources,events:selectionRecords.map(event=>({...event,source:{...event.source,kind:'news'}}))},now).length,1,'Homepage uses at most one news record');
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.events={};this.hidden=false;this.value='';this.textContent='';this.className='';this.selectors={};}
 append(...children){this.children.push(...children);for(const child of children)for(const node of flatten(child))node.isConnected=true;}
 replaceChildren(...children){for(const child of this.children)for(const node of flatten(child))node.isConnected=false;this.children=[];this.append(...children);}
 setAttribute(key,value){this.attrs[key]=value;}
 getAttribute(key){return this.attrs[key];}
 addEventListener(key,fn){this.events[key]=fn;}
 querySelector(selector){return this.selectors[selector]||null;}
}
function flatten(node){return [node,...node.children.flatMap(flatten)];}
function allText(node){return flatten(node).map(node=>node.textContent||'').join(' ');}
function fixture(modes=['index'],{stored=null,blockedStorage=false,search='?id=test-only-record'}={}){
 const roots=modes.map(mode=>{const root=new Element();root.attrs['data-briefing']=mode;for(const key of ['status','cards','fallback','filters','category','location','reset','count','empty','source-health','sources','detail','detail-fallback','more'])root.selectors['[data-briefing-'+key+']']=new Element();root.selectors['.briefing-fallback-intro']=new Element();return root;});
 const calls=[],writes=[],timers=new Map();let nextTimer=0,clockNow=now;
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[clockNow]));}static now(){return clockNow;}}
 const document={title:'',hidden:false,events:{},activeElement:null,addEventListener(type,fn){this.events[type]=fn;},querySelectorAll:()=>roots,createElement:tag=>new Element(tag)};
 const window={location:{search},events:{},addEventListener(type,fn){this.events[type]=fn;}};
 vm.runInNewContext(code,{document,window,URL,URLSearchParams,Date:ClockDate,AbortController,
  localStorage:{getItem:()=>{if(blockedStorage)throw Error();return stored;},setItem:(k,v)=>{if(blockedStorage)throw Error();writes.push([k,v]);},removeItem:k=>{if(blockedStorage)throw Error();writes.push([k,null]);}},
  setTimeout:(fn,delay)=>{timers.set(++nextTimer,{fn,at:clockNow+delay,delay});return nextTimer;},clearTimeout:id=>timers.delete(id),
  fetch:(url,options)=>new Promise((resolve,reject)=>calls.push({url,options,resolve,reject}))});
 return {roots,calls,writes,document,window,timers,advance(ms){clockNow+=ms;let n=0;while(true){const next=[...timers].filter(([,t])=>t.at<=clockNow).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++n>20)throw Error('Timer failed to advance');timers.delete(next[0]);next[1].fn();}},visible(value){document.hidden=!value;document.events.visibilitychange?.();}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function resolve(fixture,data=snapshot){fixture.calls[0].resolve({ok:true,json:async()=>data});await tick();}
(async()=>{
 const index=fixture(['index'],{stored:'US:FL'});await resolve(index);
 const root=index.roots[0],get=key=>root.querySelector('[data-briefing-'+key+']');
 assert.equal(index.calls.length,1);assert.equal(index.calls[0].url,'/api/briefing');assert.equal(index.calls[0].options.credentials,'omit');
 assert.equal(index.timers.size,1,'One local boundary timer remains after the request timeout is cleared');assert.equal(get('location').value,'US:FL');assert.equal(get('cards').children.length,1);
 assert.equal(get('fallback').hidden,true);assert.equal(get('filters').hidden,false);
 assert(!flatten(get('cards')).some(node=>node.tagName==='SCRIPT'),'Untrusted source text must not become HTML');
 assert.match(allText(get('cards')),/Literal <script> text/);
 get('location').value='International';get('location').events.change();
 assert.equal(get('cards').hidden,true);assert.equal(get('fallback').hidden,false);assert.match(allText(get('empty')),/not an all-clear/);
 assert.equal(index.calls.length,1,'Filtering must not make requests');assert.deepEqual(index.writes,[[api.LOCATION_KEY,'International']]);
 get('reset').events.click();assert.equal(get('cards').children.length,1);assert.equal(get('location').value,'all');
 assert.equal(index.calls.length,1);
 const shared=fixture(['home','index','event']);await resolve(shared,{...snapshot,storageNote:'Preview schedule is inactive.'});
 assert.equal(shared.calls.length,1,'Every block in a document must share the single snapshot request');
 for(const root of shared.roots)assert.match(root.querySelector('[data-briefing-status]').textContent,/Preview schedule is inactive/);
 const detail=shared.roots[2].querySelector('[data-briefing-detail]');
 assert.equal(detail.hidden,false);assert.equal(detail.children.filter(node=>node.tagName==='SECTION').length,6);
 assert.match(allText(detail),/Test-only source instructions/);
 assert.match(allText(detail),/Reviewed preparedness next steps/);
 const news={...record,source:{...record.source,kind:'news',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',rightsUrl:'https://example.com/rights'},attribution:'Test-only author and publisher attribution',instructions:'MUST NOT PRESENT AS OFFICIAL'};
 const reported=fixture(['home','event']);await resolve(reported,{...snapshot,events:[news]});
 assert.match(allText(reported.roots[0].querySelector('[data-briefing-cards]')),/Test-only author and publisher attribution/);
 assert(flatten(reported.roots[0].querySelector('[data-briefing-cards]')).some(node=>node.href==='https://creativecommons.org/licenses/by/4.0/'));
 assert(flatten(reported.roots[0].querySelector('[data-briefing-cards]')).some(node=>node.href==='https://example.com/source'));
 assert.match(allText(reported.roots[1].querySelector('[data-briefing-detail]')),/Test-only author and publisher attribution/);
 const newsCardNodes=flatten(reported.roots[0].querySelector('[data-briefing-cards]'));assert(newsCardNodes.findIndex(node=>node.href==='https://example.com/source')<newsCardNodes.findIndex(node=>node.className==='briefing-card-summary'),'News attribution and original link must precede its reused excerpt');
 const newsDetailNodes=flatten(reported.roots[1].querySelector('[data-briefing-detail]'));assert(newsDetailNodes.findIndex(node=>node.href==='https://example.com/source')<newsDetailNodes.findIndex(node=>node.textContent==='Literal <script> text must stay text.'),'Detail original attribution must precede its reused excerpt');
 assert(!allText(reported.roots[1].querySelector('[data-briefing-detail]')).includes('MUST NOT PRESENT AS OFFICIAL'));
 assert(flatten(reported.roots[1].querySelector('[data-briefing-detail]')).some(node=>node.href==='https://creativecommons.org/licenses/by/4.0/'));
 const many=fixture(['index']);await resolve(many,{...snapshot,events:Array.from({length:23},(_,i)=>({...record,id:'test-only-'+i}))});assert.equal(many.roots[0].querySelector('[data-briefing-cards]').children.length,18);many.roots[0].querySelector('[data-briefing-more]').events.click();assert.equal(many.roots[0].querySelector('[data-briefing-cards]').children.length,23);assert.equal(many.calls.length,1);
 const missing=fixture(['event'],{search:'?id=missing'});await resolve(missing);assert.match(missing.roots[0].querySelector('[data-briefing-detail-fallback]').textContent,/absence is not an all-clear/);
 const failed=fixture(['index']);failed.calls[0].reject(Error('offline'));await tick();assert.match(failed.roots[0].querySelector('[data-briefing-status]').textContent,/Current conditions are unknown/);assert.equal(failed.calls.length,1);assert.equal(failed.roots[0].querySelector('[data-briefing-fallback]').hidden,false);
 const blocked=fixture(['index'],{blockedStorage:true});await resolve(blocked);blocked.roots[0].querySelector('[data-briefing-location]').events.change();assert.equal(blocked.roots[0].querySelector('[data-briefing-cards]').children.length,1);
 const expired=fixture(['home']);await resolve(expired,{...snapshot,events:[{...record,expiresAt:iso(-1),lastCheckedAt:iso(-15*3600000)}]});assert.match(allText(expired.roots[0].querySelector('[data-briefing-cards]')),/validity time has passed/);assert.match(allText(expired.roots[0].querySelector('[data-briefing-cards]')),/Source check overdue/);
 const timed=fixture(['home','index','event'],{stored:'US:FL'});
 const timedSnapshot={...snapshot,lastSuccessfulAt:iso(0),sources:snapshot.sources.map(source=>({...source,lastSuccessAt:iso(0)})),events:Array.from({length:23},(_,i)=>({...record,id:i===0?record.id:'test-time-'+i,expiresAt:iso(10),endsAt:iso(20),lastCheckedAt:iso(0)}))};
 await resolve(timed,timedSnapshot);
 const timeRoot=timed.roots[1],timeCards=timeRoot.querySelector('[data-briefing-cards]'),timeMore=timeRoot.querySelector('[data-briefing-more]');
 timeRoot.querySelector('[data-briefing-category]').value='weather';timeRoot.querySelector('[data-briefing-category]').events.change();timeMore.events.click();
 assert.equal(timeCards.children.length,23);
 const firstCard=timeCards.children[0],focused=flatten(firstCard).find(node=>node.href);timed.document.activeElement=focused;
 const detailHeader=timed.roots[2].querySelector('[data-briefing-detail]').children[0];
 assert.equal(timed.timers.size,1);assert.equal([...timed.timers.values()][0].delay,10,'Schedule the next exact record deadline, not a polling interval');
 timed.advance(11);
 assert.match(allText(timeCards),/validity time has passed/);assert.match(allText(detailHeader),/does not mean the threat has ended/);
 assert.strictEqual(timeCards.children[0],firstCard,'Time update preserves rendered card nodes');assert.strictEqual(timed.document.activeElement,focused,'Time update preserves keyboard focus');
 assert.equal(timeRoot.querySelector('[data-briefing-category]').value,'weather');assert.equal(timeRoot.querySelector('[data-briefing-location]').value,'US:FL');assert.equal(timeCards.children.length,23,'Progressive reveal remains expanded');
 assert.strictEqual(timed.roots[2].querySelector('[data-briefing-detail]').children[0],detailHeader,'Detail navigation is not reinitialized');
 timed.advance(api.STALE_AFTER_MS);
 for(const root of timed.roots)assert.equal(root.querySelector('[data-briefing-status]').attrs['data-state'],'stale');
 assert.match(allText(timeCards),/Source refresh overdue/);assert.match(allText(timeRoot.querySelector('[data-briefing-sources]')),/Source is stale/);
 assert.equal(timed.timers.size,0,'No recurring timer remains once all known boundaries pass');assert.equal(timed.calls.length,1,'Expiry/freshness timers never fetch');
 const hidden=fixture(['index']);await resolve(hidden,snapshot);hidden.visible(false);assert.equal(hidden.timers.size,0);hidden.advance(15*3600000);hidden.visible(true);assert.equal(hidden.roots[0].querySelector('[data-briefing-status]').attrs['data-state'],'stale');assert.match(allText(hidden.roots[0].querySelector('[data-briefing-cards]')),/validity time has passed/);assert.equal(hidden.calls.length,1,'Returning to a backgrounded tab recalculates without fetching');
 assert(!code.includes('innerHTML'));assert(!code.includes('setInterval'));assert(!code.includes('geolocation'));
 console.log('PASS: briefing single-fetch privacy, local filters, untrusted text/URL safety, stale/partial/outage and expiry semantics, six detail sections, news attribution, official-instruction separation and in-place expiry/freshness timers without polling.');
})().catch(error=>{console.error(error);process.exitCode=1;});
