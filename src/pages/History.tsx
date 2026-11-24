import { motion } from 'framer-motion';
import { FolderOpen, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Glass } from '@/components/Glass';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/Status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { statusColor } from '@/design/tokens';
import { fmtRelative } from '@/lib/format';
import { navigate } from '@/lib/router';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/app';
import type { HistoryMeta } from '@/store/history';

function Trend({ items, onPick }: { items: HistoryMeta[]; onPick: (id: string) => void }) {
  const pts = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const [hover, setHover] = useState<number | null>(null);
  if (pts.length < 2) return <p className="text-sm text-ink-3">Run at least two analyses to see a health trend.</p>;
  const W = 640, H = 160, P = 24;
  const x = (i: number) => P + (i / (pts.length - 1)) * (W - P * 2);
  const y = (s: number) => H - P - (s / 100) * (H - P * 2);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.score)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Health trend over ${pts.length} analyses`}>
      <defs><linearGradient id="tg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#00C8FF" stopOpacity="0.35" /><stop offset="1" stopColor="#00C8FF" stopOpacity="0" /></linearGradient></defs>
      {[0, 50, 85, 100].map((v) => <g key={v}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" /><text x={4} y={y(v) + 3} fill="#64728C" fontSize={9}>{v}</text></g>)}
      <path d={`${d} L${x(pts.length - 1)},${H - P} L${x(0)},${H - P} Z`} fill="url(#tg)" />
      <motion.path d={d} fill="none" stroke="#00C8FF" strokeWidth={2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
      {pts.map((p, i) => (
        <g key={p.id} className="cursor-pointer" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onClick={() => onPick(p.id)}>
          <circle cx={x(i)} cy={y(p.score)} r={hover === i ? 7 : 4.5} fill={statusColor[p.status]} stroke="#050810" strokeWidth={2} />
          {hover === i && <text x={x(i)} y={y(p.score) - 12} textAnchor="middle" fill="#E6EDF7" fontSize={11}>{p.score} · {new Date(p.createdAt).toLocaleDateString()}</text>}
        </g>
      ))}
    </svg>
  );
}

export default function History() {
  const history = useApp((s) => s.history);
  const refresh = useApp((s) => s.refreshHistory);
  const open = useApp((s) => s.openHistory);
  const remove = useApp((s) => s.removeHistory);
  const clear = useApp((s) => s.clearAllHistory);
  const current = useApp((s) => s.analysis?.id);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { refresh(); }, [refresh]);
  const openIt = async (id: string) => { await open(id); navigate('overview'); };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader eyebrow="Manage" title="Diagnostic History" description="Analyses are stored locally in this browser (IndexedDB). Open one to restore every view."
        actions={history.length > 0 && <Button variant="danger" size="sm" onClick={() => setConfirm(true)}><Trash /> Clear all</Button>} />
      <Glass className="p-5">
        <h2 className="mb-2 font-display text-base font-semibold">Health trend</h2>
        <Trend items={history.filter((h) => !h.isSample)} onPick={openIt} />
      </Glass>
      {history.length === 0 ? (
        <Glass className="p-8 text-center text-sm text-ink-3">No saved analyses yet. Analyses are saved automatically after parsing (configurable in Settings).</Glass>
      ) : (
        <ul className="space-y-2">
          {history.map((h, i) => (
            <motion.li key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
              <Glass interactive className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', current === h.id && 'ring-1 ring-accent/40')}>
                <div className="grid size-14 shrink-0 place-items-center rounded-xl font-display text-xl font-bold" style={{ background: `${statusColor[h.status]}1a`, color: statusColor[h.status] }}>{h.status === 'no-data' ? '—' : h.score}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="truncate font-medium">{h.label}</span><StatusBadge status={h.status} />{h.isSample && <Badge tone="violet">sample</Badge>}{current === h.id && <Badge tone="info">open</Badge>}</div>
                  <div className="mt-1 text-xs text-ink-3">{fmtRelative(h.createdAt)} · {h.critical} critical · {h.warnings} warnings · {h.files.map((f) => `${f.name} (${f.lines.toLocaleString()} lines)`).join(', ')}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openIt(h.id)}><FolderOpen /> Open</Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${h.label}`} onClick={() => remove(h.id)}><Trash /></Button>
                </div>
              </Glass>
            </motion.li>
          ))}
        </ul>
      )}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Clear diagnostic history?</DialogTitle>
          <DialogDescription className="mt-2">This permanently deletes {history.length} saved analyses from this browser. The currently open analysis stays loaded.</DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={async () => { await clear(); setConfirm(false); }}>Delete all</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
