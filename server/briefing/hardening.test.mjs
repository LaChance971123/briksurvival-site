import test from 'node:test';
import assert from 'node:assert/strict';
import bootstrap from './bootstrap.json' with {type:'json'};
import {serveSnapshot} from '../../netlify/functions/briefing-snapshot.mjs';
import {boundResponse} from './public-view.mjs';
const now=Date.parse('2026-10-15T12:00:00Z');
const seed={schemaVersion:1,id:'inert-test',generatedAt:new Date(now).toISOString(),sources:[{id:'test',status:'ok',lastSuccessAt:new Date(now).toISOString()}],events:[]};
test('health checks storage and each source freshness, never just HTTP success',async()=>{
 const call=async(snapshot,load=async()=>({snapshot}))=>serveSnapshot(new Request('https://example.test/api/health'),{load,seed,now});
 assert.equal((await call(seed)).status,200);
 for(const snapshot of [{...seed,generatedAt:'2020-01-01'}, {...seed,sources:[]}, {...seed,sources:[{...seed.sources[0],lastSuccessAt:'2020-01-01'}]}, {...seed,sources:[{...seed.sources[0],status:'failed'}]}])assert.equal((await call(snapshot)).status,503);
 assert.equal((await call(seed,async()=>{throw Error('storage')})).status,503);
 assert.equal((await call(seed,async()=>null)).status,503);
 assert.equal((await call(seed)).headers.get('Cache-Control'),'no-store');
});
test('homepage feed is compact and retains dates, licensing and source health',async()=>{
 const snapshot=bootstrap.snapshot;
 const response=await serveSnapshot(new Request('https://example.test/api/briefing/home'),{load:async()=>({snapshot}),now:Date.parse(snapshot.generatedAt)});
 const raw=await response.text(),body=JSON.parse(raw);
 assert.ok(Buffer.byteLength(raw)<128*1024);assert.ok(body.events.length<=12);assert.equal(body.generatedAt,snapshot.generatedAt);assert.deepEqual(body.sources,snapshot.sources);
 for(const e of body.events){assert.ok(e.url);assert.ok(e.source);assert.equal(e.instructions,undefined);if(e.source.kind==='news'){assert.ok(e.attribution);assert.ok(e.source.licenseUrl);}}
});
test('full public response budget includes metadata and discloses truncation',()=>{
 const body={...seed,events:Array.from({length:100},(_,i)=>({id:i,text:'x'.repeat(2000)})),storageNote:null};
 const out=boundResponse(body,10000);assert.ok(Buffer.byteLength(out)<=10000);assert.ok(JSON.parse(out).responseOmittedRecords>0);assert.equal(body.events.length,100);
});
test('HEAD has no response body',async()=>{const res=await serveSnapshot(new Request('https://example.test/api/briefing',{method:'HEAD'}),{load:async()=>({snapshot:seed}),now});assert.equal(await res.text(),'');});
