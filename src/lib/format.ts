/** Log timestamps are wall-clock as written in the log, stored as UTC epoch. */
export function fmtTs(t: number | null | undefined, withDate = true): string {
  if (t == null) return '—';
  const iso = new Date(t).toISOString();
  return withDate ? `${iso.slice(0, 10)} ${iso.slice(11, 19)}` : iso.slice(11, 19);
}
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
export function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}
export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
export function fmtRelative(t: number): string {
  const d = Date.now() - t;
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} h ago`;
  return new Date(t).toLocaleDateString();
}
