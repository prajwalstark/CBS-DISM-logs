import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Bug, FileSearch, HardDrive, MousePointerClick, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { FindingDetail } from '@/components/FindingDetail';
import { Glass } from '@/components/Glass';
import { HealthRing } from '@/components/HealthRing';
import { ModulePanel } from '@/components/ModulePanel';
import { PageHeader } from '@/components/PageHeader';
import { Scene3D } from '@/components/Scene3D';
import { StatCard } from '@/components/StatCard';
import { SeverityBadge, StatusDot } from '@/components/Status';
import { Timeline } from '@/components/Timeline';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { color } from '@/design/tokens';
import { MODULE_META } from '@/engine/modules';
import type { ModuleId } from '@/engine/types';
import { MODULE_IDS } from '@/engine/types';
import { fmtBytes, fmtDuration, fmtNum } from '@/lib/format';
import { navigate } from '@/lib/router';
import { useMedia } from '@/lib/useMedia';
import { cn } from '@/lib/utils';
import { SvgSystemMap } from '@/fallback/Fallbacks';
import { OverviewScene } from '@/three/lazy';
import { useApp } from '@/store/app';

export default function Overview() {
  const analysis = useApp((s) => s.analysis);
  const selected = useApp((s) => s.selectedModule);
  const select = useApp((s) => s.selectModule);
  const [hovered, setHovered] = useState<ModuleId | null>(null);
  const [openFinding, setOpenFinding] = useState<string | null>(null);
  const compact = useMedia('(max-width: 767px)');
  const finding = analysis?.findings.find((f) => f.id === openFinding);
  const crit = analysis?.findings.filter((f) => f.severity === 'critical').length ?? 0;
  const warn = analysis?.findings.filter((f) => f.severity === 'warning').length ?? 0;
  const unrepaired = analysis?.corrupt.filter((c) => c.status !== 'repaired').length ?? 0;

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow="Command center"
        title="System Overview"
        description={analysis ? analysis.overall.verdict : 'Load CBS.log and dism.log to build a live model of your Windows servicing stack.'}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <Glass className="relative min-w-0 overflow-hidden p-0">
          <Scene3D
            label="Interactive 3D system map. Drag to rotate, scroll to zoom, click a module for details. A keyboard-accessible module list follows."
            className="h-[380px] md:h-[560px]"
            onPointerMissed={() => select(null)}
            fallback={<SvgSystemMap analysis={analysis} selected={selected} onSelect={select} />}
          >
            {(p) => <OverviewScene {...p} analysis={analysis} selected={selected} hovered={hovered} onSelect={select} onHover={setHovered} compact={compact} />}
          </Scene3D>
          {/* HUD overlay */}
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-3 md:left-5 md:top-5">
            <div className="rounded-full bg-void/80 p-1">
              <HealthRing score={analysis?.overall.score ?? 0} status={analysis?.overall.status ?? 'no-data'} size={compact ? 64 : 88} stroke={compact ? 6 : 8} sublabel="health" label="Overall system health" />
            </div>
            <div className="hidden sm:block">
              <div className="label">Overall</div>
              <div className="font-display text-lg font-semibold capitalize">{analysis ? analysis.overall.status.replace('-', ' ') : 'Awaiting logs'}</div>
              {analysis && <div className="text-xs text-ink-3">{fmtNum(analysis.totals.lines)} lines · {fmtBytes(analysis.totals.bytes)} · parsed in {fmtDuration(analysis.parseMs)}</div>}
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-3 right-4 hidden items-center gap-1.5 text-[11px] text-ink-3 md:flex">
            <MousePointerClick className="size-3.5" /> Drag to orbit · scroll to zoom · click a module
          </div>
          {/* Accessible module list mirrors the 3D nodes */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex gap-1.5 overflow-x-auto bg-gradient-to-t from-void/90 to-transparent p-3 pt-8 md:bottom-8 md:bg-none md:pt-3 [&>button]:pointer-events-auto" role="toolbar" aria-label="Diagnostic modules">
            {MODULE_IDS.map((m) => {
              const h = analysis?.modules[m];
              return (
                <button key={m} onClick={() => select(selected === m ? null : m)} onMouseEnter={() => setHovered(m)} onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(m)} onBlur={() => setHovered(null)} aria-pressed={selected === m}
                  className={cn('flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors duration-base',
                    selected === m ? 'border-accent/60 bg-[#0b2a3d] text-ink' : 'border-white/10 bg-void/90 text-ink-2 hover:border-white/25 hover:text-ink')}>
                  <StatusDot status={h?.status ?? 'no-data'} pulse={false} />
                  {MODULE_META[m].label}
                  {h && h.status !== 'no-data' && <span className="mono text-ink-3">{h.score}</span>}
                </button>
              );
            })}
          </div>
        </Glass>

        <div className="min-h-[200px] min-w-0 xl:max-h-[560px]">
          <AnimatePresence mode="wait">
            {analysis && selected ? (
              <ModulePanel key={selected} id={selected} analysis={analysis} onClose={() => select(null)} />
            ) : analysis ? (
              <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass flex h-full flex-col p-5">
                <h2 className="label mb-3">Top findings</h2>
                {analysis.findings.length === 0 ? (
                  <p className="text-sm text-ink-2">No issues detected in the parsed logs.</p>
                ) : (
                  <ul className="flex-1 space-y-1.5 overflow-auto">
                    {analysis.findings.slice(0, 9).map((f) => (
                      <li key={f.id}>
                        <button onClick={() => setOpenFinding(f.id)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-white/5">
                          <SeverityBadge severity={f.severity} />
                          <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                          <span className="mono text-[11px] text-ink-3">{f.sources[0].toUpperCase()} ×{f.occurrences}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button onClick={() => navigate('errors')} className="mt-3 text-left text-xs text-accent hover:underline">Explore all {analysis.findings.length} findings →</button>
              </motion.div>
            ) : (
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass h-full p-5">
                <Dropzone compact />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {analysis && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard icon={Bug} label="Critical findings" value={crit} tone={color.crit} hint="Blocking servicing" onClick={() => navigate('errors')} />
            <StatCard icon={Activity} label="Warnings" value={warn} tone={color.warn} hint="Degraded or past issues" onClick={() => navigate('errors')} />
            <StatCard icon={HardDrive} label="Unrepaired items" value={unrepaired} tone={color.crit} hint={`${analysis.corrupt.length} corrupt items total`} onClick={() => navigate('map')} />
            <StatCard icon={ShieldCheck} label="DISM sessions" value={analysis.dismSessions.length} tone={color.accent2} hint={`${analysis.dismSessions.filter((s) => s.errors).length} with errors`} onClick={() => navigate('dism')} />
            <StatCard icon={FileSearch} label="Error lines" value={analysis.totals.errors} tone={color.accent} hint={`${fmtNum(analysis.totals.warnings)} warning lines`} onClick={() => navigate('cbs')} />
          </div>

          <Glass className="mt-4 p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Diagnostic timeline</h2>
              <span className="text-xs text-ink-3">{fmtNum(analysis.timeline.length)} events across CBS and DISM</span>
            </div>
            <Timeline events={analysis.timeline} onOpenFinding={(id) => setOpenFinding(id)} />
          </Glass>
        </>
      )}

      <Dialog open={!!finding} onOpenChange={(o) => !o && setOpenFinding(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-auto">
          <DialogTitle className="sr-only">Finding details</DialogTitle>
          {finding && analysis && <FindingDetail finding={finding} analysis={analysis} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
