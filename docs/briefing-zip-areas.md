# Browser-local ZIP-area lookup

`briefing/zip-areas.json` is a static, derived lookup from U.S. Census Bureau public geographic data. A visitor's entered ZIP stays in the browser: consumers fetch the same complete static file and match locally. No ZIP lookup account, key, geolocation request, external geocoder, or visitor-location upload is needed. The usual site request still reaches the site's hosting provider; this feature should not append ZIPs to requests, query strings, logs, analytics, or external links.

## Scope and attribution

This is **approximate 2020 ZCTA-to-2020-county coverage**, not a complete or current USPS ZIP directory. Census ZIP Code Tabulation Areas approximate delivery geography using census blocks. A five-digit entry can correspond to multiple counties and even multiple states. Not every valid ZIP has a ZCTA; some PO-box-only or organization-specific ZIPs are represented and others are absent. Codes added since 2020 may be missing. A failed lookup must never imply that the ZIP is invalid or that no alerts apply.

Official sources, verified and downloaded on October 10, 2026:

- [2020 ZCTA-to-county raw relationship file](https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt), 6,821,287 bytes. The [official directory](https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/) reports last modification on December 9, 2021; this is not a 2026 geography refresh.
- Raw relationship SHA-256: `3ed41278d637dc249e0323306f68be8a6c234e3090f4de88ef328dee71aeaaaf`
- [Official state reference](https://www2.census.gov/geo/docs/reference/state.txt), 1,485 bytes; SHA-256: `bea4e03f71a1fa0045ae732aabad11fa541e5932b071c2369bb0d325e8cba5a0`
- [Record layout](https://www.census.gov/programs-surveys/geography/technical-documentation/records-layout/2020-zcta-record-layout.html), [relationship explanation](https://www2.census.gov/geo/pdfs/maps-data/data/rel2020/zcta520/explanation_tab20_zcta520_county20_natl.pdf), and [ZCTA definitions and limitations](https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html).
- [Census legal/citation statement](https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2025/TGRSHP2025_TechDoc_Ch1.pdf): government-produced Census material is not protected by U.S. copyright, may be reproduced, and should credit Census. This permits U.S. commercial reuse; it does not imply Census endorsement or guarantee geographic accuracy. The statement also reserves the TIGER/Line trademark, which is not part of Osprey's product name. No third-party ZIP database is included.

Suggested display credit: “ZIP-area estimate: U.S. Census Bureau, 2020 ZCTA–County Relationship File.” Link it to the source. Keep the vintage and approximate-county scope visible near the selected location.

## Data contract (schemaVersion 1)

- `source`: origin, 2020 vintage, recorded source last-modification date, provenance retrieval date, raw SHA-256, attribution and explanatory links. `source.stateReference` has the second source and hash. These dates describe the pinned source snapshot; rebuilding does not pretend to refresh geography.
- `states`: state/territory abbreviation → `{name, fips}`. FIPS stays a two-character string.
- `counties`: five-character county FIPS → `{name, state}`. Includes all county records in the source, including records without a ZCTA.
- `zipAreas`: five-character ZCTA code → sorted array of **all** intersecting five-character county FIPS strings. Preserve leading zeroes, tiny overlaps and cross-state membership. Do not pick only the largest county, a centroid, the first county, or the state suggested by the ZIP prefix.
- `unsupportedStates`: currently `['CT']`. Consumers must block a ZIP match if **any** returned county is in an unsupported state. Never remove unsupported counties and use the remainder.
- `unsupportedReasons`: explanation and fallback per unsupported state.
- `coverage`, `limitations`, `counts`: descriptive provenance and invariant checks.

Current artifact: 33,791 ZCTAs; 46,960 unique ZCTA/county relationships; 3,234 county labels; 10,186 ZCTAs with multiple counties. The source has 47,863 records, of which 903 represent geography without an assigned ZCTA. Those 903 rows provide county labels but are not indexed under an empty ZIP. The artifact is about 871 KB uncompressed / 146 KB gzip.

Representative checks:

| Entered ZIP area | County FIPS | Expected handling |
| --- | --- | --- |
| 90210 | 06037 | Los Angeles County, California |
| 00901 | 72127 | San Juan Municipio, Puerto Rico; retain leading zero |
| 42223 | 21047, 47125 | Both Kentucky and Tennessee county matches |
| 02861 | 25005, 44007 | Both Massachusetts and Rhode Island county matches |
| 06331 | 09011, 09015 | Connecticut unsupported fallback |
| 00501 | absent | Explain unavailable estimate; offer a state choice, never “no alerts” |

### Connecticut is intentionally unsupported

Census adopted nine Connecticut planning regions as county equivalents after this file's eight legacy counties. [Official change and supplemental relationships](https://www.census.gov/geographies/reference-files/2022/geo/relationship-files.html). This implementation does not claim that the new Census county-equivalent IDs, legacy county IDs, and a feed's current alert IDs are interchangeable. No validated reconciliation has been bundled.

The dataset preserves all original Connecticut relationships for provenance (288 ZIP areas touch Connecticut), but ZIP-based filtering must be blocked for those results. Offer the Connecticut state filter and original official source; do not imply a manually selected legacy Census county resolves this compatibility issue. A future change needs a separately verified crosswalk and feed compatibility tests before removing the block.

## Matching safety

A county-level match is only potentially relevant **somewhere in the county**. It does not establish that an alert polygon covers the entered ZIP area or a visitor's residence. No point coordinates or centroids are included in the dataset. Never test a county center against an alert polygon as a proxy for county coverage.

NWS adapters retain geographic identifiers instead of reducing alerts to state codes. This release does not store or test alert polygons and makes no point-level coverage claim. The [NWS geolocation guide](https://www.weather.gov/media/documentation/docs/NWS_Geolocation.pdf) explains that county UGCs and zone UGCs differ, zones need not follow county boundaries, and zone-based alerts also carry intersecting counties in SAME. Validate identifiers and relevant vintage; do not interpret a zone's numeric suffix as a county FIPS.

A missing ZIP, lookup-file failure or unsupported geography should preserve the existing view and explain the fallback. Keep product and software notices available separately, because US jurisdiction does not establish nationwide distribution and product applicability is not determined by ZIP. Other areas and unknown-location records remain accessible; missing location metadata is not evidence of irrelevance. The twice-daily briefing remains a snapshot, not a warning service or proof that no danger exists.

## Reproduce and validate

The generator uses Python's standard library, fixed official URLs and pinned content hashes. It does not run during ordinary site builds and does not fetch source data at visitor runtime. No raw Census file is committed or deployed.

Explicit download and regenerate:

```sh
python scripts/build_zip_areas.py --download
```

Or reproduce from local copies of the pinned files:

```sh
python scripts/build_zip_areas.py --source /path/to/tab20_zcta520_county20_natl.txt --states /path/to/state.txt --check
```

`--check` compares the deterministic generated bytes without overwriting. A changed source hash, unexpected redirect or malformed input fails closed. Review official provenance and geography changes before updating pinned hashes or metadata. Never silently accept a different upstream revision.

Offline tests:

```sh
python scripts/test_zip_areas.py
node --test server/briefing/zip-areas.test.mjs
```

The Node wrapper includes the 21 Python tests in `npm test` and the existing aggregate site build. Tests cover every checked-in relationship, counts, leading zeroes, multi-county and cross-state cases, missing ZIPs, Connecticut blocking metadata, compact canonical output, hash mismatches and deterministic generation. Full reproduction against both downloaded official inputs is a separate source-verification step, not an internet-dependent CI test.
