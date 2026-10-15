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
  const sources=body.sources.map(({id,status,lastSuccessAt})=>({id,status,lastSuccessAt,healthy:status==='ok' && time(lastSuccessAt)>0 && time(lastSuccessAt)<=now+300000 && now-time(lastSuccessAt)<=14*3600000}));
  const healthy=body.storageStatus==='ok' && time(body.generatedAt)>0 && time(body.generatedAt)<=now+300000 && now-time(body.generatedAt)<=14*3600000 && sources.length>0 && sources.every(s=>s.healthy);
  return {healthy,storageStatus:body.storageStatus,generatedAt:body.generatedAt,sources};
}
export function boundResponse(body, maxBytes=3*1024*1024) {
  let json=JSON.stringify(body);
  if(Buffer.byteLength(json)<=maxBytes)return json;
  const events=body.events.slice();let omitted=0;
  // Never mutate the saved snapshot. Keep explicit disclosure on the public copy.
  do { events.pop();omitted++;json=JSON.stringify({...body,events,responseOmittedRecords:omitted,storageNote:[body.storageNote,`${omitted} record(s) omitted to fit this response; coverage is incomplete.`].filter(Boolean).join(' ')}); } while(events.length && Buffer.byteLength(json)>maxBytes);
  return json;
}
