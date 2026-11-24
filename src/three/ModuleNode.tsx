import { useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { statusColor, severityColor } from '@/design/tokens';
import { MODULE_META } from '@/engine/modules';
import type { Analysis, ModuleHealth, ModuleId } from '@/engine/types';
import { Label3D } from './Label3D';
import { useDispose } from './useDispose';

interface Props {
  id: ModuleId;
  health: ModuleHealth | null;
  analysis: Analysis | null;
  position: THREE.Vector3;
  selected: boolean;
  dimmed: boolean;
  showLabel: boolean;
  onSelect: (id: ModuleId) => void;
  onHover: (id: ModuleId | null) => void;
}

const glassMat = (c: string) => ({ color: '#0d1830', metalness: 0.25, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, emissive: c, transparent: true, opacity: 0.92 });

/** Body geometry per subsystem. Store and WU bodies encode real counts. */
function Body({ id, analysis, c, emissive }: { id: ModuleId; analysis: Analysis | null; c: string; emissive: number }) {
  const cubes = useRef<THREE.InstancedMesh>(null);
  const storeCells = useMemo(() => {
    // 3x3x3 cell cluster: red = unrepaired corrupt items, amber = repaired, rest healthy.
    const unrep = analysis ? analysis.corrupt.filter((x) => x.status !== 'repaired').length : 0;
    const rep = analysis ? analysis.corrupt.filter((x) => x.status === 'repaired').length : 0;
    return Array.from({ length: 27 }, (_, i) => (i < Math.min(27, unrep) ? 'crit' : i < Math.min(27, unrep + rep) ? 'warn' : 'ok'));
  }, [analysis]);
  const packages = useMemo(() => (analysis ? analysis.packages.slice(0, 7) : []), [analysis]);

  useLayoutEffect(() => {
    if (id !== 'store') return;
    {
      const m = cubes.current;
      if (!m) return;
      const o = new THREE.Object3D();
      const col = new THREE.Color();
      storeCells.forEach((s, i) => {
        const x = (i % 3) - 1, y = Math.floor(i / 9) - 1, z = (Math.floor(i / 3) % 3) - 1;
        o.position.set(x * 0.34, y * 0.34, z * 0.34);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        col.set(s === 'crit' ? severityColor.critical : s === 'warn' ? severityColor.warning : '#1c2b4d');
        if (s !== 'ok') col.multiplyScalar(2.2);
        m.setColorAt(i, col);
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [id, storeCells]);

  const mat = <meshPhysicalMaterial {...glassMat(c)} emissiveIntensity={emissive} />;
  switch (id) {
    case 'cbs': return <mesh><octahedronGeometry args={[0.75, 0]} />{mat}</mesh>;
    case 'dism': return <mesh><dodecahedronGeometry args={[0.7, 0]} />{mat}</mesh>;
    case 'sfc': return (
      <group>
        <mesh><torusGeometry args={[0.6, 0.16, 16, 48]} />{mat}</mesh>
        <mesh rotation-x={Math.PI / 2}><torusGeometry args={[0.38, 0.06, 12, 36]} />{mat}</mesh>
      </group>
    );
    case 'store': return (
      <instancedMesh ref={cubes} args={[undefined, undefined, 27]}>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshStandardMaterial metalness={0.3} roughness={0.3} toneMapped={false} />
      </instancedMesh>
    );
    case 'wu': return (
      <group>
        {(packages.length ? packages : [null]).map((p, i, arr) => (
          <mesh key={i} position-y={(i - (arr.length - 1) / 2) * 0.2}>
            <cylinderGeometry args={[0.55, 0.55, 0.13, 32]} />
            <meshPhysicalMaterial {...glassMat(p?.state === 'failed' ? severityColor.critical : p?.state === 'pending' ? severityColor.warning : c)} emissiveIntensity={p?.state === 'failed' ? 1.4 : emissive} />
          </mesh>
        ))}
      </group>
    );
    case 'integrity': return <mesh><icosahedronGeometry args={[0.72, 0]} /><meshPhysicalMaterial {...glassMat(c)} emissiveIntensity={emissive} flatShading /></mesh>;
  }
}

export function ModuleNode({ id, health, analysis, position, selected, dimmed, showLabel, onSelect, onHover }: Props) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const status = health?.status ?? 'no-data';
  const c = statusColor[status];
  const meta = MODULE_META[id];
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.InstancedMesh>(null);
  const score = health && status !== 'no-data' ? health.score : 0;
  const labelPos = useMemo(() => position.clone().add(new THREE.Vector3(0, 1.6, 0)), [position]);

  // Findings orbit the node: one satellite per finding (max 12), coloured by severity.
  const sats = useMemo(() => {
    if (!analysis || !health) return [];
    return health.findingIds.slice(0, 12).map((fid) => analysis.findings.find((f) => f.id === fid)!).filter(Boolean);
  }, [analysis, health]);

  const arcGeom = useDispose(useMemo(() => new THREE.RingGeometry(1.08, 1.16, 64, 1, Math.PI / 2, Math.max(0.001, (score / 100) * Math.PI * 2)), [score]));
  const crit = (health?.critical ?? 0) > 0;
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (spin.current) spin.current.rotation.y += dt * (hovered || selected ? 0.9 : 0.25);
    if (group.current) {
      const target = hovered || selected ? 1.18 : 1;
      const pulse = crit ? 1 + Math.sin(t * 4) * 0.04 : 1;
      const s = THREE.MathUtils.lerp(group.current.scale.x, target * pulse, 1 - Math.exp(-dt * 10));
      group.current.scale.setScalar(s);
      group.current.position.y = position.y + Math.sin(t * 0.8 + position.x) * 0.1;
    }
    const m = orbit.current;
    if (m && sats.length) {
      sats.forEach((f, i) => {
        const a = t * (0.6 + i * 0.05) + (i / sats.length) * Math.PI * 2;
        tmp.position.set(Math.cos(a) * 1.35, Math.sin(a * 1.3) * 0.25, Math.sin(a) * 1.35);
        tmp.scale.setScalar(f.severity === 'critical' ? 1.4 : f.severity === 'warning' ? 1 : 0.7);
        tmp.updateMatrix();
        m.setMatrixAt(i, tmp.matrix);
        tmpColor.set(severityColor[f.severity]).multiplyScalar(2.5);
        m.setColorAt(i, tmpColor);
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      <group
        ref={group}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(id); }}
        onPointerOut={() => { setHovered(false); onHover(null); }}
        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
      >
        <group ref={spin}>
          <Body id={id} analysis={analysis} c={c} emissive={hovered || selected ? 0.9 : status === 'no-data' ? 0.05 : 0.35} />
        </group>
        {/* invisible hit area for small/irregular geometry */}
        <mesh visible={false}><sphereGeometry args={[1.1, 12, 12]} /></mesh>
        <group rotation-x={-Math.PI / 2} position-y={-0.95}>
          <mesh><ringGeometry args={[1.08, 1.16, 64]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.07} side={THREE.DoubleSide} /></mesh>
          <mesh geometry={arcGeom}><meshBasicMaterial color={new THREE.Color(c).multiplyScalar(dimmed ? 0.6 : 2.2)} toneMapped={false} side={THREE.DoubleSide} /></mesh>
        </group>
        {sats.length > 0 && (
          <instancedMesh ref={orbit} args={[undefined, undefined, sats.length]} key={sats.length}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshBasicMaterial toneMapped={false} />
          </instancedMesh>
        )}
      </group>
      <Label3D
        visible={showLabel}
        position={labelPos}
        k={14}
        className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-center backdrop-blur-md transition-[opacity,border-color] duration-200 ${selected || hovered ? 'border-accent/60 bg-void-2/90' : 'border-white/10 bg-void-2/70'} ${dimmed ? 'opacity-40' : ''}`}
        lines={[
          { text: meta.label, className: 'font-display text-[13px] font-semibold text-ink' },
          { text: status === 'no-data' ? 'no data' : `${health!.score} · ${status}`, className: 'mono text-[11px]', color: c },
        ]}
      />
    </group>
  );
}
