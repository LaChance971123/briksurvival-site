import bootstrap from '../../server/briefing/bootstrap.json' with {type:'json'};
import { briefingStore } from '../../server/briefing/store.mjs';
import { hash } from '../../server/briefing/core.mjs';

export async function serveSnapshot(request,{load,seed=bootstrap.snapshot}={}) {
  let snapshot, storageUnavailable = false;
  try { snapshot = (await load())?.snapshot; } catch { storageUnavailable = true; }
  const seeded = !snapshot;
  snapshot ||= seed;
  const body = {...snapshot,storageStatus:storageUnavailable ? 'unavailable' : seeded ? 'initial-snapshot' : 'ok',
    storageNote:storageUnavailable ? 'The saved briefing could not be read. This dated initial snapshot may be out of date; use original sources.' : seeded ? 'Initial source snapshot. A saved scheduled refresh is not available yet; check the source dates below.' : null};
  const etag = '"'+hash(body)+'"';
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate','Netlify-CDN-Cache-Control':'public, durable, s-maxage=300, stale-while-revalidate=60','ETag':etag,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
  if (request.headers.get('if-none-match') === etag) return new Response(null,{status:304,headers});
  return new Response(JSON.stringify(body),{status:200,headers});
}
export default async (request,context) => serveSnapshot(request,{load:async () => briefingStore(context).get('latest-state',{type:'json'})});
export const config = {path:'/api/briefing',method:['GET','HEAD']};
