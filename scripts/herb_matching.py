"""Link source names to Open Herbology without erasing processing or ambiguity."""
import collections
import re
import unicodedata

THERMAL_KEYWORDS = [('大热', 'hot'), ('大寒', 'cold'), ('微温', 'warm'), ('微寒', 'cool'), ('微凉', 'cool'), ('温', 'warm'), ('热', 'hot'), ('寒', 'cold'), ('凉', 'cool'), ('平', 'neutral')]
PROCESSING_PREFIXES = ('醋炙', '姜制', '土炒', '酒炒', '盐制', '蜜炙', '麸炒', '炮', '炒', '炙', '制', '煨', '煅', '酒', '生')

# These broad source aliases do not identify a unique herb / medicinal part.
HOLD_NAMES = {
    '芍药': '原书未分赤芍、白芍，不直接采用白芍药性。',
    '炒芍药': '原书未分赤芍、白芍；保留炮制名，药性待核对。',
    '贝母': '原书未分川贝母、浙贝母，药性待核对。',
    '枳壳': '参考库将枳壳列为枳实别名；本 App 保留二者区别，待补独立资料。',
    '青木香': '不直接采用参考库的木香别名映射，待核对来源。',
    '菖蒲': '原书未明确菖蒲品种，不直接套用石菖蒲药性。',
    '竹叶': '保留原书竹叶名称，不直接以淡竹叶替代。',
    '大戟': '参考库指向京大戟，原书品种尚未核对。',
    '红大戟': '不直接采用参考库的京大戟映射，待补独立资料。',
    '草乌': '不以川乌替代草乌，待补独立资料。',
    '制草乌': '不以川乌替代制草乌，待补独立资料。',
}

# Reference relationships, not identity assertions. Some processed products need
# their own nature entry, so the base herb's color is deliberately withheld.
REFERENCE_ONLY = {
    '胆南星': ('天南星', True), '胆星': ('天南星', True),
    '半夏曲': ('半夏', True), '千金子霜': ('续随子', True),
    '茯神': ('茯苓', False), '茯神木': ('茯苓', False),
    '茯苓皮': ('茯苓', False), '生姜皮': ('生姜', False),
    '莲须': ('莲子', False), '鹿角胶': ('鹿角', False),
    '椒目': ('蜀椒', False), '皂角刺': ('皂荚', False),
    '橘红': ('陈皮', False), '瓜蒌仁': ('瓜蒌', False),
    '瓜蒌子': ('瓜蒌', False),
}

ADDITIONAL_ALIASES = {
    '海螵蛸': ('乌贼骨', '国家中医药研究所标本馆：海螵蛸的别名含乌贼骨。', 'https://www.nricm.edu.tw/htcm/catalog/tcm_herbal_detailse24d.html?id=910'),
}

def normalize_name(name):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', name)).translate(str.maketrans({'朮': '术', '耆': '芪'})).strip('。．')

def nature_label(nature):
    clause = re.split(r'[。；;]|[归入人][^，。]*经', nature or '')[0]
    for word, _ in THERMAL_KEYWORDS:
        if word in clause:
            return word
    return '待补资料'

def thermal(nature):
    label = nature_label(nature)
    return dict(THERMAL_KEYWORDS).get(label, 'unknown')

def prescription_names(value, medicine=None):
    result = set()
    for group in re.finditer(r'(?:^|[）)。；])([^（()\n]+)（([^）]*)）', value or ''):
        same_as = re.search(r'均为([^，。]+)', group[2])
        if same_as and medicine and normalize_name(same_as[1]) != normalize_name(medicine):
            continue
        for name in re.split(r'[、，]', group[1]):
            name = name.strip()
            if 1 < len(name) <= 10 and re.fullmatch(r'[\u3400-\u9fff]+', name):
                result.add(normalize_name(name))
    return result

class HerbMatcher:
    def __init__(self, rows, alias_rows):
        self.rows = {str(row['ID']): row for row in rows}
        self.direct = collections.defaultdict(set)
        self.aliases = collections.defaultdict(dict)
        self.forms = collections.defaultdict(dict)
        for herb_id, row in self.rows.items():
            self.direct[normalize_name(row['Medicine'])].add(herb_id)
        for herb_id, row in self.rows.items():
            for alias in re.split(r'[、，,。；;\n]', row.get('Alias') or ''):
                if alias.strip():
                    self.aliases[normalize_name(alias)][herb_id] = f"raw-herbs.json #{herb_id} Alias"
            for name in prescription_names(row.get('Prescription'), row['Medicine']):
                self.forms[name][herb_id] = f"raw-herbs.json #{herb_id} Prescription"
        for alias in alias_rows:
            targets = self.direct.get(normalize_name(alias['Medicine']), set())
            for herb_id in targets:
                self.aliases[normalize_name(alias['Alias'])][herb_id] = f"raw-herb-aliases.json #{alias['ID']}"

    def _result(self, herb_id=None, method='unmatched', scope='unresolved', evidence='', note='', hold=False):
        row = self.rows.get(herb_id)
        return {'herbId': herb_id, 'thermal': thermal(row.get('GuiJing')) if row and not hold else 'unknown',
                'natureLabel': nature_label(row.get('GuiJing')) if row and not hold else '待核对' if method == 'ambiguous' or hold else '待补资料',
                'match': {'method': method, 'scope': scope, 'referenceName': row['Medicine'] if row else None,
                          'evidence': evidence, 'note': note}}

    def match(self, name):
        key = normalize_name(name)
        if key in HOLD_NAMES:
            return self._result(method='ambiguous', note=HOLD_NAMES[key])
        if key in ADDITIONAL_ALIASES:
            target, note, url = ADDITIONAL_ALIASES[key]
            ids = self.direct.get(normalize_name(target), set())
            if len(ids) == 1:
                return self._result(next(iter(ids)), 'documented-alias', 'ingredient', url, note)
        direct = self.direct.get(key, set())
        if len(direct) == 1:
            herb_id = next(iter(direct))
            method = 'exact' if name == self.rows[herb_id]['Medicine'] else 'normalized'
            return self._result(herb_id, method, 'ingredient', f'raw-herbs.json #{herb_id} Medicine', '按异体字或字形对应关联，原书药名不变。' if method == 'normalized' else '')
        if len(direct) > 1:
            return self._result(method='ambiguous', note='规范化药名命中多条记录，待核对。')
        if key in REFERENCE_ONLY:
            target, hold = REFERENCE_ONLY[key]
            ids = self.direct.get(normalize_name(target), set())
            if len(ids) == 1:
                note = f'保留{name}名称；仅关联{target}作为基药参考，不表示药用部位或炮制品相同。'
                if hold:
                    note += '该品药性需独立资料，不沿用基药颜色。'
                return self._result(next(iter(ids)), 'reference', 'base-herb', 'Open Herbology 关联资料；见匹配策略', note, hold)
        aliases = self.aliases.get(key, {})
        if len(aliases) > 1:
            return self._result(method='ambiguous', note='别名指向多条记录，待核对。')
        if len(aliases) == 1:
            herb_id, evidence = next(iter(aliases.items()))
            is_form = any(key.startswith(prefix) for prefix in PROCESSING_PREFIXES)
            return self._result(herb_id, 'alias', 'base-herb' if is_form else 'ingredient', evidence,
                                '保留炮制名称；色彩仅为基药药性参考。' if is_form else '采用 Open Herbology 的别名关联，原书药名保持不变。')
        forms = self.forms.get(key, {})
        if len(forms) == 1:
            herb_id, evidence = next(iter(forms.items()))
            return self._result(herb_id, 'prescription', 'base-herb', evidence, '参考库的炮制规格中收录此名；显示基药性味，不代表炮制后药性已独立核定。')
        if len(forms) > 1:
            return self._result(method='ambiguous', note='炮制规格名称指向多条记录，待核对。')
        for prefix in PROCESSING_PREFIXES:
            if key.startswith(prefix) and len(key) > len(prefix) + 1:
                base = key[len(prefix):]
                base_result = self.match(base)
                if base_result['herbId'] and base_result['match']['scope'] == 'ingredient':
                    return self._result(base_result['herbId'], 'processing-reference', 'base-herb', base_result['match']['evidence'],
                                        f'原书炮制标记“{prefix}”保留；仅提供{base_result["match"]["referenceName"]}的基药药性参考。')
        return self._result(note='参考库尚无明确匹配，待补资料；不默认为平性。')

    def enrich_herbs(self):
        return [{'id': herb_id, 'name': row['Medicine'], 'nature': row.get('GuiJing') or '',
                 'thermal': thermal(row.get('GuiJing')), 'natureLabel': nature_label(row.get('GuiJing')),
                 'action': row.get('Function') or '', 'prescription': row.get('Prescription') or '',
                 'aliases': sorted({alias for alias, matches in self.aliases.items() if herb_id in matches}),
                 'reviewStatus': 'pending', 'source': f'Open Herbology · raw-herbs.json #{herb_id}'} for herb_id, row in self.rows.items()]
