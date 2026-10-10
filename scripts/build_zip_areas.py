#!/usr/bin/env python3
"""Build the pinned Census ZCTA/county lookup. No visitor data or lookup API is used."""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'briefing/zip-areas.json'
SOURCE_URL = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt'
SOURCE_SHA256 = '3ed41278d637dc249e0323306f68be8a6c234e3090f4de88ef328dee71aeaaaf'
STATE_URL = 'https://www2.census.gov/geo/docs/reference/state.txt'
STATE_SHA256 = 'bea4e03f71a1fa0045ae732aabad11fa541e5932b071c2369bb0d325e8cba5a0'
RIGHTS_URL = 'https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2025/TGRSHP2025_TechDoc_Ch1.pdf'
MAX_DOWNLOAD_BYTES = 12_000_000


def read_pinned(path: Path | None, url: str, digest: str) -> bytes:
    """Use an explicit local input or download the fixed public source; fail closed on changes."""
    if path is not None:
        data = path.read_bytes()
    else:
        request = urllib.request.Request(url, headers={'User-Agent': 'OspreyZero-ZCTA-Build/1.0'})
        with urllib.request.urlopen(request, timeout=60) as response:
            if response.geturl() != url:
                raise ValueError('Unexpected source redirect; inspect it before updating the generator.')
            data = response.read(MAX_DOWNLOAD_BYTES + 1)
    if len(data) > MAX_DOWNLOAD_BYTES:
        raise ValueError('Source exceeds the expected download bound.')
    actual = hashlib.sha256(data).hexdigest()
    if actual != digest:
        raise ValueError(f'Source SHA-256 mismatch for {url}: {actual}; review before changing the pinned hash.')
    return data


def rows(raw: bytes, required: set[str]) -> csv.DictReader:
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')), delimiter='|')
    if not required.issubset(reader.fieldnames or []):
        raise ValueError('Missing required Census source columns.')
    return reader


def build_document(raw: bytes, state_raw: bytes) -> dict:
    states, fips_to_state = {}, {}
    for row in rows(state_raw, {'STATE', 'STUSAB', 'STATE_NAME'}):
        fips, code, name = row['STATE'], row['STUSAB'], row['STATE_NAME']
        if not re.fullmatch(r'\d{2}', fips) or not re.fullmatch(r'[A-Z]{2}', code) or not name:
            raise ValueError('Invalid state reference record.')
        if fips in fips_to_state or code in states:
            raise ValueError('Duplicate state reference record.')
        states[code] = {'name': name, 'fips': fips}
        fips_to_state[fips] = code

    counties, zip_areas = {}, {}
    source_records, unassigned_records = 0, 0
    for row in rows(raw, {'GEOID_ZCTA5_20', 'GEOID_COUNTY_20', 'NAMELSAD_COUNTY_20'}):
        source_records += 1
        zcta, county, name = row['GEOID_ZCTA5_20'], row['GEOID_COUNTY_20'], row['NAMELSAD_COUNTY_20']
        if not re.fullmatch(r'\d{5}', county) or county[:2] not in fips_to_state or not name:
            raise ValueError('Invalid or unmapped county record.')
        value = {'name': name, 'state': fips_to_state[county[:2]]}
        if county in counties and counties[county] != value:
            raise ValueError('Conflicting county reference records.')
        counties[county] = value
        if not zcta:
            unassigned_records += 1
            continue
        if not re.fullmatch(r'\d{5}', zcta):
            raise ValueError('Invalid ZCTA code; five-digit strings must be retained.')
        zip_areas.setdefault(zcta, set()).add(county)

    # The complete multimap is retained, including tiny overlaps and unsupported CT.
    # Consumers MUST block any result touching unsupportedStates, not discard those counties.
    ordered_areas = {zcta: sorted(counties_) for zcta, counties_ in sorted(zip_areas.items())}
    return {
        'schemaVersion': 1,
        'source': {
            'name': 'U.S. Census Bureau 2020 ZCTA to County Relationship File',
            'url': SOURCE_URL,
            'vintage': '2020',
            'lastModifiedDate': '2021-12-09',
            'retrievedDate': '2026-10-10',
            'sha256': SOURCE_SHA256,
            'rightsUrl': RIGHTS_URL,
            'attribution': 'Source: U.S. Census Bureau, 2020 ZCTA–County Relationship File. Osprey Zero derived this lookup; the Census Bureau does not endorse this service.',
            'license': 'U.S. government public-domain data in the United States; Census requests attribution.',
            'definitionsUrl': 'https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html',
            'recordLayoutUrl': 'https://www.census.gov/programs-surveys/geography/technical-documentation/records-layout/2020-zcta-record-layout.html',
            'stateReference': {'url': STATE_URL, 'sha256': STATE_SHA256, 'retrievedDate': '2026-10-10'},
        },
        'coverage': 'Approximate 2020 Census ZIP areas and every intersecting 2020 county. This is not a current or complete USPS postal ZIP directory, a point location, or an alert boundary.',
        'unsupportedStates': ['CT'],
        'unsupportedReasons': {
            'CT': 'Connecticut county-equivalent geography changed after 2020. ZIP-area matching is unavailable until compatibility with alert county codes has been validated. Use the Connecticut state filter and check the original source.'
        },
        'limitations': [
            'Not every valid postal ZIP has a ZCTA. Some PO-box-only or organization ZIPs have a ZCTA and others do not; new ZIPs may be absent.',
            'ZCTAs can cross county and state boundaries. Match every listed county, never only a primary county or centroid.',
            'A county match means potentially relevant somewhere in that county, not confirmed coverage of a residence or ZIP area.',
            'A missing ZIP or unsupported geography must preserve the existing view and offer a manual county/state fallback, never an empty local result.',
            'National, country-wide and unknown-location items must remain available separately from county matches.',
        ],
        'counts': {
            'sourceRecords': source_records,
            'unassignedZctaRecords': unassigned_records,
            'zipAreas': len(ordered_areas),
            'counties': len(counties),
            'relationships': sum(len(value) for value in ordered_areas.values()),
            'multiCountyZipAreas': sum(len(value) > 1 for value in ordered_areas.values()),
        },
        'states': dict(sorted(states.items())),
        'counties': dict(sorted(counties.items())),
        'zipAreas': ordered_areas,
    }


def serialize(document: dict) -> bytes:
    return (json.dumps(document, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Local copy of the exact pinned Census relationship file')
    parser.add_argument('--states', type=Path, help='Local copy of the exact pinned Census state reference')
    parser.add_argument('--download', action='store_true', help='Explicitly permit downloading either missing source from Census')
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--check', action='store_true', help='Compare the reproducible result with the existing output without writing')
    args = parser.parse_args()
    if not args.download and (args.source is None or args.states is None):
        parser.error('Supply both --source and --states, or use --download for the fixed official files.')
    try:
        raw = read_pinned(args.source, SOURCE_URL, SOURCE_SHA256)
        state_raw = read_pinned(args.states, STATE_URL, STATE_SHA256)
        document = build_document(raw, state_raw)
        result = serialize(document)
        if args.check:
            if args.output.read_bytes() != result:
                raise ValueError('Generated lookup differs from the checked-in file.')
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_bytes(result)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f'ZIP-area build failed: {exc}', file=sys.stderr)
        return 1
    print(f"{'Verified' if args.check else 'Built'} {document['counts']['zipAreas']:,} ZIP areas, {document['counts']['relationships']:,} county relationships; {len(result):,} bytes.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
