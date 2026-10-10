"""Offline checks for the Census ZIP-area artifact and lossless multimap generator."""
from pathlib import Path
import gzip
import hashlib
import json
import tempfile
import unittest

import build_zip_areas as builder

ROOT = Path(__file__).resolve().parents[1]
STATE_FIXTURE = b'STATE|STUSAB|STATE_NAME|STATENS\n06|CA|California|0\n09|CT|Connecticut|0\n21|KY|Kentucky|0\n47|TN|Tennessee|0\n72|PR|Puerto Rico|0\n'
HEADER = 'GEOID_ZCTA5_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_PART\n'


def build(*records):
    return builder.build_document(('\ufeff' + HEADER + '\n'.join(records) + '\n').encode(), STATE_FIXTURE)


class GeneratorTests(unittest.TestCase):
    def test_leading_zeroes_are_not_numbers(self):
        data = build('00901|72127|San Juan Municipio|1')
        self.assertEqual(data['zipAreas'], {'00901': ['72127']})
        self.assertEqual(data['counties']['72127'], {'name': 'San Juan Municipio', 'state': 'PR'})

    def test_all_counties_kept_even_tiny_or_zero_area(self):
        data = build('06331|09015|Windham County|105575118', '06331|09011|New London County|0')
        self.assertEqual(data['zipAreas']['06331'], ['09011', '09015'])
        self.assertEqual(data['counts']['relationships'], 2)

    def test_cross_state_relationships_kept(self):
        data = build('42223|47125|Montgomery County|1', '42223|21047|Christian County|999999')
        self.assertEqual(data['zipAreas']['42223'], ['21047', '47125'])
        self.assertEqual({data['counties'][fips]['state'] for fips in data['zipAreas']['42223']}, {'KY', 'TN'})

    def test_blank_zcta_not_indexed_but_county_retained(self):
        data = build('|06037|Los Angeles County|12')
        self.assertEqual(data['zipAreas'], {})
        self.assertIn('06037', data['counties'])
        self.assertEqual(data['counts']['unassignedZctaRecords'], 1)

    def test_duplicate_relationship_deduplicated(self):
        row = '90210|06037|Los Angeles County|1'
        self.assertEqual(build(row, row)['zipAreas']['90210'], ['06037'])

    def test_conflicting_county_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Conflicting county'):
            build('90210|06037|Los Angeles County|1', '90211|06037|Different County|1')

    def test_invalid_zip_rejected(self):
        for zcta in ['901', '9001x', '123456', '90210-1234']:
            with self.subTest(zcta=zcta), self.assertRaisesRegex(ValueError, 'Invalid ZCTA'):
                build(f'{zcta}|06037|Los Angeles County|1')

    def test_unmapped_county_rejected(self):
        with self.assertRaisesRegex(ValueError, 'unmapped county'):
            build('90210|99037|Unknown County|1')

    def test_invalid_county_rejected(self):
        with self.assertRaisesRegex(ValueError, 'county record'):
            build('90210|6037|Los Angeles County|1')

    def test_missing_columns_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Missing required'):
            builder.build_document(b'wrong|columns\n', STATE_FIXTURE)

    def test_duplicate_state_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate state'):
            builder.build_document(HEADER.encode(), STATE_FIXTURE + b'06|CA|California|0\n')

    def test_unknown_source_revision_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'source.txt'
            path.write_bytes(b'changed source')
            with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
                builder.read_pinned(path, builder.SOURCE_URL, builder.SOURCE_SHA256)

    def test_known_hash_local_source_accepted_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'source.txt'
            raw = b'local fixture'
            path.write_bytes(raw)
            self.assertEqual(builder.read_pinned(path, builder.SOURCE_URL, hashlib.sha256(raw).hexdigest()), raw)

    def test_deterministic_regardless_of_relationship_order(self):
        records = ('90210|06037|Los Angeles County|1', '00901|72127|San Juan Municipio|1')
        self.assertEqual(builder.serialize(build(*records)), builder.serialize(build(*reversed(records))))


class CheckedInArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = (ROOT / 'briefing/zip-areas.json').read_bytes()
        cls.data = json.loads(cls.raw)

    def test_counts_match_pinned_official_source(self):
        self.assertEqual(self.data['counts'], {
            'sourceRecords': 47863, 'unassignedZctaRecords': 903,
            'zipAreas': 33791, 'counties': 3234, 'relationships': 46960,
            'multiCountyZipAreas': 10186,
        })
        self.assertEqual(len(self.data['zipAreas']), 33791)
        self.assertEqual(sum(map(len, self.data['zipAreas'].values())), 46960)
        self.assertEqual(len(self.data['counties']), 3234)

    def test_every_relationship_resolves_and_preserves_strings(self):
        for code, counties in self.data['zipAreas'].items():
            self.assertRegex(code, r'^\d{5}$')
            self.assertTrue(counties)
            self.assertEqual(counties, sorted(set(counties)))
            for fips in counties:
                self.assertRegex(fips, r'^\d{5}$')
                county = self.data['counties'][fips]
                self.assertTrue(county['name'])
                self.assertEqual(self.data['states'][county['state']]['fips'], fips[:2])

    def test_representative_real_crosswalks(self):
        for code, counties in {'90210': ['06037'], '00901': ['72127'], '96950': ['69110'],
                               '42223': ['21047', '47125'], '02861': ['25005', '44007'],
                               '06331': ['09011', '09015']}.items():
            self.assertEqual(self.data['zipAreas'][code], counties)

    def test_missing_codes_are_not_invented(self):
        for code in ['', '00000', '99999', '00501', '90210-1234']:
            self.assertNotIn(code, self.data['zipAreas'])
        self.assertIn('missing ZIP', ' '.join(self.data['limitations']))

    def test_ct_retained_but_explicitly_unsupported(self):
        self.assertEqual(self.data['unsupportedStates'], ['CT'])
        self.assertIn('state filter', self.data['unsupportedReasons']['CT'])
        ct_matches = [code for code, counties in self.data['zipAreas'].items()
                      if any(self.data['counties'][fips]['state'] == 'CT' for fips in counties)]
        self.assertEqual(len(ct_matches), 288)

    def test_source_metadata_and_license(self):
        source = self.data['source']
        self.assertEqual(source['url'], builder.SOURCE_URL)
        self.assertEqual(source['sha256'], builder.SOURCE_SHA256)
        self.assertEqual(source['stateReference']['sha256'], builder.STATE_SHA256)
        self.assertEqual(source['vintage'], '2020')
        self.assertEqual(source['lastModifiedDate'], '2021-12-09')
        self.assertEqual(source['retrievedDate'], '2026-10-10')
        self.assertEqual(source['rightsUrl'], builder.RIGHTS_URL)
        self.assertIn('U.S. Census Bureau', source['attribution'])

    def test_compact_canonical_output_and_no_point_coordinates(self):
        self.assertEqual(self.raw, builder.serialize(self.data))
        self.assertLess(len(self.raw), 1_000_000)
        self.assertLess(len(gzip.compress(self.raw, mtime=0)), 200_000)
        for county in self.data['counties'].values():
            self.assertEqual(set(county), {'name', 'state'})


if __name__ == '__main__':
    unittest.main(verbosity=2)
