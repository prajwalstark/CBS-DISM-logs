// End-to-end suite: builds are expected in dist/. Starts `vite preview`,
// runs interaction, device-matrix and keyboard suites in headless Chromium.
// Usage: npm run build && npm run e2e   (large-file test needs: npm run gen:large)
const { spawn, execFileSync } = require('node:child_process');
const { existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-results');
mkdirSync(path.join(out, 'shots'), { recursive: true });
if (!existsSync(path.join(root, 'samples/large-CBS.log'))) {
  console.log('Generating 150 MB synthetic log for the performance check…');
  execFileSync('node', ['scripts/generate-large-log.mjs', '150', 'samples/large-CBS.log'], { cwd: root, stdio: 'inherit' });
}
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'ignore' });
let failed = false;
setTimeout(() => {
  try {
    for (const s of ['interactions.cjs', 'devices.cjs', 'keyboard.cjs']) {
      console.log(`\n=== ${s} ===`);
      const res = execFileSync('node', [path.join(__dirname, s), out, root], { cwd: root, encoding: 'utf8' });
      process.stdout.write(res);
      if (/^FAIL/m.test(res) || /CONSOLE ERRORS: (?!none)/.test(res)) failed = true;
    }
  } catch (e) {
    failed = true;
    console.error(e.stdout || e.message);
  } finally {
    server.kill();
    process.exit(failed ? 1 : 0);
  }
}, 2500);
