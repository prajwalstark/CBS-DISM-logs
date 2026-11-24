// Core domain model for the CBS & DISM diagnostic engine.
// Everything the UI (2D and 3D) renders is derived from these structures,
// which are produced exclusively by parsing real log input.

export type LogSource = 'cbs' | 'dism';
export type LogLevel = 'Info' | 'Warning' | 'Error' | 'Perf' | 'Unknown';
export type Severity = 'critical' | 'warning' | 'info';

/** The six diagnostic subsystems shown as nodes around the system core. */
export type ModuleId = 'cbs' | 'dism' | 'sfc' | 'store' | 'wu' | 'integrity';

export const MODULE_IDS: ModuleId[] = ['cbs', 'dism', 'sfc', 'store', 'wu', 'integrity'];

export interface LogEntry {
  /** 1-based line number in the source file. */
  line: number;
  /** epoch ms (local time as written in the log), or null if absent. */
  ts: number | null;
  level: LogLevel;
  /** Log component column, e.g. CBS, CSI, DISM, DPX. */
  component: string;
  message: string;
  source: LogSource;
  file: string;
  module: ModuleId;
  hresult?: string;
  /** Pattern id if this line matched a known diagnostic pattern. */
  pattern?: string;
}

export interface KbLink {
  title: string;
  url: string;
}

export interface RemediationStep {
  text: string;
  command?: string;
}

export interface KnowledgeEntry {
  code: string;
  name: string;
  title: string;
  description: string;
  severity: Severity;
  module: ModuleId;
  causes: string[];
  steps: RemediationStep[];
  links: KbLink[];
}

export interface Finding {
  id: string;
  /** HRESULT (0x…) or pattern id (e.g. SFC_CANNOT_REPAIR). */
  code: string;
  kind: 'hresult' | 'pattern';
  title: string;
  name: string;
  description: string;
  severity: Severity;
  module: ModuleId;
  sources: LogSource[];
  occurrences: number;
  firstSeen: number | null;
  lastSeen: number | null;
  /** Up to 50 line references (file + line). */
  refs: { file: string; line: number; source: LogSource }[];
  sample: string;
  causes: string[];
  steps: RemediationStep[];
  links: KbLink[];
  /** ids of correlated findings */
  related: string[];
}

export interface Correlation {
  a: string;
  b: string;
  reason: string;
  kind: 'shared-hresult' | 'temporal' | 'component' | 'causal';
  strength: number; // 0..1
}

export interface CorruptComponent {
  name: string;
  file?: string;
  status: 'repaired' | 'unrepaired' | 'detected';
  line: number;
  source: LogSource;
  ts: number | null;
}

export interface PackageRecord {
  name: string;
  kb?: string;
  client?: string;
  state: 'installed' | 'failed' | 'pending' | 'staged' | 'unknown';
  hresult?: string;
  line: number;
  ts: number | null;
}

export interface DismSession {
  id: string;
  file: string;
  startLine: number;
  start: number | null;
  end: number | null;
  command?: string;
  operation?: 'CheckHealth' | 'ScanHealth' | 'RestoreHealth' | 'AnalyzeComponentStore' | 'StartComponentCleanup' | 'AddPackage' | 'Other';
  usesSource?: boolean;
  limitAccess?: boolean;
  result?: string;
  errors: number;
  warnings: number;
  rebootRequired?: boolean;
  componentStoreState?: 'healthy' | 'repairable' | 'not-repairable' | 'repaired';
}

export interface CbsSession {
  id: string;
  file: string;
  startLine: number;
  start: number | null;
  end: number | null;
  version?: string;
  errors: number;
  warnings: number;
}

export interface SfcRun {
  startLine: number;
  start: number | null;
  end: number | null;
  verified?: number;
  repairedFiles: number;
  unrepairedFiles: number;
  complete: boolean;
}

export interface CheckerSummary {
  line: number;
  ts: number | null;
  operation?: string;
  result?: string;
  totalDetected: number;
  totalRepaired: number;
  breakdown: Record<string, number>;
}

export interface TimelineEvent {
  id: string;
  ts: number;
  source: LogSource;
  module: ModuleId;
  severity: Severity | 'milestone';
  label: string;
  message: string;
  line: number;
  file: string;
  findingId?: string;
}

export type StageStatus = 'passed' | 'failed' | 'warning' | 'not-run' | 'in-progress';

export interface RepairStage {
  id: 'scan' | 'detect' | 'source' | 'repair' | 'verify' | 'commit';
  label: string;
  description: string;
  status: StageStatus;
  evidence: string[];
  line?: number;
}

export interface ModuleHealth {
  id: ModuleId;
  score: number; // 0..100
  status: 'healthy' | 'degraded' | 'critical' | 'no-data';
  errors: number;
  warnings: number;
  entries: number;
  critical: number;
  findingIds: string[];
  /** Human readable explanation of how the score was derived. */
  rationale: string[];
}

export interface FileSummary {
  name: string;
  source: LogSource;
  size: number;
  lines: number;
  parsedLines: number;
  first: number | null;
  last: number | null;
  levels: Record<LogLevel, number>;
  components: Record<string, number>;
}

export interface PlanStep {
  id: string;
  order: number;
  title: string;
  why: string;
  command?: string;
  requiresReboot?: boolean;
  findingIds: string[];
}

export interface Analysis {
  id: string;
  createdAt: number;
  label: string;
  isSample: boolean;
  files: FileSummary[];
  totals: { lines: number; errors: number; warnings: number; notable: number; bytes: number };
  findings: Finding[];
  correlations: Correlation[];
  modules: Record<ModuleId, ModuleHealth>;
  overall: { score: number; status: ModuleHealth['status']; verdict: string };
  timeline: TimelineEvent[];
  /** Notable entries (errors, warnings, pattern hits, milestones). Capped. */
  entries: LogEntry[];
  entriesTruncated: boolean;
  corrupt: CorruptComponent[];
  packages: PackageRecord[];
  dismSessions: DismSession[];
  cbsSessions: CbsSession[];
  sfcRuns: SfcRun[];
  checker: CheckerSummary[];
  stages: RepairStage[];
  plan: PlanStep[];
  parseMs: number;
}

export interface ParseProgress {
  file: string;
  bytesRead: number;
  totalBytes: number;
  lines: number;
}
