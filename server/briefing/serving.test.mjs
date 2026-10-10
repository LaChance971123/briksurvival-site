import test from 'node:test';
import assert from 'node:assert/strict';
import { serveSnapshot } from '../../netlify/functions/briefing-snapshot.mjs';
import { saveState } from './store.mjs';
const seed={id:'test-only',generatedAt:'2026-10-10T12:00:00Z',sources:[],events:[]};
test('snapshot endpoint reads only shared storage and supports CDN/ETag caching',async()=>{
 let reads=0;const load=async()=>{reads++;return {snapshot:seed}};
 const response=await serveSnapshot(new Request('https://example.test/api/briefing'),{load,seed});
 assert.equal(reads,1);assert.equal(response.status,200);assert.match(response.headers.get('Netlify-CDN-Cache-Control'),/durable, s-maxage=300/);
 const again=await serveSnapshot(new Request('https://example.test/api/briefing',{headers:{'if-none-match':response.headers.get('etag')}}),{load,seed});
 assert.equal(again.status,304);
});
test('storage failures retain dated seed and disclose failure, not current/all clear',async()=>{
 const response=await serveSnapshot(new Request('https://example.test/api/briefing'),{load:async()=>{throw Error('private internal path')},seed});
 const body=await response.json();assert.equal(body.storageStatus,'unavailable');assert.equal(body.generatedAt,seed.generatedAt);assert.ok(!JSON.stringify(body).includes('private internal path'));
});
test('an initial snapshot does not claim that production scheduling is inactive or already verified',async()=>{
 const response=await serveSnapshot(new Request('https://example.test/api/briefing'),{load:async()=>null,seed});
 const body=await response.json();assert.equal(body.storageStatus,'initial-snapshot');
 assert.equal(body.generatedAt,seed.generatedAt);assert.match(body.storageNote,/saved scheduled refresh is not available yet/);
 assert.doesNotMatch(body.storageNote,/preview|inactive|activated|all clear/i);
});
test('bounded version storage writes version before latest and stops on failed write',async()=>{
 const calls=[];const store={setJSON:async(key,value)=>{calls.push(key)}};
 await saveState(store,{snapshot:seed});assert.equal(calls[1],'latest-state');assert.match(calls[0],/^versions\/slot-\d\d$/);
 let count=0;await assert.rejects(saveState({setJSON:async()=>{count++;throw Error('unavailable')}},{snapshot:seed}));assert.equal(count,1);
});
test('storage fetch aborts slow requests and prevents SDK retry storms',async()=>{
 const {boundedStorageFetch}=await import('./store.mjs');
 let aborted=false;
 const slow=boundedStorageFetch({timeoutMs:5,fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('abort'))}))});
 assert.equal((await slow('https://example.test/')).status,400);assert.ok(aborted);
 const retryable=boundedStorageFetch({fetchImpl:async()=>new Response('unavailable',{status:503})});
 assert.equal((await retryable('https://example.test/')).status,400);
 const expired=boundedStorageFetch({deadline:Date.now()-1,fetchImpl:async()=>{throw Error('must not fetch')}});
 assert.equal((await expired('https://example.test/')).status,400);
});
