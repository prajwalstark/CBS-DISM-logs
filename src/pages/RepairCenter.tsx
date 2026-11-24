import { AnimatePresence, motion } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { CommandBlock } from '@/components/CopyButton';
import { Glass } from '@/components/Glass';
import { HealthRing } from '@/components/HealthRing';
import { NoData } from '@/components/NoData';
import { PageHeader } from '@/components/PageHeader';
import { Scene3D } from '@/components/Scene3D';
import { StageBadge } from '@/components/Status';
import { Badge } from '@/components/ui/badge';
import { stageColor } from '@/design/tokens';
import { SvgPipeline } from '@/fallback/Fallbacks';
import { navigate } from '@/lib/router';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/app';
import { RepairPipeline } from '@/three/lazy';

export default function RepairCenter() {
  const a = useApp((s) => s.analysis);
  const checklist = useApp((s) => s.checklist);
  const toggle = useApp((s) => s.toggleStep);
  const [stage, setStage] = useState<string | null>(null);
  if (!a) return <><PageHeader eyebrow="Act" title="Repair Center" /><NoData what="The repair pipeline" /></>;
  const done = new Set(checklist[a.id] || []);
  const pct = a.plan.length ? Math.round((a.plan.filter((p) => done.has(p.id)).length / a.plan.length) * 100) : 0;
  const sel = a.stages.find((s) => s.id === stage);
  const unrepaired = a.corrupt.filter((c) => c.status !== 'repaired');

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader eyebrow="Act" title="Repair Center"
        description="Stage status is reconstructed from evidence in your logs. The plan below is ordered by dependency — run it on the affected machine from an elevated prompt." />

      <Glass className="relative overflow-hidden p-0">
        <Scene3D label="3D repair pipeline with six stages: scan, detect, source, repair, verify and commit. Click a stage for evidence." className="h-[300px] md:h-[380px]"
          onPointerMissed={() => setStage(null)} fallback={<SvgPipeline stages={a.stages} selected={stage} onSelect={setStage} />}>
          {(p) => <RepairPipeline {...p} stages={a.stages} selected={stage} onSelect={setStage} />}
        </Scene3D>
      </Glass>

      <ol className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Repair stages">
        {a.stages.map((s, i) => (
          <li key={s.id}>
            <button onClick={() => setStage(stage === s.id ? null : s.id)} aria-pressed={stage === s.id}
              className={cn('glass w-full p-3 text-left transition-all duration-base hover:-translate-y-0.5', stage === s.id && 'shadow-glow')}
              style={{ borderTop: `2px solid ${stageColor[s.status]}` }}>
              <div className="label">Stage {i + 1}</div>
              <div className="font-display font-semibold">{s.label}</div>
              <StageBadge status={s.status} />
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence>
        {sel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Glass className="p-5">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-lg font-semibold">{sel.label}</h2><StageBadge status={sel.status} /><span className="text-sm text-ink-3">— {sel.description}</span></div>
              <ul className="mt-3 space-y-1 text-sm text-ink-2">{sel.evidence.map((e) => <li key={e} className="flex gap-2"><span className="text-accent">›</span>{e}</li>)}</ul>
              {sel.line && <button className="mt-3 text-xs text-accent hover:underline" onClick={() => navigate(sel.id === 'scan' && a.dismSessions.some((d) => d.startLine === sel.line) ? 'dism' : 'cbs')}>Open in analyzer →</button>}
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Glass className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Recommended repair plan</h2>
              <p className="text-sm text-ink-2">{a.plan.length ? `${a.plan.length} steps derived from ${new Set(a.plan.flatMap((p) => p.findingIds)).size} findings.` : 'No repair actions are needed based on these logs.'}</p>
            </div>
            {a.plan.length > 0 && <HealthRing score={pct} status={pct === 100 ? 'healthy' : 'degraded'} size={72} stroke={6} sublabel="done" label="Plan progress" />}
          </div>
          {a.plan.length > 0 && <p className="mb-3 text-xs text-ink-3">Tick steps as you complete them on the affected machine — progress is saved in this browser only and never alters diagnostic results.</p>}
          <ol className="space-y-2">
            {a.plan.map((p) => {
              const isDone = done.has(p.id);
              return (
                <motion.li key={p.id} layout className={cn('rounded-xl border p-3 transition-colors', isDone ? 'border-ok/30 bg-ok/[0.06]' : 'border-white/[0.07] bg-white/[0.02]')}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggle(p.id)} role="checkbox" aria-checked={isDone} aria-label={`Mark "${p.title}" as done`}
                      className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition-all duration-base', isDone ? 'border-ok bg-ok text-void' : 'border-white/20 hover:border-accent')}>
                      {isDone ? <Check className="size-4" /> : <span className="text-[11px] text-ink-3">{p.order}</span>}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={cn('flex flex-wrap items-center gap-2 font-medium', isDone && 'text-ink-2 line-through')}>
                        {p.title}{p.requiresReboot && <Badge tone="warning"><RotateCcw className="size-3" />reboot</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-2">{p.why}</p>
                      {p.command && <CommandBlock command={p.command} />}
                      {p.findingIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.findingIds.slice(0, 5).map((fid) => {
                            const f = a.findings.find((x) => x.id === fid);
                            return f ? <button key={fid} onClick={() => { useApp.getState().selectFinding(fid); navigate('errors', { finding: fid }); }}
                              className="mono rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-ink-3 hover:bg-accent/15 hover:text-accent">{f.code}</button> : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </Glass>

        <Glass className="p-5">
          <h2 className="mb-1 font-display text-lg font-semibold">Corrupt items</h2>
          <p className="mb-3 text-sm text-ink-2">{a.corrupt.length ? `${unrepaired.length} unrepaired, ${a.corrupt.length - unrepaired.length} repaired` : 'No corrupt files or payloads recorded.'}</p>
          <ul className="max-h-[480px] space-y-1.5 overflow-auto">
            {a.corrupt.map((c, i) => (
              <li key={`${c.line}-${i}`} className="rounded-lg bg-white/[0.03] p-2.5">
                <div className="flex items-center gap-2">
                  <Badge tone={c.status === 'repaired' ? 'ok' : 'critical'}>{c.status}</Badge>
                  <span className="truncate text-sm font-medium">{c.file ?? c.name}</span>
                </div>
                <div className="mono mt-1 truncate text-[10px] text-ink-3" title={c.name}>{c.name} · line {c.line}</div>
              </li>
            ))}
          </ul>
        </Glass>
      </div>
    </div>
  );
}
