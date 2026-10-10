import { getStore, getDeployStore } from '@netlify/blobs';
export const STORE_NAME = 'osprey-briefing-v1';
/** Bound both headers and body. Terminate retryable failures locally: the SDK's
 * default five retries with 5s waits exceed a 30s scheduled invocation. A local
 * 400 is a terminal SDK error, never reported as the upstream HTTP status. */
export function boundedStorageFetch({fetchImpl=fetch,timeoutMs=2000,deadline=Infinity}={}) {
  return async (url,options={}) => {
    const remaining = Math.min(timeoutMs,deadline-Date.now());
    const failed = () => new Response('{"error":"Briefing storage unavailable within time budget"}',{status:400,headers:{'content-type':'application/json'}});
    if (remaining <= 0) return failed();
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),remaining);
    try {
      const response = await fetchImpl(url,{...options,signal:controller.signal});
      if (response.status === 429 || response.status >= 500 || response.status === 403) { await response.body?.cancel();return failed(); }
      const body = response.status === 204 || response.status === 304 || options.method?.toUpperCase() === 'HEAD' ? null : await response.arrayBuffer();
      return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
    } catch { return failed(); } finally { clearTimeout(timer); }
  };
}
export function briefingStore(context,{deadline=Infinity}={}) {
  const options={name:STORE_NAME,consistency:'strong',fetch:boundedStorageFetch({deadline})};
  // Preview code cannot write or read the production store. No user tokens required.
  return context?.deploy?.context === 'production' ? getStore(options) : getDeployStore(options);
}
export async function saveState(store,state) {
  const slot = Math.floor(+new Date(state.snapshot.generatedAt) / (12*60*60*1000)) % 28;
  // 28 bounded half-day versions; latest is always one complete atomic value.
  await store.setJSON(`versions/slot-${String(slot).padStart(2,'0')}`,state.snapshot);
  await store.setJSON('latest-state',state);
}
