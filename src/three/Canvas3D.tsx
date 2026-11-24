import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import type { Quality } from '@/lib/webgl';
import { useApp, useQuality, useReducedMotion } from '@/store/app';

export interface SceneProps { quality: Quality; reduced: boolean }

/**
 * Drives rendering on demand: full rate while the user interacts or `active`
 * is true, ~20 fps when idle, nothing when offscreen/hidden or reduced motion.
 */
function FrameDriver({ visible, reduced, activeRef }: { visible: boolean; reduced: boolean; activeRef: React.MutableRefObject<number> }) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const bump = () => { activeRef.current = performance.now(); invalidate(); };
    el.addEventListener('pointermove', bump);
    el.addEventListener('pointerdown', bump);
    el.addEventListener('wheel', bump, { passive: true });
    el.addEventListener('touchmove', bump, { passive: true });
    return () => {
      el.removeEventListener('pointermove', bump);
      el.removeEventListener('pointerdown', bump);
      el.removeEventListener('wheel', bump);
      el.removeEventListener('touchmove', bump);
    };
  }, [gl, invalidate, activeRef]);
  useEffect(() => {
    if (!visible) return;
    invalidate();
    if (reduced) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const idle = t - activeRef.current > 6000;
      if (!idle || t - last > 48) { last = t; invalidate(); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible, reduced, invalidate, activeRef]);
  return null;
}

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('[3D] scene failed, using fallback', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

interface Props {
  children: (p: SceneProps) => ReactNode;
  fallback: ReactNode;
  camera?: { position: [number, number, number]; fov?: number };
  className?: string;
  label: string;
  onPointerMissed?: () => void;
}

export function Canvas3D({ children, fallback, camera = { position: [0, 4, 14], fov: 42 }, className, label, onPointerMissed }: Props) {
  const quality = useQuality();
  const reduced = useReducedMotion();
  const webgl = useApp((s) => s.webgl);
  const enable3D = useApp((s) => s.settings.enable3D);
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [dpr, setDpr] = useState(quality === 'high' ? 1.75 : quality === 'medium' ? 1.25 : 1);
  const [lost, setLost] = useState(false);
  const activeRef = useRef(performance.now());

  useEffect(() => setDpr(quality === 'high' ? 1.75 : quality === 'medium' ? 1.25 : 1), [quality]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!webgl || !enable3D || lost) return <>{fallback}</>;

  return (
    <div ref={wrap} className={className} role="application" aria-label={label}>
      <GLBoundary fallback={fallback}>
        <Canvas
          frameloop="demand"
          onPointerMissed={onPointerMissed}
          dpr={[1, dpr]}
          camera={{ position: camera.position, fov: camera.fov ?? 42, near: 0.1, far: 200 }}
          gl={{ antialias: quality !== 'high', powerPreference: quality === 'low' ? 'low-power' : 'high-performance', alpha: true, stencil: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = ACESFilmicToneMapping;
            gl.outputColorSpace = SRGBColorSpace;
            gl.setClearColor(0x000000, 0);
            gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setLost(true); }, { once: true });
          }}
        >
          <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} onIncline={() => setDpr((d) => Math.min(quality === 'high' ? 2 : 1.5, d + 0.25))} />
          <FrameDriver visible={visible} reduced={reduced} activeRef={activeRef} />
          {children({ quality, reduced })}
        </Canvas>
      </GLBoundary>
    </div>
  );
}
