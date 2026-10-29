import test from 'node:test';
import assert from 'node:assert/strict';
import {healthView} from './public-view.mjs';
import {serveSnapshot} from '../../netlify/functions/briefing-snapshot.mjs';
import {checkBriefingHealth,healthDiagnostic} from '../../scripts/production-health.mjs';

const now=Date.parse('2026-10-29T01:48:00Z');
const at=offset=>new Date(now+offset).toISOString();
const source={id:'cpsc',status:'ok',lastSuccessAt:at(0),lastAttemptAt:at(0)};
const snapshot={id:'inert-health-test',generatedAt:at(0),sources:[source],events:[]};
const view=(changes={})=>healthView({...snapshot,storageStatus:'ok',...changes},now);
const serve=(changes={},load)=>serveSnapshot(new Request('https://example.test/api/health'),{
  seed:snapshot,now,load:load||(async()=>({snapshot:{...snapshot,...changes}}))});

test('a failed source rejects a fresh snapshot even before its 14-hour age limit',()=>{
  const body=view({sources:[{...source,status:'stale',lastSuccessAt:at(-13*3600000)}]});
  assert.equal(body.healthy,false);assert.equal(body.snapshotAgeSeconds,0);
  assert.deepEqual(body.reasons,['sources_unhealthy']);
  assert.deepEqual(body.sources[0].reasons,['source_check_failed']);
  assert.equal(body.sources[0].ageSeconds,13*3600);
});
test('snapshot and source freshness preserve exact 14-hour and five-minute skew boundaries',()=>{
  for(const offset of [-14*3600000,300000]){
    assert.equal(view({generatedAt:at(offset),sources:[{...source,lastSuccessAt:at(offset)}]}).healthy,true);
  }
  for(const [offset,reason] of [[-14*3600000-1,'overdue'],[300001,'timestamp_future']]){
    const body=view({generatedAt:at(offset),sources:[{...source,lastSuccessAt:at(offset)}]});
    assert.equal(body.healthy,false);assert.ok(body.reasons.includes(`snapshot_${reason}`));
    assert.ok(body.sources[0].reasons.includes(`source_${reason}`));
  }
  const invalid=view({generatedAt:'invalid',sources:[{...source,lastSuccessAt:null}]});
  assert.ok(invalid.reasons.includes('snapshot_timestamp_invalid'));
  assert.ok(invalid.sources[0].reasons.includes('source_timestamp_invalid'));
  assert.equal(invalid.snapshotAgeSeconds,null);
  assert.deepEqual(view({sources:[]}).reasons,['sources_missing']);
});
test('storage failure, missing state and source failure remain distinct 503s with no-store',async()=>{
  for(const [load,reason] of [[async()=>{throw Error('secret storage path');},'storage_unavailable'],[async()=>null,'snapshot_missing']]){
    const response=await serve({},load),body=await response.json();
    assert.equal(response.status,503);assert.ok(body.reasons.includes(reason));
    assert.equal(body.generatedAt,snapshot.generatedAt);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('netlify-cdn-cache-control'),'no-store');
    assert.ok(!JSON.stringify(body).includes('secret'));
  }
});
test('synthetic check retains source failure evidence from a real endpoint 503 without retry',async()=>{
  let requests=0;
  await assert.rejects(checkBriefingHealth('https://example.test',{fetchImpl:async(url)=>{
    requests++;assert.equal(url,'https://example.test/api/health');
    const response=await serve({sources:[{...source,status:'stale'}]});
    response.headers.set('x-nf-request-id','test-request');return response;
  }}),error=>{
    assert.match(error.message,/HTTP 503/);assert.match(error.message,/cpsc/);
    assert.match(error.message,/source_check_failed/);assert.match(error.message,/test-request/);return true;
  });
  assert.equal(requests,1);
});
test('healthy results include evidence and non-2xx never passes even with healthy=true',async()=>{
  const diagnostic=await checkBriefingHealth('https://example.test',{fetchImpl:()=>serve()});
  assert.equal(diagnostic.healthy,true);assert.equal(diagnostic.snapshotId,snapshot.id);
  assert.deepEqual(diagnostic.reasons,[]);
  await assert.rejects(checkBriefingHealth('https://example.test',{fetchImpl:async()=>Response.json({healthy:true},{status:503})}),/HTTP 503/);
  await assert.rejects(checkBriefingHealth('https://example.test',{fetchImpl:async()=>Response.json({healthy:false})}),/HTTP 200/);
});
test('malformed, oversized and interrupted responses fail without logging raw content',async()=>{
  for(const [response,reason] of [[new Response('<html>private diagnostic</html>',{status:503}),'invalid_json'],
    [new Response('private diagnostic'.repeat(5000),{status:503}),'body_too_large'],
    [new Response(null,{status:503}),'missing_body'],
    [new Response(new ReadableStream({start(c){c.error(Error('private diagnostic'));}}),{status:503}),'body_read_failed']]){
    await assert.rejects(checkBriefingHealth('https://example.test',{fetchImpl:async()=>response}),error=>{
      assert.match(error.message,new RegExp(reason));assert.doesNotMatch(error.message,/private diagnostic/);return true;
    });
  }
  const result=healthDiagnostic({healthy:false,token:'private diagnostic',sources:[{...source,error:'private diagnostic',etag:'private diagnostic'}]});
  assert.ok(!JSON.stringify(result).includes('private diagnostic'));
});
