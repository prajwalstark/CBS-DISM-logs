import { useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { color, severityColor } from '@/design/tokens';
import type { Analysis, Finding } from '@/engine/types';
import { CameraRig } from './CameraRig';
import { FlowTube } from './Connections';
import { Effects } from './Effects';
import { Dust, HoloGrid, Lights } from './Environment';
import type { SceneProps } from './Canvas3D';
import { Label3D } from './Label3D';

interface Props extends SceneProps {
  analysis: Analysis;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

const KIND_COLOR: Record<string, string> = { 'shared-hresult': color.accent, causal: color.accent2, temporal: color.warn, component: color.crit };

/**
 * Correlation bridge: CBS findings on the left pillar, DISM on the right,
 * ordered by first occurrence. Arcs are actual correlations; colour = kind.
 */
export default function CorrelationScene({ analysis, selected, onSelect, quality, reduced }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  useCursor(!!hover);
  const nodes = useMemo(() => {
    const involved = new Set(analysis.correlations.flatMap((c) => [c.a, c.b]));
    const list = analysis.findings.filter((f) => involved.has(f.id));
    const place = (src: 'cbs' | 'dism', x: number) => {
      const side = list.filter((f) => f.sources[0] === src).sort((a, b) => (a.firstSeen ?? 0) - (b.firstSeen ?? 0));
      return side.map((f, i) => {
        const y = (side.length - 1) / 2 - i;
        const a = (i / Math.max(1, side.length - 1) - 0.5) * 0.9;
        return { f, pos: new THREE.Vector3(x + Math.cos(a) * 0.6 * Math.sign(x), y * 1.05 + 1, Math.sin(a) * 2) };
      });
    };
    return [...place('cbs', -5), ...place('dism', 5)];
  }, [analysis]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.f.id, n])), [nodes]);
  const edges = useMemo(() => analysis.correlations.map((c) => {
    const a = byId.get(c.a), b = byId.get(c.b);
    if (!a || !b) return null;
    const mid = a.pos.clone().add(b.pos).multiplyScalar(0.5);
    const same = a.f.sources[0] === b.f.sources[0];
    if (same) mid.x += Math.sign(a.pos.x) * 2.2; else mid.z += 2.5;
    return { c, curve: new THREE.QuadraticBezierCurve3(a.pos.clone(), mid, b.pos.clone()) };
  }).filter(Boolean) as { c: Analysis['correlations'][number]; curve: THREE.QuadraticBezierCurve3 }[], [analysis, byId]);
  const active = selected ?? hover;

  return (
    <>
      <Lights />
      <fog attach="fog" args={['#050810', 16, 40]} />
      {(['cbs', 'dism'] as const).map((s, i) => (
        <group key={s} position={[i ? 5.4 : -5.4, 0, 0]}>
          <mesh position-y={1}>
            <cylinderGeometry args={[0.04, 0.04, Math.max(4, nodes.length * 0.6 + 2), 8]} />
            <meshBasicMaterial color={new THREE.Color(i ? color.accent2 : color.accent).multiplyScalar(1.5)} toneMapped={false} transparent opacity={0.4} />
          </mesh>
          <Label3D position={[i ? 5.4 : -5.4, -nodes.filter((n) => n.f.sources[0] === s).length / 2 - 0.4, 0]} k={14}
            lines={[{ text: s.toUpperCase(), className: 'font-display text-sm font-bold tracking-widest', color: i ? '#a49dff' : color.accent }]} />
        </group>
      ))}
      {edges.map(({ c, curve }) => {
        const on = !active || c.a === active || c.b === active;
        return <FlowTube key={`${c.a}|${c.b}|${c.kind}`} curve={curve} tint={KIND_COLOR[c.kind]} speed={0.35} density={4} opacity={on ? 0.35 + c.strength * 0.65 : 0.06} radius={0.025 + c.strength * 0.02} />;
      })}
      {nodes.map((n) => (
        <Node key={n.f.id} f={n.f} pos={n.pos} active={n.f.id === active} dim={!!active && n.f.id !== active && !n.f.related.includes(active)}
          onOver={() => setHover(n.f.id)} onOut={() => setHover((h) => (h === n.f.id ? null : h))} onClick={() => onSelect(n.f.id === selected ? null : n.f.id)} />
      ))}
      <HoloGrid y={-4} pulse={0.2} />
      <Dust quality={quality} />
      <CameraRig focus={null} home={[0, 1.5, 19]} autoRotate={false} reduced={reduced} focusDistance={9} minDistance={4} approach={[0.15, 0.2, 1]} />
      <Effects quality={quality} />
    </>
  );
}

function Node({ f, pos, active, dim, onOver, onOut, onClick }: { f: Finding; pos: THREE.Vector3; active: boolean; dim: boolean; onOver: () => void; onOut: () => void; onClick: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const r = 0.18 + Math.min(0.32, Math.log2(1 + f.occurrences) * 0.08);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const s = THREE.MathUtils.lerp(ref.current.scale.x, active ? 1.5 : 1, 1 - Math.exp(-dt * 10));
    ref.current.scale.setScalar(s);
  });
  const c = new THREE.Color(severityColor[f.severity]).multiplyScalar(dim ? 0.4 : active ? 3 : 2);
  return (
    <>
    <group position={pos}>
      <mesh ref={ref} onPointerOver={(e) => { e.stopPropagation(); onOver(); }} onPointerOut={onOut} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <sphereGeometry args={[r, 24, 24]} />
        <meshBasicMaterial color={c} toneMapped={false} />
      </mesh>
    </group>
      <Label3D position={[pos.x + (pos.x < 0 ? -0.5 : 0.5), pos.y, pos.z]} align={pos.x < 0 ? 'right' : 'left'} k={13}
        className={`max-w-[220px] whitespace-nowrap text-[11px] transition-opacity ${dim ? 'opacity-30' : ''} ${pos.x < 0 ? 'text-right' : ''}`}
        lines={[
          { text: f.code.length > 16 ? f.code.slice(0, 16) + '…' : f.code, className: 'mono', color: severityColor[f.severity] },
          ...(active ? [{ text: f.title, className: 'truncate text-ink' }] : []),
        ]} />
    </>
  );
}
