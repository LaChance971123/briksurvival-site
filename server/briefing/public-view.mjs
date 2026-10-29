// Compact public views retain source provenance and freshness, never re-date records.
const time = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
const current = (e, now) => e.status === 'current' && e.relevance !== 'background' && !e.cancelledAt && (!e.expiresAt || time(e.expiresAt)>now) && (!e.endsAt || time(e.endsAt)>now);
export function homeView(body, now=Date.now()) {
  const sources=new Map(body.sources.map(s=>[s.id,s]));
  const pool=body.events.filter(e=>current(e,now)), chosen=[],categories=new Set(),origins=new Set();
  const stale=e=>{const s=sources.get(e.source.id);return !s || s.status!=='ok' || !time(s.lastSuccessAt) || now-time(s.lastSuccessAt)>14*3600000;};
  while(pool.length && chosen.length<12) {
    pool.sort((a,b)=>Number(stale(a))-Number(stale(b)) || Number(categories.has(a.category))-Number(categories.has(b.category)) || Number(a.source.kind==='news')-Number(b.source.kind==='news') || Number(origins.has(a.source.id))-Number(origins.has(b.source.id)) || time(b.updatedAt||b.publishedAt)-time(a.updatedAt||a.publishedAt) || a.id.localeCompare(b.id));
    const event=pool.shift();categories.add(event.category);origins.add(event.source.id);
    const {instructions,updates,geo,sourceText,...card}=event;
    chosen.push({...card,summary:(card.summary||'').slice(0,600),...(sourceText?{sourceText:{...sourceText,text:(sourceText.text||'').slice(0,600),mode:'excerpt'}}:{})});
  }
  return {...body,view:'home',totalRecords:body.events.length,events:chosen};
}
export function healthView(body,now=Date.now()) {
  const freshnessLimitSeconds=14*3600;
  const assessTime=(value,prefix)=>{
    const at=time(value),reasons=[];
    if(at<=0)reasons.push(`${prefix}_timestamp_invalid`);
    else if(at>now+300000)reasons.push(`${prefix}_timestamp_future`);
    else if(now-at>freshnessLimitSeconds*1000)reasons.push(`${prefix}_overdue`);
    return {ageSeconds:at>0?Math.floor((now-at)/1000):null,reasons};
  };
  const sources=body.sources.map(({id,status,lastSuccessAt,lastAttemptAt})=>{
    const {ageSeconds,reasons}=assessTime(lastSuccessAt,'source');
    if(status!=='ok')reasons.unshift('source_check_failed');
    return {id,status,lastSuccessAt,lastAttemptAt,healthy:reasons.length===0,ageSeconds,reasons};
  });
  const {ageSeconds:snapshotAgeSeconds,reasons}=assessTime(body.generatedAt,'snapshot');
  if(body.storageStatus!=='ok')reasons.unshift(body.storageStatus==='initial-snapshot'?'snapshot_missing':'storage_unavailable');
  if(!sources.length)reasons.push('sources_missing');
  if(sources.some(s=>!s.healthy))reasons.push('sources_unhealthy');
  return {healthy:reasons.length===0,storageStatus:body.storageStatus,generatedAt:body.generatedAt,
    snapshotId:body.id,checkedAt:new Date(now).toISOString(),freshnessLimitSeconds,snapshotAgeSeconds,reasons,sources};
}
export function boundResponse(body, maxBytes=3*1024*1024) {
  let json=JSON.stringify(body);
  if(Buffer.byteLength(json)<=maxBytes)return json;
  const events=body.events.slice();let omitted=0;
  // Never mutate the saved snapshot. Keep explicit disclosure on the public copy.
  do { events.pop();omitted++;json=JSON.stringify({...body,events,responseOmittedRecords:omitted,storageNote:[body.storageNote,`${omitted} record(s) omitted to fit this response; coverage is incomplete.`].filter(Boolean).join(' ')}); } while(events.length && Buffer.byteLength(json)>maxBytes);
  return json;
}
