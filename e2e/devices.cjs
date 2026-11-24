const { chromium, devices } = require('playwright');
const SP = process.argv[2];
const ok = (c, m) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
async function loadSample(page) {
  await page.getByRole('button', { name: /Load labelled sample logs/ }).first().click();
  await page.waitForSelector('text=Top findings', { timeout: 20000 });
}
(async () => {
  const gl = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  // ---- Phone (touch)
  let b = await chromium.launch({ args: gl });
  let ctx = await b.newContext({ ...devices['iPhone 13'] });
  let page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto('http://localhost:4173/#/overview'); await loadSample(page); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SP}/shots/m-overview.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow <= 0, `phone: no horizontal page scroll (overflow ${overflow}px)`);
  await page.getByRole('button', { name: 'More' }).tap(); await page.waitForTimeout(500);
  await page.screenshot({ path: `${SP}/shots/m-more.png` });
  await page.getByRole('dialog', { name: 'More navigation' }).getByRole('link', { name: /Repair Center/ }).tap(); await page.waitForTimeout(2500);
  ok(page.url().endsWith('#/repair'), 'phone: More sheet navigates to Repair Center');
  await page.screenshot({ path: `${SP}/shots/m-repair.png` });
  await page.goto('http://localhost:4173/#/errors'); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SP}/shots/m-errors.png`, fullPage: true });
  const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(ov2 <= 0, `phone errors page: no horizontal scroll (${ov2}px)`);
  ok(errs.length === 0, `phone: console errors: ${errs.join(' | ') || 'none'}`);
  await b.close();

  // ---- Tablet
  b = await chromium.launch({ args: gl });
  ctx = await b.newContext({ ...devices['iPad (gen 7)'] });
  page = await ctx.newPage();
  await page.goto('http://localhost:4173/#/overview'); await loadSample(page); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SP}/shots/t-overview.png` });
  ok(await page.locator('aside nav').isVisible(), 'tablet: icon rail visible');
  await b.close();

  // ---- WebGL unavailable
  b = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  page = await b.newPage({ viewport: { width: 1280, height: 860 } }); const e2 = []; page.on('pageerror', (e) => e2.push(e.message));
  await page.goto('http://localhost:4173/#/overview'); await loadSample(page); await page.waitForTimeout(1200);
  ok(await page.locator('canvas').count() === 0 && await page.locator('text=WebGL unavailable').count() > 0, 'no-WebGL: SVG fallback rendered, no canvas');
  await page.locator('svg [role=button][aria-label^="DISM Engine"]').click(); await page.waitForTimeout(600);
  ok(await page.locator('section[aria-labelledby="mod-dism"]').count() === 1, 'no-WebGL: fallback node click opens module panel');
  await page.screenshot({ path: `${SP}/shots/f-overview.png` });
  for (const r of ['errors', 'repair', 'map']) {
    await page.goto(`http://localhost:4173/#/${r}`); await page.waitForTimeout(800);
    ok(await page.locator('text=WebGL unavailable').count() > 0, `no-WebGL: ${r} fallback`);
  }
  await page.screenshot({ path: `${SP}/shots/f-map.png` });
  ok(e2.length === 0, `no-WebGL page errors: ${e2.join(' | ') || 'none'}`);
  await b.close();

  // ---- Reduced motion
  b = await chromium.launch({ args: gl });
  ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page = await ctx.newPage();
  await page.goto('http://localhost:4173/#/overview'); await loadSample(page); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => document.documentElement.classList.contains('reduce-motion')), 'reduced motion: honoured from OS preference');
  // Frame count in 2s should be tiny with demand rendering (no rAF invalidation loop)
  await page.goto('http://localhost:4173/#/errors'); await page.waitForTimeout(1200);
  await page.getByRole('tab', { name: /Correlation/ }).click(); await page.waitForTimeout(2500);
  await page.locator('ul[aria-label=Findings] button').nth(2).click(); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SP}/shots/rm-correlation.png` });
  await page.goto('http://localhost:4173/#/map'); await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SP}/shots/rm-map.png` });
  await b.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
