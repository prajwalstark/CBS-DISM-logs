import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { color } from '@/design/tokens';
import { gridShader } from './shaders';
import type { Quality } from '@/lib/webgl';
import { useDispose } from './useDispose';

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function HoloGrid({ y = -3, pulse = 1, tint = color.accent }: { y?: number; pulse?: number; tint?: string }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(tint) }, uTime: { value: 0 }, uPulse: { value: pulse } }), [tint, pulse]);
  useFrame((_, dt) => { if (mat.current) mat.current.uniforms.uTime.value += dt; });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={y} renderOrder={-1}>
      <planeGeometry args={[60, 60, 1, 1]} />
      <shaderMaterial ref={mat} vertexShader={gridShader.vertex} fragmentShader={gridShader.fragment} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  );
}

/** Ambient dust. Count scales with quality tier; drifts slowly upward. */
export function Dust({ quality, enabled = true }: { quality: Quality; enabled?: boolean }) {
  const count = !enabled ? 0 : quality === 'high' ? 1400 : quality === 'medium' ? 600 : 220;
  const ref = useRef<THREE.Points>(null);
  const tex = useDispose(useMemo(() => dotTexture(), []));
  const geom = useDispose(useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 22;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -3 + Math.random() * 14;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]));
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.01; });
  if (!count) return null;
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial map={tex} alphaTest={0.01} size={0.09} color={color.accent} transparent opacity={0.5} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} color="#cfe8ff" />
      <pointLight position={[0, 0, 0]} intensity={18} distance={14} color={color.accent} />
      <pointLight position={[-8, 4, -6]} intensity={10} distance={20} color={color.accent2} />
    </>
  );
}
