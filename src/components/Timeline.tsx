import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { severityColor } from '@/design/tokens';
import { MODULE_META } from '@/engine/modules';
import type { LogSource, TimelineEvent } from '@/engine/types';
import { MODULE_IDS } from '@/engine/types';
import { fmtDuration, fmtTs } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/app';
import { Button } from './ui/button';

const LANE_H = 30;
const PAD_L = 116;

/**
 * Interactive diagnostic timeline: one lane per subsystem, markers coloured by
 * severity. Wheel / buttons zoom, drag pans, click expands an event.
 */
export function Timeline({ events, source, onOpenFinding }: { events: TimelineEvent[]; source?: LogSource; onOpenFinding?: (id: string) => void }) {
  const list = useMemo(() => (source ? events.filter((e) => e.source === source) : events), [events, source]);
  const lanes = useMemo(() => MODULE_IDS.filter((m) => list.some((e) => e.module === m)), [list]);
  const [t0, t1] = useMemo(() => {
    if (!list.length) return [0, 1];
    const a = list[0].ts, b = list[list.length - 1].ts;
    const pad = Math.max(5000, (b - a) * 0.03);
    return [a - pad, b + pad];
  }, [list]);
  const [view, setView] = useState<[number, number]>([t0, t1]);
  useEffect(() => setView([t0, t1]), [t0, t1]);
  const [selected, setSelected] = useState<TimelineEvent | null>(null);
  const [width, setWidth] = useState(800);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; v: [number, number] } | null>(null);
  const selectFinding = useApp((s) => s.selectFinding);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (ev.clientX - r.left - PAD_L) / (r.width - PAD_L)));
      zoomAt(frac, ev.deltaY > 0 ? 1.2 : 1 / 1.2);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const span = view[1] - view[0];
  const innerW = Math.max(100, width - PAD_L - 12);
  const x = (t: number) => PAD_L + ((t - view[0]) / span) * innerW;
  function zoomAt(frac: number, factor: number) {
    setView(([a, b]) => {
      const s = b - a;
      const ns = Math.max(2000, Math.min((t1 - t0) * 1.5, s * factor));
      const c = a + s * frac;
      return [c - ns * frac, c + ns * (1 - frac)];
    });
  }
  const ticks = useMemo(() => {
    const n = Math.max(2, Math.floor(innerW / 140));
    return Array.from({ length: n + 1 }, (_, i) => view[0] + (span * i) / n);
  }, [view, span, innerW]);

  const visible = list.filter((e) => e.ts >= view[0] && e.ts <= view[1]);
  const height = lanes.length * LANE_H + 34;

  if (!list.length) return <div className="rounded-xl border border-white/[0.07] p-6 text-center text-sm text-ink-3">No timestamped events.</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-2">
          {(['critical', 'warning', 'info', 'milestone'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: severityColor[s] }} />{s}</span>
          ))}
          <span className="text-ink-3">· {visible.length} events in view ({fmtDuration(Math.round(span))}) · drag to pan, Ctrl+scroll to zoom</span>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label="Zoom in" onClick={() => zoomAt(0.5, 1 / 1.6)}><Plus /></Button>
          <Button size="icon" variant="ghost" aria-label="Zoom out" onClick={() => zoomAt(0.5, 1.6)}><Minus /></Button>
          <Button size="icon" variant="ghost" aria-label="Reset zoom" onClick={() => setView([t0, t1])}><RotateCcw /></Button>
        </div>
      </div>
      <div
        ref={ref}
        className="relative cursor-grab touch-pan-y select-none overflow-hidden rounded-xl border border-white/[0.07] bg-void-2/60 active:cursor-grabbing"
        style={{ height }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, v: view }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dt = ((e.clientX - drag.current.x) / innerW) * (drag.current.v[1] - drag.current.v[0]);
          setView([drag.current.v[0] - dt, drag.current.v[1] - dt]);
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        role="group"
        aria-label="Diagnostic timeline. Use the event list below for keyboard navigation."
      >
        <svg width={width} height={height} className="block">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={height - 22} stroke="rgba(255,255,255,0.05)" />
              <text x={x(t)} y={height - 8} fill="#64728C" fontSize={10} textAnchor="middle" fontFamily="JetBrains Mono">{fmtTs(t, span > 86_400_000).slice(span > 86_400_000 ? 5 : 0, 16)}</text>
            </g>
          ))}
          {lanes.map((m, i) => (
            <g key={m} transform={`translate(0 ${i * LANE_H + 6})`}>
              <rect x={PAD_L} y={2} width={innerW} height={LANE_H - 8} rx={6} fill="rgba(255,255,255,0.02)" />
              <text x={12} y={LANE_H / 2 + 2} fill="#9AA8C2" fontSize={11} fontFamily="Inter">{MODULE_META[m].label}</text>
            </g>
          ))}
          {visible.map((e) => {
            const lane = lanes.indexOf(e.module);
            const cy = lane * LANE_H + 6 + LANE_H / 2 - 2;
            const c = severityColor[e.severity];
            const sel = selected?.id === e.id;
            return e.severity === 'milestone' ? (
              <rect key={e.id} x={x(e.ts) - 1} y={cy - 9} width={2} height={18} fill={c} opacity={0.8}
                className="cursor-pointer" onClick={(ev) => { ev.stopPropagation(); setSelected(e); }} />
            ) : (
              <circle key={e.id} cx={x(e.ts)} cy={cy} r={sel ? 7 : e.severity === 'critical' ? 5 : 4} fill={c} fillOpacity={0.85}
                stroke={sel ? '#fff' : 'none'} strokeWidth={2} style={{ filter: `drop-shadow(0 0 4px ${c})` }}
                className="cursor-pointer transition-all" onClick={(ev) => { ev.stopPropagation(); setSelected(e); }} />
            );
          })}
        </svg>
      </div>
      <AnimatePresence mode="wait">
        {selected && (
          <motion.div key={selected.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="size-2 rounded-full" style={{ background: severityColor[selected.severity] }} />
                <span className="font-semibold text-ink">{selected.label}</span>
                <span className="text-ink-3">{fmtTs(selected.ts)} · {selected.file}:{selected.line} · {MODULE_META[selected.module].label}</span>
                <button className="ml-auto text-ink-3 hover:text-ink" onClick={() => setSelected(null)} aria-label="Close event">✕</button>
              </div>
              <pre className="mono mt-2 whitespace-pre-wrap break-all text-ink-2">{selected.message}</pre>
              {selected.findingId && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => { selectFinding(selected.findingId!); onOpenFinding?.(selected.findingId!); }}>
                  Open finding
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <details className="group">
        <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink">Event list ({list.length}) — keyboard accessible</summary>
        <ul className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/[0.07]">
          {list.filter((e) => e.severity !== 'info').slice(0, 400).map((e) => (
            <li key={e.id}>
              <button className={cn('flex w-full gap-3 px-3 py-1.5 text-left text-xs hover:bg-white/5', selected?.id === e.id && 'bg-accent/10')} onClick={() => setSelected(e)}>
                <span className="mono shrink-0 text-ink-3">{fmtTs(e.ts)}</span>
                <span className="shrink-0" style={{ color: severityColor[e.severity] }}>{e.severity}</span>
                <span className="truncate">{e.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
