import { severityColor, statusColor } from '@/design/tokens';
import { MODULE_META } from '@/engine/modules';
import type { Analysis } from '@/engine/types';
import { MODULE_IDS } from '@/engine/types';

// Pure data → graph conversion (no three.js import, so pages can use it
// without pulling the 3D bundle).
const RING = 6.2 * 1.15;
function anchorFor(i: number): [number, number, number] {
  const a = (i / MODULE_IDS.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / 6;
  return [Math.cos(a) * RING, Math.sin(i * 1.7) * 0.7 * 1.15, Math.sin(a) * RING];
}

export type GraphNodeKind = 'module' | 'finding' | 'component' | 'package';
export interface GraphNode { id: string; kind: GraphNodeKind; label: string; sub: string; color: string; size: number; ref?: string; anchor?: [number, number, number] }
export interface GraphEdge { a: number; b: number; strength: number; color: string }

/** Build the graph purely from analysis data (capped for performance). */
export function buildGraph(a: Analysis): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const idx = new Map<string, number>();
  const add = (n: GraphNode) => { idx.set(n.id, nodes.length); nodes.push(n); };
  for (const m of MODULE_IDS) {
    const h = a.modules[m];
    add({ id: `m:${m}`, kind: 'module', label: MODULE_META[m].label, sub: h.status === 'no-data' ? 'no data' : `${h.score}/100 · ${h.status}`, color: statusColor[h.status], size: 0.55, ref: m, anchor: anchorFor(MODULE_IDS.indexOf(m)) });
  }
  const edges: GraphEdge[] = [];
  const link = (x: string, y: string, strength: number, color: string) => {
    const i = idx.get(x), j = idx.get(y);
    if (i !== undefined && j !== undefined) edges.push({ a: i, b: j, strength, color });
  };
  for (const f of a.findings.slice(0, 80)) {
    add({ id: `f:${f.id}`, kind: 'finding', label: f.title, sub: `${f.code} · ×${f.occurrences} · ${f.sources[0].toUpperCase()}`, color: severityColor[f.severity], size: 0.16 + Math.min(0.24, Math.log2(1 + f.occurrences) * 0.05), ref: f.id });
    link(`m:${f.module}`, `f:${f.id}`, 0.6, '#3a4a70');
  }
  for (const c of a.correlations) link(`f:${c.a}`, `f:${c.b}`, c.strength, '#7067FF');
  const seen = new Set<string>();
  for (const c of a.corrupt.slice(0, 40)) {
    const key = `c:${c.name}:${c.file ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    add({ id: key, kind: 'component', label: c.file ?? c.name, sub: `${c.status} · line ${c.line}`, color: c.status === 'repaired' ? severityColor.warning : severityColor.critical, size: 0.12 });
    const target = a.findings.find((f) => (c.status === 'repaired' ? ['SFC_REPAIRED', 'CSI_PAYLOAD_FIXED'] : ['CSI_PAYLOAD_CORRUPT', 'SFC_CANNOT_REPAIR']).includes(f.code) && (c.source === f.sources[0]));
    if (target) link(`f:${target.id}`, key, 0.8, c.status === 'repaired' ? '#FFB547' : '#FF4568');
    else link(`m:${/^(amd64|wow64|x86|arm64)_/.test(c.name) ? 'store' : 'sfc'}`, key, 0.5, '#3a4a70');
  }
  for (const p of a.packages.slice(0, 30)) {
    const key = `p:${p.name}`;
    add({ id: key, kind: 'package', label: p.kb ?? p.name.split('~')[0], sub: `${p.state}${p.hresult ? ` · ${p.hresult}` : ''}`, color: p.state === 'failed' ? severityColor.critical : p.state === 'pending' ? severityColor.warning : statusColor.healthy, size: 0.14 });
    link('m:wu', key, 0.6, '#3a4a70');
    if (p.state === 'failed') { const f = a.findings.find((x) => x.code === 'PACKAGE_FAILED'); if (f) link(`f:${f.id}`, key, 0.9, '#FF4568'); }
  }
  return { nodes, edges };
}

