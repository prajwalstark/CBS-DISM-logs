import { useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { stageColor } from '@/design/tokens';
import type { RepairStage } from '@/engine/types';
import { CameraRig } from './CameraRig';
import { FlowTube } from './Connections';
import { Effects } from './Effects';
import { Dust, HoloGrid, Lights } from './Environment';
import type { SceneProps } from './Canvas3D';
import { Label3D } from './Label3D';

interface Props extends SceneProps {
  stages: RepairStage[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Repair environment: six gates along a path. Segment colour/flow comes from
 * each stage's evidence-derived status; a packet travels as far as the last
 * stage that actually ran and stops at failures.
 */
export default function RepairPipeline({ stages, selected, onSelect, quality, reduced }: Props) {
  const points = useMemo(() => stages.map((_, i) => {
    const t = i / (stages.length - 1);
    return new THREE.Vector3((t - 0.5) * 16, Math.sin(t * Math.PI * 2) * 0.6, Math.cos(t * Math.PI * 1.5) * 2.2 - 1);
  }), [stages]);
  const segments = useMemo(() => points.slice(0, -1).map((p, i) => {
    const q = points[i + 1];
    const mid = p.clone().add(q).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.6, 0));
    return new THREE.QuadraticBezierCurve3(p, mid, q);
  }), [points]);
  const path = useMemo(() => { const cp = new THREE.CurvePath<THREE.Vector3>(); segments.forEach((s) => cp.add(s)); return cp; }, [segments]);
  // Furthest stage reached: stop at first failure, else last stage that ran.
  const reach = useMemo(() => {
    const fail = stages.findIndex((s) => s.status === 'failed');
    if (fail >= 0) return fail;
    let last = 0;
    stages.forEach((s, i) => { if (s.status !== 'not-run') last = i; });
    return last;
  }, [stages]);
  const packet = useRef<THREE.Mesh>(null);
  const prog = useRef(0);

  useFrame((_, dt) => {
    if (!packet.current) return;
    const end = reach / (stages.length - 1);
    if (reduced) prog.current = end; else { prog.current += dt * 0.12; if (prog.current > end + 0.06) prog.current = 0; }
    const p = path.getPointAt(Math.min(end, Math.max(0, prog.current)) || 0.0001);
    packet.current.position.copy(p);
  });
  const focus = useMemo(() => {
    const i = stages.findIndex((s) => s.id === selected);
    return i >= 0 ? points[i].clone() : null;
  }, [selected, stages, points]);

  return (
    <>
      <Lights />
      <fog attach="fog" args={['#050810', 16, 40]} />
      {segments.map((curve, i) => {
        const st = stages[i].status;
        const ok = st === 'passed' || st === 'warning' || st === 'in-progress';
        return <FlowTube key={i} curve={curve} tint={stageColor[ok ? stages[i + 1].status === 'not-run' ? 'not-run' : st : st === 'failed' ? 'failed' : 'not-run']} speed={ok ? 0.5 : 0.05} density={6} opacity={ok ? 1 : 0.35} radius={0.06} />;
      })}
      {stages.map((s, i) => (
        <Gate key={s.id} stage={s} index={i} pos={points[i]} selected={selected === s.id} onClick={() => onSelect(selected === s.id ? null : s.id)} />
      ))}
      <mesh ref={packet}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshBasicMaterial color={new THREE.Color('#ffffff').multiplyScalar(3)} toneMapped={false} />
      </mesh>
      <HoloGrid y={-2.2} pulse={0.2} />
      <Dust quality={quality} />
      <CameraRig focus={focus} home={[0, 5, 15]} autoRotate={false} reduced={reduced} focusDistance={6.5} minDistance={4} approach={[0, 0.35, 1]} />
      <Effects quality={quality} />
    </>
  );
}

function Gate({ stage, index, pos, selected, onClick }: { stage: RepairStage; index: number; pos: THREE.Vector3; selected: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const ring = useRef<THREE.Mesh>(null);
  const gem = useRef<THREE.Mesh>(null);
  const c = stageColor[stage.status];
  const glow = useMemo(() => new THREE.Color(c).multiplyScalar(stage.status === 'not-run' ? 0.8 : 2.6), [c, stage.status]);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (ring.current) ring.current.rotation.z += dt * (stage.status === 'in-progress' ? 1.5 : 0.3);
    if (gem.current) {
      gem.current.rotation.y += dt;
      const pulse = stage.status === 'failed' ? 1 + Math.sin(t * 6) * 0.12 : 1;
      const target = (hover || selected ? 1.3 : 1) * pulse;
      gem.current.scale.setScalar(THREE.MathUtils.lerp(gem.current.scale.x, target, 1 - Math.exp(-dt * 10)));
    }
  });
  return (
    <group position={pos}>
      <group onPointerOver={(e) => { e.stopPropagation(); setHover(true); }} onPointerOut={() => setHover(false)} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <mesh ref={ring}>
          <torusGeometry args={[0.9, 0.05, 12, 64, stage.status === 'not-run' ? Math.PI * 1.2 : Math.PI * 2]} />
          <meshBasicMaterial color={glow} toneMapped={false} transparent opacity={stage.status === 'not-run' ? 0.4 : 1} />
        </mesh>
        <mesh ref={gem}>
          <octahedronGeometry args={[0.38, 0]} />
          <meshPhysicalMaterial color="#0d1830" emissive={c} emissiveIntensity={stage.status === 'not-run' ? 0.15 : 1.2} metalness={0.3} roughness={0.15} clearcoat={1} />
        </mesh>
        <mesh visible={false}><sphereGeometry args={[1, 8, 8]} /></mesh>
      </group>
      <Label3D position={[pos.x, pos.y - 1.45, pos.z]} k={13}
        className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-center backdrop-blur ${selected || hover ? 'border-accent/60 bg-void-2/90' : 'border-white/10 bg-void-2/70'}`}
        lines={[
          { text: `STAGE ${index + 1}`, className: 'text-[10px] text-ink-3' },
          { text: stage.label, className: 'font-display text-[13px] font-semibold text-ink' },
          { text: stage.status.replace('-', ' '), className: 'mono text-[10px] uppercase', color: c },
        ]} />
    </group>
  );
}
