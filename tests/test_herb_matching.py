import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from import_book import thermal
from herb_matching import HerbMatcher, prescription_names

class ThermalRegressionTests(unittest.TestCase):
    def test_micro_cold_uses_open_herbology_cool_group(self):
        self.assertEqual(thermal('甘、微苦，微寒。归肺、胃经。'), 'cool')

    def test_does_not_classify_the_action_text_as_nature(self):
        self.assertEqual(thermal('甘，平。归脾经。清热。'), 'neutral')

class HerbMatchingTests(unittest.TestCase):
    def setUp(self):
        self.matcher = HerbMatcher([
            {'ID': 1, 'Medicine': '白朮', 'GuiJing': '苦、甘，温。入脾、胃经。', 'Alias': '白术。'},
            {'ID': 2, 'Medicine': '甘草', 'GuiJing': '甘，平。入十二经。', 'Prescription': '生甘草、炙甘草（蜜炙用）。'},
            {'ID': 3, 'Medicine': '白芍', 'GuiJing': '微寒。'},
            {'ID': 4, 'Medicine': '麦门冬', 'GuiJing': '甘，微寒。', 'Prescription': '麦门冬、麦冬（切片用）。'},
            {'ID': 5, 'Medicine': '生地黄', 'GuiJing': '寒。'},
            {'ID': 6, 'Medicine': '熟地黄', 'GuiJing': '微温。'},
            {'ID': 7, 'Medicine': '炮姜', 'GuiJing': '温。'},
        ], [
            {'ID': 1, 'Alias': '炙甘草', 'Medicine': '甘草'},
            {'ID': 2, 'Alias': '芍药', 'Medicine': '白芍'},
            {'ID': 3, 'Alias': '麦冬', 'Medicine': '麦门冬'},
            {'ID': 4, 'Alias': '生地', 'Medicine': '生地黄'},
            {'ID': 5, 'Alias': '熟地', 'Medicine': '熟地黄'},
        ])

    def test_variant_names_match_without_changing_display_identity(self):
        result = self.matcher.match('白术')
        self.assertEqual(result['herbId'], '1')
        self.assertEqual(result['thermal'], 'warm')
        self.assertEqual(result['match']['scope'], 'ingredient')

    def test_processed_name_is_a_labeled_reference_not_silent_identity_merge(self):
        result = self.matcher.match('炙甘草')
        self.assertEqual(result['herbId'], '2')
        self.assertEqual(result['match']['scope'], 'base-herb')
        self.assertEqual(result['natureLabel'], '平')
        self.assertIn('#1', result['match']['evidence'])

    def test_unambiguous_synonym_is_not_mislabeled_as_processing(self):
        result = self.matcher.match('麦冬')
        self.assertEqual(result['thermal'], 'cool')
        self.assertEqual(result['natureLabel'], '微寒')
        self.assertEqual(result['match']['scope'], 'ingredient')

    def test_ambiguous_and_distinct_drugs_are_not_forced_into_aliases(self):
        for name in ['芍药', '枳壳', '青木香', '草乌']:
            self.assertIsNone(self.matcher.match(name)['herbId'])
            self.assertEqual(self.matcher.match(name)['thermal'], 'unknown')

    def test_raw_prepared_and_canonical_processed_entries_stay_separate(self):
        self.assertEqual(self.matcher.match('生地')['herbId'], '5')
        self.assertEqual(self.matcher.match('熟地')['herbId'], '6')
        self.assertEqual(self.matcher.match('炮姜')['match']['scope'], 'ingredient')
        self.assertEqual(self.matcher.match('炮姜')['herbId'], '7')

    def test_alias_conflict_stays_unresolved(self):
        matcher = HerbMatcher([{'ID': 1, 'Medicine': '甲', 'Alias': '同名。'}, {'ID': 2, 'Medicine': '乙', 'Alias': '同名。'}], [])
        self.assertIsNone(matcher.match('同名')['herbId'])

    def test_form_clause_cannot_capture_another_drug_listed_in_the_same_row(self):
        names = prescription_names('川贝母、川贝（均为川贝母）、象贝母、浙贝（均为象贝母）。', '川贝母')
        self.assertIn('川贝', names)
        self.assertNotIn('浙贝', names)

if __name__ == '__main__':
    unittest.main()
