import { effectiveSeverity, type FileResult, type FindingAcc } from './analyzer';
import { GENERIC_STEPS } from './knowledge';
import type {
  Analysis, Correlation, Finding, ModuleHealth, ModuleId, PlanStep, RepairStage, Severity, TimelineEvent,
} from './types';
import { MODULE_IDS } from './types';

const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
export const MAX_ENTRIES_TOTAL = 40000;
const TEMPORAL_WINDOW_MS = 120_000;

/** Causal rules between diagnostic codes (bidirectional). */
const CAUSAL: { a: string[]; b: string[]; reason: string }[] = [
  { a: ['0x800f081f', 'SOURCE_NOT_FOUND', '0x800f0906', '0x800f0907'], b: ['CSI_PAYLOAD_CORRUPT', 'STORE_NOT_REPAIRABLE', 'STORE_REPAIRABLE', 'SFC_CANNOT_REPAIR'],
    reason: 'Repair needed a replacement payload for corrupted store files but no source was reachable' },
  { a: ['STORE_CORRUPTION', 'CSI_PAYLOAD_CORRUPT', '0x80073712', '0x800f0831', 'MANIFEST_CORRUPT'], b: ['SFC_CANNOT_REPAIR'],
    reason: 'SFC repairs files from the component store; a corrupt store copy makes the file unrepairable' },
  { a: ['STORE_CORRUPTION', 'CSI_PAYLOAD_CORRUPT', '0x80073712', '0x800f0831', '0x80070490', '0x800f0982', '0x80073701'], b: ['PACKAGE_FAILED', '0x800f0922'],
    reason: 'Update packages fail to stage when the component store is inconsistent' },
  { a: ['REBOOT_PENDING', 'PENDING_XML', '0x80070bc9'], b: ['PACKAGE_FAILED', '0x800f0922', '0x80070652'],
    reason: 'A pending reboot blocks subsequent servicing operations' },
  { a: ['DOWNLOAD_FAILED', '0x80240034', '0x8024402c'], b: ['0x800f081f', '0x800f0906', 'SOURCE_NOT_FOUND'],
    reason: 'Payload download failures leave repair without a source' },
  { a: ['LOW_DISK', '0x80070070'], b: ['PACKAGE_FAILED', '0x800f0922', 'CLEANUP_RECOMMENDED'],
    reason: 'Insufficient disk space prevents staging and installing packages' },
];

export function aggregate(results: FileResult[], opts: { label?: string; isSample?: boolean; parseMs?: number } = {}): Analysis {
  // ---- Findings -------------------------------------------------------------
  const accs: FindingAcc[] = results.flatMap((r) => r.findings);
  const merged = new Map<string, FindingAcc>();
  for (const f of accs) {
    const ex = merged.get(f.key);
    if (!ex) { merged.set(f.key, { ...f, refs: [...f.refs], times: [...f.times], components: new Set(f.components) }); continue; }
    ex.occurrences += f.occurrences;
    ex.firstSeen = minN(ex.firstSeen, f.firstSeen);
    ex.lastSeen = maxN(ex.lastSeen, f.lastSeen);
    ex.refs.push(...f.refs.slice(0, Math.max(0, 50 - ex.refs.length)));
    ex.times.push(...f.times);
    ex.infoOnly = ex.infoOnly && f.infoOnly;
    ex.sawErrorLevel = ex.sawErrorLevel || f.sawErrorLevel;
  }

  const findings: Finding[] = [...merged.values()].map((f) => ({
    id: f.key,
    code: f.code,
    kind: f.kind,
    title: f.kb.title,
    name: f.kb.name,
    description: f.kb.description,
    severity: effectiveSeverity(f),
    module: f.kb.module,
    sources: [f.source],
    occurrences: f.occurrences,
    firstSeen: f.firstSeen,
    lastSeen: f.lastSeen,
    refs: f.refs,
    sample: f.sample,
    causes: f.kb.causes,
    steps: f.kb.steps,
    links: f.kb.links,
    related: [],
  }));
  findings.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.occurrences - a.occurrences);
  const byId = new Map(findings.map((f) => [f.id, f]));
  const times = new Map([...merged.values()].map((f) => [f.key, f.times.slice().sort((x, y) => x - y)]));

  // ---- Correlations ---------------------------------------------------------
  const correlations: Correlation[] = [];
  const seen = new Set<string>();
  const add = (a: string, b: string, c: Omit<Correlation, 'a' | 'b'>) => {
    if (a === b) return;
    const k = a < b ? `${a}|${b}|${c.kind}` : `${b}|${a}|${c.kind}`;
    if (seen.has(k)) return;
    seen.add(k);
    correlations.push({ a, b, ...c });
  };
  // shared HRESULT across CBS and DISM
  const byCode = new Map<string, Finding[]>();
  for (const f of findings) byCode.set(f.code, [...(byCode.get(f.code) || []), f]);
  for (const [code, list] of byCode) {
    if (list.length > 1) for (let i = 1; i < list.length; i++)
      add(list[0].id, list[i].id, { kind: 'shared-hresult', strength: 1, reason: `Same code ${code} reported by both ${list[0].sources[0].toUpperCase()} and ${list[i].sources[0].toUpperCase()}` });
  }
  // causal rules
  for (const rule of CAUSAL) {
    const as = findings.filter((f) => rule.a.includes(f.code));
    const bs = findings.filter((f) => rule.b.includes(f.code));
    for (const a of as) for (const b of bs) add(a.id, b.id, { kind: 'causal', strength: 0.8, reason: rule.reason });
  }
  // temporal co-occurrence across sources
  const cross = findings.filter((f) => f.severity !== 'info');
  for (let i = 0; i < cross.length; i++) {
    for (let j = i + 1; j < cross.length; j++) {
      const a = cross[i], b = cross[j];
      if (a.sources[0] === b.sources[0]) continue;
      const n = coOccurrences(times.get(a.id) || [], times.get(b.id) || [], TEMPORAL_WINDOW_MS);
      if (n > 0) {
        const strength = Math.min(1, 0.35 + Math.log2(1 + n) / 6);
        add(a.id, b.id, { kind: 'temporal', strength, reason: `${n} occurrence${n > 1 ? 's' : ''} within ${TEMPORAL_WINDOW_MS / 1000}s of each other across CBS and DISM` });
      }
    }
  }
  // corrupt component shared between SFC and CSI findings
  const corrupt = results.flatMap((r) => r.corrupt);
  const sfcFiles = new Set(corrupt.filter((c) => c.status === 'unrepaired' && c.file && c.name !== 'protected file').map((c) => c.file!.toLowerCase()));
  const csiFiles = corrupt.filter((c) => c.status !== 'repaired' && c.file && /amd64_|x86_|wow64_|arm64_/i.test(c.name));
  const sfcF = findings.find((f) => f.code === 'SFC_CANNOT_REPAIR');
  const csiF = findings.find((f) => f.code === 'CSI_PAYLOAD_CORRUPT');
  if (sfcF && csiF && csiFiles.some((c) => sfcFiles.has(c.file!.toLowerCase())))
    add(sfcF.id, csiF.id, { kind: 'component', strength: 1, reason: 'The same file is corrupt in both the protected location and the component store' });

  for (const c of correlations) {
    byId.get(c.a)?.related.push(c.b);
    byId.get(c.b)?.related.push(c.a);
  }

  // ---- Module health ---------------------------------------------------------
  const counts = Object.fromEntries(MODULE_IDS.map((m) => [m, { entries: 0, errors: 0, warnings: 0 }])) as Record<ModuleId, { entries: number; errors: number; warnings: number }>;
  for (const r of results) for (const m of MODULE_IDS) {
    counts[m].entries += r.moduleCounts[m].entries;
    counts[m].errors += r.moduleCounts[m].errors;
    counts[m].warnings += r.moduleCounts[m].warnings;
  }
  const hasDism = results.some((r) => r.summary.source === 'dism');
  const hasCbs = results.some((r) => r.summary.source === 'cbs');
  const sfcRuns = results.flatMap((r) => r.sfcRuns);
  const checker = results.flatMap((r) => r.checker);
  const dismSessions = results.flatMap((r) => r.dismSessions);
  const storeStates = dismSessions.map((s) => s.componentStoreState).filter(Boolean);

  const modules = {} as Record<ModuleId, ModuleHealth>;
  for (const m of MODULE_IDS) {
    const fs = findings.filter((f) => f.module === m);
    const rationale: string[] = [];
    let score = 100;
    const counted = new Set<string>();
    for (const f of fs) {
      let p = penalty(f);
      const dup = counted.has(f.code);
      if (dup) p = Math.round(p / 2);
      counted.add(f.code);
      if (p > 0) { score -= p; rationale.push(`−${p} ${f.title} [${f.sources[0].toUpperCase()}, ${f.severity}, ×${f.occurrences}]${dup ? ' (corroborating, half weight)' : ''}`); }
    }
    if (m === 'integrity') {
      const unrepaired = corrupt.filter((c) => c.status !== 'repaired').length;
      if (unrepaired) { const p = Math.min(50, unrepaired * 10); score -= p; rationale.push(`−${p} ${unrepaired} unrepaired corrupt item${unrepaired > 1 ? 's' : ''}`); }
      const lastChk = checker[checker.length - 1];
      if (lastChk && lastChk.totalDetected > lastChk.totalRepaired) { score -= 20; rationale.push(`−20 checker: ${lastChk.totalDetected} detected, ${lastChk.totalRepaired} repaired`); }
    }
    score = Math.max(0, Math.min(100, Math.round(score)));
    let hasData: boolean;
    switch (m) {
      case 'dism': hasData = hasDism; break;
      case 'cbs': hasData = hasCbs; break;
      case 'sfc': hasData = sfcRuns.length > 0 || counts.sfc.entries > 0; break;
      case 'store': hasData = counts.store.entries > 0 || storeStates.length > 0; break;
      case 'wu': hasData = counts.wu.entries > 0; break;
      case 'integrity': hasData = checker.length > 0 || sfcRuns.length > 0 || storeStates.length > 0 || fs.length > 0; break;
    }
    hasData = hasData || fs.length > 0;
    const crit = fs.filter((f) => f.severity === 'critical').length;
    const status: ModuleHealth['status'] = !hasData ? 'no-data' : crit > 0 || score < 50 ? 'critical' : score < 85 || fs.some((f) => f.severity === 'warning') ? 'degraded' : 'healthy';
    if (!rationale.length) rationale.push(hasData ? 'No penalising findings in parsed data' : 'No log data for this subsystem');
    modules[m] = {
      id: m, score: hasData ? score : 0, status, errors: counts[m].errors, warnings: counts[m].warnings, entries: counts[m].entries,
      critical: crit, findingIds: fs.map((f) => f.id), rationale,
    };
  }
  const withData = MODULE_IDS.map((m) => modules[m]).filter((m) => m.status !== 'no-data');
  const avg = withData.length ? withData.reduce((s, m) => s + m.score, 0) / withData.length : 0;
  const min = withData.length ? Math.min(...withData.map((m) => m.score)) : 0;
  const overallScore = withData.length ? Math.round(avg * 0.5 + min * 0.5) : 0;
  const critCount = findings.filter((f) => f.severity === 'critical').length;
  const overallStatus: ModuleHealth['status'] = !withData.length ? 'no-data' : critCount > 0 || overallScore < 50 ? 'critical' : overallScore < 85 ? 'degraded' : 'healthy';

  // ---- Timeline / entries --------------------------------------------------
  const timeline: TimelineEvent[] = results.flatMap((r) => r.timeline).sort((a, b) => a.ts - b.ts);
  for (const t of timeline) if (t.findingId && byId.has(t.findingId)) t.severity = t.severity === 'milestone' ? 'milestone' : byId.get(t.findingId)!.severity;
  let entries = results.flatMap((r) => r.entries);
  let entriesTruncated = results.some((r) => r.entriesTruncated);
  if (entries.length > MAX_ENTRIES_TOTAL) { entries = entries.slice(0, MAX_ENTRIES_TOTAL); entriesTruncated = true; }

  const files = results.map((r) => r.summary);
  const totals = {
    lines: files.reduce((s, f) => s + f.lines, 0),
    errors: files.reduce((s, f) => s + f.levels.Error, 0),
    warnings: files.reduce((s, f) => s + f.levels.Warning, 0),
    notable: entries.length,
    bytes: files.reduce((s, f) => s + f.size, 0),
  };

  const analysisBase = {
    corrupt,
    packages: results.flatMap((r) => r.packages),
    dismSessions,
    cbsSessions: results.flatMap((r) => r.cbsSessions),
    sfcRuns,
    checker,
  };
  const stages = buildStages(findings, analysisBase, results);
  const plan = buildPlan(findings, modules);

  return {
    id: cryptoId(),
    createdAt: Date.now(),
    label: opts.label || files.map((f) => f.name).join(' + '),
    isSample: !!opts.isSample,
    files, totals, findings, correlations, modules,
    overall: { score: overallScore, status: overallStatus, verdict: verdict(overallStatus, findings, corrupt.filter((c) => c.status !== 'repaired').length) },
    timeline, entries, entriesTruncated,
    ...analysisBase,
    stages, plan,
    parseMs: opts.parseMs ?? 0,
  };
}

function penalty(f: Finding): number {
  const l = Math.log2(1 + f.occurrences);
  if (f.severity === 'critical') return Math.round(Math.min(35, 18 + 4 * l));
  if (f.severity === 'warning') return Math.round(Math.min(12, 4 + 2 * l));
  return 0;
}

function verdict(status: ModuleHealth['status'], findings: Finding[], unrepaired: number): string {
  if (status === 'no-data') return 'No diagnostic data loaded';
  const crit = findings.filter((f) => f.severity === 'critical');
  if (status === 'critical') {
    if (unrepaired) return `${unrepaired} corrupted item${unrepaired > 1 ? 's' : ''} remain unrepaired — servicing is blocked`;
    return `${crit.length} critical issue${crit.length > 1 ? 's' : ''} require attention`;
  }
  if (status === 'degraded') return 'Servicing works but warnings indicate past or pending problems';
  return 'No servicing faults detected in the parsed logs';
}

function coOccurrences(a: number[], b: number[], w: number): number {
  let i = 0, j = 0, n = 0;
  while (i < a.length && j < b.length) {
    const d = a[i] - b[j];
    if (Math.abs(d) <= w) { n++; i++; j++; }
    else if (d < 0) i++;
    else j++;
  }
  return n;
}

type Base = Pick<Analysis, 'corrupt' | 'packages' | 'dismSessions' | 'cbsSessions' | 'sfcRuns' | 'checker'>;

export function buildStages(findings: Finding[], a: Base, results: FileResult[]): RepairStage[] {
  const has = (...codes: string[]) => findings.filter((f) => codes.includes(f.code));
  const ops = (op: string) => a.dismSessions.filter((s) => s.operation === op);
  const scans = [...ops('CheckHealth'), ...ops('ScanHealth')];
  const restores = ops('RestoreHealth');
  const sfc = a.sfcRuns;
  const chk = a.checker;
  const lastChk = chk[chk.length - 1];
  const storeState = results.map((r) => r.flags.storeState).filter(Boolean).pop();
  const unrepaired = a.corrupt.filter((c) => c.status !== 'repaired');
  const repaired = a.corrupt.filter((c) => c.status === 'repaired');

  const scanEv = [
    ...scans.map((s) => `DISM /${s.operation} at line ${s.startLine}${s.errors ? ` (${s.errors} errors)` : ''}`),
    ...sfc.map((r) => `SFC scan at line ${r.startLine}${r.verified ? ` — ${r.verified} components verified` : ''}`),
    ...chk.map((c) => `Checker summary at line ${c.line}`),
  ];
  const scan: RepairStage = {
    id: 'scan', label: 'Scan', description: 'Component store and protected file scan',
    status: scanEv.length ? (scans.some((s) => s.errors > 0 && !s.componentStoreState) ? 'warning' : 'passed') : 'not-run',
    evidence: scanEv.length ? scanEv : ['No CheckHealth/ScanHealth, SFC or checker run found in logs'],
    line: scans[0]?.startLine ?? sfc[0]?.startLine,
  };

  const detected = (lastChk?.totalDetected ?? 0) + a.corrupt.length;
  const detEv: string[] = [];
  if (lastChk) detEv.push(`Checker: ${lastChk.totalDetected} detected / ${lastChk.totalRepaired} repaired (result ${lastChk.result ?? 'n/a'})`);
  if (storeState) detEv.push(`DISM component store state: ${storeState}`);
  if (a.corrupt.length) detEv.push(`${a.corrupt.length} corrupt item(s) recorded (${repaired.length} repaired, ${unrepaired.length} unrepaired)`);
  const detect: RepairStage = {
    id: 'detect', label: 'Detect', description: 'Corruption assessment',
    status: scan.status === 'not-run' && !detEv.length ? 'not-run' : storeState === 'not-repairable' ? 'failed' : detected > 0 || storeState === 'repairable' ? 'warning' : 'passed',
    evidence: detEv.length ? detEv : scan.status === 'not-run' ? ['No assessment data'] : ['No corruption detected'],
    line: lastChk?.line,
  };

  const srcFail = has('0x800f081f', 'SOURCE_NOT_FOUND', '0x800f0906', '0x800f0907', 'DOWNLOAD_FAILED');
  const srcRuns = restores.filter((r) => r.usesSource);
  const source: RepairStage = {
    id: 'source', label: 'Source', description: 'Repair payload source resolution',
    status: srcFail.length ? 'failed' : restores.length || repaired.length ? 'passed' : 'not-run',
    evidence: srcFail.length
      ? srcFail.map((f) => `${f.title} (${f.code}) ×${f.occurrences} [${f.sources[0].toUpperCase()}]`)
      : restores.length
        ? [srcRuns.length ? `Explicit /Source used in ${srcRuns.length} RestoreHealth run(s)` : 'Windows Update used as repair source']
        : ['No repair source activity recorded'],
    line: srcFail[0]?.refs[0]?.line,
  };

  const repEv: string[] = restores.map((r) => `RestoreHealth at line ${r.startLine}: ${r.result && r.errors ? `failed ${r.result}` : r.componentStoreState === 'repaired' ? 'restore completed' : r.errors ? `${r.errors} errors` : 'no errors'}`);
  const sfcRepairs = sfc.reduce((s, r) => s + r.repairedFiles, 0);
  if (sfcRepairs) repEv.push(`SFC repaired ${sfcRepairs} file(s)`);
  const csiFixed = repaired.filter((c) => c.source === 'cbs' && !c.file?.includes('\\')).length;
  if (lastChk?.totalRepaired) repEv.push(`Checker repaired ${lastChk.totalRepaired} item(s)`);
  const restoreFailed = restores.some((r) => r.errors > 0 && r.componentStoreState !== 'repaired');
  const restoreOk = restores.some((r) => r.componentStoreState === 'repaired' || (r.errors === 0 && r.result === undefined));
  const repair: RepairStage = {
    id: 'repair', label: 'Repair', description: 'DISM RestoreHealth / SFC replacement',
    status: !restores.length && !sfcRepairs && !lastChk?.totalRepaired && !csiFixed ? (detected ? 'not-run' : 'not-run')
      : restoreFailed && !restoreOk ? 'failed' : unrepaired.length ? 'warning' : 'passed',
    evidence: repEv.length ? repEv : ['No repair operation recorded'],
    line: restores[0]?.startLine,
  };

  const lastSfc = sfc[sfc.length - 1];
  const verify: RepairStage = {
    id: 'verify', label: 'Verify', description: 'Post-repair SFC verification',
    status: !lastSfc ? 'not-run' : !lastSfc.complete ? 'in-progress' : lastSfc.unrepairedFiles > 0 ? 'failed' : 'passed',
    evidence: lastSfc
      ? [`Last SFC run at line ${lastSfc.startLine}: ${lastSfc.complete ? 'completed' : 'incomplete'}, ${lastSfc.repairedFiles} repaired, ${lastSfc.unrepairedFiles} could not be repaired`]
      : ['Run sfc /scannow after the component store is healthy'],
    line: lastSfc?.startLine,
  };

  const pending = has('REBOOT_PENDING', 'PENDING_XML', '0x80070bc9');
  const pkgFailed = a.packages.filter((p) => p.state === 'failed');
  const pkgPending = a.packages.filter((p) => p.state === 'pending');
  const commitEv: string[] = [];
  if (pending.length) commitEv.push(...pending.map((f) => `${f.title} ×${f.occurrences}`));
  if (pkgFailed.length) commitEv.push(`${pkgFailed.length} package(s) failed: ${pkgFailed.slice(0, 3).map((p) => p.kb || p.name).join(', ')}`);
  if (pkgPending.length) commitEv.push(`${pkgPending.length} package(s) pending restart`);
  const commit: RepairStage = {
    id: 'commit', label: 'Commit', description: 'Finalize transaction & reboot',
    status: pkgFailed.length ? 'failed' : pending.length || pkgPending.length ? 'in-progress' : a.cbsSessions.some((s) => s.end) || a.dismSessions.some((s) => s.end) ? 'passed' : 'not-run',
    evidence: commitEv.length ? commitEv : ['No pending servicing operations found'],
    line: pending[0]?.refs[0]?.line,
  };

  return [scan, detect, source, repair, verify, commit];
}

const STEP_PRIORITY: { match: RegExp; prio: number; id: string; title: string; reboot?: boolean }[] = [
  { match: /^Restart Windows/, prio: 0, id: 'reboot', title: 'Restart to finish pending servicing', reboot: true },
  { match: /^Free at least/, prio: 1, id: 'space', title: 'Free disk space' },
  { match: /services are not disabled/, prio: 2, id: 'services', title: 'Re-enable servicing services' },
  { match: /antivirus/i, prio: 3, id: 'av', title: 'Rule out antivirus interference' },
  { match: /Servicing Stack Update/, prio: 4, id: 'ssu', title: 'Install latest servicing stack' },
  { match: /^Reset Windows Update/, prio: 5, id: 'wureset', title: 'Reset Windows Update components' },
  { match: /Check the system volume/, prio: 6, id: 'chkdsk', title: 'Check disk for file-system errors' },
  { match: /^Scan the component store/, prio: 7, id: 'scan', title: 'Scan component store' },
  { match: /^Repair the component store from Windows Update/, prio: 8, id: 'restore', title: 'Repair component store (Windows Update)' },
  { match: /^Repair using a matching install/, prio: 9, id: 'restore-src', title: 'Repair component store from install media' },
  { match: /^Re-verify protected/, prio: 10, id: 'sfc', title: 'Verify protected system files' },
  { match: /^Download the failing package/, prio: 11, id: 'catalog', title: 'Install failing update manually' },
  { match: /^Remove superseded/, prio: 12, id: 'cleanup', title: 'Clean up component store' },
  { match: /in-place upgrade/, prio: 13, id: 'ipu', title: 'In-place upgrade (last resort)' },
];

export function buildPlan(findings: Finding[], modules: Record<ModuleId, ModuleHealth>): PlanStep[] {
  const steps = new Map<string, PlanStep & { prio: number }>();
  const actionable = findings.filter((f) => f.severity !== 'info' || f.code === 'CLEANUP_RECOMMENDED');
  const sourceMissing = actionable.some((f) => ['0x800f081f', 'SOURCE_NOT_FOUND', '0x800f0906', '0x800f0907'].includes(f.code));
  for (const f of actionable) {
    for (const s of f.steps) {
      const rule = STEP_PRIORITY.find((r) => r.match.test(s.text));
      if (!rule) continue;
      // If WU can't provide the source, prefer the /Source variant and push the plain one after it.
      const prio = rule.id === 'restore' && sourceMissing ? 9.5 : rule.prio;
      const ex = steps.get(rule.id);
      if (ex) { if (!ex.findingIds.includes(f.id)) ex.findingIds.push(f.id); continue; }
      steps.set(rule.id, { id: rule.id, order: 0, prio, title: rule.title, why: s.text, command: s.command, requiresReboot: rule.reboot, findingIds: [f.id] });
    }
  }
  // Always finish a repair chain with SFC verification when store repair is planned.
  if ((steps.has('restore') || steps.has('restore-src')) && !steps.has('sfc'))
    steps.set('sfc', { id: 'sfc', order: 0, prio: 10, title: 'Verify protected system files', why: GENERIC_STEPS.sfc.text, command: GENERIC_STEPS.sfc.command, findingIds: [] });
  if (modules.store.status === 'healthy' && steps.size === 0) return [];
  return [...steps.values()].sort((a, b) => a.prio - b.prio).map((s, i) => {
    const { prio: _p, ...rest } = s;
    void _p;
    return { ...rest, order: i + 1 };
  });
}

function minN(a: number | null, b: number | null) { return a === null ? b : b === null ? a : Math.min(a, b); }
function maxN(a: number | null, b: number | null) { return a === null ? b : b === null ? a : Math.max(a, b); }
function cryptoId(): string {
  try { return crypto.randomUUID(); } catch { return `a-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}
