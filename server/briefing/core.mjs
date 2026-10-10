import { createHash } from 'node:crypto';
import { editorialFor, presentationFor } from './editorial.mjs';
import { normalizeNwsGeo } from './sources.mjs';

export const SCHEMA_VERSION = 1;
export const NORMALIZATION_VERSION = 2;
export const PRESENTATION_VERSION = 1;
export const STALE_AFTER_MS = 14 * 60 * 60 * 1000;
export const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_EVENTS_PER_SOURCE = 120;
export const MAX_ACTIVE_NWS_EVENTS = 800;
export const MAX_PUBLIC_EVENTS = 1000;
export const MAX_PUBLIC_EVENT_BYTES = 3 * 1024 * 1024;
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
/** Pure presentation only. Original source fields, hashes and check times survive. */
export function presentEvent(event, {summary = event.summary, eventType = event.eventType, sourceReaderZoneId = event.sourceReaderZoneId} = {}) {
  const context={...event,summary:plainText(summary,16000),eventType:plainText(eventType,120)};
  const display=presentationFor(context);
  const nws=event.source?.kind==='official' && ['nws','nws-cancellations'].includes(event.source.id);
  const zone=nws && typeof sourceReaderZoneId==='string' && /^[A-Z]{2}Z\d{3}$/.test(sourceReaderZoneId) && states.has(sourceReaderZoneId.slice(0,2)) && !sourceReaderZoneId.endsWith('000') ? sourceReaderZoneId : null;
  const sourceUrl=nws ? zone?`https://forecast.weather.gov/MapClick.php?zoneid=${zone}`:'https://www.weather.gov/' : event.url;
  const sourceUrlKind=nws ? zone?'current-zone-forecast':'current-alerts-map' : event.category==='cyber'?'source-catalog':'original-notice';
  const sourceLinkLabel=nws ? zone?`Check current NWS forecast and alerts for zone ${zone}`:'Check current NWS alerts (map)' : event.category==='recall'?'Open the original recall and remedy':event.category==='cyber'?'Open the CISA vulnerability catalog':event.category==='earthquake'?'Open the USGS earthquake record':'Read the original reporting';
  return {...event,...display,...editorialFor({...context,eventType:display.eventType}),sourceUrl,sourceUrlKind,sourceLinkLabel,
    sourceReaderZoneId:zone,presentationVersion:PRESENTATION_VERSION};
}
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
    geo:normalizeNwsGeo(source.kind === 'official' && ['nws','nws-cancellations'].includes(source.id) ? raw.geo : undefined),
    publishedAt, updatedAt:iso(raw.updatedAt) || publishedAt, expiresAt, endsAt, cancelledAt,
    status:cancelledAt || raw.status === 'cancelled' ? 'cancelled' : [expiresAt,endsAt].some(at => at && +new Date(at) <= +new Date(now)) ? 'expired' : 'current',
    urgency: source.kind === 'official' && ['immediate','expected'].includes(raw.urgency) ? raw.urgency : 'unknown',
    lastCheckedAt:iso(now), relatedIds:Array.isArray(raw.relatedIds) ? raw.relatedIds.map(x => plainText(x,1200)).filter(Boolean).slice(0,30) : [],
    attribution:plainText(raw.attribution, 600),
  };
  event.contentHash = hash({...event,lastCheckedAt:null,status:null});
  return presentEvent({...event,updates:[{at:iso(now),kind:'first-seen',text:'First included in this briefing. Check the original source for earlier history.'}]},
    {summary:raw.summary,eventType:raw.eventType,sourceReaderZoneId:raw.sourceReaderZoneId});
}
export function emptyState() { return {schemaVersion:SCHEMA_VERSION,sources:{},snapshot:null}; }
const retentionPriority = event => event.status === 'current' ? 0 : event.status === 'cancelled' ? 1 : 2;
const retentionTime = event => event.status === 'cancelled' ? event.cancelledAt || event.updatedAt : event.updatedAt;
const retentionOrder = (a,b) => retentionPriority(a) - retentionPriority(b) || retentionTime(b).localeCompare(retentionTime(a)) || a.id.localeCompare(b.id);
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
        const incompleteGeography = events.filter(event => event.geo?.incomplete || event.geo?.truncated).length;
        coverage = { ...(typeof result.coverage === 'object' ? result.coverage : {}), label:typeof source.coverage === 'string' ? source.coverage : source.coverage?.label || '', normalizedRejected:rejected, snapshotCapped:false,
          incompleteGeography, status:rejected || incompleteGeography || result.coverage?.status === 'partial' ? 'partial' : 'ok'};
      } else {
        events = events.map(event => ({...event,lastCheckedAt:now}));
      }
    }
    events = events.map(event => {
      const dated={...event,status:event.status !== 'cancelled' && [event.expiresAt,event.endsAt].some(at => at && +new Date(at) <= +new Date(now)) ? 'expired' : event.status};
      return dated.presentationVersion===PRESENTATION_VERSION?dated:presentEvent(dated);
    });
    sources[source.id] = {
      id:source.id,name:source.name,kind:source.kind,website:source.website,
      status:success ? 'ok' : prior?.lastSuccessAt ? 'stale' : 'unavailable',
      normalizationVersion:success && !result.notModified ? NORMALIZATION_VERSION : prior?.normalizationVersion || null,
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
  // Apply cancellations before any cap. Current records precede cancellation history;
  // recent explicit withdrawals precede other history and have their own source lane.
  // Source and public caps are separate: storedCount must not be called displayedCount.
  for (const source of Object.values(sources)) {
    const limit = source.id === 'nws' ? MAX_ACTIVE_NWS_EVENTS : MAX_EVENTS_PER_SOURCE;
    const dropped = Math.max(0,source.events.length - limit);
    source.events = source.events.sort(retentionOrder).slice(0,limit);
    source.coverage = {...source.coverage,limit,storedCount:source.events.length,sourceDroppedCount:dropped,
      publicDroppedCount:0,publicCount:0};
    if (dropped) source.coverage = {...source.coverage,status:'partial',snapshotCapped:true};
  }
  // Cross-source URL copies are a single reporting origin, never corroboration.
  const unique = new Map();
  for (const event of Object.values(sources).flatMap(source => source.events)) {
    const key = event.source.kind === 'news' ? `news:${event.url}` : event.id;
    const old = unique.get(key);
    if (!old || event.status === 'cancelled' || event.updatedAt > old.updatedAt) unique.set(key,event);
  }
  const publicEvents = [...unique.values()].sort(retentionOrder);
  let bytes = 0;
  const boundedEvents = [];
  for (const event of publicEvents) {
    const size = Buffer.byteLength(JSON.stringify(event));
    const source = sources[event.source.id];
    if (boundedEvents.length >= MAX_PUBLIC_EVENTS || bytes + size > MAX_PUBLIC_EVENT_BYTES) {
      source.coverage = {...source.coverage,status:'partial',snapshotCapped:true,publicDroppedCount:source.coverage.publicDroppedCount + 1};
      continue;
    }
    bytes += size; boundedEvents.push(event);
    source.coverage.publicCount += 1;
  }
  boundedEvents.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  const snapshot = {
    schemaVersion:SCHEMA_VERSION,id:'briefing-' + now.replace(/[^0-9]/g,''),generatedAt:now,
    lastSuccessfulAt:anySuccess ? now : state.snapshot?.lastSuccessfulAt || null,
    schedule:{cron:'0 0,12 * * *',label:'Twice daily · 00:00 and 12:00 UTC'},coverage:COVERAGE,
    sources:Object.values(sources).map(({events,etag,lastModified,nextEligibleAt,...publicSource}) => publicSource),
    events:boundedEvents,
  };
  return {schemaVersion:SCHEMA_VERSION,sources,snapshot};
}

/** Rebuild an existing captured derivative without fetching or changing collection
 * timestamps. Do not pass an earlier raw feed here as if it were a newer check. */
export function refreshStoredPresentation(state) {
  const sources=Object.fromEntries(Object.entries(state.sources || {}).map(([id,source])=>[id,{...source,
    coverage:{...source.coverage},events:(source.events || []).map(event=>presentEvent(event))}]));
  const byId=new Map(Object.values(sources).flatMap(source=>source.events).map(event=>[event.id,event]));
  const candidates=(state.snapshot?.events || []).map(event=>byId.get(event.id) || presentEvent(event)).sort(retentionOrder);
  const events=[];let bytes=0;
  const counts=new Map(),drops=new Map();
  for(const event of candidates) {
    const size=Buffer.byteLength(JSON.stringify(event));
    if(events.length>=MAX_PUBLIC_EVENTS || bytes+size>MAX_PUBLIC_EVENT_BYTES) {drops.set(event.source.id,(drops.get(event.source.id)||0)+1);continue;}
    bytes+=size;events.push(event);counts.set(event.source.id,(counts.get(event.source.id)||0)+1);
  }
  for(const [id,source] of Object.entries(sources)) {
    source.coverage={...source.coverage,publicCount:counts.get(id)||0};
    if(drops.has(id))source.coverage={...source.coverage,status:'partial',snapshotCapped:true,publicDroppedCount:(source.coverage.publicDroppedCount||0)+drops.get(id)};
  }
  events.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  return {...state,sources,snapshot:{...state.snapshot,presentationVersion:PRESENTATION_VERSION,
    sources:(state.snapshot?.sources || []).map(source=>({...source,coverage:sources[source.id]?.coverage || source.coverage})),events}};
}
