import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from nursery_research import merge_nursery_research

SOURCE = 'https://nido.example.it/servizi/'

class NurseryResearchTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name)
        self.base = [
            {'id': f'nido-test-{i}', 'slug': f'nido-test-{i}', 'name': f'Nido di esempio {i}',
             'address': f'Via di esempio {i}', 'municipality': 1, 'management': 'Privata',
             'hours': None, 'cost': None, 'services': [], 'openDay': None, 'description': '',
             'warnings': [], 'sources': [], 'events': [], 'enriched': False,
             'detailYear': None, 'lat': 45.46, 'lng': 9.19, 'url': None, 'officialPage': None,
             'status': 'active', 'dataStatus': {}, 'locationYear': '2026/27',
             'serviceType': 'Nido d’infanzia'}
            for i in (1, 2)
        ]
        self.manifest = {'checkedAt': '2026-11-16', 'groups': {'test': [s['id'] for s in self.base]}}
        self.rows = [self.record(s['id']) for s in self.base]
        self.write()

    def tearDown(self):
        self.folder.cleanup()

    def record(self, ident):
        return {'id': ident, 'checkedAt': '2026-11-16', 'researchComplete': True,
                'officialUrl': SOURCE, 'officialPage': SOURCE,
                'hours': 'Pagina del servizio: 8:00–18:00.', 'cost': '2026/27: 600 €/mese, pasti inclusi.',
                'services': ['Giardino documentato dalla sede.'], 'openDay': None, 'events': [],
                'sources': [{'label': 'Pagina ufficiale', 'url': SOURCE, 'year': '2026/27',
                             'publicPublicationEvidence': {'pageUrl': SOURCE, 'linkText': 'Orari e servizi', 'rationale': 'Pagina pubblica informativa del gestore.'}}],
                'attempts': [{'url': SOURCE, 'outcome': 'Pagina ufficiale letta.'}],
                'fieldEvidence': {field: {'status': 'not-published' if field == 'openDay' else 'verified', 'sourceUrls': [SOURCE], 'year': '2026/27'} for field in ('hours', 'cost', 'services', 'openDay')}}

    def write(self):
        (self.path / 'assignment-manifest.json').write_text(json.dumps(self.manifest))
        (self.path / 'test.json').write_text(json.dumps(self.rows))

    def merge(self):
        self.write()
        return merge_nursery_research(self.base, research_dir=self.path)

    def test_missing_or_duplicate_records_are_rejected_without_altering_base(self):
        original = copy.deepcopy(self.base)
        self.rows.pop()
        with self.assertRaisesRegex(ValueError, 'incompleta'):
            self.merge()
        self.assertEqual(original, self.base)
        self.rows.append(copy.deepcopy(self.rows[0]))
        with self.assertRaisesRegex(ValueError, 'duplicata'):
            self.merge()

    def test_facts_require_intentional_publication_and_uncredentialed_urls(self):
        del self.rows[0]['sources'][0]['publicPublicationEvidence']
        with self.assertRaisesRegex(ValueError, 'pubblic'):
            self.merge()
        self.rows[0] = self.record(self.base[0]['id'])
        self.rows[0]['sources'][0]['publicPublicationEvidence']['pageUrl'] += '?token=private'
        with self.assertRaisesRegex(ValueError, 'pubblic'):
            self.merge()

    def test_field_and_event_sources_must_belong_to_the_public_evidence(self):
        self.rows[0]['fieldEvidence']['cost']['sourceUrls'] = ['https://unproven.example.it/tariffa.pdf']
        with self.assertRaisesRegex(ValueError, 'provenienza'):
            self.merge()
        self.rows[0] = self.record(self.base[0]['id'])
        self.rows[0]['events'] = [{'id': 'test', 'date': '2026-12-01', 'time': 'mattina', 'source': SOURCE}]
        with self.assertRaisesRegex(ValueError, 'Orario'):
            self.merge()

    def test_conflicting_locations_drop_the_point_preserving_identity_and_proof(self):
        original = copy.deepcopy(self.base)
        self.rows[0].update(locationConflict=True, locationEvidenceUrls=[SOURCE], warnings=['Indirizzo del gestore discordante dal registro.'])
        schools, report = self.merge()
        self.assertEqual([s['id'] for s in schools], [s['id'] for s in original])
        self.assertEqual(schools[0]['slug'], original[0]['slug'])
        self.assertEqual(schools[0]['address'], original[0]['address'])
        self.assertIsNone(schools[0]['lat'])
        self.assertIsNone(schools[0]['lng'])
        self.assertEqual(schools[0]['status'], 'needs-review')
        self.assertEqual(len(report['locationConflicts']), 1)
        added = next(s for s in schools[0]['sources'] if s['url'] == SOURCE)
        self.assertIn('publicPublicationEvidence', added)
        self.assertEqual(original, self.base)

    def test_replay_is_deterministic_and_event_identifiers_are_stable(self):
        self.rows[0]['events'] = [{'id': 'provided', 'date': '2026-12-01', 'time': '9:00–10:00', 'source': SOURCE}]
        first, report = self.merge()
        second, _ = self.merge()
        self.assertEqual(first, second)
        self.assertEqual(first[0]['events'][0]['time'], '09:00–10:00')
        self.assertTrue(first[0]['events'][0]['id'].startswith(self.base[0]['id']))
        self.assertEqual(report['reviewed'], 2)
        self.assertEqual(report['events'], 1)
        self.assertTrue(first[0]['research']['schoolSpecific'])
        self.assertTrue(first[0]['enriched'])

    def test_network_rules_alone_do_not_claim_site_specific_details(self):
        for row in self.rows:
            for field in ('hours', 'cost', 'services'):
                row['fieldEvidence'][field]['status'] = 'operator-rule'
        schools, report = self.merge()
        self.assertTrue(all(not s['research']['schoolSpecific'] for s in schools))
        self.assertEqual(report['schoolSpecificDetails'], 0)

    def test_report_is_identical_for_reconstructed_and_sorted_input(self):
        _, first = self.merge()
        self.base.reverse()
        _, second = self.merge()
        self.assertEqual(json.dumps(first), json.dumps(second))

if __name__ == '__main__':
    unittest.main()
