import { Instance, Instances, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { severityColor } from '@/design/tokens';
import { MODULE_META } from '@/engine/modules';
import type { Analysis, Finding } from '@/engine/types';
import { MODULE_IDS } from '@/engine/types';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { Dust, HoloGrid, Lights } from './Environment';
import type { SceneProps } from './Canvas3D';
import { Label3D } from './Label3D';

interface Props extends SceneProps {
  analysis: Analysis;
  findings: Finding[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

const COL_W = 3.2;

/**
 * Severity field: one crystal per finding, grouped into subsystem districts.
 * Height = log2(occurrences), colour/emission = severity.
 */
export default function ErrorField({ analysis, findings, selected, onSelect, quality, reduced }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  useCursor(!!hover);
  const mods = MODULE_IDS.filter((m) => findings.some((f) => f.module === m));
  const placed = useMemo(() => {
    const out: { f: Finding; pos: THREE.Vector3; h: number }[] = [];
    mods.forEach((m, mi) => {
      const list = findings.filter((f) => f.module === m);
      list.forEach((f, i) => {
        const h = 0.5 + Math.log2(1 + f.occurrences) * 0.55;
        const x = (mi - (mods.length - 1) / 2) * COL_W + ((i % 2) - 0.5) * 1.1;
        const z = -Math.floor(i / 2) * 1.2 + 1.5;
        out.push({ f, pos: new THREE.Vector3(x, h / 2 - 2, z), h });
      });
    });
    return out;
  }, [findings, mods]);
  const sel = placed.find((p) => p.f.id === selected);
  const focus = useMemo(() => (sel ? sel.pos.clone() : null), [sel]);

  return (
    <>
      <Lights />
      <fog attach="fog" args={['#050810', 16, 40]} />
      {mods.map((m, mi) => (
        <group key={m} position={[(mi - (mods.length - 1) / 2) * COL_W, -2.58, -1]}>
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[COL_W - 0.4, 9]} />
            <meshStandardMaterial color="#0c1428" transparent opacity={0.65} metalness={0.4} roughness={0.6} />
          </mesh>
          <Label3D position={[(mi - (mods.length - 1) / 2) * COL_W, -2.5, 3.1]} k={16} className="whitespace-nowrap text-center"
            lines={[
              { text: MODULE_META[m].short, className: 'label text-ink-2' },
              { text: `${findings.filter((f) => f.module === m).length} findings`, className: 'mono text-[11px]', color: severityColor[analysis.modules[m].critical ? 'critical' : 'warning'] },
            ]} />
        </group>
      ))}
      <Instances limit={Math.max(1, placed.length)} range={placed.length}>
        <octahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial toneMapped={false} metalness={0.2} roughness={0.25} />
        {placed.map((p) => (
          <Crystal key={p.f.id} p={p} active={p.f.id === selected || p.f.id === hover} dim={!!selected && p.f.id !== selected}
            onOver={() => setHover(p.f.id)} onOut={() => setHover((h) => (h === p.f.id ? null : h))} onClick={() => onSelect(p.f.id === selected ? null : p.f.id)} />
        ))}
      </Instances>
      {[...new Set([hover, selected])].filter((x): x is string => !!x).map((id) => {
        const p = placed.find((x) => x.f.id === id);
        if (!p) return null;
        return (
          <Label3D key={id} position={[p.pos.x, p.pos.y + p.h / 2 + 0.7, p.pos.z]} k={11} className="max-w-[240px] rounded-lg border border-white/15 bg-void-2/90 px-2.5 py-1.5 text-center"
            lines={[
              { text: p.f.title, className: 'text-[12px] font-semibold text-ink' },
              { text: `${p.f.code} · ×${p.f.occurrences} · ${p.f.sources[0].toUpperCase()}`, className: 'mono text-[10px]', color: severityColor[p.f.severity] },
            ]} />
        );
      })}
      <HoloGrid y={-2.6} pulse={0.3} />
      <Dust quality={quality} />
      <CameraRig focus={focus} home={[0, 4 + mods.length * 1.1, 8 + mods.length * 2.1]} autoRotate={false} reduced={reduced} focusDistance={6} minDistance={3} approach={[0, 0.55, 1]} />
      <Effects quality={quality} />
    </>
  );
}

function Crystal({ p, active, dim, onOver, onOut, onClick }: { p: { f: Finding; pos: THREE.Vector3; h: number }; active: boolean; dim: boolean; onOver: () => void; onOut: () => void; onClick: () => void }) {
  const ref = useRef<THREE.Object3D>(null);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame((state, dt) => {
    const o = ref.current;
    if (!o) return;
    const t = state.clock.elapsedTime;
    const sy = (p.h / 0.76) * (active ? 1.08 : 1);
    o.scale.x = o.scale.z = THREE.MathUtils.lerp(o.scale.x, active ? 1.35 : 1, 1 - Math.exp(-dt * 10));
    o.scale.y = THREE.MathUtils.lerp(o.scale.y, sy, 1 - Math.exp(-dt * 10));
    o.rotation.y += dt * (active ? 1.2 : 0.3);
    o.position.y = p.pos.y + (active ? 0.25 + Math.sin(t * 3) * 0.05 : 0);
    const k = p.f.severity === 'critical' ? 2.4 : p.f.severity === 'warning' ? 1.8 : 1.2;
    col.set(severityColor[p.f.severity]).multiplyScalar(dim ? 0.35 : active ? k * 1.4 : k);
    (o as unknown as { color: THREE.Color }).color.copy(col);
  });
  return (
    <Instance ref={ref as never} position={p.pos} scale={[1, p.h / 0.76, 1]}
      onPointerOver={(e) => { e.stopPropagation(); onOver(); }} onPointerOut={onOut} onClick={(e) => { e.stopPropagation(); onClick(); }} />
  );
}
