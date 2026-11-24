import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { color, statusColor } from '@/design/tokens';
import type { Analysis, ModuleId } from '@/engine/types';
import { MODULE_IDS } from '@/engine/types';
import { MODULE_POS, arc } from './layout';
import { flowShader } from './shaders';
import { useDispose } from './useDispose';

export function FlowTube({ curve, tint, speed, density, opacity, radius = 0.035 }: { curve: THREE.Curve<THREE.Vector3>; tint: string; speed: number; density: number; opacity: number; radius?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geom = useDispose(useMemo(() => new THREE.TubeGeometry(curve, 48, radius, 6, false), [curve, radius]));
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(tint).multiplyScalar(1.6) }, uTime: { value: 0 }, uSpeed: { value: speed }, uDensity: { value: density }, uOpacity: { value: opacity },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    u.uTime.value += dt;
    u.uColor.value.set(tint).multiplyScalar(1.6);
    u.uSpeed.value = speed;
    u.uDensity.value = density;
    u.uOpacity.value = THREE.MathUtils.lerp(u.uOpacity.value, opacity, 1 - Math.exp(-dt * 8));
  });
  return (
    <mesh geometry={geom}>
      <shaderMaterial ref={mat} vertexShader={flowShader.vertex} fragmentShader={flowShader.fragment} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

/**
 * Core→module streams: speed scales with the module's log volume, colour with
 * status. Module↔module arcs appear only where findings are correlated.
 */
export function Connections({ analysis, focus }: { analysis: Analysis | null; focus: ModuleId | null }) {
  const origin = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const spokes = useMemo(() => MODULE_IDS.map((m) => ({ m, curve: arc(origin, MODULE_POS[m], 1.2) })), [origin]);

  const links = useMemo(() => {
    if (!analysis) return [];
    const byId = new Map(analysis.findings.map((f) => [f.id, f]));
    const pairs = new Map<string, { a: ModuleId; b: ModuleId; n: number; s: number }>();
    for (const c of analysis.correlations) {
      const fa = byId.get(c.a), fb = byId.get(c.b);
      if (!fa || !fb || fa.module === fb.module) continue;
      const [a, b] = [fa.module, fb.module].sort() as [ModuleId, ModuleId];
      const k = `${a}|${b}`;
      const p = pairs.get(k) ?? { a, b, n: 0, s: 0 };
      p.n++; p.s = Math.max(p.s, c.strength);
      pairs.set(k, p);
    }
    return [...pairs.values()].map((p) => ({ ...p, curve: arc(MODULE_POS[p.a], MODULE_POS[p.b], 2.6) }));
  }, [analysis]);

  return (
    <group>
      {spokes.map(({ m, curve }) => {
        const h = analysis?.modules[m];
        const st = h?.status ?? 'no-data';
        const vol = h?.entries ?? 0;
        const speed = st === 'no-data' ? 0.05 : 0.25 + Math.min(1.2, Math.log10(1 + vol) / 4);
        const dim = focus && focus !== m;
        return <FlowTube key={m} curve={curve} tint={statusColor[st]} speed={speed} density={st === 'critical' ? 8 : 5} opacity={dim ? 0.25 : st === 'no-data' ? 0.3 : 1} />;
      })}
      {links.map((l) => {
        const dim = focus && focus !== l.a && focus !== l.b;
        return <FlowTube key={`${l.a}-${l.b}`} curve={l.curve} tint={color.accent2} speed={0.4} density={3 + l.n} opacity={dim ? 0.15 : 0.5 + l.s * 0.5} radius={0.02 + Math.min(0.04, l.n * 0.008)} />;
      })}
    </group>
  );
}
