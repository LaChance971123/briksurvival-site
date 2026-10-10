#!/usr/bin/env python3
"""Build pinned, browser-local Census place and approximate county lookups.

This is an explicit data-maintenance command, never a site build/network refresh.
Raw downloaded inputs belong outside the repository and public deployment.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'places': ('https://www2.census.gov/geo/docs/reference/codes2020/national_place_by_county2020.txt', '9996494d33cf6ee4527491508aa1b8dae85dcff3a979886e19b0b375e5d06ec6'),
    'counties': ('https://www2.census.gov/geo/tiger/TIGER2020/COUNTY/tl_2020_us_county.zip', 'a490d33145b8cd308b0b53113d4bb31575b84a2b4cf6ec28fa5855be37559d8d'),
    'states': ('https://www2.census.gov/geo/docs/reference/state.txt', 'bea4e03f71a1fa0045ae732aabad11fa541e5932b071c2369bb0d325e8cba5a0'),
}
RIGHTS_URL = 'https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2025/TGRSHP2025_TechDoc_Ch1.pdf'
SCALE = 100_000
SIMPLIFY_DEGREES = 0.001
BOUNDARY_MARGIN_METERS = 500
MAX_SOURCE_BYTES = 100_000_000


def read_pinned(path: Path | None, key: str) -> bytes:
    url, digest = SOURCES[key]
    if path is None:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'OspreyZero-LocalArea-Build/1.0'}), timeout=120) as response:
            if response.geturl() != url:
                raise ValueError('Unexpected source redirect.')
            raw = response.read(MAX_SOURCE_BYTES + 1)
    else:
        raw = path.read_bytes()
    if len(raw) > MAX_SOURCE_BYTES or hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError(f'Pinned {key} source size or SHA-256 mismatch. Review source changes before updating the pin.')
    return raw


def rows(raw: bytes, required: set[str]):
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')), delimiter='|')
    if not required.issubset(reader.fieldnames or []):
        raise ValueError('Missing required Census columns.')
    return reader


def build_states(raw: bytes) -> dict:
    result = {}
    for row in rows(raw, {'STATE', 'STUSAB', 'STATE_NAME'}):
        code, fips = row['STUSAB'], row['STATE']
        if not re.fullmatch('[A-Z]{2}', code) or not re.fullmatch(r'\d{2}', fips) or code in result or any(v['fips'] == fips for v in result.values()):
            raise ValueError('Invalid or duplicate state code.')
        result[code] = {'name': row['STATE_NAME'], 'fips': fips}
    return dict(sorted(result.items()))


def common_metadata() -> dict:
    return {
        'schemaVersion': 1,
        'sourceVintage': '2020',
        'retrievedDate': '2026-10-10',
        'license': 'U.S. government public-domain data in the United States; Census requests attribution.',
        'rightsUrl': RIGHTS_URL,
        'attribution': 'Source: U.S. Census Bureau, 2020 Census geographic codes and TIGER/Line® county boundaries. Osprey Zero derived these approximate lookups. The Census Bureau does not endorse this service.',
        'unsupportedStates': ['CT'],
        'unsupportedReasons': {'CT': 'Connecticut county-equivalent geography changed after 2020. Use the Connecticut state filter; compatibility with current alert county codes is not validated.'},
    }


def build_places(raw: bytes, states: dict, counties: dict) -> dict:
    places = {}
    count = 0
    for row in rows(raw, {'STATE', 'STATEFP', 'COUNTYFP', 'COUNTYNAME', 'PLACEFP', 'PLACENAME', 'TYPE'}):
        state, sf, cf, pf = row['STATE'], row['STATEFP'], row['COUNTYFP'], row['PLACEFP']
        if state not in states or states[state]['fips'] != sf or not re.fullmatch(r'\d{3}', cf) or not re.fullmatch(r'\d{5}', pf):
            raise ValueError('Invalid or unmapped place code.')
        county, place = sf + cf, sf + pf
        if county not in counties or counties[county]['state'] != state or counties[county]['name'] != row['COUNTYNAME']:
            raise ValueError(f'County relationship is not identical to the pinned county reference: {county}.')
        name, kind = row['PLACENAME'], row['TYPE']
        if not name or kind not in {'INCORPORATED PLACE', 'CENSUS DESIGNATED PLACE'}:
            raise ValueError('Missing place name or unsupported source type.')
        value = places.setdefault(place, {'id': place, 'name': name, 'state': state, 'counties': [], 'type': kind})
        if value['name'] != name or value['state'] != state or value['type'] != kind:
            raise ValueError('Conflicting place records.')
        if county not in value['counties']:
            value['counties'].append(county)
        count += 1
    ordered = []
    for key in sorted(places):
        value = places[key]
        value['counties'].sort()
        ordered.append(value)
    return {
        **common_metadata(),
        'sources': {k: {'url': SOURCES[k][0], 'sha256': SOURCES[k][1]} for k in ['places', 'states', 'counties']},
        'definitionsUrl': 'https://www.census.gov/library/reference/code-lists/ansi.html#par_textimage_13',
        'coverage': '2020 incorporated places and census-designated places in the United States and territories. Not every mailing city, neighborhood, township or informal community name is a Census place.',
        'limitations': [
            'Every source-listed county relationship is retained. No city point, centroid or nearest county is used.',
            'A selected city broadens matching to all its listed 2020 counties. This does not identify a residence, municipality boundary or alert footprint.',
            'Names, incorporations and boundaries may have changed after 2020. Missing names require manual state/county selection.',
            'Identical city names, including within one state, remain distinct candidates. Never silently select the first result.',
        ],
        'counts': {'places': len(ordered), 'sourceRelationships': count, 'relationships': sum(len(p['counties']) for p in ordered), 'multiCountyPlaces': sum(len(p['counties']) > 1 for p in ordered)},
        'states': states, 'counties': counties, 'places': ordered,
    }


def encode_ring(coords) -> list[int]:
    """Integer delta coordinates with ring bbox; unwrap the antimeridian locally."""
    points = []
    previous_x = None
    for longitude, latitude in coords:
        if not math.isfinite(longitude) or not math.isfinite(latitude):
            raise ValueError('Nonfinite source geometry.')
        x = longitude
        if previous_x is not None:
            x += 360 * round((previous_x - x) / 360)
        previous_x = x
        point = (round(x * SCALE), round(latitude * SCALE))
        if not points or point != points[-1]:
            points.append(point)
    if points[-1] != points[0]:
        points.append(points[0])
    if len(set(points)) < 3:
        raise ValueError('Quantization would drop a geographic ring.')
    result = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]
    x = y = 0
    for nx, ny in points:
        result.extend([nx - x, ny - y])
        x, y = nx, ny
    return result


def build_geometry(raw: bytes, states: dict) -> tuple[dict, dict]:
    # Extra dependencies are needed only for explicit rebuilding, not site builds/tests.
    import shapefile
    import shapely
    from shapely.geometry import shape
    fips_states = {v['fips']: k for k, v in states.items()}
    counties, features = {}, []
    vertices_before = vertices_after = rings_count = 0
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        stem = 'tl_2020_us_county'
        reader = shapefile.Reader(shp=io.BytesIO(archive.read(stem + '.shp')), dbf=io.BytesIO(archive.read(stem + '.dbf')), encoding='utf-8')
        for item in reader.iterShapeRecords():
            rec = item.record.as_dict()
            code, state = rec['GEOID'], fips_states.get(rec['STATEFP'])
            if not re.fullmatch(r'\d{5}', code) or state is None or code in counties:
                raise ValueError('Invalid or duplicate county geometry.')
            counties[code] = {'name': rec['NAMELSAD'], 'state': state}
            geometry = shape(item.shape.__geo_interface__)
            if not geometry.is_valid:
                raise ValueError(f'Invalid source polygon {code}.')
            simplified = geometry.simplify(SIMPLIFY_DEGREES, preserve_topology=True)
            if not simplified.is_valid or simplified.is_empty:
                raise ValueError(f'Invalid simplified polygon {code}.')
            polygons = [simplified] if simplified.geom_type == 'Polygon' else list(simplified.geoms)
            rings = []
            for polygon in polygons:
                rings.extend(encode_ring(ring.coords) for ring in [polygon.exterior, *polygon.interiors])
            if len(rings) != len(item.shape.parts):
                raise ValueError(f'Simplification changed ring count for {code}.')
            vertices_before += len(item.shape.points)
            vertices_after += sum((len(r) - 4) // 2 for r in rings)
            rings_count += len(rings)
            features.append({'code': code, 'name': rec['NAMELSAD'], 'state': state, 'rings': rings})
    return ({
        **common_metadata(),
        'sources': {k: {'url': SOURCES[k][0], 'sha256': SOURCES[k][1]} for k in ['counties', 'states']},
        'coverage': 'Approximate 2020 Census counties and county equivalents, including U.S. territories. Statistical geography, not legal land descriptions, a geocoder, a hazard footprint or proof of present jurisdiction.',
        'encoding': 'delta-rings-v1', 'scale': SCALE,
        'boundaryMarginMeters': BOUNDARY_MARGIN_METERS,
        'maxAccuracyMeters': 50_000,
        'derivation': {'algorithm': 'Shapely topology-preserving Douglas-Peucker simplification, then 1e-5-degree quantization; every exterior and interior ring retained.', 'toleranceDegrees': SIMPLIFY_DEGREES, 'shapelyVersion': shapely.__version__, 'geosVersion': shapely.geos_version_string, 'pyshpVersion': shapefile.__version__},
        'limitations': [
            'Device-reported accuracy plus a 500-meter editorial boundary margin is used to flag approximate border results. This is not a guarantee of source or device accuracy.',
            'Simplification tolerance is 0.001 degree (at most about 112 meters in a single coordinate direction); quantization is 0.00001 degree. Source geometry is NAD83; device GPS is usually WGS84.',
            'A point near any boundary or with more than one plausible county requires explicit county choice. Missing or over-50-km device accuracy cannot produce an automatic county match.',
            'Unmapped coordinates, including outside coverage, must preserve the current view and offer manual state/county selection. Never choose the nearest county.',
            'County relevance is broad and does not establish that an alert applies at a visitor location. National and unknown-location items must remain separately available.',
        ],
        'counts': {'counties': len(features), 'rings': rings_count, 'sourceVertices': vertices_before, 'vertices': vertices_after},
        'counties': sorted(features, key=lambda v: v['code']),
    }, dict(sorted(counties.items())))


def serialize(data: dict) -> bytes:
    return (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    for key in SOURCES:
        parser.add_argument('--' + key, type=Path)
    parser.add_argument('--download', action='store_true', help='Explicitly allow missing pinned inputs to be downloaded.')
    parser.add_argument('--output-directory', type=Path, default=ROOT / 'briefing')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if not args.download and any(getattr(args, key) is None for key in SOURCES):
        parser.error('Provide --places, --counties and --states local inputs, or explicitly use --download.')
    try:
        raw = {key: read_pinned(getattr(args, key), key) for key in SOURCES}
        states = build_states(raw['states'])
        geometry, counties = build_geometry(raw['counties'], states)
        places = build_places(raw['places'], states, counties)
        for name, data, bound in [('place-areas.json', places, 5_500_000), ('county-geometry.json', geometry, 8_000_000)]:
            output = serialize(data)
            if len(output) > bound:
                raise ValueError(f'{name} exceeds decoded asset size budget.')
            path = args.output_directory / name
            if args.check:
                if path.read_bytes() != output:
                    raise ValueError(f'{name} is not reproducible from the pinned inputs.')
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(output)
            print(f'{name}: {len(output):,} bytes; SHA-256 {hashlib.sha256(output).hexdigest()}; {data["counts"]}')
    except (OSError, ValueError, UnicodeError, ImportError) as exc:
        print(f'Local-area build failed: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
