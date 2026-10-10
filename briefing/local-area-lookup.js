/* Browser-local approximate Census area lookup. No network, storage, logs or DOM access.
 * Source attribution and provenance accompany the separately lazy-loaded JSON assets.
 */
(function (root) {
  'use strict';

  const placeIndexes = new WeakMap();
  const DEGREE_METERS = 111320;
  const MAX_QUERY_LENGTH = 160;
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function normalizeName(value) {
    if (typeof value !== 'string' || value.length > MAX_QUERY_LENGTH) return '';
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function basePlaceName(name) {
    return name.replace(/\s+(?:city and borough|unified government \(balance\)|metropolitan government \(balance\)|metro government \(balance\)|consolidated government \(balance\)|municipality|zona urbana|comunidad|borough|village|town|city|CDP)$/i, '');
  }

  function result(status, matches = [], reason = '') {
    return { status, matches, reason };
  }

  function placeIndex(data) {
    if (!data || typeof data !== 'object' || data.schemaVersion !== 1 || !data.states || !data.counties || !Array.isArray(data.places)) return null;
    if (placeIndexes.has(data)) return placeIndexes.get(data);
    const stateNames = new Map();
    for (const [code, state] of Object.entries(data.states)) {
      if (!/^[A-Z]{2}$/.test(code) || typeof state?.name !== 'string') return null;
      stateNames.set(normalizeName(code), code);
      stateNames.set(normalizeName(state.name), code);
    }
    const entries = [];
    for (const place of data.places) {
      if (!place || typeof place.name !== 'string' || !/^[0-9]{7}$/.test(place.id) || !hasOwn(data.states, place.state) || !Array.isArray(place.counties) || !place.counties.length) return null;
      if (place.counties.some(code => !/^[0-9]{5}$/.test(code) || !hasOwn(data.counties, code))) return null;
      entries.push({ place, keys: [...new Set([normalizeName(place.name), normalizeName(basePlaceName(place.name))])] });
    }
    const index = { stateNames, stateSuffixes: [...stateNames.keys()].sort((a, b) => b.length - a.length), entries };
    placeIndexes.set(data, index);
    return index;
  }

  function cityArea(data, place) {
    return {
      kind: 'city', id: place.id, label: `${place.name}, ${place.state}`, state: place.state,
      counties: place.counties.map(code => ({ code, name: data.counties[code].name, state: data.counties[code].state })),
      sourceVintage: data.sourceVintage, approximate: true,
      unsupported: (data.unsupportedStates || []).includes(place.state),
    };
  }

  function searchAreas(data, query) {
    // ZIP strings deliberately belong to the separate, lossless ZIP-area resolver.
    if (typeof query !== 'string' || !query.trim() || query.length > MAX_QUERY_LENGTH || /[<>\u0000-\u001f\u007f]/.test(query)) return result('invalid', [], 'Enter a city or state name.');
    const index = placeIndex(data);
    if (!index) return result('unavailable', [], 'Local place data is unavailable. Choose a state manually.');
    const normalized = normalizeName(query);
    if (!normalized || /^\d/.test(normalized)) return result('unmapped', [], 'Use the ZIP-area lookup for a five-digit ZIP.');
    if (index.stateNames.has(normalized)) {
      const state = index.stateNames.get(normalized);
      return result('found', [{ kind: 'state', label: data.states[state].name, state, counties: [], sourceVintage: data.sourceVintage, approximate: true }]);
    }
    let state = '', city = normalized;
    if (query.includes(',')) {
      const parts = query.split(',');
      if (parts.length !== 2 || !parts[0].trim() || !index.stateNames.has(normalizeName(parts[1]))) return result('unmapped', [], 'Use a city followed by a U.S. state name or two-letter code.');
      city = normalizeName(parts[0]);
      state = index.stateNames.get(normalizeName(parts[1]));
    } else if (!index.entries.some(entry => entry.keys.includes(normalized))) {
      // Real place names may themselves end in a state name (West New York, NJ).
      // An exact whole place name takes precedence over inferred suffix parsing.
      for (const suffix of index.stateSuffixes) {
        if (normalized.endsWith(` ${suffix}`)) {
          state = index.stateNames.get(suffix);
          city = normalized.slice(0, -(suffix.length + 1));
          break;
        }
      }
    }
    const eligible = index.entries.filter(entry => !state || entry.place.state === state);
    let found = eligible.filter(entry => entry.keys.includes(city));
    // Whole-word phrase fallback covers names such as Urban Honolulu without invented aliases.
    if (!found.length && city.length >= 3) found = eligible.filter(entry => entry.keys.some(key => (` ${key} `).includes(` ${city} `)));
    const matches = found.map(entry => cityArea(data, entry.place)).sort((a, b) => a.label.localeCompare(b.label, 'en') || a.id.localeCompare(b.id));
    if (!matches.length) return result('unmapped', [], 'No matching 2020 Census place. Try city, state or choose a state manually.');
    if (matches.every(area => area.unsupported)) return result('unsupported', matches, data.unsupportedReasons?.[matches[0].state] || 'County matching is not supported for this geography.');
    return result('found', matches, matches.length > 1 ? 'Choose the intended place; names can repeat within or across states.' : 'City matching includes every source-listed county, not an exact alert area.');
  }

  function segmentDistanceSquared(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
    return (ax + t * dx) ** 2 + (ay + t * dy) ** 2;
  }

  function ringRelation(ring, scale, latitude, longitude, radiusMeters) {
    const [minX, minY, maxX, maxY] = ring;
    const centerX = (minX + maxX) / (2 * scale);
    const queryX = longitude + 360 * Math.round((centerX - longitude) / 360);
    // The supported sources do not approach a pole; cos adjustment covers Alaska/territories.
    const xMeters = DEGREE_METERS * Math.max(0.01, Math.cos(latitude * Math.PI / 180));
    const yMargin = radiusMeters / DEGREE_METERS;
    const xMargin = radiusMeters / xMeters;
    if (latitude < minY / scale - yMargin || latitude > maxY / scale + yMargin || queryX < minX / scale - xMargin || queryX > maxX / scale + xMargin) return { inside: false, near: false };
    let x = ring[4], y = ring[5], inside = false, near = false;
    let ax = (x / scale - queryX) * xMeters, ay = (y / scale - latitude) * DEGREE_METERS;
    for (let i = 6; i < ring.length; i += 2) {
      x += ring[i]; y += ring[i + 1];
      const bx = (x / scale - queryX) * xMeters, by = (y / scale - latitude) * DEGREE_METERS;
      if ((ay > 0) !== (by > 0) && 0 < ax + (bx - ax) * -ay / (by - ay)) inside = !inside;
      if (!near && segmentDistanceSquared(ax, ay, bx, by) <= radiusMeters ** 2) near = true;
      ax = bx; ay = by;
    }
    return { inside, near };
  }

  function resolveCoordinates(data, latitude, longitude, accuracy) {
    // Coordinates are arguments only: never echoed in results, persisted, logged or sent.
    if (![latitude, longitude, accuracy].every(value => typeof value === 'number' && Number.isFinite(value)) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracy < 0) {
      return result('invalid', [], 'A valid device position and its accuracy are needed. Choose an area manually.');
    }
    if (!data || data.schemaVersion !== 1 || data.encoding !== 'delta-rings-v1' || data.scale !== 100000 || !Array.isArray(data.counties) || !Number.isFinite(data.boundaryMarginMeters) || data.boundaryMarginMeters < 500) return result('unavailable', [], 'Local county data is unavailable. Choose an area manually.');
    if (accuracy > Math.min(50000, data.maxAccuracyMeters || 50000)) return result('imprecise', [], 'Device location is too imprecise for county matching. Choose an area manually.');
    // A further 10% cushion covers local planar-distance approximation over a <=50km radius.
    const radiusMeters = (accuracy + data.boundaryMarginMeters) * 1.1;
    const matches = [];
    let nearBoundary = false, insideCount = 0;
    for (const county of data.counties) {
      if (!county || !/^[0-9]{5}$/.test(county.code) || !/^[A-Z]{2}$/.test(county.state) || !Array.isArray(county.rings)) return result('unavailable', [], 'Local county data is unavailable. Choose an area manually.');
      let inside = false, near = false;
      for (const ring of county.rings) {
        if (!Array.isArray(ring) || ring.length < 12 || ring.length % 2 || ring.some(value => !Number.isSafeInteger(value))) return result('unavailable', [], 'Local county data is unavailable. Choose an area manually.');
        const relation = ringRelation(ring, data.scale, latitude, longitude, radiusMeters);
        // Even-odd fill retains holes and disjoint polygons without relying on winding order.
        if (relation.inside) inside = !inside;
        near ||= relation.near;
      }
      if (!inside && !near) continue;
      insideCount += Number(inside);
      nearBoundary ||= near;
      matches.push({
        kind: 'geolocation', label: `${county.name}, ${county.state}`, state: county.state,
        counties: [{ code: county.code, name: county.name, state: county.state }],
        sourceVintage: data.sourceVintage, approximate: true,
        unsupported: (data.unsupportedStates || []).includes(county.state),
      });
    }
    matches.sort((a, b) => a.label.localeCompare(b.label, 'en'));
    if (!matches.length) return result('unmapped', [], 'No supported county matched this approximate position. It may be outside U.S. coverage. Choose an area manually.');
    if (matches.some(area => area.unsupported)) return result('unsupported', matches, 'This position may touch unsupported county geography. Use a state filter or choose a supported area manually.');
    if (matches.length !== 1 || insideCount !== 1 || nearBoundary) return result('ambiguous', matches, 'Device accuracy or an approximate county boundary makes this uncertain. Confirm your county or choose another area.');
    return result('found', matches, 'Approximate device county, calculated only in this browser. County matches do not confirm an alert at your location.');
  }

  const api = Object.freeze({ normalizeName, searchAreas, resolveCoordinates });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OspreyAreaLookup = api;
})(typeof globalThis === 'object' ? globalThis : this);
