import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, SOURCE_BY_ID, sourceRequestUrl, adaptSource, normalizeNwsGeo } from './sources.mjs';

const NOW = '2026-10-10T12:00:00Z';
const at = (id, data) => adaptSource(id, data, { now: NOW });
const collection = (features, extra = {}) => ({ type: 'FeatureCollection', features, ...extra });
function alert(overrides = {}, id = 'urn:test:alert') {
  return { id: `https://api.weather.gov/alerts/${id}`, properties: {
    id, status: 'Actual', scope: 'Public', messageType: 'Alert', event: 'Flood Warning',
    headline: 'Flood warning for example county', description: 'River flooding is expected.',
    instruction: 'Avoid flooded roads.', areaDesc: 'Example County', geocode: { UGC: ['ORC001'] },
    sent: '2026-10-10T08:00:00-04:00', expires: '2026-10-10T18:00:00Z', ends: '2026-10-10T19:00:00Z',
    urgency: 'Immediate', references: [], ...overrides,
  } };
}
function quake(overrides = {}, id = 'us-example') {
  return { id, geometry: { type: 'Point', coordinates: [-155, 19, 12] }, properties: {
    type: 'earthquake', title: 'M 6.1 - Example location', place: '5 km E of Example, Hawaii', mag: 6.1,
    time: Date.parse('2026-10-09T22:00:00Z'), updated: Date.parse('2026-10-10T01:00:00Z'),
    url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`, ...overrides,
  } };
}
const recall = (overrides = {}) => ({ RecallID: 1234, RecallNumber: '26123', Title: 'Example heater recalled',
  RecallDate: '2026-10-08T00:00:00', LastPublishDate: '2026-10-09T00:00:00',
  URL: 'https://www.cpsc.gov/Recalls/2026/example', Description: 'Example product.',
  Hazards: [{ Name: 'Overheating can cause a fire.' }], Remedies: [{ Name: 'Stop use and follow the recall remedy.' }],
  ManufacturerCountries: [{ Country: 'China' }], Retailers: [{ Name: 'Example store in Texas' }], ...overrides });
const kev = (overrides = {}) => ({ cveID: 'CVE-2026-12345', vulnerabilityName: 'Example software vulnerability',
  shortDescription: 'A flaw affects Example software.', requiredAction: 'Apply vendor mitigations.',
  dateAdded: '2026-10-09', dueDate: '2026-10-10', knownRansomwareCampaignUse: 'Known', ...overrides });
const catalog = (items) => ({ catalogVersion: '2026.10.09', dateReleased: '2026-10-09T18:00:00Z', count: items.length, vulnerabilities: items });
const rss = (items, extra = '') => `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Test source</title>${extra}${items}</channel></rss>`;
function rssItem({ title = 'Flooding displaces residents', link = 'https://globalvoices.org/2026/10/09/example/',
  date = 'Fri, 09 Oct 2026 12:00:00 +0000', description = 'Flooding has displaced residents and damaged homes.',
  authors = ['Example Writer'], body = '', category = '', guid = '' } = {}) {
  return `<item><title><![CDATA[${title}]]></title><link>${link.replaceAll('&', '&amp;')}</link><pubDate>${date}</pubDate>${guid ? `<guid>${guid}</guid>` : ''}<description><![CDATA[${description}]]></description>${authors.map((author) => `<dc:creator>${author}</dc:creator>`).join('')}${body ? `<content:encoded><![CDATA[${body}]]></content:encoded>` : ''}${category ? `<category>${category}</category>` : ''}</item>`;
}

test('every configured source has explicit provenance, fixed HTTPS feed and permitted fields', () => {
  assert.equal(SOURCES.length, 8);
  assert.equal(SOURCE_BY_ID.size, 8);
  for (const source of SOURCES) {
    assert.equal(new URL(source.url).protocol, 'https:');
    assert.equal(new URL(source.rights.url).protocol, 'https:');
    assert.ok(source.allowedHosts.length);
    assert.ok(source.rights.allowedFields.length);
    assert.ok(source.coverage);
    assert.ok(['official', 'news'].includes(source.kind));
    assert.ok(!source.rights.allowedFields.includes('images'));
  }
  assert.equal(SOURCE_BY_ID.get('eff').rights.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(SOURCE_BY_ID.get('global-voices').rights.licenseUrl, 'https://creativecommons.org/licenses/by/3.0/');
});

test('CPSC query uses a bounded documented last-published window, and ignores caller URL overrides', () => {
  const url = new URL(sourceRequestUrl({ id: 'cpsc', url: 'https://attacker.example/' }, { now: NOW }));
  assert.equal(url.hostname, 'www.saferproducts.gov');
  assert.equal(url.searchParams.get('LastPublishDateStart'), '2026-09-10');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(sourceRequestUrl('nws', { now: NOW }), SOURCE_BY_ID.get('nws').url);
  assert.throws(() => sourceRequestUrl('unknown'), /Unknown/);
  assert.throws(() => sourceRequestUrl('cpsc', { now: 'not a date' }), /Invalid/);
});

test('NWS preserves exact source expiry and verified state UGCs', () => {
  const [event] = at('nws', collection([alert()])).events;
  assert.equal(event.id, 'urn:test:alert');
  assert.equal(event.publishedAt, NOW.replace('Z', '.000Z'));
  assert.equal(event.expiresAt, '2026-10-10T18:00:00.000Z');
  assert.equal(event.endsAt, '2026-10-10T19:00:00.000Z');
  assert.equal(event.status, 'current');
  assert.equal(event.urgency, 'immediate');
  assert.deepEqual(event.location.codes, ['OR']);
  assert.equal(event.instructions, 'Avoid flooded roads.');
});

test('NWS handles explicit cancellation and references across active/cancellation lanes', () => {
  const cancellation = alert({ messageType: 'Cancel', references: [
    { identifier: 'urn:test:old', '@id': 'https://api.weather.gov/alerts/urn:test:old' },
    { '@id': 'https://api.weather.gov/alerts/urn:test:older' },
  ] }, 'urn:test:cancel');
  const [event] = at('nws-cancellations', collection([cancellation])).events;
  assert.equal(event.status, 'cancelled');
  assert.equal(event.cancelledAt, '2026-10-10T12:00:00.000Z');
  assert.deepEqual(event.relatedIds, ['urn:test:old', 'urn:test:older']);
  assert.equal(event.sourceId, 'nws-cancellations');
});

test('NWS CAP-style msgType and references string are supported', () => {
  const item = alert({ messageType: undefined, msgType: 'Cancel', references: 'sender,urn:test:old,2026-10-10T01:00:00Z sender,urn:test:older,2026-10-10T02:00:00Z' });
  assert.deepEqual(at('nws', collection([item])).events[0].relatedIds, ['urn:test:old', 'urn:test:older']);
});

test('NWS past expiry is expired, and cancellation takes precedence', () => {
  assert.equal(at('nws', collection([alert({ expires: '2026-10-10T11:00:00Z' })])).events[0].status, 'expired');
  assert.equal(at('nws', collection([alert({ ends: '2026-10-10T11:00:00Z' })])).events[0].status, 'expired');
  assert.equal(at('nws', collection([alert({ messageType: 'Cancel', expires: '2026-10-10T11:00:00Z' })])).events[0].status, 'cancelled');
});

test('NWS missing records never generate synthetic cancellation or all-clear', () => {
  const result = at('nws', collection([]));
  assert.deepEqual(result.events, []);
  assert.equal(result.coverage.status, 'ok');
  assert.equal(result.coverage.receivedCount, 0);
});

test('NWS tests, exercises and private alerts are excluded', () => {
  const result = at('nws', collection([alert({ status: 'Test' }), alert({ status: 'Exercise' }), alert({ scope: 'Private' }), alert()]));
  assert.equal(result.events.length, 1);
  assert.equal(result.coverage.skippedCount, 3);
});

test('NWS marine, unrecognised and missing geography never invent state codes', () => {
  const [marine] = at('nws', collection([alert({ geocode: { UGC: ['AMZ555', 'XXZ001', 'oregon', 'ORZ123', 'ORC001'] } })])).events;
  assert.deepEqual(marine.location.codes, ['OR']);
  const [missing] = at('nws', collection([alert({ geocode: {}, areaDesc: null, senderName: 'NWS New York NY' })])).events;
  assert.deepEqual(missing.location.codes, []);
  assert.equal(missing.location.precision, 'unknown');
});

test('NWS pagination and capped cancellation response are explicitly partial', () => {
  const result = at('nws-cancellations', collection([alert()], { pagination: { next: 'https://attacker.example/next' } }));
  assert.equal(result.coverage.status, 'partial');
  assert.match(result.coverage.warnings[0], /truncated/);
  const full = Array.from({ length: 100 }, (_, i) => alert({}, `urn:test:${i}`));
  assert.equal(at('nws-cancellations', collection(full)).coverage.status, 'partial');
});

test('NWS duplicates keep the newer source update and count omissions', () => {
  const result = at('nws', collection([alert({ sent: '2026-10-10T10:00:00Z', headline: 'Older' }), alert({ sent: '2026-10-10T11:00:00Z', headline: 'Newer' }), alert({ sent: '2026-10-10T09:00:00Z', headline: 'Oldest' })]));
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].title, 'Newer');
  assert.equal(result.coverage.duplicatesRemoved, 2);
});

test('individual malformed source records do not erase valid neighbors', () => {
  const result = at('nws', collection([alert(), null, alert({ sent: 'bad date' }), alert({ messageType: 'Unrecognised' })]));
  assert.equal(result.events.length, 1);
  assert.equal(result.coverage.rejectedCount, 3);
  assert.equal(result.coverage.status, 'partial');
});

test('USGS reports observations, not inferred tsunami warnings or completed hazards', () => {
  const [event] = at('usgs', collection([quake({ tsunami: 1 })])).events;
  assert.equal(event.category, 'earthquake');
  assert.equal(event.urgency, 'unknown');
  assert.equal(event.endsAt, null);
  assert.equal(event.expiresAt, null);
  assert.equal(event.status, 'current');
  assert.doesNotMatch(event.summary, /tsunami warning/i);
  assert.deepEqual(event.location.codes, ['HI']);
  assert.equal(event.location.precision, 'epicenter-place');
});

test('USGS country comes from explicit place, not US network ID or coordinates', () => {
  assert.equal(at('usgs', collection([quake({ place: '10 km E of Example, Japan' })])).events[0].location.scope, 'International');
  assert.equal(at('usgs', collection([quake({ place: null })])).events[0].location.scope, 'Unknown');
  assert.equal(at('usgs', collection([quake({ place: 'Unmapped ocean location' })])).events[0].location.scope, 'Unknown');
  assert.equal(at('usgs', collection([quake({ place: 'Georgia' })])).events[0].location.scope, 'Unknown');
});

test('USGS excludes non-earthquakes and checks feed metadata counts', () => {
  const result = at('usgs', collection([quake({ type: 'explosion' }), quake()], { metadata: { status: 200, count: 3 } }));
  assert.equal(result.events.length, 1);
  assert.equal(result.coverage.skippedCount, 1);
  assert.equal(result.coverage.status, 'partial');
});

test('CPSC retains hazards/remedies without pretending manufacturing location is distribution', () => {
  const [event] = at('cpsc', [recall()]).events;
  assert.equal(event.summary, 'Overheating can cause a fire.');
  assert.equal(event.instructions, 'Stop use and follow the recall remedy.');
  assert.equal(event.updatedAt, '2026-10-09T00:00:00.000Z');
  assert.equal(event.publishedAt, '2026-10-08T00:00:00.000Z');
  assert.equal(event.location.scope, 'US');
  assert.deepEqual(event.location.codes, []);
  assert.equal(event.endsAt, null);
  assert.equal(event.expiresAt, null);
  assert.ok(!('Images' in event));
});

test('CPSC revised recalls deduplicate by stable recall ID', () => {
  const result = at('cpsc', [recall(), recall({ LastPublishDate: '2026-10-10T00:00:00', Title: 'Expanded recall' })]);
  assert.equal(result.events[0].title, 'Expanded recall');
  assert.equal(result.coverage.duplicatesRemoved, 1);
});

test('FDA supports current RSS dates and known-host HTTP links without guessing state', () => {
  const input = rss(rssItem({ link: 'http://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/example', title: 'Example recall', date: 'Fri, 09 Oct 2026 15:08:00 EDT', description: 'A company in Connecticut recalls a product.' }));
  const [event] = at('fda', input).events;
  assert.equal(event.url, 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/example');
  assert.equal(event.publishedAt, '2026-10-09T19:08:00.000Z');
  assert.deepEqual(event.location.codes, []);
  assert.equal(event.status, 'current');
  assert.equal(event.expiresAt, null);
});

test('KEV is a vulnerability record, with neither incident location nor due-date expiry', () => {
  const [event] = at('cisa-kev', catalog([kev()])).events;
  assert.equal(event.category, 'cyber');
  assert.match(event.summary, /^Known exploited vulnerability:/);
  assert.equal(event.location.scope, 'Unknown');
  assert.equal(event.expiresAt, null);
  assert.equal(event.endsAt, null);
  assert.equal(event.urgency, 'unknown');
  assert.equal(event.status, 'current');
  assert.equal(event.publishedAt, '2026-10-09T00:00:00.000Z');
});

test('KEV rejects invalid CVEs independently and never attributes catalog release time to every record', () => {
  const result = at('cisa-kev', catalog([kev(), kev({ cveID: '<script>' }), kev({ dateAdded: 'bad' })]));
  assert.equal(result.events.length, 1);
  assert.equal(result.coverage.rejectedCount, 2);
  assert.equal(result.events[0].updatedAt, result.events[0].publishedAt);
  assert.equal(result.coverage.sourceUpdatedAt, '2026-10-09T18:00:00.000Z');
});

test('news excerpts retain multiple authors and attribution without full articles or media', () => {
  const input = rss(rssItem({ link: 'https://www.eff.org/deeplinks/example', title: 'Privacy and encryption',
    description: `<p>Security and privacy matter. ${'Limited source excerpt. '.repeat(100)}</p><img src="https://track.example/pixel">`,
    authors: ['Writer One', 'Writer Two'], body: 'FULL ARTICLE MUST NEVER BE STORED' }));
  const [event] = at('eff', input).events;
  assert.match(event.attribution, /Writer One, Writer Two/);
  assert.match(event.attribution, /Shortened excerpt/);
  assert.ok(event.summary.length <= 360);
  assert.doesNotMatch(JSON.stringify(event), /FULL ARTICLE|track\.example|<img/);
  assert.equal(event.location.scope, 'Unknown');
});

test('Global Voices selects preparedness hazard news and excludes generic politics', () => {
  const input = rss(rssItem() + rssItem({ title: 'Election debate resumes', description: 'Candidates discussed the parliamentary election.', link: 'https://globalvoices.org/2026/10/09/other/' }));
  const result = at('global-voices', input);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].category, 'news');
  assert.equal(result.coverage.skippedReasons['outside-topic-scope'], 1);
});

test('news country topic tags never become verified affected-area geography', () => {
  const tagged = at('global-voices', rss(rssItem({ category: 'Japan' }))).events[0];
  assert.equal(tagged.location.scope, 'Unknown');
  assert.match(tagged.location.label, /Japan; affected area unverified/);
  assert.equal(tagged.location.precision, 'article-topic');
  assert.deepEqual(tagged.location.codes, []);
  const untagged = at('global-voices', rss(rssItem({ title: 'Flooding in Japan prompts evacuations' }))).events[0];
  assert.equal(untagged.location.scope, 'Unknown');
  assert.equal(at('global-voices', rss(rssItem({ category: 'United States' }))).events[0].location.scope, 'Unknown');
});

test('news with missing authors or explicit rights restrictions is omitted', () => {
  for (const options of [ { authors: [] }, { body: 'All rights reserved.' }, { body: 'An edited version is being republished under a content partnership agreement.' }, { body: 'This article first appeared in Another Publisher.' }, { body: 'This story was originally published on Another Publisher.' } ]) {
    const result = at('global-voices', rss(rssItem(options)));
    assert.equal(result.events.length, 0);
    assert.equal(result.coverage.skippedCount, 1);
    assert.equal(result.coverage.status, 'partial');
  }
  assert.equal(at('global-voices', rss(rssItem({ body: 'Originally published on Global Voices.' }))).events.length, 1);
  assert.equal(at('global-voices', rss(rssItem({ body: 'Originally published on <a href="https://globalvoices.org/">Global Voices</a>.' }))).events.length, 1);
});

test('news does not reuse attributed third-party blockquotes or images in excerpts', () => {
  const result = at('global-voices', rss(rssItem({ description: '<blockquote>Third-party quote.</blockquote><p>Flooding continues.</p><figure>Third-party image caption.</figure>' })));
  assert.equal(result.events[0].summary, 'Flooding continues.');
});

test('feed text stays data: scripts are stripped from excerpts and source HTML is never executed', () => {
  const input = rss(rssItem({ title: '<img src=x onerror=alert(1)> Floods &amp; rain', description: '<script>stealSecrets()</script><p>Flooding &amp; evacuations.</p><a href="javascript:alert(1)">Source words</a>' }));
  const [event] = at('global-voices', input).events;
  assert.equal(event.title, 'Floods & rain');
  assert.equal(event.summary, 'Flooding & evacuations. Source words');
  assert.doesNotMatch(JSON.stringify(event), /stealSecrets|onerror|javascript:/);
});

test('malicious or off-source item URLs are rejected without fetching', () => {
  for (const link of ['javascript:alert(1)', 'https://attacker.example/floods', 'https://globalvoices.org.attacker.example/floods', 'https://attacker@globalvoices.org/floods', 'https://globalvoices.org:8443/floods']) {
    assert.throws(() => at('global-voices', rss(rssItem({ link }))), /Every source item was malformed/);
    const result = at('global-voices', rss(rssItem({ link }) + rssItem()));
    assert.equal(result.events.length, 1);
    assert.equal(result.coverage.rejectedCount, 1);
  }
});

test('malformed whole JSON and XML feeds throw rather than publish empty success', () => {
  for (const [id, raw] of [['nws', '{}'], ['nws', '{'], ['usgs', collection([], { metadata: { status: 500 } })], ['cpsc', {}], ['cisa-kev', { vulnerabilities: [] }], ['fda', '<html>Upstream error</html>'], ['eff', '<rss><channel>'], ['global-voices', '']]) {
    assert.throws(() => at(id, raw));
  }
});

test('XML external entities and DTD declarations are rejected before parsing', () => {
  assert.throws(() => at('fda', '<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss><channel><title>&xxe;</title></channel></rss>'), /entity declarations/);
  assert.throws(() => at('eff', '<!DOCTYPE rss SYSTEM "https://attacker.example/evil.dtd"><rss><channel><title>Test</title></channel></rss>'), /document types/);
});

test('well-formed empty RSS differs from malformed XML', () => {
  const result = at('fda', rss(''));
  assert.deepEqual(result.events, []);
  assert.equal(result.coverage.status, 'ok');
  assert.equal(result.coverage.receivedCount, 0);
});

test('adapters accept parsed JSON and serialized JSON equivalently', () => {
  assert.deepEqual(at('cpsc', [recall()]), at('cpsc', JSON.stringify([recall()])));
  assert.throws(() => at('not-registered', {}), /Unknown/);
  assert.throws(() => adaptSource('nws', collection([]), { now: 'bad' }), /Invalid/);
});

test('nonempty feeds with every item malformed fail so the caller preserves last-good data', () => {
  for (const [id, raw] of [['nws', collection([null, {}])], ['usgs', collection([null])], ['cpsc', [recall({ Title: '' })]], ['cisa-kev', catalog([kev({ cveID: 'INVALID' })])], ['fda', rss(rssItem({ date: 'bad' }))]]) {
    assert.throws(() => at(id, raw), /Every source item was malformed/);
  }
});

test('KEV exposes only additions in its documented rolling 30-day window', () => {
  const result = at('cisa-kev', catalog([kev(), kev({ cveID: 'CVE-2020-99999', dateAdded: '2020-01-01' })]));
  assert.equal(result.events.length, 1);
  assert.equal(result.coverage.receivedCount, 2);
  assert.equal(result.coverage.skippedReasons['outside-30-day-window'], 1);
  assert.equal(result.coverage.status, 'ok');
});
test('EFF fundraising is excluded even when privacy boilerplate matches',()=>{
 const result=at('eff',rss(rssItem({link:'https://www.eff.org/deeplinks/example',title:"It’s DAF Day!",description:'Support our work for digital privacy and security.',authors:['Author']})));
 assert.equal(result.events.length,0);
});

test('NWS SAME preserves leading zeros and subdivision codes while deduplicating county membership',()=>{
 const [event]=at('nws',collection([alert({geocode:{SAME:['006001','106001','006001'],UGC:['CAC001']}})])).events;
 assert.deepEqual(event.geo.countyFips,['06001']);
 assert.deepEqual(event.geo.sameCodes,['006001','106001']);
 assert.deepEqual(event.geo.zoneIds,['CAC001']);
 assert.equal(event.geo.precision,'county-or-zone');assert.equal(event.geo.incomplete,false);
 assert.match(event.geo.evidence,/county overlap, not exact ZIP/);
});

test('whole-state SAME and all-US codes never become county FIPS',()=>{
 const geo=normalizeNwsGeo({sameCodes:['006000','000000'],zoneIds:['CAC000']});
 assert.deepEqual(geo.countyFips,[]);assert.deepEqual(geo.sameCodes,['006000','000000']);
 assert.equal(geo.incomplete,true);assert.equal(geo.precision,'unknown');
});

test('county UGCs derive FIPS but forecast and marine Z suffixes do not',()=>{
 const geo=normalizeNwsGeo({zoneIds:['CAC001','MDC033','PRC001','CAZ001','AMZ555']});
 assert.deepEqual(geo.countyFips,['06001','24033','72001']);
 assert.deepEqual(normalizeNwsGeo({zoneIds:['CAZ001','AMZ555']}).countyFips,[]);
 const marine=normalizeNwsGeo({sameCodes:['075362','092521'],zoneIds:['AMZ362','LMZ521']});
 assert.deepEqual(marine.sameCodes,['075362','092521']);assert.deepEqual(marine.countyFips,[]);
});

test('zone notices retain all intersecting SAME counties without centroid inference',()=>{
 const [event]=at('nws',collection([alert({geocode:{UGC:['UTZ493'],SAME:['049001','049017','049027','049031','049055','049041']}})])).events;
 assert.deepEqual(event.geo.countyFips,['49001','49017','49027','49031','49055','49041']);
 assert.deepEqual(event.geo.zoneIds,['UTZ493']);
});

test('NWS official affectedZones retain county and forecast IDs without following URLs',()=>{
 const [event]=at('nws',collection([alert({geocode:{},affectedZones:['https://api.weather.gov/zones/county/MDC033','https://api.weather.gov/zones/forecast/MDZ013']})])).events;
 assert.deepEqual(event.geo.zoneIds,['MDC033','MDZ013']);assert.deepEqual(event.geo.countyFips,['24033']);
});

test('malicious or unknown geography never invents local membership and marks incompleteness',()=>{
 const response=at('nws',collection([alert({geocode:{SAME:['006001','099001','06001',60001,'<script>006003</script>'],UGC:['CAC001','XXC999','CAZ<script>']},affectedZones:['https://evil.example/zones/county/CAC003','https://api.weather.gov.evil.example/zones/county/CAC005','https://user@api.weather.gov/zones/county/CAC007','https://api.weather.gov/zones/county/CAC009?anything=1']})]));
 assert.deepEqual(response.events[0].geo.countyFips,['06001']);assert.equal(response.events[0].geo.incomplete,true);
 assert.equal(response.coverage.status,'partial');assert.match(response.coverage.warnings.join(' '),/incomplete.*geographic/);
 assert.doesNotMatch(JSON.stringify(response.events[0].geo),/script|evil|user@/);
});

test('missing geography remains unknown and cannot borrow county labels or caller-provided FIPS',()=>{
 const [event]=at('nws',collection([alert({geocode:{},areaDesc:'Alameda County, California',affectedZones:[]})])).events;
 assert.deepEqual(event.geo.countyFips,[]);assert.equal(event.geo.precision,'unknown');
 assert.deepEqual(normalizeNwsGeo({countyFips:['06001']}).countyFips,[]);
 assert.deepEqual(normalizeNwsGeo(null).countyFips,[]);
});

test('geo revisions and cancellations retain source code evidence through duplicate handling',()=>{
 const response=at('nws-cancellations',collection([
  alert({messageType:'Cancel',sent:'2026-10-10T10:00:00Z',geocode:{SAME:['006001']},references:[{identifier:'urn:test:prior'}]}),
  alert({messageType:'Cancel',sent:'2026-10-10T11:00:00Z',geocode:{SAME:['006001','106003']},references:[{identifier:'urn:test:prior'}]}),
 ]));
 assert.equal(response.events.length,1);assert.equal(response.events[0].status,'cancelled');
 assert.deepEqual(response.events[0].geo.countyFips,['06001','06003']);assert.deepEqual(response.events[0].relatedIds,['urn:test:prior']);
});

test('oversized geographic code sets stay bounded with an explicit incomplete-coverage warning',()=>{
 const SAME=Array.from({length:600},(_,i)=>`006${String(i+1).padStart(3,'0')}`);
 const response=at('nws',collection([alert({geocode:{SAME,UGC:[]}})]));
 assert.equal(response.events[0].geo.countyFips.length,512);assert.equal(response.events[0].geo.sameCodes.length,512);
 assert.equal(response.events[0].geo.truncated,true);assert.equal(response.coverage.status,'partial');
});
