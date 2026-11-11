"""Deterministic, source-preserving EPUB import. No document content is executed."""
import argparse
import collections
import hashlib
import html
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath
from herb_matching import HerbMatcher, thermal

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BOOK = ROOT / 'Separated EPUBs/08 汤头歌诀白话解（第6版）.epub'
DEFAULT_HERBS = Path('C:/Users/ASUS/projects/tcm-fangyao-app/src/data/raw-herbs.json')

def text(el):
    def walk(node):
        value = node.text or ''
        for child in node:
            if child.tag.split('}')[-1] == 'img':
                # This title glyph was visually checked against the embedded image.
                value += {'Image00535.gif': '蹻'}.get(PurePosixPath(child.get('src','')).name, '〔原书字形〕')
            else:
                value += walk(child)
            value += child.tail or ''
        return value
    return re.sub(r'[\t\r\n ]+', ' ', walk(el)).strip()

def identity(el):
    value = rich(el)
    value = re.sub(r'<sup>.*?</sup>', '', value)
    value = value.replace('<img class="book-glyph" src="/book-images/Image00535.gif" alt="原书字形" />', '蹻')
    value = re.sub(r'<img[^>]*>', '〔原书字形〕', value)
    return re.sub(r'\s+', '', html.unescape(re.sub('<[^>]+>', '', value)))

def clean_name(value):
    return re.sub(r'^\d+[.．、]\s*', '', value).strip()

def rich(el):
    # Whitelist the tiny set of book formatting elements; never retain links/scripts.
    value = html.escape(el.text or '')
    for child in el:
        tag = child.tag.split('}')[-1]
        if tag == 'img':
            filename = PurePosixPath(child.get('src', '')).name
            value += f'<img class="book-glyph" src="/book-images/{html.escape(filename)}" alt="原书字形" />'
        elif tag in ('sub', 'sup', 'b', 'strong', 'em', 'i'):
            value += f'<{tag}>{rich(child)}</{tag}>'
        else:
            value += rich(child)
        value += html.escape(child.tail or '')
    return re.sub(r'[\r\n\t]+', '', value)

def parse_ingredients(elements):
    # Subs attach a shared dose to the preceding group. Unknown layouts stay raw.
    markup = ''.join(rich(e) for e in elements)
    markup = re.sub(r'</sub>\s*<sub>', '', markup)
    pattern = r'([^<>]*?)<sub>(.*?)</sub>'
    ingredients = []
    leftover = re.sub(pattern, '', markup).strip('　 ，。;；')
    for match in re.finditer(pattern, markup):
        names, dose = html.unescape(match[1]), html.unescape(re.sub('<[^>]+>', '', match[2]))
        if not re.search(r'[两钱分斤升枚个粒片寸克g合具撮挺茎铢把张量许大小倍]', dose):
            return [], '复杂炮制或分段剂量，查看原文'
        names = [x.strip() for x in re.split(r'[　\s]+', names) if x.strip()]
        if len(names) > 1 and not dose.startswith('各'):
            return [], '合列药味的剂量或炮制归属不明确，查看原文'
        if re.search(r'[，、；：]', dose):
            return [], '剂量含炮制或复合说明，查看原文'
        for name in names:
            if len(name) > 12 or re.search(r'[，。；：<>]', name):
                return [], '复杂组成，查看原文'
            ingredients.append({'name': name, 'dose': dose.removeprefix('各'), 'sharedDose': dose.startswith('各')})
    if leftover or not ingredients:
        return [], '组成保留原文，尚未拆分'
    return ingredients, None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--book', type=Path, default=DEFAULT_BOOK)
    parser.add_argument('--herbs', type=Path, default=DEFAULT_HERBS)
    parser.add_argument('--aliases', type=Path, help='Defaults to raw-herb-aliases.json beside --herbs')
    args = parser.parse_args()
    z = zipfile.ZipFile(args.book)
    opf_path = ET.fromstring(z.read('META-INF/container.xml')).find('.//{*}rootfile').get('full-path')
    opf = ET.fromstring(z.read(opf_path))
    base = PurePosixPath(opf_path).parent
    manifest = {e.get('id'): e.get('href') for e in opf.findall('.//{*}manifest/{*}item')}
    files = [str(base / manifest[e.get('idref')]) for e in opf.findall('.//{*}spine/{*}itemref')]
    records, chapters, extra = [], [], []
    category = None
    current = None
    current_section = None
    supplement = False
    composition = []

    def finish():
        nonlocal current, composition
        if not current:
            return
        current['ingredients'], current['compositionNote'] = parse_ingredients(composition) if composition else ([], None)
        current['rhyme'] = [b['text'] for s in current['sections'] if s['title'] in ('歌诀','方歌') for b in s['blocks']]
        current['reviewStatus'] = 'pending'
        records.append(current)
        current, composition = None, []

    for file in files:
        if not file.endswith(('.html', '.xhtml')):
            continue
        root = ET.fromstring(z.read(file))
        body = root.find('{*}body')
        if body is None:
            continue
        # CHP1 is the duplicated verse-only section; CHP2 is the complete commentary.
        heading = body.find('{*}h4')
        if heading is None or not heading.get('id','').startswith('CHP2-'):
            continue
        finish()
        heading_text = text(heading)
        supplement = heading_text == '增辑'
        if not supplement:
            category = {'id': heading.get('id'), 'name': re.sub(r'^[一二三四五六七八九十]+、', '', heading_text), 'intro': []}
            chapters.append(category)
        for e in body:
            tag, cls, value = e.tag.split('}')[-1], e.get('class',''), text(e)
            if tag == 'h4':
                continue
            if tag == 'h6':
                finish()
                title = clean_name(identity(e))
                name = title.split('（')[0]
                current = {'id': e.get('id'), 'name': name, 'title': title, 'categoryId': category['id'], 'supplement': supplement, 'source': {'file': file, 'anchor': e.get('id')}, 'preface': [], 'sections': []}
                current_section = None
            elif tag == 'h5':
                finish()
                current_section = None
                category['intro'].append({'text': value, 'html': rich(e)})
            elif cls == 'h8' and current:
                current_section = {'title': value.strip('【】'), 'anchor': e.get('id'), 'blocks': []}
                current['sections'].append(current_section)
            elif current and value:
                if current_section is None and cls == 'pCls' and ('　' in value or category['name'] == '经络歌诀'):
                    # Some songs inherit a heading or omit 【歌诀】 in this edition.
                    current_section = {'title': '歌诀', 'anchor': current['id'] + '-implicit-rhyme', 'blocks': []}
                    current['sections'].append(current_section)
                if current_section is not None:
                    current_section['blocks'].append({'text': value, 'html': rich(e)})
                    if current_section['title'] == '组成':
                        composition.append(e)
                else:
                    current['preface'].append(value)
            elif value and category:
                category['intro'].append({'text': value, 'html': rich(e)})
        if not any(e.tag.endswith('h6') for e in body) and category and category['name'] == '经络歌诀':
            extra.append({'categoryId': category['id'], 'blocks': category['intro']})
    finish()
    # Copy glyph images for faithful source rendering.
    image_dir = ROOT / 'public/book-images'
    image_dir.mkdir(parents=True, exist_ok=True)
    for file in z.namelist():
        if file.lower().endswith(('.gif', '.png')):
            (image_dir / PurePosixPath(file).name).write_bytes(z.read(file))
    herb_rows = json.loads(args.herbs.read_text(encoding='utf-8'))
    alias_path = args.aliases or args.herbs.with_name('raw-herb-aliases.json')
    alias_rows = json.loads(alias_path.read_text(encoding='utf-8'))
    matcher = HerbMatcher(herb_rows, alias_rows)
    herbs = matcher.enrich_herbs()
    for record in records:
        for ingredient in record['ingredients']:
            ingredient.update(matcher.match(ingredient['name']))
    ingredients = [i for record in records for i in record['ingredients']]
    matching_report = {'ingredientOccurrences': len(ingredients),
                       'linkedOccurrences': sum(bool(i['herbId']) for i in ingredients),
                       'withThermal': sum(i['thermal'] != 'unknown' for i in ingredients),
                       'methods': dict(collections.Counter(i['match']['method'] for i in ingredients)),
                       'scopes': dict(collections.Counter(i['match']['scope'] for i in ingredients)),
                       'pending': dict(collections.Counter(i['name'] for i in ingredients if i['thermal'] == 'unknown')),
                       'referenceFiles': [{'name': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in [args.herbs, alias_path]]}
    ids = [r['id'] for r in records]
    assert len(ids) == len(set(ids)), 'Duplicate source anchors'
    assert all(r['categoryId'] in {c['id'] for c in chapters} for r in records)
    report = {'records': len(records), 'categories': len(chapters), 'withRhyme': sum(bool(r['rhyme']) for r in records), 'structuredCompositions': sum(bool(r['ingredients']) for r in records), 'rawOnlyCompositions': [r['id'] for r in records if r['compositionNote']], 'categoryCounts': dict(collections.Counter(r['categoryId'] for r in records)), 'reviewStatus': 'pending', 'copyright': '用户提供的学习资料；再分发授权未独立核实。'}
    report['herbMatching'] = matching_report
    data = {'source': {'title': '汤头歌诀白话解', 'edition': '第6版', 'filename': args.book.name, 'sha256': hashlib.sha256(args.book.read_bytes()).hexdigest(), 'rights': 'redistribution-not-independently-verified', 'reviewStatus': 'pending'}, 'categories': chapters, 'formulas': records, 'herbs': herbs, 'extra': extra, 'report': report}
    out = ROOT / 'src/data'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'book.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    (ROOT / 'work/import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
