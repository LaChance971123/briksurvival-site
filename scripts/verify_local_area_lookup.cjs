/* Offline, dependency-free tests for browser-local place and county resolution. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.join(__dirname, '..');
const lookup = require(path.join(root, 'briefing/local-area-lookup.js'));
const places = JSON.parse(fs.readFileSync(path.join(root, 'briefing/place-areas.json'), 'utf8'));
const geometry = JSON.parse(fs.readFileSync(path.join(root, 'briefing/county-geometry.json'), 'utf8'));
const codes = area => area.counties.map(county => county.code);

function encodeRing(points) {
  const xy = points.map(([x, y]) => [Math.round(x * 1e5), Math.round(y * 1e5)]);
  const ring = [Math.min(...xy.map(p => p[0])), Math.min(...xy.map(p => p[1])), Math.max(...xy.map(p => p[0])), Math.max(...xy.map(p => p[1]))];
  let x = 0, y = 0;
  for (const p of xy) { ring.push(p[0] - x, p[1] - y); [x, y] = p; }
  return ring;
}
const rectangle = (x1, y1, x2, y2) => encodeRing([[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]);
const county = (code, state, ...rings) => ({ code, state, name: `County ${code}`, rings });
function fixture(counties) {
  return { schemaVersion: 1, sourceVintage: '2020', encoding: 'delta-rings-v1', scale: 100000, boundaryMarginMeters: 500, maxAccuracyMeters: 50000, unsupportedStates: ['CT'], counties };
}
const adjoining = fixture([county('06001', 'CA', rectangle(-101, 35, -100, 36)), county('06003', 'CA', rectangle(-100, 35, -99, 36))]);

test('state full names, codes, casing and whitespace resolve to broad state only', () => {
  for (const query of ['ca', ' California ', 'cALiForNIa']) {
    const response = lookup.searchAreas(places, query);
    assert.equal(response.status, 'found');
    assert.equal(response.matches[0].kind, 'state');
    assert.equal(response.matches[0].state, 'CA');
    assert.deepEqual(response.matches[0].counties, []);
  }
  assert.equal(lookup.searchAreas(places, 'New York').matches[0].kind, 'state');
  assert.equal(lookup.searchAreas(places, 'District of Columbia').matches[0].state, 'DC');
});

test('city ambiguity is retained; state suffix and commas narrow it', () => {
  const response = lookup.searchAreas(places, 'Springfield');
  assert.equal(response.status, 'found');
  assert.equal(response.matches.length, 22);
  assert.ok(new Set(response.matches.map(v => v.state)).size > 10);
  const broad = lookup.searchAreas(places, 'San');
  assert.equal(broad.status, 'found');
  assert.ok(broad.matches.length > 100); // UI may cap rendering but keeps an honest full count.
  for (const query of ['Springfield, IL', 'springfield Illinois', 'SPRINGFIELD CITY, illinois']) {
    const answer = lookup.searchAreas(places, query);
    assert.equal(answer.matches.length, 1);
    assert.deepEqual(codes(answer.matches[0]), ['17167']);
  }
});

test('same-name cities in the same state retain separate place IDs', () => {
  const data = structuredClone(places);
  data.places = [
    { id: '0600001', name: 'Example city', state: 'CA', counties: ['06001'] },
    { id: '0600002', name: 'Example CDP', state: 'CA', counties: ['06003'] },
  ];
  const answer = lookup.searchAreas(data, 'Example CA');
  assert.equal(answer.status, 'found');
  assert.equal(answer.matches.length, 2);
  assert.equal(new Set(answer.matches.map(a => a.id)).size, 2);
});

test('place names ending in a state name are not misparsed as city/state pairs', () => {
  const west = lookup.searchAreas(places, 'West New York');
  assert.equal(west.matches.length, 1);
  assert.equal(west.matches[0].label, 'West New York town, NJ');
  assert.ok(lookup.searchAreas(places, 'East Washington').matches.some(area => area.label === 'East Washington borough, PA'));
  assert.ok(lookup.searchAreas(places, 'New Washington').matches.some(area => area.label === 'New Washington CDP, IN'));
  assert.equal(lookup.searchAreas(places, 'West New York, NJ').matches[0].label, 'West New York town, NJ');
});

test('accent/casing normalization and official-name phrase fallback', () => {
  for (const query of ['San José, CA', 'SAN JOSE CALIFORNIA', 'San Jose city CA']) {
    assert.deepEqual(codes(lookup.searchAreas(places, query).matches[0]), ['06085']);
  }
  assert.deepEqual(codes(lookup.searchAreas(places, 'Mayagüez, PR').matches[0]), ['72097']);
  const honolulu = lookup.searchAreas(places, 'Honolulu HI');
  assert.equal(honolulu.status, 'found');
  assert.ok(honolulu.matches.some(area => area.label === 'Urban Honolulu CDP, HI'));
  assert.ok(honolulu.matches.length > 1); // no invented preferred Honolulu alias
});

test('every multicounty city relationship is retained, never a centroid county', () => {
  assert.deepEqual(codes(lookup.searchAreas(places, 'New York, NY').matches[0]), ['36005', '36047', '36061', '36081', '36085']);
  assert.deepEqual(codes(lookup.searchAreas(places, 'Dallas TX').matches[0]), ['48085', '48113', '48121', '48257', '48397']);
  assert.deepEqual(codes(lookup.searchAreas(places, 'Austin TX').matches[0]), ['48021', '48209', '48453', '48491']);
});

test('Connecticut city/county vintage blocked while broad state remains available', () => {
  const city = lookup.searchAreas(places, 'Hartford Connecticut');
  assert.equal(city.status, 'unsupported');
  assert.equal(city.matches[0].unsupported, true);
  assert.equal(lookup.searchAreas(places, 'CT').status, 'found');
  assert.equal(lookup.searchAreas(places, 'CT').matches[0].kind, 'state');
  assert.equal(lookup.resolveCoordinates(geometry, 41.7658, -72.6734, 20).status, 'unsupported');
});

test('ZIP leading zero strings are untouched by the independent city lookup', () => {
  const before = fs.readFileSync(path.join(root, 'briefing/zip-areas.json'), 'utf8');
  for (const query of ['00901', '02108', '90210', '90210-0001']) assert.equal(lookup.searchAreas(places, query).status, 'unmapped');
  const zips = JSON.parse(before);
  assert.ok(zips.zipAreas['00901'].includes('72127'));
  assert.equal(fs.readFileSync(path.join(root, 'briefing/zip-areas.json'), 'utf8'), before);
});

test('malicious, nonscalar, excessive and malformed search inputs fail safely', () => {
  for (const query of [null, undefined, {}, [], 90210, '', ' ', 'x'.repeat(161), '<img src=x onerror=alert(1)>', 'LA\u0000CA']) assert.equal(lookup.searchAreas(places, query).status, 'invalid');
  for (const query of ['__proto__', 'constructor', 'toString', 'Nowhere, ZZ', 'Portland, OR, US']) assert.equal(lookup.searchAreas(places, query).status, 'unmapped');
  assert.equal(lookup.searchAreas({}, 'LA').status, 'unavailable');
});

test('device coordinate interior yields only the containing county', () => {
  const answer = lookup.resolveCoordinates(adjoining, 35.5, -100.5, 25);
  assert.equal(answer.status, 'found');
  assert.deepEqual(codes(answer.matches[0]), ['06001']);
  assert.equal(answer.matches[0].approximate, true);
});

test('exact and nearby county boundaries retain every plausible candidate', () => {
  for (const longitude of [-100, -100.001, -99.999]) {
    const answer = lookup.resolveCoordinates(adjoining, 35.5, longitude, 25);
    assert.equal(answer.status, 'ambiguous');
    assert.deepEqual(answer.matches.flatMap(codes), ['06001', '06003']);
  }
  assert.equal(lookup.resolveCoordinates(adjoining, 35.5, -100.1, 12000).status, 'ambiguous');
});

test('coastline/outer edge remains uncertain even with a single candidate', () => {
  const answer = lookup.resolveCoordinates(adjoining, 35.5, -101.002, 20);
  assert.equal(answer.status, 'ambiguous');
  assert.equal(answer.matches.length, 1);
  assert.equal(lookup.resolveCoordinates(adjoining, 35.5, -102, 20).status, 'unmapped');
});

test('polygon holes and disjoint rings never become a bounding-box county match', () => {
  const data = fixture([county('06001', 'CA', rectangle(-102, 33, -99, 36), rectangle(-101.5, 33.5, -99.5, 35.5), rectangle(-98, 33, -97, 34))]);
  assert.equal(lookup.resolveCoordinates(data, 34.5, -100.5, 20).status, 'unmapped');
  assert.equal(lookup.resolveCoordinates(data, 33.2, -101.8, 20).status, 'found');
  assert.equal(lookup.resolveCoordinates(data, 33.5, -97.5, 20).status, 'found');
});

test('antimeridian-local polygons work for either longitude convention', () => {
  const data = fixture([county('02016', 'AK', rectangle(179, 50, 181, 52))]);
  assert.equal(lookup.resolveCoordinates(data, 51, -179.5, 20).status, 'found');
  assert.equal(lookup.resolveCoordinates(data, 51, 179.5, 20).status, 'found');
  assert.equal(lookup.resolveCoordinates(data, 51, 0, 20).status, 'unmapped');
});

test('all inaccurate, invalid and malicious coordinate inputs fail closed', () => {
  for (const point of [[NaN, -100, 10], [35, Infinity, 10], [91, 0, 10], [-91, 0, 10], [35, 181, 10], [35, -181, 10], [35, -100, -1], [35, -100], ['35', '-100', 20], [null, -100, 20], [{ valueOf() { throw Error('coercion'); } }, -100, 20]]) assert.equal(lookup.resolveCoordinates(adjoining, ...point).status, 'invalid');
  assert.equal(lookup.resolveCoordinates(adjoining, 35.5, -100.5, 50001).status, 'imprecise');
  assert.equal(lookup.resolveCoordinates({}, 35.5, -100.5, 20).status, 'unavailable');
});

test('real national artifact resolves continental, Alaska and territory points', () => {
  for (const [lat, lon, expected] of [[34.0522, -118.2437, '06037'], [39.7392, -104.9903, '08031'], [61.2181, -149.9003, '02020'], [21.3069, -157.8583, '15003'], [13.4443, 144.7937, '66010'], [18.4655, -66.1057, '72127']]) {
    const answer = lookup.resolveCoordinates(geometry, lat, lon, 20);
    assert.equal(answer.status, 'found');
    assert.deepEqual(codes(answer.matches[0]), [expected]);
  }
  for (const [lat, lon] of [[0, 0], [51.5, -.12], [48.85, 2.35], [-33.86, 151.2], [89, 0], [-89, 0]]) assert.equal(lookup.resolveCoordinates(geometry, lat, lon, 20).status, 'unmapped');
});

test('lookup has no side-effect APIs or exact coordinates in results', () => {
  const source = fs.readFileSync(path.join(root, 'briefing/local-area-lookup.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|console|document|location|URLSearchParams)\s*(?:\.[A-Za-z_$]|\()/);
  const answer = lookup.resolveCoordinates(geometry, 34.052234567, -118.243712345, 27.321);
  const serialized = JSON.stringify(answer);
  assert.ok(!serialized.includes('34.052234567') && !serialized.includes('-118.243712345') && !serialized.includes('27.321'));
  assert.doesNotMatch(serialized, /"(?:latitude|longitude|accuracy)"/);
});
