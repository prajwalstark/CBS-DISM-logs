import type { Analysis, ParseProgress } from '@/engine/types';
import type { ParseInput } from './stream';

export interface ParseJob {
  promise: Promise<Analysis>;
  cancel: () => void;
}

/** Parse logs in a Web Worker; falls back to the main thread if workers are unavailable. */
export function startParse(input: ParseInput, onProgress: (p: ParseProgress) => void): ParseJob {
  if (typeof Worker === 'undefined') return mainThread(input, onProgress);
  let worker: Worker;
  try {
    worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return mainThread(input, onProgress);
  }
  let reject!: (e: Error) => void;
  const promise = new Promise<Analysis>((res, rej) => {
    reject = rej;
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === 'progress') onProgress(m.progress);
      else if (m.type === 'done') { res(m.analysis); worker.terminate(); }
      else if (m.type === 'error') { rej(new Error(m.message)); worker.terminate(); }
    };
    worker.onerror = (e) => { rej(new Error(e.message || 'Worker failed')); worker.terminate(); };
  });
  worker.postMessage({ type: 'parse', input });
  return {
    promise,
    cancel: () => { worker.terminate(); reject(new Error('cancelled')); },
  };
}

function mainThread(input: ParseInput, onProgress: (p: ParseProgress) => void): ParseJob {
  let cancelled = false;
  const promise = import('./stream').then((m) => m.parseFiles(input, onProgress, () => cancelled));
  return { promise, cancel: () => { cancelled = true; } };
}
