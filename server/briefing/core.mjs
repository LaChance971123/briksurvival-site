import { createHash } from 'node:crypto';
import { editorialFor } from './editorial.mjs';

export const SCHEMA_VERSION = 1;
export const STALE_AFTER_MS = 14 * 60 * 60 * 1000;
export const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_EVENTS_PER_SOURCE = 120;
export const COVERAGE = 'Selected US weather and recall sources, significant earthquakes worldwide, CISA vulnerabilities and a limited rights-cleared news selection. Not every hazard, place or source is covered. Short-lived notices can appear and end between updates. No listed item never means all clear.';
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function plainText(value, limit = 1600) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).slice(0, 100000)
    .replace(/<(script|style|iframe|object|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, n) => { const point = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1),16) : parseInt(n,10); return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''; })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, name) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[name.toLowerCase()]))
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}
export function safeURL(value, hosts) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const host = u.hostname.toLowerCase();
    if (hosts && !hosts.some(allowed => host === allowed || host.endsWith('.' + allowed))) return null;
    if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(host)) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) u.searchParams.delete(key);
    return u.href;
  } catch { return null; }
}
export function iso(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isFinite(+date) ? date.toISOString() : null;
}
const states = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR VI GU AS MP'.split(' '));
export function normalizeEvent(raw, source, now) {
  if (!raw || typeof raw !== 'object') return null;
  const title = plainText(raw.title, 240);
  const url = safeURL(raw.url, source.allowedHosts);
  const publishedAt = iso(raw.publishedAt);
  const sourceEventId = plainText(raw.id, 1200);
  if (!title || !url || !sourceEventId || !publishedAt || Date.parse(publishedAt) > +new Date(now) + 5 * 60000) return null;
  const expiresAt = iso(raw.expiresAt), endsAt = iso(raw.endsAt), cancelledAt = iso(raw.cancelledAt);
  const category = ['weather','earthquake','recall','cyber','news'].includes(raw.category) ? raw.category : 'news';
  const codes = [...new Set(Array.isArray(raw.location?.codes) ? raw.location.codes.filter(x => states.has(x)) : [])];
  const location = {
    label: plainText(raw.location?.label, 500) || 'Location not established by this source',
    scope: ['US','International'].includes(raw.location?.scope) ? raw.location.scope : 'Unknown',
    codes,
    precision: plainText(raw.location?.precision, 100) || 'unknown',
  };
  const instructionText = source.kind === 'official' ? plainText(raw.instructions,12001) : '';
  const instructionsOmitted = instructionText.length > 12000;
  const event = {
    id: source.id + '-' + hash(sourceEventId).slice(0, 20), sourceEventId,
    source: {id:source.id,name:source.name,kind:source.kind,rightsUrl:source.rights.url,rightsLabel:source.rights.label,licenseUrl:source.rights.licenseUrl || null},
    category, title, summary:plainText(raw.summary, 620), instructions:instructionsOmitted ? '' : instructionText,instructionsOmitted, url, location,
    publishedAt, updatedAt:iso(raw.updatedAt) || publishedAt, expiresAt, endsAt, cancelledAt,
    status:cancelledAt || raw.status === 'cancelled' ? 'cancelled' : [expiresAt,endsAt].some(at => at && +new Date(at) <= +new Date(now)) ? 'expired' : 'current',
    urgency: source.kind === 'official' && ['immediate','expected'].includes(raw.urgency) ? raw.urgency : 'unknown',
    lastCheckedAt:iso(now), relatedIds:Array.isArray(raw.relatedIds) ? raw.relatedIds.map(x => plainText(x,1200)).filter(Boolean).slice(0,30) : [],
    attribution:plainText(raw.attribution, 600),
  };
  event.contentHash = hash({...event,lastCheckedAt:null,status:null});
  return {...event,...editorialFor(event),updates:[{at:iso(now),kind:'first-seen',text:'First included in this briefing. Check the original source for earlier history.'}]};
}
export function emptyState() { return {schemaVersion:SCHEMA_VERSION,sources:{},snapshot:null}; }
export function assembleSnapshot(previous, results, now = new Date().toISOString()) {
  const state = previous?.schemaVersion === SCHEMA_VERSION ? previous : emptyState();
  const sources = {};
  let anySuccess = false;
  for (const result of results) {
    const {source} = result;
    const prior = state.sources[source.id];
    const excludedIds = new Set((result.excludedIds || []).map(id => plainText(id,1200)).filter(Boolean));
    const candidateEvents = (result.events || []).map(raw => normalizeEvent(raw,source,now)).filter(event => event && !excludedIds.has(event.sourceEventId));
    const allInvalid = !result.notModified && result.events?.length > 0 && candidateEvents.length === 0;
    const success = !allInvalid && (result.ok || (result.notModified && prior?.lastSuccessAt));
    // Explicit rights removal dominates duplicate, validation-failure and retention paths.
    let events = (prior?.events || []).filter(event => !excludedIds.has(event.sourceEventId));
    let coverage = prior?.coverage || {label:source.coverage,status:'partial'};
    if (success) {
      anySuccess = true;
      if (!result.notModified) {
        const normalized = candidateEvents;
        const before = new Map(events.map(e => [e.id,e]));
        const deduped = new Map();
        for (const event of normalized) {
          const current = deduped.get(event.id);
          if (!current || event.updatedAt >= current.updatedAt || event.status === 'cancelled') deduped.set(event.id,event);
        }
        events = [...deduped.values()].map(event => {
          const old = before.get(event.id);
          return {...event,updates:old ? [...(old.updates || []),...(old.contentHash !== event.contentHash ? [{at:now,kind:'source-update',text:'The source record changed. This briefing reflects the newly retrieved version; consult the source for its correction history.'}] : [])].slice(-6) : event.updates};
        });
        for (const old of before.values()) {
          if (source.kind !== 'news' && !excludedIds.has(old.sourceEventId) && !deduped.has(old.id) && +new Date(now) - +new Date(old.updatedAt || old.publishedAt) <= RETENTION_MS) {
            events.push({...old,status:old.status === 'cancelled' ? 'cancelled' : [old.expiresAt,old.endsAt].some(at => at && +new Date(at) <= +new Date(now)) ? 'expired' : 'no-longer-listed'});
          }
        }
        const rejected = (result.events || []).length - normalized.length;
        const capped = events.length > MAX_EVENTS_PER_SOURCE;
        coverage = { ...(typeof result.coverage === 'object' ? result.coverage : {}), label:typeof source.coverage === 'string' ? source.coverage : source.coverage?.label || '', normalizedRejected:rejected, snapshotCapped:capped,
          status:rejected || capped || result.coverage?.status === 'partial' ? 'partial' : 'ok'};
        events.sort((a,b) => (a.status === 'current' ? 0 : 1) - (b.status === 'current' ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt));
        events = events.slice(0,MAX_EVENTS_PER_SOURCE);
        coverage.storedCount = events.length; coverage.limit = MAX_EVENTS_PER_SOURCE;
      } else {
        events = events.map(event => ({...event,lastCheckedAt:now}));
      }
    }
    events = events.map(event => ({...event,status:event.status !== 'cancelled' && [event.expiresAt,event.endsAt].some(at => at && +new Date(at) <= +new Date(now)) ? 'expired' : event.status}));
    sources[source.id] = {
      id:source.id,name:source.name,kind:source.kind,website:source.website,
      status:success ? 'ok' : prior?.lastSuccessAt ? 'stale' : 'unavailable',
      lastSuccessAt:success ? now : prior?.lastSuccessAt || null,lastAttemptAt:now,
      error:success ? null : plainText(result.error,160) || (allInvalid ? 'Source items failed validation; previous data retained' : 'Source check unavailable'),
      coverage, etag:success ? result.etag || prior?.etag || null : prior?.etag || null,
      lastModified:success ? result.lastModified || prior?.lastModified || null : prior?.lastModified || null,
      nextEligibleAt:result.nextEligibleAt || null, events,
    };
  }
  // CAP references connect explicit cancels to previous alerts; absence alone is never cancellation.
  const all = Object.values(sources).flatMap(source => source.events);
  const cancellations = all.filter(event => event.status === 'cancelled' && event.source.id.startsWith('nws'));
  for (const cancel of cancellations) {
    for (const event of all) {
      if (event.source.id.startsWith('nws') && cancel.relatedIds.includes(event.sourceEventId)) {
        event.status='cancelled';event.cancelledAt=cancel.cancelledAt || cancel.updatedAt;
        if (!event.updates.some(update => update.kind === 'cancellation' && update.at === event.cancelledAt)) event.updates = [...event.updates,{at:event.cancelledAt,kind:'cancellation',text:'An explicit source cancellation references this notice. This does not establish that all hazards have ended.'}].slice(-6);
      }
    }
  }
  // Cross-source URL copies are a single reporting origin, never corroboration.
  const unique = new Map();
  for (const event of all) {
    const key = event.source.kind === 'news' ? `news:${event.url}` : event.id;
    const old = unique.get(key);
    if (!old || event.status === 'cancelled' || event.updatedAt > old.updatedAt) unique.set(key,event);
  }
  const publicEvents = [...unique.values()].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  let bytes = 0;
  const boundedEvents = publicEvents.filter(event => {
    const size = Buffer.byteLength(JSON.stringify(event));
    if (bytes + size > 3 * 1024 * 1024) {
      sources[event.source.id].coverage = {...sources[event.source.id].coverage,status:'partial',snapshotCapped:true};
      return false;
    }
    bytes += size; return true;
  }).slice(0,500);
  if (boundedEvents.length < publicEvents.length) {
    for (const event of publicEvents.slice(500)) sources[event.source.id].coverage = {...sources[event.source.id].coverage,status:'partial',snapshotCapped:true};
  }
  const snapshot = {
    schemaVersion:SCHEMA_VERSION,id:'briefing-' + now.replace(/[^0-9]/g,''),generatedAt:now,
    lastSuccessfulAt:anySuccess ? now : state.snapshot?.lastSuccessfulAt || null,
    schedule:{cron:'0 0,12 * * *',label:'Twice daily · 00:00 and 12:00 UTC'},coverage:COVERAGE,
    sources:Object.values(sources).map(({events,etag,lastModified,nextEligibleAt,...publicSource}) => publicSource),
    events:boundedEvents,
  };
  return {schemaVersion:SCHEMA_VERSION,sources,snapshot};
}
