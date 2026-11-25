import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import type { Quality } from '@/lib/webgl';
import { useApp, useQuality, useReducedMotion } from '@/store/app';

export interface SceneProps { quality: Quality; reduced: boolean }

/**
 * Reduced-motion mode renders on demand only: redraw when the user interacts
 * (and once when shown), so nothing animates on its own.
 */
function DemandDriver({ visible }: { visible: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const bump = () => invalidate();
    const events = ['pointermove', 'pointerdown', 'wheel', 'touchmove'] as const;
    events.forEach((e) => el.addEventListener(e, bump, { passive: true }));
    return () => events.forEach((e) => el.removeEventListener(e, bump));
  }, [gl, invalidate]);
  useEffect(() => { if (visible) invalidate(); }, [visible, invalidate]);
  return null;
}

function usePageVisible(): boolean {
  const [v, setV] = useState(() => !document.hidden);
  useEffect(() => {
    const on = () => setV(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return v;
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
  const pageVisible = usePageVisible();
  // R3F drives its own frame loop while the scene is on screen (no external
  // invalidate loop, which landed every render one tick late); it stops entirely
  // when the canvas is scrolled away or the tab is hidden.
  const frameloop = reduced ? 'demand' : visible && pageVisible ? 'always' : 'never';

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
          frameloop={frameloop}
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
          {/* Only ever step resolution down, and settle at 1x if it keeps flip-flopping, so the canvas never oscillates in size. */}
          <PerformanceMonitor flipflops={2} onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} onFallback={() => setDpr(1)} />
          {reduced && <DemandDriver visible={visible && pageVisible} />}
          {children({ quality, reduced })}
        </Canvas>
      </GLBoundary>
    </div>
  );
}
