/// <reference lib="webworker" />
import { parseFiles, type ParseInput } from './stream';

let cancelled = false;

self.onmessage = async (ev: MessageEvent<{ type: 'parse'; input: ParseInput } | { type: 'cancel' }>) => {
  const msg = ev.data;
  if (msg.type === 'cancel') { cancelled = true; return; }
  cancelled = false;
  try {
    const analysis = await parseFiles(msg.input, (p) => self.postMessage({ type: 'progress', progress: p }), () => cancelled);
    self.postMessage({ type: 'done', analysis });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
