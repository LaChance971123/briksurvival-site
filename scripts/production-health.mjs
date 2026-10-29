// Keep failure evidence even on HTTP 503. No retries, collection calls or raw-body logging.
const text=value=>typeof value==='string'?value.slice(0,160):null;
const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const reasons=value=>Array.isArray(value)?value.slice(0,10).map(text):[];
export function healthDiagnostic(body) {
  return {healthy:body?.healthy===true,storageStatus:text(body?.storageStatus),
    snapshotId:text(body?.snapshotId),generatedAt:text(body?.generatedAt),checkedAt:text(body?.checkedAt),
    snapshotAgeSeconds:number(body?.snapshotAgeSeconds),freshnessLimitSeconds:number(body?.freshnessLimitSeconds),
    reasons:reasons(body?.reasons),sources:Array.isArray(body?.sources)?body.sources.slice(0,32).map(s=>({
      id:text(s?.id),status:text(s?.status),healthy:s?.healthy===true,lastSuccessAt:text(s?.lastSuccessAt),
      lastAttemptAt:text(s?.lastAttemptAt),ageSeconds:number(s?.ageSeconds),reasons:reasons(s?.reasons)})):[]};
}
async function readHealth(response) {
  const reader=response.body?.getReader();
  if(!reader)throw Error('missing_body');
  const chunks=[];let size=0;
  try {
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>64*1024)throw Error('body_too_large');
      chunks.push(value);
    }
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
    catch{throw Error('invalid_json');}
  } finally { await reader.cancel().catch(()=>{}); }
}
export async function checkBriefingHealth(origin,{fetchImpl=fetch}={}) {
  const response=await fetchImpl(origin+'/api/health',{signal:AbortSignal.timeout(20000),redirect:'error'});
  const diagnostic={observedAt:new Date().toISOString(),httpStatus:response.status,
    requestId:text(response.headers.get('x-nf-request-id')),responseDate:text(response.headers.get('date'))};
  let body;
  try{body=await readHealth(response);}
  catch(error){
    // Only fixed parser categories are exposed; stream/transport errors may contain private details.
    diagnostic.bodyError=['missing_body','body_too_large','invalid_json'].includes(error.message)?error.message:'body_read_failed';
    throw Error(`/api/health: HTTP ${response.status} ${JSON.stringify(diagnostic)}`);
  }
  Object.assign(diagnostic,healthDiagnostic(body));
  if(!response.ok||body?.healthy!==true)throw Error(`/api/health: HTTP ${response.status} ${JSON.stringify(diagnostic)}`);
  return diagnostic;
}
