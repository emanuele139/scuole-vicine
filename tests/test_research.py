"""Regression checks for merging evidence into the city catalogue."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from school_research import apply_research, minimize_public_contacts


class ResearchMergeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.base = [{
            'id': 'a', 'slug': 'stable-slug', 'name': 'Scuola A', 'municipality': 1,
            'management': 'Comunale', 'hours': 'Orario precedente', 'cost': 'Costo precedente',
            'openDay': None, 'description': '', 'warnings': [], 'sources': [
                {'url': 'https://example.org/old', 'label': 'Ricerca iniziale', 'checkedAt': '2026-11-15'}
            ], 'events': [], 'enriched': True, 'detailYear': '2026/27', 'lat': 45.4, 'lng': 9.1,
            'url': 'https://example.org/stale', 'officialPage': 'https://example.org/stale',
            'status': 'active', 'dataStatus': {}, 'locationYear': '2025/26',
        }]
        self.row = {
            'id': 'a', 'checkedAt': '2026-11-16', 'attempts': [{'url': 'https://example.org', 'status': 'read'}],
            'sources': [], 'officialUrl': None, 'officialPage': None,
            'hours': None, 'cost': None, 'services': [], 'openDay': None, 'events': [],
            'fieldEvidence': {key: {'status': 'not-found', 'sourceUrls': [], 'year': None}
                              for key in ('hours', 'cost', 'services', 'openDay')},
        }
        (self.folder / 'assignment-manifest.json').write_text(json.dumps({'checkedAt': '2026-11-16', 'groups': {'test': ['a']}}))

    def merge(self, rows=None):
        (self.folder / 'test.json').write_text(json.dumps(rows if rows is not None else [self.row]))
        return apply_research(self.base, research_dir=self.folder)

    def test_unknown_preserves_original_details_and_identity(self):
        result, report = self.merge()
        self.assertEqual(result[0]['hours'], 'Orario precedente')
        self.assertEqual(result[0]['cost'], 'Costo precedente')
        self.assertEqual(result[0]['slug'], 'stable-slug')
        self.assertEqual(result[0]['research']['fieldEvidence']['cost']['status'], 'prior-research')
        self.assertEqual(self.base[0]['dataStatus'], {})
        self.assertEqual(report['missingIds'], [])

    def test_unconfirmed_official_links_are_removed(self):
        result, _ = self.merge()
        self.assertIsNone(result[0]['url'])
        self.assertIsNone(result[0]['officialPage'])

    def test_missing_pending_and_duplicate_records_fail(self):
        with self.assertRaises(ValueError): self.merge([])
        self.row['researchComplete'] = False
        with self.assertRaises(ValueError): self.merge()
        self.row['researchComplete'] = True
        with self.assertRaises(ValueError): self.merge([self.row, copy.deepcopy(self.row)])

    def test_positive_facts_require_a_source(self):
        self.row['cost'] = '100 euro'
        self.row['fieldEvidence']['cost']['status'] = 'verified'
        with self.assertRaises(ValueError): self.merge()

    def test_same_event_with_different_time_format_is_replaced(self):
        self.base[0]['events'] = [{'id': 'old', 'date': '2026-12-01', 'time': '9:00', 'source': 'https://example.org/old'}]
        self.row['events'] = [{'date': '2026-12-01', 'time': '09:00', 'source': 'https://example.org/current'}]
        result, _ = self.merge()
        self.assertEqual(len(result[0]['events']), 1)
        self.assertEqual(result[0]['events'][0]['source'], 'https://example.org/current')
        self.row['events'][0]['time'] = '25:00'
        with self.assertRaises(ValueError): self.merge()

    def test_documented_closure_withholds_historical_coordinates(self):
        self.row.update(statusUpdate='historical', statusSource='https://example.org/closure')
        result, _ = self.merge()
        self.assertEqual(result[0]['status'], 'historical')
        self.assertIsNone(result[0]['lat'])
        self.assertIsNone(result[0]['lng'])

    def test_public_contact_minimization_survives_source_reimports(self):
        rows = [
            {'id': 'mi-1253', 'email': 'persona@example.org', 'phone': '02 000000'},
            {'id': 'extra-dragonfly', 'email': 'altrapersona@example.org'},
            {'id': 'school-test', 'email': 'segreteria@example.org'},
        ]
        result = minimize_public_contacts(rows)
        self.assertIsNone(result[0]['email'])
        self.assertIsNone(result[1]['email'])
        self.assertEqual(result[0]['phone'], '02 000000')
        self.assertEqual(result[2]['email'], 'segreteria@example.org')


if __name__ == '__main__':
    unittest.main()
