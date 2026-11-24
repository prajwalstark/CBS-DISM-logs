import { aggregate } from '@/engine/aggregate';
import { createFileAnalyzer, detectSource, type FileResult } from '@/engine/analyzer';
import type { Analysis, ParseProgress } from '@/engine/types';

export interface InlineLog { name: string; content: string }

export interface ParseInput {
  files: (File | InlineLog)[];
  label?: string;
  isSample?: boolean;
}

async function sniffEncoding(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xfe) return 'utf-16le';
  if (head[0] === 0xfe && head[1] === 0xff) return 'utf-16be';
  // UTF-16 without BOM: every second byte zero in the first ASCII chars.
  if (head.length === 4 && head[1] === 0 && head[3] === 0 && head[0] !== 0) return 'utf-16le';
  return 'utf-8';
}

/**
 * Streams each file line by line through the analyzer. Memory stays bounded:
 * only notable entries and aggregates are retained, never the whole file.
 */
export async function parseFiles(input: ParseInput, onProgress: (p: ParseProgress) => void, isCancelled: () => boolean): Promise<Analysis> {
  const t0 = performance.now();
  const results: FileResult[] = [];
  for (const f of input.files) {
    if (!(f instanceof Blob)) {
      const a = createFileAnalyzer(f.name, detectSource(f.name, f.content.slice(0, 20000)), f.content.length);
      for (const line of f.content.split('\n')) a.pushLine(line);
      results.push(a.finish());
      onProgress({ file: f.name, bytesRead: f.content.length, totalBytes: f.content.length, lines: a.lines });
      continue;
    }
    if (/\.(cab|zip|evtx|etl)$/i.test(f.name)) throw new Error(`${f.name}: binary archives are not supported. Extract CbsPersist_*.cab / logs first and load the .log files.`);
    const encoding = await sniffEncoding(f);
    const sample = await f.slice(0, 64 * 1024).text();
    const a = createFileAnalyzer(f.name, detectSource(f.name, encoding === 'utf-8' ? sample : sample.replace(/\0/g, '')), f.size);
    const reader = f.stream().pipeThrough(new TextDecoderStream(encoding) as unknown as TransformStream<Uint8Array, string>).getReader();
    let carry = '';
    let bytes = 0;
    let lastPost = 0;
    const bytesPerChar = encoding.startsWith('utf-16') ? 2 : 1;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (isCancelled()) { await reader.cancel(); throw new Error('cancelled'); }
      bytes += value.length * bytesPerChar;
      let start = 0;
      const chunk = carry + value;
      for (let i = 0; i < chunk.length; i++) {
        if (chunk.charCodeAt(i) === 10) { a.pushLine(chunk.slice(start, i)); start = i + 1; }
      }
      carry = chunk.slice(start);
      const now = performance.now();
      if (now - lastPost > 80) { lastPost = now; onProgress({ file: f.name, bytesRead: Math.min(bytes, f.size), totalBytes: f.size, lines: a.lines }); }
    }
    if (carry) a.pushLine(carry);
    results.push(a.finish());
    onProgress({ file: f.name, bytesRead: f.size, totalBytes: f.size, lines: a.lines });
  }
  return aggregate(results, { label: input.label, isSample: input.isSample, parseMs: Math.round(performance.now() - t0) });
}
