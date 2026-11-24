const { chromium } = require('playwright');
const ok = (c, m) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4173/#/overview'); await page.waitForTimeout(800);
  await page.keyboard.press('Tab');
  ok((await page.evaluate(() => document.activeElement.textContent)).includes('Skip to content'), 'first Tab reaches skip link');
  // Tab to the dropzone and load sample via keyboard
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if ((await page.evaluate(() => document.activeElement.textContent)).includes('Load labelled sample')) break; }
  await page.keyboard.press('Enter');
  await page.waitForSelector('text=Top findings');
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.activeElement.id) === 'main', 'focus moves to main region after keyboard load');
  for (let i = 0; i < 80; i++) { await page.keyboard.press('Tab'); const t = await page.evaluate(() => document.activeElement.tagName + ':' + document.activeElement.textContent); if (t.startsWith('BUTTON:') && t.includes('System Integrity')) break; }
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  ok(outline !== 'none', `focused module chip has visible focus ring (${outline})`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  ok(await page.locator('section[aria-labelledby="mod-integrity"]').count() === 1, 'Enter on module chip opens module panel');
  await page.keyboard.press('Alt+5'); await page.waitForTimeout(1200);
  ok(page.url().endsWith('#/repair'), 'Alt+5 opens Repair Center');
  await page.getByRole('checkbox').first().focus(); await page.keyboard.press('Space');
  ok(await page.getByRole('checkbox').first().getAttribute('aria-checked') === 'true', 'checklist operable with Space');
  await b.close();
})();
