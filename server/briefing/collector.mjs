import { SOURCES, adaptSource, sourceRequestUrl } from './sources.mjs';
import { assembleSnapshot, NORMALIZATION_VERSION } from './core.mjs';

const LIMIT_BYTES = 4 * 1024 * 1024;
export async function readBounded(response, maxBytes = LIMIT_BYTES) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Source response exceeds size limit');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Source returned no body');
  const decoder = new TextDecoder();
  let total = 0, text = '';
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Source response exceeds size limit');
      text += decoder.decode(value,{stream:true});
    }
    return text + decoder.decode();
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
}
export function retryAt(value, now) {
  if (!value) return null;
  const numeric = Number(value);
  const target = Number.isFinite(numeric) ? +new Date(now) + numeric * 1000 : +new Date(value);
  return Number.isFinite(target) && target > +new Date(now) ? new Date(target).toISOString() : null;
}
export async function collectSource(source, prior, {now,fetchImpl = fetch,timeoutMs = 6500,signal} = {}) {
  if (prior?.nextEligibleAt && +new Date(prior.nextEligibleAt) > +new Date(now)) {
    return {source,ok:false,error:'Source requested a later retry; previous data retained',nextEligibleAt:prior.nextEligibleAt};
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  try {
    if (signal?.aborted) controller.abort();
    const headers = {'User-Agent':'OspreyZeroBriefing/1.0 (https://ospreyzero.com/contact/)','Accept':source.format === 'json' ? 'application/geo+json, application/json' : 'application/rss+xml, application/xml, text/xml'};
    // A legacy derivative lacks county keys and may have the former 120-item cap.
    // Download once after normalization changes; failures still retain last-good data.
    const normalized = prior?.normalizationVersion === NORMALIZATION_VERSION;
    if (normalized && prior?.etag) headers['If-None-Match'] = prior.etag;
    if (normalized && prior?.lastModified) headers['If-Modified-Since'] = prior.lastModified;
    const url = sourceRequestUrl(source,{now});
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid configured source URL');
    // Source targets are code-reviewed constants, never visitor data or links from feed items.
    const response = await fetchImpl(url,{headers,signal:controller.signal,redirect:'error'});
    if (response.status === 304 && normalized && prior?.lastSuccessAt) return {source,ok:true,notModified:true,etag:prior.etag,lastModified:prior.lastModified};
    if (!response.ok) return {source,ok:false,error:`Source returned HTTP ${response.status}`,nextEligibleAt:retryAt(response.headers.get('retry-after'),now)};
    const raw = await readBounded(response);
    const parsedFeed = adaptSource(source.id,raw,{now});
    return {source,ok:true,...parsedFeed,etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
  } catch (error) {
    return {source,ok:false,error:controller.signal.aborted ? 'Source check timed out; previous data retained' : 'Source could not be read or validated; previous data retained'};
  } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); }
}
export async function collectBriefing(previous, {now = new Date().toISOString(),sources = SOURCES,fetchImpl = fetch,timeoutMs = 6500,budgetMs = 21000,concurrency = 3} = {}) {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(),budgetMs);
  const results = new Array(sources.length);
  let next = 0;
  try {
    await Promise.all(Array.from({length:Math.min(concurrency,sources.length)},async () => {
      while (next < sources.length) {
        const index = next++, source = sources[index];
        results[index] = await collectSource(source,previous?.sources?.[source.id],{now,fetchImpl,timeoutMs,signal:deadline.signal});
      }
    }));
  } finally { clearTimeout(timer); }
  return assembleSnapshot(previous,results,now);
}
