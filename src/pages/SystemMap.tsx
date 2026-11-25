import { AnimatePresence, motion } from 'framer-motion';
import { Hand, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Glass } from '@/components/Glass';
import { NoData } from '@/components/NoData';
import { PageHeader } from '@/components/PageHeader';
import { Scene3D } from '@/components/Scene3D';
import { Button } from '@/components/ui/button';
import { severityColor, statusColor } from '@/design/tokens';
import type { ModuleId } from '@/engine/types';
import { SvgSystemMap } from '@/fallback/Fallbacks';
import { navigate } from '@/lib/router';
import { useApp } from '@/store/app';
import { buildGraph } from '@/three/graph';
import { SystemMapGraph } from '@/three/lazy';

export default function SystemMap() {
  const a = useApp((s) => s.analysis);
  const [sel, setSel] = useState<string | null>(null);
  const graph = useMemo(() => (a ? buildGraph(a) : null), [a]);
  if (!a || !graph) return <><PageHeader eyebrow="Act" title="3D System Map" /><NoData what="The system map" /></>;
  const node = graph.nodes.find((n) => n.id === sel);
  const idx = node ? graph.nodes.indexOf(node) : -1;
  const neighbours = idx >= 0 ? graph.edges.filter((e) => e.a === idx || e.b === idx).map((e) => graph.nodes[e.a === idx ? e.b : e.a]) : [];
  const counts = graph.nodes.reduce((acc, n) => ({ ...acc, [n.kind]: (acc[n.kind] || 0) + 1 }), {} as Record<string, number>);

  const open = () => {
    if (!node) return;
    if (node.kind === 'finding') { useApp.getState().selectFinding(node.ref!); navigate('errors', { finding: node.ref! }); }
    else if (node.kind === 'module') { useApp.getState().selectModule(node.ref as ModuleId); navigate('overview'); }
    else if (node.kind === 'package') navigate('cbs');
    else navigate('repair');
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader eyebrow="Act" title="3D System Map"
        description={`${graph.nodes.length} nodes and ${graph.edges.length} links built from this analysis: subsystems, findings, corrupt components and update packages. Drag any node — connected nodes follow.`} />
      <Glass className="relative overflow-hidden p-0">
        <Scene3D label="Force-directed 3D graph of subsystems, findings, corrupt components and packages. Drag nodes to explore connections; click to inspect." className="h-[520px] md:h-[680px]"
          onPointerMissed={() => setSel(null)} fallback={<SvgSystemMap analysis={a} selected={null} onSelect={(m) => m && setSel(`m:${m}`)} />}>
          {(p) => <SystemMapGraph {...p} analysis={a} selected={sel} onSelect={setSel} />}
        </Scene3D>
        <div className="pointer-events-none absolute left-4 top-4 space-y-1 rounded-xl bg-void/85 p-3 text-[11px] text-ink-2">
          {[['module', 'Subsystem', statusColor.healthy], ['finding', 'Finding', severityColor.critical], ['component', 'Corrupt item', severityColor.warning], ['package', 'Update package', '#4FA3FF']].map(([k, l, c]) => (
            <div key={k} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: c }} />{l} <span className="mono text-ink-3">{counts[k] || 0}</span></div>
          ))}
          <div className="flex items-center gap-1.5 pt-1 text-ink-3"><Hand className="size-3.5" /> drag nodes · orbit empty space</div>
        </div>
        <AnimatePresence>
          {node && (
            <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="absolute bottom-4 right-4 top-auto w-[min(340px,calc(100%-2rem))] rounded-[var(--radius)] border border-white/10 bg-[#0b1224]/95 p-4 shadow-glass md:top-4 md:bottom-auto" aria-live="polite">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: node.color }} />
                <div className="min-w-0 flex-1">
                  <div className="label">{node.kind}</div>
                  <h2 className="font-display font-semibold leading-snug">{node.label}</h2>
                  <div className="mono text-[11px] text-ink-3">{node.sub}</div>
                </div>
                <button onClick={() => setSel(null)} aria-label="Close" className="rounded p-1 text-ink-3 hover:bg-white/10"><X className="size-4" /></button>
              </div>
              {neighbours.length > 0 && (
                <div className="mt-3">
                  <div className="label mb-1">Connected ({neighbours.length})</div>
                  <ul className="max-h-40 space-y-0.5 overflow-auto">
                    {neighbours.map((n) => (
                      <li key={n.id}><button onClick={() => setSel(n.id)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-white/5">
                        <span className="size-2 rounded-full" style={{ background: n.color }} /><span className="truncate">{n.label}</span></button></li>
                    ))}
                  </ul>
                </div>
              )}
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={open}>Open details</Button>
            </motion.aside>
          )}
        </AnimatePresence>
      </Glass>
      <details className="mt-4 glass p-4">
        <summary className="cursor-pointer text-sm text-ink-2">Node list (keyboard accessible)</summary>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {graph.nodes.map((n) => (
            <li key={n.id}><button onClick={() => setSel(n.id)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-white/5" aria-pressed={sel === n.id}>
              <span className="size-2 rounded-full" style={{ background: n.color }} /><span className="truncate">{n.label}</span><span className="ml-auto text-ink-3">{n.kind}</span></button></li>
          ))}
        </ul>
      </details>
    </div>
  );
}
