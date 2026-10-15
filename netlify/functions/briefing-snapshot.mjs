import bootstrap from '../../server/briefing/bootstrap.json' with {type:'json'};
import { briefingStore } from '../../server/briefing/store.mjs';
import { hash } from '../../server/briefing/core.mjs';
import { homeView, healthView, boundResponse } from '../../server/briefing/public-view.mjs';

export async function serveSnapshot(request,{load,seed=bootstrap.snapshot,now=Date.now()}={}) {
  let snapshot, storageUnavailable = false;
  try { snapshot = (await load())?.snapshot; } catch { storageUnavailable = true; }
  const seeded = !snapshot;
  snapshot ||= seed;
  let body = {...snapshot,storageStatus:storageUnavailable ? 'unavailable' : seeded ? 'initial-snapshot' : 'ok',
    storageNote:storageUnavailable ? 'The saved briefing could not be read. This dated initial snapshot may be out of date; use original sources.' : seeded ? 'Initial source snapshot. A saved scheduled refresh is not available yet; check the source dates below.' : null};
  const path=new URL(request.url).pathname,health=path==='/api/health';
  if(path==='/api/briefing/home')body=homeView(body,now);
  if(health)body=healthView(body,now);
  const json=health?JSON.stringify(body):boundResponse(body);
  const etag='"'+hash(json)+'"';
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate','Netlify-CDN-Cache-Control':health?'no-store':'public, durable, s-maxage=300, stale-while-revalidate=60','ETag':etag,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Strict-Transport-Security':'max-age=31536000; includeSubDomains','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'X-Frame-Options':'DENY'};
  if(health)headers['Cache-Control']='no-store';
  if(!health && request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});
  return new Response(request.method==='HEAD'?null:json,{status:health&&!body.healthy?503:200,headers});
}
export default async (request,context) => serveSnapshot(request,{load:async()=>briefingStore(context).get('latest-state',{type:'json'})});
export const config={path:['/api/briefing','/api/briefing/home','/api/health'],method:['GET','HEAD']};
