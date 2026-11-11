import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../src/data/book.json', import.meta.url), 'utf8'));

test('the complete commentary contains 315 unique entries in all 23 source categories', () => {
  assert.equal(data.formulas.length, 315);
  assert.equal(data.categories.length, 23);
  assert.equal(new Set(data.formulas.map(f => f.id)).size, 315);
  for (const category of data.categories) assert.ok(data.formulas.some(f => f.categoryId === category.id), category.name);
  for (const formula of data.formulas) {
    assert.ok(data.categories.some(c => c.id === formula.categoryId));
    assert.ok(formula.rhyme.length, `${formula.name} must retain its song, including inherited headings`);
    assert.equal(formula.reviewStatus, 'pending');
    assert.ok(formula.source.file.endsWith('.html'));
    assert.equal(formula.source.anchor, formula.id);
  }
});
test('shared doses and ambiguous herbs remain faithful to the book', () => {
  const dragon = data.formulas.find(f => f.name === '大青龙汤');
  assert.equal(dragon.ingredients.find(i => i.name === '桂枝').dose, '二两');
  assert.equal(dragon.ingredients.find(i => i.name === '炙甘草').dose, '二两');
  assert.equal(dragon.ingredients.find(i => i.name === '石膏').dose, '如鸡子大');
  const guizhi = data.formulas.find(f => f.name === '桂枝汤');
  assert.equal(guizhi.ingredients.find(i => i.name === '芍药').herbId, null);
  assert.equal(guizhi.ingredients.find(i => i.name === '炙甘草').thermal, 'neutral');
  assert.equal(guizhi.ingredients.find(i => i.name === '炙甘草').match.scope, 'base-herb');
  const peony = guizhi.sections.find(s => s.title === '组成').blocks;
  assert.ok(peony.some(b => b.html.includes('<sub>三两</sub>')));
});
test('ingredient relationships resolve and complex compositions retain source evidence', () => {
  for (const f of data.formulas) {
    if (f.compositionNote) { assert.equal(f.ingredients.length, 0); assert.ok(f.sections.find(s => s.title === '组成')?.blocks.length); }
    for (const i of f.ingredients) {
      assert.ok(i.name && i.dose);
      assert.ok(i.match && i.natureLabel);
      if (i.herbId) {
        assert.ok(data.herbs.some(h => h.id === i.herbId && h.name === i.match.referenceName));
        assert.ok(i.match.evidence);
        assert.notEqual(i.match.scope, 'unresolved');
      }
      else assert.equal(i.thermal, 'unknown');
    }
  }
  assert.equal(data.formulas.filter(f => f.ingredients.length).length, data.report.structuredCompositions);
});

test('Open Herbology variants and synonyms have nature data with a review trail', () => {
  const ingredients = data.formulas.flatMap(f => f.ingredients);
  for (const name of ['白术', '苍术', '麦冬', '天冬', '炙甘草', '生甘草', '熟地', '生地']) {
    const matches = ingredients.filter(i => i.name === name);
    assert.ok(matches.length, name);
    for (const i of matches) { assert.ok(i.herbId, name); assert.notEqual(i.thermal, 'unknown', name); }
  }
  const wheat = ingredients.find(i => i.name === '麦冬');
  assert.equal(wheat.natureLabel, '微寒');
  assert.equal(wheat.thermal, 'cool');
  assert.equal(wheat.match.scope, 'ingredient');
  const cuttlebone = ingredients.find(i => i.name === '海螵蛸');
  assert.equal(cuttlebone.match.referenceName, '乌贼骨');
  assert.notEqual(cuttlebone.match.referenceName, '桑螵蛸');
  for (const i of ingredients.filter(i => ['芍药', '枳壳', '贝母', '胆南星', '胆星'].includes(i.name))) {
    assert.equal(i.thermal, 'unknown', i.name);
  }
  assert.equal(ingredients.length, data.report.herbMatching.ingredientOccurrences);
  assert.equal(ingredients.filter(i => i.thermal !== 'unknown').length, data.report.herbMatching.withThermal);
});
test('rendered source fragments contain only approved markup and local glyph assets', () => {
  const fragments = [...data.categories.flatMap(c => c.intro), ...data.formulas.flatMap(f => f.sections.flatMap(s => s.blocks))];
  for (const b of fragments) {
    assert.ok(!/<(?:script|iframe|style|a|object)\b/i.test(b.html));
    assert.ok(!/\bon\w+=/i.test(b.html));
    for (const match of b.html.matchAll(/src="([^"]+)"/g)) {
      assert.ok(match[1].startsWith('/book-images/'));
      assert.ok(existsSync(new URL(`../public${match[1]}`, import.meta.url)));
    }
  }
  assert.equal(data.formulas.find(f => f.id === 'CHP2-2-8').name, '七宝美髯丹');
  assert.equal(data.formulas.find(f => f.id === 'CHP2-38-2-5').name, '蹻脉歌');
});
