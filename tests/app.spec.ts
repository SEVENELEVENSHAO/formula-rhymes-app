import { test, expect } from '@playwright/test';
const APP_PATH = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5178/').pathname;

test('manifest, source glyphs and worker remain inside the app path', async ({ page }) => {
  await page.goto(APP_PATH);
  await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href', `${APP_PATH}manifest.webmanifest`);
  await page.locator('.sidebar').getByRole('button', { name: '经络歌诀 16', exact: true }).click();
  await page.locator('.sidebar .category-formulas').getByRole('button', { name: '足阳明胃经歌', exact: true }).click();
  await page.getByRole('button', { name: '原书全文', exact: true }).click();
  const glyph = page.locator('.book-glyph').first();
  await expect(glyph).toBeVisible();
  expect(await glyph.getAttribute('src')).toMatch(new RegExp(`^${APP_PATH}book-images/`));
  await expect.poll(() => glyph.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe(APP_PATH);
});

test('category navigation, ingredient tiles and source evidence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(APP_PATH);
  await expect(page.locator('.sidebar .category-tree-button')).toHaveCount(23);
  await page.locator('.sidebar').getByRole('button', { name: '发表之剂 19', exact: true }).click();
  await expect(page.locator('.sidebar .category-formulas button')).toHaveCount(19);
  await expect(page.locator('main .category-grid')).toHaveCount(0);
  await page.locator('.sidebar').getByRole('button', { name: '发表之剂 19', exact: true }).click();
  const detail = page.getByRole('article', { name: '方歌白话解' });
  await expect(detail.locator('.ingredient-tile')).toHaveCount(4);
  await expect(detail.locator('.ingredient-dose')).toContainText(['三两', '二两', '七十个', '一两']);
  await detail.getByRole('button', { name: '查看麻黄药材资料' }).click();
  await expect(page.getByRole('dialog', { name: '药材资料' }).getByRole('heading', { name: '麻黄', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: '原书全文', exact: true }).click();
  await expect(detail.getByText(/OEBPS\/text00514.html/).first()).toBeVisible();
  await expect(detail.getByRole('heading', { name: '方析', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('search supports Chinese, pinyin, initials and empty results', async ({ page }) => {
  await page.goto(APP_PATH);
  const search = page.getByRole('textbox', { name: '搜索方名、歌诀、药材或主治' });
  for (const query of ['麻黄汤', 'mahuangtang', 'mht']) {
    await search.fill(query);
    await expect(page.locator('.formula-card').filter({ has: page.getByRole('heading', { name: '麻黄汤', exact: true }) })).toBeVisible();
  }
  await search.fill('no-such-formula-xxx');
  await expect(page.getByText('没有找到匹配的方歌')).toBeVisible();
  await page.getByRole('button', { name: '清除筛选', exact: true }).last().click();
  await expect(page.locator('.sidebar .category-tree-button')).toHaveCount(23);
});

test('favorites, notes and mastery persist across reload', async ({ page }) => {
  await page.goto(APP_PATH);
  await page.locator('.sidebar').getByRole('button', { name: '发表之剂 19', exact: true }).click();
  const detail = page.getByRole('article', { name: '方歌白话解' });
  await detail.getByRole('button', { name: '收藏', exact: true }).click();
  await detail.getByRole('textbox', { name: '这首方歌的学习笔记' }).fill('麻桂杏草，留意原书剂量。');
  await detail.getByRole('button', { name: '标记熟记', exact: true }).click();
  await page.reload();
  await page.locator('.main-nav').getByRole('button', { name: /我的收藏/ }).click();
  await expect(page.locator('.formula-card')).toHaveCount(1);
  await page.locator('.formula-open').click();
  await expect(detail.getByRole('textbox')).toHaveValue('麻桂杏草，留意原书剂量。');
  await expect(detail.getByRole('button', { name: '已熟记', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await detail.getByRole('button', { name: '逐句背诵', exact: true }).click();
  await expect(detail.locator('.concealed')).toHaveCount(2);
  await detail.getByRole('button', { name: '点击显示这一句歌诀' }).first().click();
  await expect(detail.locator('.concealed')).toHaveCount(1);
});

test('practice reveals actual verses and saves mastery', async ({ page }) => {
  await page.goto(APP_PATH);
  await page.locator('.main-nav').getByRole('button', { name: /背诵练习/ }).click();
  await expect(page.getByRole('button', { name: '展开歌诀' })).toBeVisible();
  await page.getByRole('button', { name: '展开歌诀' }).click();
  await expect(page.locator('.study-rhyme')).toBeVisible();
  await page.getByRole('button', { name: '已记住，下一首' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tangtou-library-v1') || '{}'));
  expect(saved.mastered).toHaveLength(1);
  await expect(page.getByRole('button', { name: '展开歌诀' })).toBeVisible();
});

test('backup import merges records and rejects malformed files without data loss', async ({ page }) => {
  await page.goto(APP_PATH);
  const upload = page.getByLabel('导入学习记录', { exact: true });
  await upload.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ favorites: ['CHP2-3-1'], mastered: ['CHP2-3-1'], notes: { 'CHP2-3-1': '备份中的笔记' }, recent: ['CHP2-3-1'] })) });
  await expect(page.getByRole('status')).toContainText('备份已合并');
  await page.locator('.main-nav').getByRole('button', { name: /我的收藏/ }).click();
  await expect(page.locator('.formula-card')).toHaveCount(1);
  await upload.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"favorites":"bad"}') });
  await expect(page.getByRole('status')).toContainText('导入失败');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tangtou-library-v1') || '{}').notes['CHP2-3-1'])).toBe('备份中的笔记');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出记录', exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('汤头歌诀-学习记录.json');
});

test('sidebar and mobile directory leave the main page for book content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(APP_PATH);
  await expect(page.locator('main h1')).toHaveText('四君子汤');
  await page.locator('.sidebar').getByRole('button', { name: '发表之剂 19', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('麻黄汤');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: 'work/qa/sidebar-desktop.png', animations: 'disabled' });
  await page.evaluate(() => window.scrollTo(0, 500));
  expect((await page.locator('.sidebar').boundingBox())?.y).toBe(0);
  await page.locator('.sidebar .category-formulas').getByRole('button', { name: '桂枝汤', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('桂枝汤');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.screenshot({ path: 'work/qa/sidebar-mobile-reader.png', animations: 'disabled' });
  await page.getByRole('button', { name: '打开分类目录' }).click();
  const directory = page.getByRole('dialog', { name: '分类目录' });
  await expect(directory.locator('.category-tree-button')).toHaveCount(23);
  await page.screenshot({ path: 'work/qa/sidebar-mobile-directory.png', animations: 'disabled' });
  await directory.locator('.category-formulas').getByRole('button', { name: '麻黄汤', exact: true }).click();
  await expect(directory).toHaveCount(0);
  await expect(page.locator('main h1')).toHaveText('麻黄汤');
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('production app opens offline after first load', async ({ page, context }) => {
  await page.goto(APP_PATH);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('main h1')).toHaveText('四君子汤');
  await page.locator('.main-nav').getByRole('button', { name: /背诵练习/ }).click();
  await page.getByRole('button', { name: '展开歌诀' }).click();
  await expect(page.locator('.study-rhyme')).toBeVisible();
});

test('nature cards resolve variants and explain processed references', async ({ page }) => {
  await page.goto(APP_PATH);
  const whiteAtractylodes = page.getByRole('button', { name: '查看白术药材资料', exact: true });
  await expect(whiteAtractylodes.locator('.ingredient-meta>span')).toHaveText('温');
  await whiteAtractylodes.click();
  const herb = page.getByRole('dialog', { name: '药材资料' });
  await expect(herb.getByRole('heading', { name: '白术', exact: true })).toBeVisible();
  await expect(herb.getByText(/参考条目：白朮/)).toBeVisible();
  await page.keyboard.press('Escape');
  const licorice = page.getByRole('button', { name: '查看炙甘草药材资料', exact: true });
  await expect(licorice.getByText('基药参考', { exact: true })).toBeVisible();
  await licorice.click();
  await expect(herb.getByRole('heading', { name: '炙甘草', exact: true })).toBeVisible();
  await expect(herb.getByRole('heading', { name: '基药性味归经', exact: true })).toBeVisible();
  await expect(herb.getByText(/参考条目：甘草/)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.property-references summary').click();
  await expect(page.locator('.property-references')).toContainText('raw-herb-aliases.json #10');
  await page.screenshot({ path: 'work/qa/nature-properties.png', animations: 'disabled' });
  await page.locator('.sidebar').getByRole('button', { name: '发表之剂 19', exact: true }).click();
  await page.locator('.sidebar .category-formulas').getByRole('button', { name: '桂枝汤', exact: true }).click();
  const peony = page.locator('.ingredient-tile').filter({ has: page.locator('.ingredient-color>strong').getByText('芍药', { exact: true }) });
  await expect(peony.locator('.ingredient-meta>span')).toHaveText('待核对');
});
