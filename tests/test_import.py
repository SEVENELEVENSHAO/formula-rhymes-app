import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from import_book import parse_ingredients

class IngredientParsingTests(unittest.TestCase):
    def test_shared_dose_attaches_to_all_explicitly_grouped_herbs(self):
        ingredients, note = parse_ingredients([ET.fromstring('<div>麻黄　桂枝<sub>各三两</sub>　杏仁<sub>七十个</sub></div>')])
        self.assertIsNone(note)
        self.assertEqual([(i['name'], i['dose']) for i in ingredients], [('麻黄', '三两'), ('桂枝', '三两'), ('杏仁', '七十个')])

    def test_ambiguous_shared_dose_stays_raw(self):
        ingredients, note = parse_ingredients([ET.fromstring('<div>龟甲　枸杞子<sub>二十两</sub></div>')])
        self.assertEqual(ingredients, [])
        self.assertIsNotNone(note)

    def test_processing_does_not_become_a_dose_for_other_herbs(self):
        ingredients, note = parse_ingredients([ET.fromstring('<div>竹茹　赤茯苓　碧玉散<sub>包，各三钱</sub></div>')])
        self.assertEqual(ingredients, [])
        self.assertIsNotNone(note)

    def test_split_subscript_is_rejoined(self):
        ingredients, note = parse_ingredients([ET.fromstring('<div>桂枝　甘草<sub>各</sub> <sub>一两</sub></div>')])
        self.assertIsNone(note)
        self.assertEqual([i['dose'] for i in ingredients], ['一两', '一两'])

if __name__ == '__main__':
    unittest.main()
