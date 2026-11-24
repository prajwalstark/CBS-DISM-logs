import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { LogEntry, LogLevel } from '@/engine/types';
import { fmtNum, fmtTs } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MODULE_META } from '@/engine/modules';

const LEVEL_STYLE: Record<LogLevel, string> = {
  Error: 'text-crit', Warning: 'text-warn', Info: 'text-ink-2', Perf: 'text-accent-2', Unknown: 'text-ink-3',
};
const FILTERS: { id: 'all' | 'Error' | 'Warning' | 'hr' | 'pattern'; label: string }[] = [
  { id: 'all', label: 'All notable' }, { id: 'Error', label: 'Errors' }, { id: 'Warning', label: 'Warnings' },
  { id: 'hr', label: 'HRESULT' }, { id: 'pattern', label: 'Patterns' },
];

export function LogViewer({ entries, focusLine, height = 460, truncated }: { entries: LogEntry[]; focusLine?: { file: string; line: number } | null; height?: number; truncated?: boolean }) {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q.trim().toLowerCase());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const parent = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => entries.filter((e) => {
    if (filter === 'Error' && e.level !== 'Error') return false;
    if (filter === 'Warning' && e.level !== 'Warning') return false;
    if (filter === 'hr' && !e.hresult) return false;
    if (filter === 'pattern' && (!e.pattern || e.pattern === 'MILESTONE')) return false;
    if (dq && !e.message.toLowerCase().includes(dq) && !(e.hresult ?? '').includes(dq) && !String(e.line).startsWith(dq)) return false;
    return true;
  }), [entries, filter, dq]);

  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: () => 30, overscan: 12 });

  useEffect(() => {
    if (!focusLine) return;
    const idx = rows.findIndex((r) => r.line === focusLine.line && r.file === focusLine.file);
    if (idx >= 0) { v.scrollToIndex(idx, { align: 'center' }); setExpanded(`${focusLine.file}:${focusLine.line}`); }
  }, [focusLine, rows, v]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search log entries</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search message, HRESULT or line…"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm placeholder:text-ink-3 focus:border-accent/50 focus:outline-none" />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter entries">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
              className={cn('rounded-md px-2.5 py-1 text-xs transition-colors', filter === f.id ? 'bg-accent/15 text-accent ring-1 ring-accent/30' : 'text-ink-2 hover:bg-white/5 hover:text-ink')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-ink-3">
        <span>{fmtNum(rows.length)} of {fmtNum(entries.length)} notable entries{truncated ? ' (capped — large log)' : ''}</span>
        <span className="hidden sm:inline">Click a row to expand</span>
      </div>
      <div ref={parent} className="overflow-auto rounded-xl border border-white/[0.07] bg-void-2/60" style={{ height }} role="list" aria-label="Log entries">
        {rows.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-ink-3">No entries match.</div>
        ) : (
          <div style={{ height: v.getTotalSize(), position: 'relative' }}>
            {v.getVirtualItems().map((vi) => {
              const e = rows[vi.index];
              const key = `${e.file}:${e.line}`;
              const open = expanded === key;
              const focused = focusLine && focusLine.line === e.line && focusLine.file === e.file;
              return (
                <div key={key + vi.index} data-index={vi.index} ref={v.measureElement} role="listitem"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}>
                  <button type="button" onClick={() => setExpanded(open ? null : key)} aria-expanded={open}
                    className={cn('flex w-full items-start gap-3 border-b border-white/[0.04] px-3 py-1.5 text-left font-mono text-[12px] hover:bg-white/[0.04]', focused && 'bg-accent/10', open && 'bg-white/[0.03]')}>
                    <span className="w-14 shrink-0 text-right text-ink-3">{e.line}</span>
                    <span className="hidden w-[68px] shrink-0 text-ink-3 md:inline">{fmtTs(e.ts, false)}</span>
                    <span className={cn('w-14 shrink-0', LEVEL_STYLE[e.level])}>{e.level === 'Unknown' ? '·' : e.level}</span>
                    <span className="hidden w-12 shrink-0 text-accent/70 sm:inline">{e.component}</span>
                    <span className={cn('min-w-0 flex-1 text-ink', open ? 'whitespace-pre-wrap break-all' : 'truncate')}>
                      {e.hresult && <span className="mr-2 rounded bg-crit/15 px-1 text-crit">{e.hresult}</span>}
                      {e.message}
                      {open && (
                        <span className="mt-1 block text-[11px] text-ink-3">
                          {e.file} · {fmtTs(e.ts)} · {MODULE_META[e.module].label}{e.pattern && e.pattern !== 'MILESTONE' ? ` · pattern ${e.pattern}` : ''}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
