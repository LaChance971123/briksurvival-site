import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSource, collectBriefing, readBounded, retryAt } from './collector.mjs';
import { SOURCES } from './sources.mjs';
import { NORMALIZATION_VERSION } from './core.mjs';
const now='2026-10-10T12:00:00.000Z';
const nws=SOURCES.find(s=>s.id==='nws');
const feed={type:'FeatureCollection',features:[]};
test('conditional headers and 304 avoid reprocessing while preserving source state',async()=>{
 let options;
 const result=await collectSource(nws,{lastSuccessAt:now,normalizationVersion:NORMALIZATION_VERSION,etag:'abc',lastModified:'Fri, 09 Oct 2026 12:00:00 GMT'},{now,fetchImpl:async(_url,opts)=>{options=opts;return new Response(null,{status:304});}});
 assert.ok(result.notModified);assert.equal(options.headers['If-None-Match'],'abc');assert.equal(options.redirect,'error');
});

test('legacy source derivatives force a full refresh before geo matching or expanded retention',async()=>{
 let options;
 const result=await collectSource(nws,{lastSuccessAt:now,etag:'old',lastModified:'Fri, 09 Oct 2026 12:00:00 GMT'},{now,fetchImpl:async(_url,opts)=>{options=opts;return new Response(JSON.stringify(feed));}});
 assert.equal(options.headers['If-None-Match'],undefined);assert.equal(options.headers['If-Modified-Since'],undefined);
 assert.equal(result.ok,true);assert.equal(result.notModified,undefined);
});

test('unrequested304 cannot bless a legacy source derivative as freshly normalized',async()=>{
 const result=await collectSource(nws,{lastSuccessAt:now,etag:'old'},{now,fetchImpl:async()=>new Response(null,{status:304})});
 assert.equal(result.ok,false);assert.equal(result.notModified,undefined);
});
test('Retry-After suppresses early repeat requests without hidden retries',async()=>{
 let calls=0;
 const result=await collectSource(nws,null,{now,fetchImpl:async()=>{calls++;return new Response(null,{status:429,headers:{'Retry-After':'86400'}});}});
 assert.equal(result.nextEligibleAt,'2026-10-11T12:00:00.000Z');
 await collectSource(nws,{nextEligibleAt:result.nextEligibleAt},{now,fetchImpl:async()=>{calls++;throw Error();}});
 assert.equal(calls,1);assert.equal(retryAt('nonsense',now),null);
});
test('timeouts abort source, unaffected sources still complete',async()=>{
 const result=await collectSource(nws,null,{now,timeoutMs:10,fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('abort'))))});
 assert.equal(result.ok,false);assert.match(result.error,/timed out/);
});
test('response bytes bounded even when Content-Length absent',async()=>{
 await assert.rejects(readBounded(new Response('abcdefghijklmnop'),4),/size limit/);
});
test('all failures produce honest unavailable snapshot, max concurrency3',async()=>{
 let active=0,max=0;
 const state=await collectBriefing(null,{now,fetchImpl:async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;return new Response(null,{status:503});}});
 assert.ok(max<=3);assert.equal(state.snapshot.sources.length,SOURCES.length);assert.equal(state.snapshot.lastSuccessfulAt,null);assert.equal(state.snapshot.events.length,0);assert.ok(state.snapshot.sources.every(s=>s.status==='unavailable'));
});
test('malformed feed cannot become a successful empty source',async()=>{
 const result=await collectSource(nws,null,{now,fetchImpl:async()=>new Response('{"unexpected":"shape"}')});
 assert.equal(result.ok,false);
});
test('FDA explicit rights exclusion removes previously retained official text',async()=>{
 const {adaptSource}=await import('./sources.mjs');const {assembleSnapshot}=await import('./core.mjs');
 const fda=SOURCES.find(s=>s.id==='fda');
 const feed=description=>`<rss><channel><title>FDA</title><item><guid>test-recall</guid><title>Test recall</title><link>https://www.fda.gov/safety/test</link><pubDate>Fri, 09 Oct 2026 15:00:00 GMT</pubDate><description>${description}</description></item></channel></rss>`;
 const first=assembleSnapshot(null,[{source:fda,ok:true,...adaptSource('fda',feed('Permitted notice'),{now})}],now);
 const updated=adaptSource('fda',feed('All rights reserved'),{now});
 assert.deepEqual(updated.excludedIds,['test-recall']);
 const second=assembleSnapshot(first,[{source:fda,ok:true,...updated}],now);
 assert.equal(second.snapshot.events.length,0);
});
