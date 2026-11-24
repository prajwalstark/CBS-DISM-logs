import { create } from 'zustand';
import type { Analysis, ModuleId, ParseProgress } from '@/engine/types';
import { startParse, type ParseJob } from '@/workers/client';
import { detectQuality, hasWebGL, type Quality } from '@/lib/webgl';
import { useMedia } from '@/lib/useMedia';
import { clearHistory, deleteAnalysis, listHistory, loadAnalysis, saveAnalysis, type HistoryMeta } from './history';

export interface Settings {
  quality: 'auto' | Quality;
  enable3D: boolean;
  bloom: boolean;
  particles: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  autoSave: boolean;
  autoRotate: boolean;
}

const SETTINGS_KEY = 'cbs-dism-studio:settings';
const CHECKLIST_KEY = 'cbs-dism-studio:checklist';
const DEFAULT_SETTINGS: Settings = { quality: 'auto', enable3D: true, bloom: true, particles: true, reducedMotion: 'system', autoSave: true, autoRotate: true };

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

interface ParseState {
  status: 'idle' | 'parsing' | 'error';
  progress: ParseProgress | null;
  error: string | null;
  job: ParseJob | null;
}

interface AppState {
  analysis: Analysis | null;
  parse: ParseState;
  selectedModule: ModuleId | null;
  selectedFinding: string | null;
  settings: Settings;
  history: HistoryMeta[];
  /** Repair plan checklist: analysisId -> completed step ids (user-tracked). */
  checklist: Record<string, string[]>;
  webgl: boolean;
  autoQuality: Quality;

  loadFiles: (files: File[]) => Promise<void>;
  loadSample: () => Promise<void>;
  cancelParse: () => void;
  setAnalysis: (a: Analysis | null) => void;
  selectModule: (m: ModuleId | null) => void;
  selectFinding: (id: string | null) => void;
  updateSettings: (p: Partial<Settings>) => void;
  refreshHistory: () => Promise<void>;
  openHistory: (id: string) => Promise<void>;
  removeHistory: (id: string) => Promise<void>;
  clearAllHistory: () => Promise<void>;
  toggleStep: (stepId: string) => void;
}

export const useApp = create<AppState>((set, get) => ({
  analysis: null,
  parse: { status: 'idle', progress: null, error: null, job: null },
  selectedModule: null,
  selectedFinding: null,
  settings: loadJson(SETTINGS_KEY, DEFAULT_SETTINGS),
  history: [],
  checklist: loadJson<Record<string, string[]>>(CHECKLIST_KEY, {}),
  webgl: hasWebGL(),
  autoQuality: detectQuality(),

  async loadFiles(files) {
    if (!files.length) return;
    const logs = files.filter((f) => !/\.(png|jpe?g|gif|pdf|exe|dll)$/i.test(f.name));
    if (!logs.length) {
      set({ parse: { status: 'error', progress: null, error: 'No log files selected. Choose CBS.log and/or dism.log.', job: null } });
      return;
    }
    await run({ files: logs, label: logs.map((f) => f.name).join(' + ') }, set, get);
  },

  async loadSample() {
    const [cbs, dism] = await Promise.all([
      import('@/engine/samples/CBS.sample.log?raw').then((m) => m.default),
      import('@/engine/samples/DISM.sample.log?raw').then((m) => m.default),
    ]);
    await run({ files: [{ name: 'CBS.sample.log', content: cbs }, { name: 'DISM.sample.log', content: dism }], label: 'Sample: Windows 10 22H2 servicing failure', isSample: true }, set, get);
  },

  cancelParse() {
    get().parse.job?.cancel();
    set({ parse: { status: 'idle', progress: null, error: null, job: null } });
  },

  setAnalysis(a) {
    set({ analysis: a, selectedModule: null, selectedFinding: null });
  },
  selectModule(m) { set({ selectedModule: m }); },
  selectFinding(id) { set({ selectedFinding: id }); },

  updateSettings(p) {
    const settings = { ...get().settings, ...p };
    saveJson(SETTINGS_KEY, settings);
    set({ settings });
  },

  async refreshHistory() {
    try { set({ history: await listHistory() }); } catch { set({ history: [] }); }
  },
  async openHistory(id) {
    const a = await loadAnalysis(id);
    if (a) get().setAnalysis(a);
  },
  async removeHistory(id) {
    await deleteAnalysis(id);
    if (get().analysis?.id === id) get().setAnalysis(null);
    await get().refreshHistory();
  },
  async clearAllHistory() {
    await clearHistory();
    await get().refreshHistory();
  },
  toggleStep(stepId) {
    const a = get().analysis;
    if (!a) return;
    const cur = new Set(get().checklist[a.id] || []);
    if (cur.has(stepId)) cur.delete(stepId); else cur.add(stepId);
    const checklist = { ...get().checklist, [a.id]: [...cur] };
    saveJson(CHECKLIST_KEY, checklist);
    set({ checklist });
  },
}));

type Setter = (p: Partial<AppState>) => void;
async function run(input: Parameters<typeof startParse>[0], set: Setter, get: () => AppState) {
  get().parse.job?.cancel();
  let lastUpdate = 0;
  const job = startParse(input, (progress) => {
    const now = performance.now();
    if (now - lastUpdate < 60 && progress.bytesRead < progress.totalBytes) return;
    lastUpdate = now;
    set({ parse: { ...get().parse, progress } });
  });
  set({ parse: { status: 'parsing', progress: null, error: null, job } });
  try {
    const analysis = await job.promise;
    set({ analysis, selectedModule: null, selectedFinding: null, parse: { status: 'idle', progress: null, error: null, job: null } });
    if (get().settings.autoSave) {
      saveAnalysis(analysis).then(() => get().refreshHistory()).catch(() => undefined);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'cancelled') return;
    set({ parse: { status: 'error', progress: null, error: msg, job: null } });
  }
}

export function useReducedMotion(): boolean {
  const pref = useApp((s) => s.settings.reducedMotion);
  const system = useMedia('(prefers-reduced-motion: reduce)');
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return system;
}

export function useQuality(): Quality {
  const q = useApp((s) => s.settings.quality);
  const auto = useApp((s) => s.autoQuality);
  return q === 'auto' ? auto : q;
}
