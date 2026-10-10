# Browser-local area data

Daily Brief city/state search and device-position county suggestions use checked-in,
public-domain U.S. Census Bureau data. Exact device coordinates are processed in
memory by `briefing/local-area-lookup.js`. That module has no network, DOM, logging,
URL, analytics or storage APIs and does not return coordinates or device accuracy.
The UI separately owns permission, lazy-loading fixed same-origin asset URLs,
explicit ambiguous-area choices and retention of only a derived broad area.

These are broad county relevance filters. They never establish that an alert
applies to a residence, a city boundary or an exact device location. Preserve
national and unknown-location briefings and direct readers to the original source.

## Official sources and rights

All inputs were retrieved on 2026-10-10; geographic vintage is explicitly 2020.
The state reference supplies names/codes, not current county relationships.

- [2020 Census Place by County table](https://www2.census.gov/geo/docs/reference/codes2020/national_place_by_county2020.txt)
  - SHA-256: `9996494d33cf6ee4527491508aa1b8dae85dcff3a979886e19b0b375e5d06ec6`
  - 33,618 place–county rows; 32,188 distinct incorporated places and CDPs;
    1,304 places have multiple counties. Every listed relationship is retained.
- [2020 TIGER/Line® national counties](https://www2.census.gov/geo/tiger/TIGER2020/COUNTY/tl_2020_us_county.zip)
  - SHA-256: `a490d33145b8cd308b0b53113d4bb31575b84a2b4cf6ec28fa5855be37559d8d`
  - 3,234 counties/county equivalents, 3,415 polygon rings, 8,086,467 source vertices.
    The generator reads the full TIGER/Line county source, not a city centroid or
    Census small-scale cartographic-boundary file.
- [Census state reference](https://www2.census.gov/geo/docs/reference/state.txt)
  - SHA-256: `bea4e03f71a1fa0045ae732aabad11fa541e5932b071c2369bb0d325e8cba5a0`
- [Census code definitions and layouts](https://www.census.gov/library/reference/code-lists/ansi.html)
  describe the incorporated-place/CDP scope and explicit Place by County table.
- [Census legal disclaimer and citation guidance](https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2025/TGRSHP2025_TechDoc_Ch1.pdf)
  explains that U.S. government work is not protected by U.S. copyright, asks for
  Census attribution, disclaims positional/attribute warranties, and limits the
  geographic boundary depiction to statistical use rather than legal land descriptions.

Public attribution: “Source: U.S. Census Bureau, 2020 Census geographic codes and
TIGER/Line® county boundaries. Osprey Zero derived these approximate lookups. The
Census Bureau does not endorse this service.” Include attribution and source access
near the area control; attribution/provenance also travel inside each data artifact.

Raw input files stay outside the repository and published output. No refresh occurs
at browser runtime or during an ordinary site build. An explicit maintenance run
verifies the exact source hashes; a changed upstream input fails closed.

## Published assets and sizes

Sizes are UTF-8 byte counts. Gzip sizes use Python gzip level 9 with `mtime=0` as a
comparison, not a promise about the host's actual negotiated compression.

| Asset | Decoded bytes | Gzip bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `briefing/place-areas.json` | 3,555,072 | 412,206 | `3e790459d370513e6cc9ca2f7ed267e4b159a97ab2f7e1c9c9656bff696aed10` |
| `briefing/county-geometry.json` | 3,642,445 | 1,495,461 | `9ea816ea01ac5e7330a095e67acbfc625a39406eaa03fe2a2e8a797fd248bb74` |

Both assets are lazy-loaded independently. Place queries never need polygons;
coordinate lookup never needs place names. The common script is about 11 KB decoded.
The existing ZIP lookup is separate and keeps all five-digit strings/leading zeros.

## Spatial derivation and uncertainty

The generator uses pyshp 2.3.1 and Shapely 2.1.2/GEOS 3.13.1. It simplifies each
county with topology-preserving Douglas–Peucker tolerance 0.001 degree, then
quantizes coordinates to 0.00001 degree, retaining every outer/inner ring. The
result contains 363,710 vertices. It does not publish place boundary polygons or
derive city/county relationships from geometric intersection or representative points.

Each ring uses integer delta coordinates and a bounding box. Ring longitudes are
unwrapped at the antimeridian; lookup shifts the query longitude into the ring's
local range. Even–odd fill handles holes and disjoint polygons. Bounding boxes
only eliminate distant rings; a box match alone is never a county match.

County candidates include containing polygons and all polygon edges within
`(device accuracy + 500 meters) × 1.1`. The 500-meter editorial margin exceeds the
roughly 112-meter per-coordinate simplification tolerance and one-meter
quantization; the extra 10% cushions local planar distance calculations. It is
not a statistical confidence interval or a guarantee about source/GPS accuracy.
Source geometry is NAD83 while device GPS is generally WGS84; no precise datum
equivalence is asserted.

- A single polygon containing the device position, outside that boundary margin,
  returns an approximate county suggestion.
- Any nearby boundary, multiple possible counties, or a position just outside a
  polygon returns `ambiguous`, even if only one candidate remains. The UI must ask
  for an explicit county choice, not silently select the nearest/first county.
- Missing, nonscalar, nonfinite or out-of-range coordinates/accuracy fail closed.
  Reported accuracy above 50 km returns `imprecise` without candidates.
- A point outside all source polygons and margins returns `unmapped`; no nearest-
  county fallback occurs. Coverage includes U.S. territories; it is not global.
- Connecticut city/county matching is `unsupported` because its county equivalents
  changed after 2020 and compatibility with alert county codes is not validated.
  Any candidate touching Connecticut blocks automatic coordinate assignment.
  Connecticut remains available as a broad state filter.
- Source names, boundaries, municipality incorporation and county codes may have
  changed since 2020. A missing place is not evidence that the visitor's city or
  postal address is invalid. Many neighborhoods, mailing names and New England
  towns are not Census places; manual state/county selection is the fallback.

## Browser API

Load `/briefing/local-area-lookup.js`; it exposes `window.OspreyAreaLookup` (and a
CommonJS export for offline tests). Both functions are synchronous and have no
side effects outside a private weakly keyed place-name index.

`searchAreas(placeData, query)` returns `{status, matches, reason}`. It accepts
state codes/full names, city names, `city, state` or `city state`. Normalization
is case/accent-insensitive. A standalone exact state name has state priority;
an exact city name is tested before inferring a trailing state name, so “West
New York” remains a New Jersey place. Whole-word phrase fallback presents the
actual source labels (e.g. East Honolulu and Urban Honolulu) rather than invented
aliases. All matches are retained so the UI can show an honest total while capping
rendered choices and asking for a more specific query. `found` can contain multiple
same-name cities, including within a single state: the UI must require an explicit
choice. ZIP-like strings are left for the separate ZIP resolver.

Each city area is `{kind:'city', id, label, state, counties, sourceVintage:'2020',
approximate:true, unsupported}`. `state` is always the uppercase two-letter code;
`counties` holds complete `{code, name, state}` objects. A state area has
`kind:'state'`, its code/name and `counties:[]`. Mixed search results may include
`unsupported:true` candidates; the UI must disable those county choices.

`resolveCoordinates(countyData, latitude, longitude, accuracyMeters)` returns the
same result envelope. Its area kind is `geolocation`, its label is the county and
state, and its county array has one element. Statuses are `found`, `ambiguous`,
`unmapped`, `unsupported`, `invalid`, `imprecise`, or `unavailable`. The result never
echoes coordinates or device accuracy. Ignore stale async UI callbacks after any
manual area choice, navigation or clear action.

## Rebuild and verification

Ordinary checks require only Node and Python standard libraries:

```sh
node --check briefing/local-area-lookup.js
node --test scripts/verify_local_area_lookup.cjs
python scripts/test_local_areas.py
```

An explicit rebuild needs the optional dependencies in
`scripts/local-area-data-requirements.txt`; they are not required by normal builds.
Supply local copies of the three pinned sources outside the checkout:

```sh
python scripts/build_local_areas.py \
  --places /path/to/national_place_by_county2020.txt \
  --counties /path/to/tl_2020_us_county.zip \
  --states /path/to/state.txt --check
```

Omit `--check` to intentionally regenerate, or use `--download` to explicitly
retrieve missing, fixed sources. Never place raw sources in the public tree.
The generator rejects changed source hashes, inconsistent county relationships,
conflicting duplicate place identities, invalid polygons, dropped rings and
oversized output. Review vintage compatibility, consumer tests, artifact hashes
and this document before any deliberate future data update.
