import { AnimatePresence, motion } from 'framer-motion';
import { Boxes, GitCompare, Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FindingDetail } from '@/components/FindingDetail';
import { Glass } from '@/components/Glass';
import { NoData } from '@/components/NoData';
import { PageHeader } from '@/components/PageHeader';
import { Scene3D } from '@/components/Scene3D';
import { SeverityBadge } from '@/components/Status';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { severityColor } from '@/design/tokens';
import type { Severity } from '@/engine/types';
import { SvgCorrelation, SvgSeverity } from '@/fallback/Fallbacks';
import { useRoute } from '@/lib/router';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/app';
import { CorrelationScene, ErrorField } from '@/three/lazy';

const SEVS: Severity[] = ['critical', 'warning', 'info'];

export default function ErrorExplorer() {
  const a = useApp((s) => s.analysis);
  const selected = useApp((s) => s.selectedFinding);
  const select = useApp((s) => s.selectFinding);
  const { params } = useRoute();
  const [view, setView] = useState<'field' | 'correlation'>('field');
  const [sev, setSev] = useState<Set<Severity>>(new Set(SEVS));
  const [src, setSrc] = useState<'all' | 'cbs' | 'dism'>('all');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q.toLowerCase());

  useEffect(() => { const f = params.get('finding'); if (f) select(f); }, [params, select]);

  const findings = useMemo(() => (a ? a.findings.filter((f) =>
    sev.has(f.severity) && (src === 'all' || f.sources[0] === src) &&
    (!dq || f.title.toLowerCase().includes(dq) || f.code.toLowerCase().includes(dq) || f.name.toLowerCase().includes(dq))) : []), [a, sev, src, dq]);

  if (!a) return <><PageHeader eyebrow="Analyse" title="Error Explorer" /><NoData what="The error explorer" /></>;
  const current = a.findings.find((f) => f.id === selected);
  const counts = Object.fromEntries(SEVS.map((s) => [s, a.findings.filter((f) => f.severity === s).length]));

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow="Analyse" title="Error Explorer"
        description={`${a.findings.length} findings and ${a.correlations.length} correlations across CBS and DISM. Every crystal and arc is a parsed finding.`}
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="field"><Boxes /> Severity field</TabsTrigger>
              <TabsTrigger value="correlation"><GitCompare /> Correlation</TabsTrigger>
            </TabsList>
          </Tabs>
        } />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Glass className="relative min-w-0 overflow-hidden p-0">
            {view === 'field' ? (
              findings.length ? (
                <Scene3D key="field" label="3D severity field. Each crystal is a finding; height reflects occurrences. Click to inspect." className="h-[360px] md:h-[460px]"
                  onPointerMissed={() => select(null)} fallback={<SvgSeverity findings={findings} selected={selected} onSelect={select} />}>
                  {(p) => <ErrorField {...p} analysis={a} findings={findings} selected={selected} onSelect={select} />}
                </Scene3D>
              ) : <div className="grid h-[360px] place-items-center text-sm text-ink-3">No findings match the filters.</div>
            ) : a.correlations.length ? (
              <Scene3D key="corr" label="3D correlation map linking CBS findings (left) to DISM findings (right). Click a node to inspect." className="h-[360px] md:h-[460px]"
                onPointerMissed={() => select(null)} fallback={<SvgCorrelation analysis={a} selected={selected} onSelect={select} />}>
                {(p) => <CorrelationScene {...p} analysis={a} selected={selected} onSelect={select} />}
              </Scene3D>
            ) : <div className="grid h-[360px] place-items-center text-sm text-ink-3">No correlations were found between findings.</div>}
            {view === 'correlation' && a.correlations.length > 0 && (
              <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap gap-3 text-[11px] text-ink-2">
                {[['shared HRESULT', '#00C8FF'], ['causal', '#7067FF'], ['temporal', '#FFB547'], ['same component', '#FF4568']].map(([l, c]) => (
                  <span key={l} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: c }} />{l}</span>
                ))}
              </div>
            )}
          </Glass>

          <Glass className="p-4">
            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
              <label className="relative flex-1">
                <span className="sr-only">Search findings</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, code or name…"
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm placeholder:text-ink-3 focus:border-accent/50 focus:outline-none" />
              </label>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Severity filter">
                {SEVS.map((s) => (
                  <button key={s} aria-pressed={sev.has(s)} onClick={() => setSev((cur) => { const n = new Set(cur); if (n.has(s)) n.delete(s); else n.add(s); return n; })}
                    className={cn('rounded-md px-2.5 py-1 text-xs capitalize transition-colors', sev.has(s) ? 'bg-white/10 text-ink' : 'text-ink-3 line-through hover:text-ink-2')}>
                    <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: severityColor[s] }} />{s} {counts[s]}
                  </button>
                ))}
              </div>
              <div className="flex gap-1" role="group" aria-label="Source filter">
                {(['all', 'cbs', 'dism'] as const).map((s) => (
                  <button key={s} aria-pressed={src === s} onClick={() => setSrc(s)}
                    className={cn('rounded-md px-2.5 py-1 text-xs uppercase transition-colors', src === s ? 'bg-accent/15 text-accent' : 'text-ink-2 hover:bg-white/5')}>{s}</button>
                ))}
              </div>
            </div>
            <ul className="max-h-[420px] space-y-1 overflow-auto" aria-label="Findings">
              {findings.map((f) => (
                <li key={f.id}>
                  <button onClick={() => select(f.id === selected ? null : f.id)} aria-pressed={f.id === selected}
                    className={cn('flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all duration-base',
                      f.id === selected ? 'border-accent/50 bg-accent/10' : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]')}>
                    <SeverityBadge severity={f.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{f.title}</div>
                      <div className="mono truncate text-[11px] text-ink-3">{f.code} · {f.sources[0].toUpperCase()} · ×{f.occurrences}{f.related.length ? ` · ${f.related.length} linked` : ''}</div>
                    </div>
                  </button>
                </li>
              ))}
              {findings.length === 0 && <li className="p-4 text-center text-sm text-ink-3">No findings match.</li>}
            </ul>
          </Glass>
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div key={current.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
                className="glass-strong glass-edge max-h-[calc(100vh-7rem)] overflow-auto p-5">
                <FindingDetail finding={current} analysis={a} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-6 text-center text-sm text-ink-3">
                Select a crystal, node or list item to see evidence, troubleshooting steps and Microsoft documentation.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
