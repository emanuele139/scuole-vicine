import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('civic_import', Path(__file__).resolve().parents[1] / 'scripts/import-civic-addresses.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def row(**changes):
    return dict(CODICE_VIA='1', STATOCIVICO='Applicato', STATOVIA='Intitolata', BARRA2='', NUMERO='12',
                NUMEROCOMPLETO='12', LAT_WGS84='45.46', LONG_WGS84='9.19', TIPO='Via',
                DESCRITTIVO='ADA ESEMPIO', ANNCSU='ADA ESEMPIO', OPENSTREETMAP='ADA CAMPIONE') | changes


class CivicImportTests(unittest.TestCase):
    def test_only_applied_standard_addresses_are_kept(self):
        streets, excluded = module.transform([row(), row(STATOCIVICO='Iter in corso'), row(BARRA2='N01'), row(NUMERO='0')])
        self.assertEqual(excluded, 3)
        self.assertEqual(streets[0]['numbers'], [['12', 45.46, 9.19]])
        self.assertIn('Via Ada Campione', streets[0]['aliases'])
        self.assertEqual(set(streets[0]), {'name', 'aliases', 'numbers'})

    def test_duplicates_and_bad_coordinates_require_review(self):
        with self.assertRaises(ValueError):
            module.transform([row(), row(LAT_WGS84='45.47')])
        with self.assertRaises(ValueError):
            module.transform([row(LAT_WGS84='nan')])

    def test_civic_letters_and_numeric_subdivisions_are_retained(self):
        streets, _ = module.transform([row(NUMEROCOMPLETO='12A'), row(NUMEROCOMPLETO='12/1')])
        self.assertEqual({entry[0] for entry in streets[0]['numbers']}, {'12A', '12/1'})


if __name__ == '__main__':
    unittest.main()
