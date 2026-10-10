"""Standard-library-only checks of the pinned local-area assets and generator logic."""
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import build_local_areas as builder

ROOT = Path(__file__).resolve().parents[1]
STATES = {'CA': {'name': 'California', 'fips': '06'}, 'CT': {'name': 'Connecticut', 'fips': '09'}}
COUNTIES = {'06001': {'name': 'Alameda County', 'state': 'CA'}, '06003': {'name': 'Alpine County', 'state': 'CA'}, '09003': {'name': 'Hartford County', 'state': 'CT'}}
HEADER = 'STATE|STATEFP|COUNTYFP|COUNTYNAME|PLACEFP|PLACENAME|TYPE\n'


class GeneratorTests(unittest.TestCase):
    def data(self, *records):
        return builder.build_places((HEADER + '\n'.join(records) + '\n').encode(), STATES, COUNTIES)

    def test_complete_multimap_and_leading_zero_identifiers(self):
        data = self.data('CA|06|001|Alameda County|00001|Example city|INCORPORATED PLACE', 'CA|06|003|Alpine County|00001|Example city|INCORPORATED PLACE')
        self.assertEqual(data['places'][0]['id'], '0600001')
        self.assertEqual(data['places'][0]['counties'], ['06001', '06003'])

    def test_same_name_place_ids_not_collapsed(self):
        data = self.data('CA|06|001|Alameda County|00001|Example city|INCORPORATED PLACE', 'CA|06|003|Alpine County|00002|Example city|INCORPORATED PLACE')
        self.assertEqual(len(data['places']), 2)

    def test_county_relation_must_match_source_exactly(self):
        for row in ['CA|06|099|Unknown County|00001|Example city|INCORPORATED PLACE', 'CA|06|001|Wrong County|00001|Example city|INCORPORATED PLACE', 'CT|06|001|Alameda County|00001|Example city|INCORPORATED PLACE']:
            with self.subTest(row=row), self.assertRaises(ValueError):
                self.data(row)

    def test_conflicting_source_place_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Conflicting place'):
            self.data('CA|06|001|Alameda County|00001|Example city|INCORPORATED PLACE', 'CA|06|003|Alpine County|00001|Wrong city|INCORPORATED PLACE')

    def test_deterministic_source_order(self):
        a, b = 'CA|06|001|Alameda County|00001|Example city|INCORPORATED PLACE', 'CA|06|003|Alpine County|00001|Example city|INCORPORATED PLACE'
        self.assertEqual(builder.serialize(self.data(a, b)), builder.serialize(self.data(b, a)))

    def test_source_changes_rejected_without_download(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'source.txt'
            path.write_bytes(b'changed source')
            with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
                builder.read_pinned(path, 'places')

    def test_ring_unwrap_and_no_dropped_ring(self):
        ring = builder.encode_ring([(179, 51), (-179, 51), (-179, 52), (179, 51)])
        self.assertEqual(ring[:4], [17900000, 5100000, 18100000, 5200000])
        with self.assertRaisesRegex(ValueError, 'drop'):
            builder.encode_ring([(0, 0), (0.0000001, 0), (0, 0.0000001), (0, 0)])


class ArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw_places = (ROOT / 'briefing/place-areas.json').read_bytes()
        cls.raw_geometry = (ROOT / 'briefing/county-geometry.json').read_bytes()
        cls.places, cls.geometry = json.loads(cls.raw_places), json.loads(cls.raw_geometry)

    def test_exact_pinned_artifact_hashes(self):
        self.assertEqual(hashlib.sha256(self.raw_places).hexdigest(), '3e790459d370513e6cc9ca2f7ed267e4b159a97ab2f7e1c9c9656bff696aed10')
        self.assertEqual(hashlib.sha256(self.raw_geometry).hexdigest(), '9ea816ea01ac5e7330a095e67acbfc625a39406eaa03fe2a2e8a797fd248bb74')

    def test_counts_and_bounded_lazy_assets(self):
        self.assertEqual(self.places['counts'], {'places': 32188, 'sourceRelationships': 33618, 'relationships': 33618, 'multiCountyPlaces': 1304})
        self.assertEqual(self.geometry['counts'], {'counties': 3234, 'rings': 3415, 'sourceVertices': 8086467, 'vertices': 363710})
        self.assertLess(len(self.raw_places), 4_000_000)
        self.assertLess(len(self.raw_geometry), 4_000_000)
        self.assertLess(len(gzip.compress(self.raw_places, mtime=0)), 600_000)
        self.assertLess(len(gzip.compress(self.raw_geometry, mtime=0)), 1_800_000)

    def test_every_place_has_complete_same_state_reference(self):
        self.assertEqual(len({p['id'] for p in self.places['places']}), 32188)
        for place in self.places['places']:
            self.assertTrue(place['counties'])
            self.assertEqual(len(place['counties']), len(set(place['counties'])))
            for code in place['counties']:
                self.assertEqual(self.places['counties'][code]['state'], place['state'])
                self.assertEqual(code[:2], place['id'][:2])

    def test_ct_old_vintage_explicitly_blocked(self):
        for data in [self.places, self.geometry]:
            self.assertEqual(data['unsupportedStates'], ['CT'])
            self.assertEqual(data['sourceVintage'], '2020')
        self.assertEqual(sum(county['state'] == 'CT' for county in self.geometry['counties']), 8)
        self.assertTrue(all(not county['code'].startswith('091') for county in self.geometry['counties']))

    def test_all_geometry_rings_closed_and_bounding_boxes_exact(self):
        count = 0
        for county in self.geometry['counties']:
            self.assertEqual(self.places['counties'][county['code']], {'name': county['name'], 'state': county['state']})
            for ring in county['rings']:
                self.assertEqual(len(ring) % 2, 0)
                self.assertGreaterEqual(len(ring), 12)
                x = y = 0
                points = []
                for i in range(4, len(ring), 2):
                    x += ring[i]
                    y += ring[i + 1]
                    points.append((x, y))
                    self.assertTrue(-90 * builder.SCALE <= y <= 90 * builder.SCALE)
                self.assertEqual(points[0], points[-1])
                self.assertGreaterEqual(len(set(points)), 3)
                self.assertEqual(ring[:4], [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)])
                count += len(points)
        self.assertEqual(count, 363710)


if __name__ == '__main__':
    unittest.main()
