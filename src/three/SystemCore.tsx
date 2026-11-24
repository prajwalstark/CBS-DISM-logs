import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { color, statusColor } from '@/design/tokens';
import type { Analysis } from '@/engine/types';
import type { Quality } from '@/lib/webgl';
import { coreShader } from './shaders';
import { useDispose } from './useDispose';

/**
 * The holographic system core. Every visual parameter is derived from the
 * analysis: colour = overall status, surface unrest = 1 - score/100, outer arc
 * = overall score, pulse rate = critical finding count.
 */
export function SystemCore({ analysis, quality, onClick }: { analysis: Analysis | null; quality: Quality; onClick?: () => void }) {
  const status = analysis?.overall.status ?? 'no-data';
  const score = analysis?.overall.score ?? 0;
  const crit = analysis ? analysis.findings.filter((f) => f.severity === 'critical').length : 0;
  const c = statusColor[status];
  const shell = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uUnrest: { value: status === 'no-data' ? 0.1 : 1 - score / 100 },
    uColor: { value: new THREE.Color(c) },
    uColor2: { value: new THREE.Color(color.accent2) },
    uIntensity: { value: 1.6 },
  }), [c, score, status]);

  const arcGeom = useDispose(useMemo(() => new THREE.TorusGeometry(2.55, 0.035, 8, 160, Math.max(0.001, (score / 100) * Math.PI * 2)), [score]));
  const detail = quality === 'high' ? 40 : quality === 'medium' ? 24 : 12;
  const pulseRate = 0.8 + Math.min(4, crit) * 0.6;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (shell.current) shell.current.uniforms.uTime.value += dt;
    if (rings.current) {
      rings.current.children[0].rotation.z += dt * 0.25;
      rings.current.children[1].rotation.z -= dt * 0.18;
      rings.current.children[2].rotation.x += dt * 0.12;
    }
    if (inner.current) {
      const s = 0.62 + Math.sin(t * pulseRate * Math.PI) * (status === 'critical' ? 0.06 : 0.025);
      inner.current.scale.setScalar(s);
    }
    if (group.current) group.current.position.y = Math.sin(t * 0.6) * 0.12;
  });

  const glow = new THREE.Color(c).multiplyScalar(3);
  return (
    <group ref={group}>
      <mesh onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
        <icosahedronGeometry args={[1.6, detail]} />
        <shaderMaterial ref={shell} vertexShader={coreShader.vertex} fragmentShader={coreShader.fragment} uniforms={uniforms} transparent depthWrite={false} />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[1.5, 3]} />
        <meshBasicMaterial color={glow} toneMapped={false} wireframe transparent opacity={0.35} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      <group ref={rings} rotation-x={Math.PI / 2}>
        <mesh geometry={arcGeom}>
          <meshBasicMaterial color={new THREE.Color(c).multiplyScalar(2.4)} toneMapped={false} />
        </mesh>
        <mesh>
          <torusGeometry args={[2.85, 0.012, 6, 160]} />
          <meshBasicMaterial color={color.accent} transparent opacity={0.4} />
        </mesh>
        <mesh rotation-y={0.5}>
          <torusGeometry args={[2.2, 0.01, 6, 120]} />
          <meshBasicMaterial color={color.accent2} transparent opacity={0.5} />
        </mesh>
      </group>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[2.55, 0.02, 6, 160]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}
