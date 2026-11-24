import { Suspense, type ReactNode } from 'react';
import { Canvas3D } from '@/three/lazy';
import type { SceneProps } from '@/three/Canvas3D';
import { cn } from '@/lib/utils';

function SceneLoader() {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="flex flex-col items-center gap-3 text-ink-3">
        <div className="relative size-14">
          <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
        </div>
        <span className="label">Initialising 3D scene</span>
      </div>
    </div>
  );
}

interface Props {
  label: string;
  fallback: ReactNode;
  className?: string;
  camera?: { position: [number, number, number]; fov?: number };
  onPointerMissed?: () => void;
  children: (p: SceneProps) => ReactNode;
}

/** Lazy-loaded R3F canvas with Suspense and a 2D fallback. */
export function Scene3D({ label, fallback, className, camera, onPointerMissed, children }: Props) {
  return (
    <div className={cn('relative', className)}>
      <Suspense fallback={<SceneLoader />}>
        <Canvas3D label={label} fallback={fallback} camera={camera} onPointerMissed={onPointerMissed} className="absolute inset-0">
          {(p) => <Suspense fallback={null}>{children(p)}</Suspense>}
        </Canvas3D>
      </Suspense>
    </div>
  );
}
