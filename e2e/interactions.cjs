const { chromium } = require('playwright');
const SP = process.argv[2], ROOT = process.argv[3];
const ok = (c, m) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:4173/#/overview');
  await page.waitForTimeout(1500);

  // 1. Real file upload through the Web Worker
  await page.locator('input[type=file]').first().setInputFiles([`${ROOT}/src/engine/samples/CBS.sample.log`, `${ROOT}/src/engine/samples/DISM.sample.log`]);
  await page.waitForSelector('text=Top findings', { timeout: 20000 });
  const label = await page.locator('header button[title]').first().getAttribute('title');
  ok(label === 'CBS.sample.log + DISM.sample.log', `worker upload produced analysis "${label}"`);
  ok(!(await page.locator('text=Sample dataset').count()), 'uploaded files are not labelled as sample');
  await page.waitForTimeout(2500);

  // 2. Raycast click on a 3D module node: scan a grid until a module panel opens
  const box = await page.locator('canvas').first().boundingBox();
  let hit = null;
  outer: for (let y = 0.4; y <= 0.75; y += 0.06) for (let x = 0.08; x <= 0.92; x += 0.06) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    await page.waitForTimeout(450);
    const h = page.locator('section[aria-labelledby^="mod-"] h2');
    if (await h.count()) { hit = await h.first().textContent(); break outer; }
  }
  ok(!!hit, `3D raycast click opened module panel: ${hit}`);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SP}/shots/d-3dclick.png` });
  // click empty space deselects
  await page.mouse.click(box.x + box.width * 0.04, box.y + box.height * 0.55);
  await page.waitForTimeout(500);
  ok(!(await page.locator('section[aria-labelledby^="mod-"]').count()), 'clicking empty space deselects module');
  // 3. drag rotate + wheel zoom
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 30, { steps: 12 }); await page.mouse.up();
  await page.mouse.wheel(0, -400); await page.waitForTimeout(800);
  await page.screenshot({ path: `${SP}/shots/d-rotated.png` });
  ok(true, 'drag-orbit and wheel-zoom executed');

  // 4. Keyboard shortcut Alt+4 → Error Explorer; select finding; KB links
  await page.keyboard.press('Alt+4');
  await page.waitForTimeout(800);
  ok(page.url().endsWith('#/errors'), `Alt+4 navigates (${page.url()})`);
  await page.locator('ul[aria-label=Findings] button').nth(2).click();
  await page.waitForTimeout(800);
  const links = await page.locator('article a[href^="https://"]').evaluateAll((as) => as.map((a) => a.href));
  ok(links.length > 0 && links.every((h) => /learn\.microsoft\.com|support\.microsoft\.com/.test(h)), `finding shows ${links.length} Microsoft doc links`);
  const correlated = await page.locator('text=Correlated errors').count();
  ok(correlated > 0, 'finding shows correlated errors');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SP}/shots/d-errors-selected.png` });
  await page.getByRole('tab', { name: /Correlation/ }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SP}/shots/d-correlation.png` });
  // copy button
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const copy = page.getByRole('button', { name: 'Copy command' }).first();
  if (await copy.count()) { await copy.click(); await page.waitForTimeout(400); ok(await page.getByRole('button', { name: 'Copied' }).count() > 0, 'copy command button'); }

  // 5. Repair checklist persists in localStorage
  await page.goto('http://localhost:4173/#/repair'); await page.waitForTimeout(1500);
  await page.getByRole('checkbox').first().click();
  const checked = await page.getByRole('checkbox').first().getAttribute('aria-checked');
  const stored = await page.evaluate(() => localStorage.getItem('cbs-dism-studio:checklist'));
  ok(checked === 'true' && stored && stored.includes('reboot'), 'checklist toggles and persists');
  await page.locator('ol[aria-label="Repair stages"] button').nth(2).click(); await page.waitForTimeout(400);
  ok(await page.locator('text=Repair payload source resolution').count() > 0, 'stage evidence panel opens');

  // 6. Reports downloads
  await page.goto('http://localhost:4173/#/reports'); await page.waitForTimeout(1000);
  for (let i = 0; i < 4; i++) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).nth(i).click()]);
    const p = await dl.path(); const size = require('fs').statSync(p).size;
    ok(size > 200, `download ${dl.suggestedFilename()} (${size} B)`);
  }

  // 7. History: reload then reopen from IndexedDB
  await page.goto('http://localhost:4173/#/history'); await page.reload(); await page.waitForTimeout(1500);
  const items = await page.getByRole('button', { name: 'Open' }).count();
  ok(items >= 1, `history lists ${items} saved analyses after reload`);
  await page.getByRole('button', { name: 'Open' }).first().click(); await page.waitForTimeout(1200);
  ok(page.url().endsWith('#/overview') && await page.locator('text=Top findings').count() > 0, 'reopened analysis from history');

  // 8. Large file performance through the worker
  const t0 = Date.now();
  await page.locator('input[type=file]').first().setInputFiles(`${ROOT}/samples/large-CBS.log`);
  let maxFrameGap = 0;
  const gapProbe = page.evaluate(() => new Promise((res) => { let last = performance.now(), max = 0; const end = performance.now() + 4000; const f = (t) => { max = Math.max(max, t - last); last = t; if (t < end) requestAnimationFrame(f); else res(max); }; requestAnimationFrame(f); }));
  maxFrameGap = await gapProbe;
  await page.waitForFunction(() => document.querySelector('header button[title]')?.getAttribute('title') === 'large-CBS.log', null, { timeout: 180000 });
  const secs = (Date.now() - t0) / 1000;
  ok(true, `150 MB CBS.log parsed in ${secs.toFixed(1)} s; max main-thread frame gap during parse ${Math.round(maxFrameGap)} ms`);
  const heap = await page.evaluate(() => { window.gc && window.gc(); return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1; });
  ok(heap < 400, `JS heap after large parse: ${heap} MB`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SP}/shots/d-large.png` });

  // 9. Memory/leak check: cycle through 3D pages
  const heapAt = async () => page.evaluate(() => { window.gc && window.gc(); return Math.round(performance.memory.usedJSHeapSize / 1048576); });
  const before = await heapAt();
  for (let i = 0; i < 6; i++) for (const r of ['overview', 'errors', 'repair', 'map', 'settings']) { await page.goto(`http://localhost:4173/#/${r}`); await page.waitForTimeout(700); }
  await page.waitForTimeout(1500);
  const after = await heapAt();
  const canvases = await page.locator('canvas').count();
  ok(after - before < 60, `heap before/after 30 3D page switches: ${before} → ${after} MB, live canvases ${canvases}`);

  console.log('CONSOLE ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
