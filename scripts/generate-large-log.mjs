// Generates a large synthetic CBS.log for performance testing (NOT diagnostic data).
// Usage: node scripts/generate-large-log.mjs [sizeMB=200] [out=samples/large-CBS.log]
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const sizeMB = Number(process.argv[2] || 200);
const out = process.argv[3] || 'samples/large-CBS.log';
mkdirSync(dirname(out), { recursive: true });
const base = readFileSync('src/engine/samples/CBS.sample.log', 'utf8').split(/\r?\n/);
const filler = [
  'Info                  CSI    00001234 Creating NT transaction (seq 2), objectname [6]"(null)"',
  'Info                  CBS    Read out cached package applicability for package: Package_for_KB5011048~31bf3856ad364e35~amd64~~10.0.9126.2, ApplicableState: 112, CurrentState:112',
  'Info                  CSI    00001235@2024/3/12:09:14:03.412 CSI Transaction @0x1f2e3d4c destroyed',
  'Info                  CBS    Appl: detect Parent, Package: Microsoft-Windows-Client-Features-Package, Parent: Microsoft-Windows-Foundation-Package, Disposition = Detect, VersionComp: EQ',
  'Perf                  CBS    Doq: Exec: Elapsed time 0.002 seconds',
];
const ws = createWriteStream(out);
let bytes = 0;
let t = Date.UTC(2024, 0, 1);
const target = sizeMB * 1024 * 1024;
function stamp() { return new Date(t).toISOString().replace('T', ' ').slice(0, 19) + ', '; }
(async () => {
  let i = 0;
  while (bytes < target) {
    let chunk = '';
    for (let k = 0; k < 2000; k++, i++) {
      t += 37;
      chunk += (i % 50000 === 0 ? base.join('\r\n') : stamp() + filler[i % filler.length]) + '\r\n';
    }
    bytes += chunk.length;
    if (!ws.write(chunk)) await new Promise((r) => ws.once('drain', r));
  }
  ws.end();
  console.log(`wrote ${(bytes / 1048576).toFixed(1)} MB to ${out}`);
})();
