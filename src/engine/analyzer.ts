import { PATTERNS, isSuccessCode, lookupHresult } from './knowledge';
import type {
  CbsSession, CheckerSummary, CorruptComponent, DismSession, FileSummary, KnowledgeEntry, LogEntry, LogLevel,
  LogSource, ModuleId, PackageRecord, Severity, SfcRun, TimelineEvent,
} from './types';

// ---------------------------------------------------------------------------
// Line grammar
//   2024-01-15 10:23:45, Info                  CBS    Message text
// Lines without the timestamp prefix are continuation lines (e.g. the checker
// summary block and "(p) CSI Payload Corrupt" rows) and inherit context.
// ---------------------------------------------------------------------------
const LINE_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}),\s*(\w+)\s+(\S+)\s?(.*)$/;
const HR_CBS_RE = /\[HRESULT\s*=\s*(0x[0-9a-fA-F]{8})\s*-\s*(\w+)\]/;
const HR_GENERIC_RE = /(?:HRESULT\s*[:=]\s*|\bhr\s*[:=]\s*|\berror(?: code)?\s*[:=]?\s*|\bresult\s*[:=]\s*|\bstatus\s*[:=]\s*)(0x[0-9a-fA-F]{8})/i;
// DISM.exe also logs bare codes: "HRESULT=800F081F".
const HR_BARE_RE = /HRESULT\s*=\s*([0-9a-fA-F]{8})\b/;
// Cheap pre-filter: only lines containing one of these tokens can match a
// pattern. Keeps throughput high on multi-hundred-MB CBS logs.
const INTERESTING_RE = /\[SR\]|CSI Payload|corrupt|HRESULT|hr[:=]|0x[0-9a-f]{8}|fail|reboot|pending|Package_|Summary|Operation|Total |session|command line|TrustedInstaller|Loaded Servicing|repairable|source files|space|hang|Checking System|Cleanup Recommended|hash|Repair|restore operation/i;

const LEVELS: Record<string, LogLevel> = { info: 'Info', warning: 'Warning', error: 'Error', perf: 'Perf' };

export const MAX_ENTRIES_PER_FILE = 30000;
export const MAX_TIMELINE_PER_FILE = 4000;
const MAX_REFS = 50;
const MAX_OCC_TS = 400;

export interface FindingAcc {
  key: string; // `${source}:${code}`
  code: string;
  kind: 'hresult' | 'pattern';
  kb: KnowledgeEntry;
  source: LogSource;
  occurrences: number;
  firstSeen: number | null;
  lastSeen: number | null;
  refs: { file: string; line: number; source: LogSource }[];
  times: number[];
  sample: string;
  /** true while every occurrence came from Info-level lines */
  infoOnly: boolean;
  sawErrorLevel: boolean;
  components: Set<string>;
}

export interface FileResult {
  summary: FileSummary;
  entries: LogEntry[];
  entriesTruncated: boolean;
  findings: FindingAcc[];
  timeline: TimelineEvent[];
  corrupt: CorruptComponent[];
  packages: PackageRecord[];
  dismSessions: DismSession[];
  cbsSessions: CbsSession[];
  sfcRuns: SfcRun[];
  checker: CheckerSummary[];
  moduleCounts: Record<ModuleId, { entries: number; errors: number; warnings: number }>;
  flags: { cleanupRecommended: boolean; storeState?: DismSession['componentStoreState'] };
}

export function detectSource(fileName: string, sample: string): LogSource {
  const n = fileName.toLowerCase();
  if (n.includes('dism')) return 'dism';
  if (n.includes('cbs')) return 'cbs';
  const dismHits = (sample.match(/,\s*\w+\s+DISM\s/g) || []).length;
  const cbsHits = (sample.match(/,\s*\w+\s+(?:CBS|CSI)\s/g) || []).length;
  return dismHits > cbsHits ? 'dism' : 'cbs';
}

export function classifyModule(component: string, msg: string, source: LogSource): ModuleId {
  if (msg.includes('[SR]')) return 'sfc';
  if (/Total (?:Detected|Repaired) Corruption|Operation result|Checking System Update Readiness|^Summary:|component store is (?:repairable|not repairable)|No component store corruption/i.test(msg)) return 'integrity';
  if (source === 'dism') return 'dism';
  if (component === 'CSI' || /CSI Payload|Store corruption|WinSxS|component store|Manifest/i.test(msg)) return 'store';
  if (/Package_(?:\d+_)?for_KB|\bKB\d{6,7}\b|WindowsUpdateAgent|wusa|Windows Update|RollupFix/i.test(msg)) return 'wu';
  return 'cbs';
}

const MODULES: ModuleId[] = ['cbs', 'dism', 'sfc', 'store', 'wu', 'integrity'];

export function createFileAnalyzer(fileName: string, source: LogSource, size: number) {
  const levels: Record<LogLevel, number> = { Info: 0, Warning: 0, Error: 0, Perf: 0, Unknown: 0 };
  const components: Record<string, number> = {};
  const moduleCounts = Object.fromEntries(MODULES.map((m) => [m, { entries: 0, errors: 0, warnings: 0 }])) as FileResult['moduleCounts'];
  const entries: LogEntry[] = [];
  let entriesTruncated = false;
  const findings = new Map<string, FindingAcc>();
  const timeline: TimelineEvent[] = [];
  const corrupt: CorruptComponent[] = [];
  const pendingCsi: CorruptComponent[] = [];
  const packages = new Map<string, PackageRecord>();
  const dismSessions: DismSession[] = [];
  const cbsSessions: CbsSession[] = [];
  const sfcRuns: SfcRun[] = [];
  const checker: CheckerSummary[] = [];
  const flags: FileResult['flags'] = { cleanupRecommended: false };

  let lineNo = 0;
  let parsed = 0;
  let first: number | null = null;
  let last: number | null = null;
  let ctxTs: number | null = null;
  let ctxComponent = source === 'dism' ? 'DISM' : 'CBS';
  let dism: DismSession | null = null;
  let cbs: CbsSession | null = null;
  let sfc: SfcRun | null = null;
  let sfcLastTs: number | null = null;
  let sfcSeen = { repaired: new Set<string>(), unrepaired: new Set<string>() };
  let chk: CheckerSummary | null = null;
  let tlCount = 0;

  function record(kb: KnowledgeEntry, kind: 'hresult' | 'pattern', e: LogEntry) {
    const key = `${source}:${kb.code}`;
    let f = findings.get(key);
    if (!f) {
      f = {
        key, code: kb.code, kind, kb, source, occurrences: 0, firstSeen: null, lastSeen: null, refs: [], times: [],
        sample: e.message.slice(0, 400), infoOnly: true, sawErrorLevel: false, components: new Set(),
      };
      findings.set(key, f);
    }
    f.occurrences++;
    if (e.ts !== null) {
      if (f.firstSeen === null || e.ts < f.firstSeen) f.firstSeen = e.ts;
      if (f.lastSeen === null || e.ts > f.lastSeen) f.lastSeen = e.ts;
      if (f.times.length < MAX_OCC_TS) f.times.push(e.ts);
    }
    if (f.refs.length < MAX_REFS) f.refs.push({ file: fileName, line: e.line, source });
    if (e.level !== 'Info' && e.level !== 'Unknown') f.infoOnly = false;
    if (e.level === 'Error') {
      if (!f.sawErrorLevel) f.sample = e.message.slice(0, 400);
      f.sawErrorLevel = true;
    }
    f.components.add(e.component);
    // One timeline marker per occurrence, until the cap.
    if (e.ts !== null) pushTimeline(e, effectiveSeverity(f), kb.title, key);
  }

  function pushTimeline(e: LogEntry, severity: TimelineEvent['severity'], label: string, findingKey?: string) {
    if (e.ts === null) return;
    if (tlCount >= MAX_TIMELINE_PER_FILE && severity !== 'milestone' && severity !== 'critical') return;
    if (tlCount >= MAX_TIMELINE_PER_FILE * 1.5) return;
    tlCount++;
    timeline.push({
      id: `${fileName}:${e.line}:${timeline.length}`,
      ts: e.ts, source, module: e.module, severity, label, message: e.message.slice(0, 600), line: e.line, file: fileName,
      findingId: findingKey,
    });
  }

  function milestone(e: LogEntry, label: string) {
    e.pattern = e.pattern || 'MILESTONE';
    pushTimeline(e, 'milestone', label);
  }

  function setPackage(name: string, e: LogEntry, patch: Partial<PackageRecord>) {
    let p = packages.get(name);
    if (!p) {
      const kb = name.match(/KB(\d{6,7})/i);
      p = { name, kb: kb ? `KB${kb[1]}` : undefined, state: 'unknown', line: e.line, ts: e.ts };
      packages.set(name, p);
    }
    if (p.state === 'failed' && patch.state && patch.state !== 'installed') delete patch.state;
    Object.assign(p, patch, { line: e.line, ts: e.ts ?? p.ts });
  }

  function closeSfc() {
    if (sfc) { sfc.end = sfcLastTs; sfcRuns.push(sfc); sfc = null; }
  }

  function resolveCsi(status: 'repaired' | 'unrepaired') {
    const c = pendingCsi.shift();
    if (!c) return;
    c.status = status;
    corrupt.push(c);
  }

  function pushLine(raw: string) {
    lineNo++;
    const lineText = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!lineText) return;
    const m = LINE_RE.exec(lineText);
    let level: LogLevel;
    let component: string;
    let message: string;
    let ts: number | null;
    if (m) {
      parsed++;
      ts = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      level = LEVELS[m[7].toLowerCase()] ?? 'Unknown';
      component = m[8];
      message = m[9].trim();
      ctxTs = ts; ctxComponent = component;
      if (first === null || ts < first) first = ts;
      if (last === null || ts > last) last = ts;
    } else {
      // Continuation line — inherit context but don't inherit severity.
      ts = ctxTs;
      level = 'Unknown';
      component = ctxComponent;
      message = lineText.trim();
    }
    levels[level]++;
    components[component] = (components[component] || 0) + 1;
    const module = classifyModule(component, message, source);
    const mc = moduleCounts[module];
    mc.entries++;
    if (level === 'Error') mc.errors++;
    if (level === 'Warning') mc.warnings++;
    if (dism) { if (level === 'Error') dism.errors++; if (level === 'Warning') dism.warnings++; }
    if (cbs) { if (level === 'Error') cbs.errors++; if (level === 'Warning') cbs.warnings++; }

    const notableLevel = level === 'Error' || level === 'Warning';
    if (!notableLevel && !INTERESTING_RE.test(message)) return;

    const e: LogEntry = { line: lineNo, ts, level, component, message: message.slice(0, 1200), source, file: fileName, module };
    analyse(e);
    if (notableLevel || e.hresult || e.pattern) {
      if (entries.length < MAX_ENTRIES_PER_FILE) entries.push(e);
      else entriesTruncated = true;
    }
  }

  function analyse(e: LogEntry) {
    const msg = e.message;

    // ---- HRESULT extraction -------------------------------------------------
    let hr: string | undefined;
    let hrName: string | undefined;
    const cm = HR_CBS_RE.exec(msg);
    if (cm) { hr = cm[1].toLowerCase(); hrName = cm[2]; }
    else {
      const gm = HR_GENERIC_RE.exec(msg) ?? HR_BARE_RE.exec(msg);
      if (gm) hr = (gm[1].startsWith('0x') || gm[1].startsWith('0X') ? gm[1] : `0x${gm[1]}`).toLowerCase();
    }
    if (hr && !isSuccessCode(hr)) {
      e.hresult = hr;
      record(lookupHresult(hr, hrName), 'hresult', e);
      if (dism) dism.result = hr;
    }

    // ---- Session / milestone tracking ---------------------------------------
    if (source === 'dism') {
      if (/<-+\s*Starting Dism\.exe session\s*-+>/i.test(msg)) {
        if (dism) { dismSessions.push(dism); }
        dism = { id: `${fileName}#${e.line}`, file: fileName, startLine: e.line, start: e.ts, end: null, errors: 0, warnings: 0 };
        milestone(e, 'DISM session started');
      } else if (/<-+\s*Ending Dism\.exe session\s*-+>/i.test(msg)) {
        if (dism) { dism.end = e.ts; dismSessions.push(dism); dism = null; }
        milestone(e, 'DISM session ended');
      }
      const cmd = /Executing command line:\s*(.+)$/i.exec(msg);
      if (cmd && dism && !dism.command) {
        dism.command = cmd[1].trim();
        dism.operation = dismOperation(dism.command);
        dism.usesSource = /\/source:/i.test(dism.command);
        dism.limitAccess = /\/limitaccess/i.test(dism.command);
        milestone(e, `dism ${dism.operation}`);
      }
      const rb = /Reboot required\s*=\s*(yes|no)/i.exec(msg);
      if (rb && dism) dism.rebootRequired = rb[1].toLowerCase() === 'yes';
    } else {
      if (/Starting TrustedInstaller initiali[sz]ation/i.test(msg)) {
        if (cbs) cbsSessions.push(cbs);
        cbs = { id: `${fileName}#${e.line}`, file: fileName, startLine: e.line, start: e.ts, end: null, errors: 0, warnings: 0 };
        milestone(e, 'TrustedInstaller started');
      } else if (/Ending TrustedInstaller finali[sz]ation/i.test(msg)) {
        if (cbs) { cbs.end = e.ts; cbsSessions.push(cbs); cbs = null; }
        milestone(e, 'TrustedInstaller finished');
      }
      const ver = /Loaded Servicing Stack v([\d.]+)/i.exec(msg);
      if (ver && cbs) cbs.version = ver[1];
    }

    // ---- SFC ([SR]) -----------------------------------------------------------
    if (msg.includes('[SR]')) {
      if (sfc && e.ts !== null && sfcLastTs !== null && e.ts - sfcLastTs > 10 * 60_000) closeSfc();
      if (!sfc) {
        sfc = { startLine: e.line, start: e.ts, end: null, repairedFiles: 0, unrepairedFiles: 0, complete: false };
        sfcSeen = { repaired: new Set(), unrepaired: new Set() };
        milestone(e, 'SFC scan started');
      }
      sfcLastTs = e.ts;
      const ver = /\[SR\] Verifying (\d+) components/.exec(msg);
      if (ver) sfc.verified = (sfc.verified || 0) + +ver[1];
      if (/\[SR\] (?:Verify|Repair) complete|Verify and Repair Transaction completed/i.test(msg)) { sfc.complete = true; sfc.end = e.ts; }
      const cannot = /\[SR\] Cannot repair member file (?:\[[^\]]*\])?"?([^"]+?)"? of ([^,]+)/i.exec(msg);
      const reproj = /\[SR\] Could not reproject corrupted file (?:\[[^\]]*\])?"?([^"\s]+)"?/i.exec(msg);
      if (cannot || reproj) {
        e.pattern = 'SFC_CANNOT_REPAIR';
        record(PATTERNS.SFC_CANNOT_REPAIR, 'pattern', e);
        const file = (cannot ? cannot[1] : reproj![1]).trim();
        const base = baseName(file);
        if (!sfcSeen.unrepaired.has(base)) {
          sfcSeen.unrepaired.add(base);
          sfc.unrepairedFiles++;
          corrupt.push({ name: cannot ? cannot[2].trim() : 'protected file', file: base, status: 'unrepaired', line: e.line, source, ts: e.ts });
        }
      }
      const rep = /\[SR\] Repair(?:ing corrupted file|ed file)\s+(?:\[[^\]]*\])?"?(.+?)"?(?:\s+from store)?$/i.exec(msg);
      if (rep && !/Repairing \d+ components/i.test(msg)) {
        e.pattern = 'SFC_REPAIRED';
        record(PATTERNS.SFC_REPAIRED, 'pattern', e);
        const fname = baseName(rep[1].replace(/\s+by copying from backup$/i, ''));
        if (!sfcSeen.repaired.has(fname)) {
          sfcSeen.repaired.add(fname);
          sfc.repairedFiles++;
          corrupt.push({ name: fname, file: fname, status: 'repaired', line: e.line, source, ts: e.ts });
        }
      }
    }

    if (/Hashes for file member .* do not match|\bhash mismatch\b/i.test(msg) && !msg.includes('Cannot repair')) {
      e.pattern = e.pattern || 'SFC_HASH_MISMATCH';
      record(PATTERNS.SFC_HASH_MISMATCH, 'pattern', e);
    }

    // ---- Checker (CSI payload + summary block) -------------------------------
    if (/Checking System Update Readiness/i.test(msg)) milestone(e, 'Checker: System Update Readiness');
    const csi = /^\((p|fix|f)\)\s+CSI (Payload|Manifest|Metadata) Corrupt(?:ion)?\s+(.*)$/i.exec(msg);
    if (csi) {
      const tag = csi[1].toLowerCase();
      const rest = csi[3].trim();
      if (tag === 'p' || tag === 'f') {
        const full = rest.replace(/^\(\w+\)\s*/, '').trim();
        const parts = full.split('\\');
        pendingCsi.push({ name: parts[0], file: parts.length > 1 ? parts[parts.length - 1] : undefined, status: 'detected', line: e.line, source, ts: e.ts });
        e.pattern = 'CSI_PAYLOAD_CORRUPT';
      } else {
        // (Fix) CSI Payload Corrupt  CSI File Replaced
        resolveCsi('repaired');
        e.pattern = 'CSI_PAYLOAD_FIXED';
        record(PATTERNS.CSI_PAYLOAD_FIXED, 'pattern', e);
      }
    }
    if (/^Repair failed:/i.test(msg)) {
      if (pendingCsi.length) {
        resolveCsi('unrepaired');
        e.pattern = 'CSI_PAYLOAD_CORRUPT';
        record(PATTERNS.CSI_PAYLOAD_CORRUPT, 'pattern', e);
      }
    }
    if (/^Summary:\s*$/i.test(msg)) {
      chk = { line: e.line, ts: e.ts, totalDetected: 0, totalRepaired: 0, breakdown: {} };
      checker.push(chk);
      milestone(e, 'Checker summary');
    } else if (chk) {
      let mm: RegExpExecArray | null;
      if ((mm = /^Operation:\s*(.+)$/i.exec(msg))) chk.operation = mm[1].trim();
      else if ((mm = /^Operation result:\s*(0x[0-9a-f]{8})/i.exec(msg))) chk.result = mm[1].toLowerCase();
      else if ((mm = /^Total Detected Corruption:\s*(\d+)/i.exec(msg))) chk.totalDetected = +mm[1];
      else if ((mm = /^(CBS|CSI) (Manifest|Metadata|Payload|Catalog) Corruption:\s*(\d+)/i.exec(msg))) chk.breakdown[`${mm[1]} ${mm[2]}`] = +mm[3];
      else if ((mm = /^Total Repaired Corruption:\s*(\d+)/i.exec(msg))) { chk.totalRepaired = +mm[1]; chk = null; }
    }

    // ---- Component-store / repair patterns -----------------------------------
    if (/CSI Store Corruption|Store corruption detected|component store (?:is|has been) corrupt|corruption (?:was )?detected in the component store/i.test(msg) && !/Corruption:\s*\d/.test(msg)) {
      e.pattern = 'STORE_CORRUPTION';
      record(PATTERNS.STORE_CORRUPTION, 'pattern', e);
    }
    if (/component store is repairable/i.test(msg)) {
      e.pattern = 'STORE_REPAIRABLE';
      record(PATTERNS.STORE_REPAIRABLE, 'pattern', e);
      setStore('repairable');
    } else if (/component store (?:cannot be repaired|is not repairable)/i.test(msg)) {
      e.pattern = 'STORE_NOT_REPAIRABLE';
      record(PATTERNS.STORE_NOT_REPAIRABLE, 'pattern', e);
      setStore('not-repairable');
    } else if (/No component store corruption detected/i.test(msg)) {
      setStore('healthy');
      milestone(e, 'No store corruption detected');
    } else if (/restore operation completed successfully/i.test(msg)) {
      setStore('repaired');
      milestone(e, 'Restore operation succeeded');
    }
    if (/source files could not be found/i.test(msg)) {
      e.pattern = 'SOURCE_NOT_FOUND';
      record(PATTERNS.SOURCE_NOT_FOUND, 'pattern', e);
    }
    if (/Manifest hash for component .* does not match|Corrupt manifest|manifest (?:is )?corrupt/i.test(msg) && !/Corruption:\s*\d/.test(msg)) {
      e.pattern = 'MANIFEST_CORRUPT';
      record(PATTERNS.MANIFEST_CORRUPT, 'pattern', e);
    }
    if (/Component Store Cleanup Recommended\s*:\s*Yes/i.test(msg)) {
      flags.cleanupRecommended = true;
      e.pattern = 'CLEANUP_RECOMMENDED';
      record(PATTERNS.CLEANUP_RECOMMENDED, 'pattern', e);
    }

    // ---- Servicing state ------------------------------------------------------
    if (/Reboot required:\s*yes|Reboot required\s*=\s*yes|Reboot mark set|A reboot is required/i.test(msg)) {
      e.pattern = 'REBOOT_PENDING';
      record(PATTERNS.REBOOT_PENDING, 'pattern', e);
    }
    if (/pending (?:transaction|operations?) (?:exists|detected|found)|pending\.xml (?:exists|present|found)/i.test(msg)) {
      e.pattern = 'PENDING_XML';
      record(PATTERNS.PENDING_XML, 'pattern', e);
    }
    if (/fail(?:ed)? to download|download (?:has )?failed/i.test(msg)) {
      e.pattern = 'DOWNLOAD_FAILED';
      record(PATTERNS.DOWNLOAD_FAILED, 'pattern', e);
    }
    if (/TrustedInstaller (?:service )?(?:hang|timed out|terminated unexpectedly)|\bhang detected\b/i.test(msg)) {
      e.pattern = 'TI_HANG';
      record(PATTERNS.TI_HANG, 'pattern', e);
    }
    if (/insufficient (?:disk )?space|not enough (?:disk )?space|disk is full/i.test(msg)) {
      e.pattern = 'LOW_DISK';
      record(PATTERNS.LOW_DISK, 'pattern', e);
    }

    // ---- Packages -----------------------------------------------------------
    const pk = /(Package_(?:\d+_)?for_(?:KB\d+|RollupFix)[^\s,]*|Package_for_[A-Za-z0-9]+~[^\s,]*)/i.exec(msg);
    if (pk) {
      const name = pk[1].replace(/[\].]+$/, '');
      const client = /Client:\s*([\w.]+)/i.exec(msg)?.[1];
      const cur = /current:\s*(\w+)/i.exec(msg)?.[1]?.toLowerCase();
      const patch: Partial<PackageRecord> = {};
      if (client) patch.client = client;
      if (cur === 'installed') patch.state = 'installed';
      else if (cur === 'staged') patch.state = 'staged';
      else if (cur && cur.includes('pending')) patch.state = 'pending';
      if (e.hresult && /fail|error/i.test(msg)) {
        patch.state = 'failed';
        patch.hresult = e.hresult;
        record(PATTERNS.PACKAGE_FAILED, 'pattern', e);
      }
      setPackage(name, e, patch);
      if (/Exec: Processing started/i.test(msg)) milestone(e, 'Package processing started');
    }
    if (/Session: \S+ finalized\. Reboot required: yes/i.test(msg)) {
      for (const p of packages.values()) if (p.state === 'staged' || p.state === 'unknown') p.state = 'pending';
    }

    // ---- Generic error lines without classification ---------------------------
    if (e.level === 'Error' && !e.hresult && !e.pattern) {
      const kb: KnowledgeEntry = {
        code: `UNCLASSIFIED_${e.module.toUpperCase()}`,
        name: `UNCLASSIFIED_${e.module.toUpperCase()}`,
        title: `Unclassified ${e.component} errors`,
        description: 'Error-level lines that did not match a known HRESULT or diagnostic pattern. Review them in context.',
        severity: 'warning',
        module: e.module,
        causes: ['See log lines'],
        steps: [{ text: 'Inspect these lines in the analyzer; the first occurrence is usually the root cause.' }],
        links: [],
      };
      record(kb, 'pattern', e);
    }
  }

  function setStore(state: NonNullable<DismSession['componentStoreState']>) {
    flags.storeState = state;
    if (dism) dism.componentStoreState = state;
  }

  function finish(): FileResult {
    if (dism) dismSessions.push(dism);
    if (cbs) cbsSessions.push(cbs);
    closeSfc();
    while (pendingCsi.length) {
      const c = pendingCsi.shift()!;
      corrupt.push(c);
      record(PATTERNS.CSI_PAYLOAD_CORRUPT, 'pattern', {
        line: c.line, ts: c.ts, level: 'Unknown', component: 'CBS', message: `CSI Payload Corrupt ${c.name}${c.file ? '\\' + c.file : ''}`,
        source, file: fileName, module: 'store',
      });
    }
    return {
      summary: { name: fileName, source, size, lines: lineNo, parsedLines: parsed, first, last, levels, components },
      entries, entriesTruncated,
      findings: [...findings.values()],
      timeline, corrupt: corrupt.slice(0, 5000), packages: [...packages.values()],
      dismSessions, cbsSessions, sfcRuns, checker, moduleCounts, flags,
    };
  }

  return { pushLine, finish, get lines() { return lineNo; } };
}

function baseName(p: string): string {
  return (p.split(/[\\/]/).pop() || p).replace(/[;,.:]+$/, "").toLowerCase();
}

function dismOperation(cmd: string): DismSession['operation'] {
  if (/\/checkhealth/i.test(cmd)) return 'CheckHealth';
  if (/\/scanhealth/i.test(cmd)) return 'ScanHealth';
  if (/\/restorehealth/i.test(cmd)) return 'RestoreHealth';
  if (/\/analyzecomponentstore/i.test(cmd)) return 'AnalyzeComponentStore';
  if (/\/startcomponentcleanup/i.test(cmd)) return 'StartComponentCleanup';
  if (/\/add-package/i.test(cmd)) return 'AddPackage';
  return 'Other';
}

export function effectiveSeverity(f: FindingAcc): Severity {
  let s = f.kb.severity;
  if (f.kind === 'hresult' && f.infoOnly && s === 'warning') s = 'info';
  if (f.sawErrorLevel && s === 'info') s = 'warning';
  return s;
}

/** Convenience: analyse a whole string (used by tests and the sync fallback). */
export function analyseText(fileName: string, text: string, source?: LogSource): FileResult {
  const src = source ?? detectSource(fileName, text.slice(0, 20000));
  const a = createFileAnalyzer(fileName, src, text.length);
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) { a.pushLine(text.slice(start, i)); start = i + 1; }
  }
  if (start < text.length) a.pushLine(text.slice(start));
  return a.finish();
}
