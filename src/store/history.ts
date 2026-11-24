import type { Analysis } from '@/engine/types';

// IndexedDB persistence for diagnostic history. Entries are capped so a
// saved analysis stays small even for multi-hundred-MB logs.
const DB = 'cbs-dism-studio';
const STORE = 'analyses';
const MAX_SAVED_ENTRIES = 5000;

export interface HistoryMeta {
  id: string;
  label: string;
  createdAt: number;
  isSample: boolean;
  score: number;
  status: Analysis['overall']['status'];
  critical: number;
  warnings: number;
  files: { name: string; source: string; lines: number }[];
}

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('IndexedDB unavailable'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
    t.oncomplete = () => db.close();
  }));
}

export function toMeta(a: Analysis): HistoryMeta {
  return {
    id: a.id, label: a.label, createdAt: a.createdAt, isSample: a.isSample, score: a.overall.score, status: a.overall.status,
    critical: a.findings.filter((f) => f.severity === 'critical').length,
    warnings: a.findings.filter((f) => f.severity === 'warning').length,
    files: a.files.map((f) => ({ name: f.name, source: f.source, lines: f.lines })),
  };
}

export async function saveAnalysis(a: Analysis): Promise<void> {
  const slim: Analysis = a.entries.length > MAX_SAVED_ENTRIES ? { ...a, entries: a.entries.slice(0, MAX_SAVED_ENTRIES), entriesTruncated: true } : a;
  await tx('readwrite', (s) => s.put(slim));
}
export async function loadAnalysis(id: string): Promise<Analysis | undefined> {
  return tx<Analysis | undefined>('readonly', (s) => s.get(id));
}
export async function deleteAnalysis(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}
export async function clearHistory(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}
export async function listHistory(): Promise<HistoryMeta[]> {
  const all = await tx<Analysis[]>('readonly', (s) => s.getAll());
  return all.map(toMeta).sort((a, b) => b.createdAt - a.createdAt);
}
