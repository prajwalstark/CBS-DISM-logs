import type { Analysis } from './types';
import { MODULE_META } from './modules';

const fmtTs = (t: number | null | undefined) => (t == null ? '—' : new Date(t).toISOString().replace('T', ' ').slice(0, 19));

/** Report JSON excludes raw entries/timeline to keep exports small and portable. */
export function toJson(a: Analysis): string {
  const { entries: _e, timeline: _t, ...rest } = a;
  void _e; void _t;
  return JSON.stringify({ generator: 'CBS & DISM Diagnostic Studio', ...rest }, null, 2);
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  // Neutralise spreadsheet formula injection and quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(a: Analysis): string {
  const head = ['severity', 'code', 'name', 'title', 'module', 'source', 'occurrences', 'first_seen', 'last_seen', 'first_line', 'kb_links'];
  const rows = a.findings.map((f) => [
    f.severity, f.code, f.name, f.title, MODULE_META[f.module].label, f.sources.join('|'), f.occurrences,
    fmtTs(f.firstSeen), fmtTs(f.lastSeen), f.refs[0] ? `${f.refs[0].file}:${f.refs[0].line}` : '', f.links.map((l) => l.url).join(' '),
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

export function toMarkdown(a: Analysis): string {
  const out: string[] = [];
  out.push('# CBS & DISM Diagnostic Report', '');
  out.push(`**Analysis:** ${a.label}${a.isSample ? ' _(sample data)_' : ''}  `);
  out.push(`**Generated:** ${new Date(a.createdAt).toISOString()}  `);
  out.push(`**Overall health:** ${a.overall.score}/100 — ${a.overall.status.toUpperCase()}  `);
  out.push(`**Verdict:** ${a.overall.verdict}`, '');
  out.push('## Files', '', '| File | Type | Lines | Errors | Warnings | Range |', '|---|---|---:|---:|---:|---|');
  for (const f of a.files) out.push(`| ${f.name} | ${f.source.toUpperCase()} | ${f.lines} | ${f.levels.Error} | ${f.levels.Warning} | ${fmtTs(f.first)} → ${fmtTs(f.last)} |`);
  out.push('', '## Subsystem health', '', '| Subsystem | Score | Status | Errors | Warnings |', '|---|---:|---|---:|---:|');
  for (const m of Object.values(a.modules)) out.push(`| ${MODULE_META[m.id].label} | ${m.status === 'no-data' ? '—' : m.score} | ${m.status} | ${m.errors} | ${m.warnings} |`);
  out.push('', '## Repair stages', '');
  for (const s of a.stages) out.push(`- **${s.label}** — ${s.status}: ${s.evidence.join('; ')}`);
  out.push('', '## Findings', '');
  for (const f of a.findings) {
    out.push(`### [${f.severity.toUpperCase()}] ${f.title} \`${f.code}\``, '');
    out.push(`${f.description}`, '');
    out.push(`- Source: ${f.sources.join(', ').toUpperCase()} · Subsystem: ${MODULE_META[f.module].label} · Occurrences: ${f.occurrences}`);
    if (f.refs[0]) out.push(`- First at ${f.refs[0].file}:${f.refs[0].line} (${fmtTs(f.firstSeen)})`);
    out.push(`- Sample: \`${f.sample.replace(/`/g, "'")}\``);
    if (f.steps.length) { out.push('- Remediation:'); for (const s of f.steps) out.push(`  - ${s.text}${s.command ? ` \`${s.command}\`` : ''}`); }
    if (f.links.length) { out.push('- References:'); for (const l of f.links) out.push(`  - [${l.title}](${l.url})`); }
    out.push('');
  }
  if (a.correlations.length) {
    out.push('## Correlations', '');
    for (const c of a.correlations) out.push(`- \`${c.a}\` ↔ \`${c.b}\` (${c.kind}, ${(c.strength * 100).toFixed(0)}%): ${c.reason}`);
    out.push('');
  }
  if (a.plan.length) {
    out.push('## Recommended repair plan', '');
    for (const p of a.plan) out.push(`${p.order}. **${p.title}** — ${p.why}${p.command ? `\n   \`\`\`\n   ${p.command}\n   \`\`\`` : ''}`);
  }
  return out.join('\n');
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const sevColor = { critical: '#FF4568', warning: '#FFB547', info: '#00C8FF' } as const;
const statusColor: Record<string, string> = { healthy: '#00E6A0', degraded: '#FFB547', critical: '#FF4568', 'no-data': '#64728C', passed: '#00E6A0', failed: '#FF4568', warning: '#FFB547', 'not-run': '#64728C', 'in-progress': '#00C8FF' };

/** Self-contained, script-free HTML report. All values are escaped. */
export function toHtml(a: Analysis): string {
  const mods = Object.values(a.modules).map((m) => `
    <div class="mod"><div class="ring" style="--c:${statusColor[m.status]};--p:${m.status === 'no-data' ? 0 : m.score}"><span>${m.status === 'no-data' ? '—' : m.score}</span></div>
    <div><b>${esc(MODULE_META[m.id].label)}</b><br><small style="color:${statusColor[m.status]}">${esc(m.status)}</small><br><small>${m.errors} errors · ${m.warnings} warnings</small></div></div>`).join('');
  const findings = a.findings.map((f) => `
    <details class="f" ${f.severity === 'critical' ? 'open' : ''}><summary><span class="sev" style="background:${sevColor[f.severity]}">${esc(f.severity)}</span>
    <b>${esc(f.title)}</b> <code>${esc(f.code)}</code> <small>${esc(f.sources.join(', ').toUpperCase())} · ×${f.occurrences}</small></summary>
    <p>${esc(f.description)}</p>
    <p><small>First seen ${esc(fmtTs(f.firstSeen))}${f.refs[0] ? ` at ${esc(f.refs[0].file)}:${f.refs[0].line}` : ''}</small></p>
    <pre>${esc(f.sample)}</pre>
    ${f.steps.length ? `<ol>${f.steps.map((s) => `<li>${esc(s.text)}${s.command ? `<pre>${esc(s.command)}</pre>` : ''}</li>`).join('')}</ol>` : ''}
    ${f.links.length ? `<ul>${f.links.map((l) => `<li><a href="${esc(l.url)}" rel="noopener noreferrer">${esc(l.title)}</a></li>`).join('')}</ul>` : ''}
    </details>`).join('');
  const stages = a.stages.map((s) => `<div class="stage" style="--c:${statusColor[s.status]}"><b>${esc(s.label)}</b><small>${esc(s.status)}</small><p>${s.evidence.map(esc).join('<br>')}</p></div>`).join('');
  const plan = a.plan.map((p) => `<li><b>${esc(p.title)}</b> — ${esc(p.why)}${p.command ? `<pre>${esc(p.command)}</pre>` : ''}</li>`).join('');
  const corr = a.correlations.map((c) => `<tr><td><code>${esc(c.a)}</code></td><td><code>${esc(c.b)}</code></td><td>${esc(c.kind)}</td><td>${(c.strength * 100).toFixed(0)}%</td><td>${esc(c.reason)}</td></tr>`).join('');
  const corrupt = a.corrupt.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.file ?? '')}</td><td style="color:${c.status === 'repaired' ? '#00E6A0' : '#FF4568'}">${esc(c.status)}</td><td>${c.line}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagnostic Report — ${esc(a.label)}</title>
<style>
:root{color-scheme:dark}body{margin:0;background:#050810;color:#E6EDF7;font:14px/1.55 Inter,system-ui,sans-serif;padding:32px 16px}
.w{max-width:1000px;margin:0 auto}h1,h2{font-family:"Space Grotesk",Inter,sans-serif;letter-spacing:-.01em}h2{margin-top:40px;border-bottom:1px solid #1a2540;padding-bottom:6px}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px}
.hero{display:flex;gap:24px;align-items:center;flex-wrap:wrap}.big{font-size:56px;font-weight:700;color:${statusColor[a.overall.status]}}
.mods{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.mod{display:flex;gap:12px;align-items:center}
.ring{width:54px;height:54px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p)*1%),#1a2540 0);display:grid;place-items:center}
.ring span{background:#0A1020;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-weight:700}
.f{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 16px;margin:8px 0;background:rgba(255,255,255,.03)}summary{cursor:pointer}
.sev{color:#050810;font-weight:700;text-transform:uppercase;font-size:11px;padding:2px 8px;border-radius:99px;margin-right:6px}
pre{background:#0A1020;border:1px solid #1a2540;padding:10px;border-radius:8px;white-space:pre-wrap;word-break:break-all;font:12px "JetBrains Mono",monospace}
code{font-family:"JetBrains Mono",monospace;color:#00C8FF}a{color:#00C8FF}small{color:#9AA8C2}
.stages{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.stage{border-top:3px solid var(--c);background:rgba(255,255,255,.03);border-radius:10px;padding:10px}
.stage small{display:block;color:var(--c);text-transform:uppercase;font-size:11px}.stage p{font-size:12px;color:#9AA8C2;margin:6px 0 0}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #1a2540;vertical-align:top}
@media print{body{background:#fff;color:#000}.card,.f{background:#fff;border-color:#ccc}pre{background:#f5f5f5;border-color:#ddd}small{color:#555}}
</style></head><body><div class="w">
<h1>CBS &amp; DISM Diagnostic Report</h1>
<p><small>${esc(a.label)}${a.isSample ? ' — <b>sample data</b>' : ''} · generated ${esc(new Date(a.createdAt).toISOString())} · ${a.totals.lines.toLocaleString()} lines parsed</small></p>
<div class="card hero"><div class="big">${a.overall.status === 'no-data' ? '—' : a.overall.score}</div><div><b style="color:${statusColor[a.overall.status]};text-transform:uppercase">${esc(a.overall.status)}</b><br>${esc(a.overall.verdict)}<br>
<small>${a.totals.errors} error lines · ${a.totals.warnings} warning lines · ${a.findings.length} findings · ${a.correlations.length} correlations</small></div></div>
<h2>Subsystem health</h2><div class="card mods">${mods}</div>
<h2>Repair stages</h2><div class="stages">${stages}</div>
${plan ? `<h2>Recommended repair plan</h2><div class="card"><ol>${plan}</ol></div>` : ''}
<h2>Findings (${a.findings.length})</h2>${findings || '<p>No findings.</p>'}
${corr ? `<h2>Correlations</h2><div class="card"><table><tr><th>A</th><th>B</th><th>Kind</th><th>Strength</th><th>Reason</th></tr>${corr}</table></div>` : ''}
${corrupt ? `<h2>Corrupt components</h2><div class="card"><table><tr><th>Component</th><th>File</th><th>Status</th><th>Line</th></tr>${corrupt}</table></div>` : ''}
<h2>Files</h2><div class="card"><table><tr><th>File</th><th>Type</th><th>Lines</th><th>Errors</th><th>Warnings</th><th>Range</th></tr>
${a.files.map((f) => `<tr><td>${esc(f.name)}</td><td>${f.source.toUpperCase()}</td><td>${f.lines}</td><td>${f.levels.Error}</td><td>${f.levels.Warning}</td><td>${esc(fmtTs(f.first))} → ${esc(fmtTs(f.last))}</td></tr>`).join('')}</table></div>
</div></body></html>`;
}
