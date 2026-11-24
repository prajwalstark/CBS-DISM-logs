import { motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { MODULE_META } from '@/engine/modules';
import type { Analysis, ModuleId } from '@/engine/types';
import { navigate } from '@/lib/router';
import { useApp } from '@/store/app';
import { HealthRing } from './HealthRing';
import { SeverityBadge, StatusBadge } from './Status';
import { Button } from './ui/button';

const ANALYZER: Partial<Record<ModuleId, 'cbs' | 'dism'>> = { cbs: 'cbs', sfc: 'cbs', store: 'cbs', wu: 'cbs', integrity: 'cbs', dism: 'dism' };

export function ModulePanel({ id, analysis, onClose }: { id: ModuleId; analysis: Analysis; onClose: () => void }) {
  const h = analysis.modules[id];
  const meta = MODULE_META[id];
  const selectFinding = useApp((s) => s.selectFinding);
  const findings = h.findingIds.map((fid) => analysis.findings.find((f) => f.id === fid)!).filter(Boolean);
  return (
    <motion.section
      key={id}
      initial={{ opacity: 0, x: 24, scale: 0.98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 24, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong glass-edge flex max-h-full flex-col overflow-hidden"
      aria-labelledby={`mod-${id}`}
    >
      <div className="flex items-start gap-4 p-5 pb-3">
        <HealthRing score={h.score} status={h.status} size={84} stroke={7} label={meta.label} />
        <div className="min-w-0 flex-1">
          <div className="label text-accent/80">{meta.short}</div>
          <h2 id={`mod-${id}`} className="font-display text-lg font-semibold">{meta.label}</h2>
          <div className="mt-1"><StatusBadge status={h.status} /></div>
        </div>
        <button onClick={onClose} aria-label="Close module panel" className="rounded-md p-1 text-ink-3 hover:bg-white/10 hover:text-ink"><X className="size-4" /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-auto px-5 pb-5">
        <p className="text-sm text-ink-2">{meta.description}</p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[['Lines', h.entries], ['Errors', h.errors], ['Warnings', h.warnings]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white/[0.04] p-2"><dt className="label">{k}</dt><dd className="font-display text-lg font-bold">{Number(v).toLocaleString()}</dd></div>
          ))}
        </dl>
        <div>
          <h3 className="label mb-1.5">Score derivation</h3>
          <ul className="space-y-0.5 text-xs text-ink-2">{h.rationale.map((r) => <li key={r} className="mono">{r}</li>)}</ul>
        </div>
        <div>
          <h3 className="label mb-1.5">Findings ({findings.length})</h3>
          {findings.length === 0 ? <p className="text-xs text-ink-3">None.</p> : (
            <ul className="space-y-1.5">
              {findings.map((f) => (
                <li key={f.id}>
                  <button onClick={() => { selectFinding(f.id); navigate('errors', { finding: f.id }); }}
                    className="group flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2 text-left transition-colors hover:border-accent/40 hover:bg-accent/5">
                    <SeverityBadge severity={f.severity} />
                    <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                    <span className="mono text-[11px] text-ink-3">×{f.occurrences}</span>
                    <ArrowRight className="size-3.5 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {ANALYZER[id] && h.status !== 'no-data' && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(ANALYZER[id]!)}>Open {ANALYZER[id] === 'dism' ? 'DISM' : 'CBS'} Analyzer <ArrowRight /></Button>
        )}
      </div>
    </motion.section>
  );
}
