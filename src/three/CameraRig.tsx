import { CameraControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  focus: THREE.Vector3 | null;
  home: [number, number, number];
  autoRotate: boolean;
  reduced: boolean;
  minDistance?: number;
  maxDistance?: number;
  focusDistance?: number;
  enabled?: boolean;
  /** Fixed approach direction for linear scenes; default approaches radially from the origin. */
  approach?: [number, number, number];
}

/** Drag to orbit, scroll/pinch to zoom, smooth fly-to on focus changes. */
export function CameraRig({ focus, home, autoRotate, reduced, minDistance = 4, maxDistance = 32, focusDistance = 6.5, enabled = true, approach }: Props) {
  const ref = useRef<CameraControls>(null);
  const invalidate = useThree((s) => s.invalidate);
  const lastInput = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const smooth = !reduced;
    if (focus) {
      const pos = approach
        ? focus.clone().add(new THREE.Vector3(...approach).normalize().multiplyScalar(focusDistance))
        : focus.clone().add(focus.clone().setY(0).normalize().multiplyScalar(focusDistance)).add(new THREE.Vector3(0, 2.4, 0));
      c.setLookAt(pos.x, pos.y, pos.z, focus.x, focus.y, focus.z, smooth);
    } else {
      c.setLookAt(home[0], home[1], home[2], 0, 0, 0, smooth);
    }
    invalidate();
  }, [focus, home, reduced, focusDistance, invalidate, approach?.[0], approach?.[1], approach?.[2]]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const c = ref.current;
    if (!c) return;
    if (autoRotate && !reduced && !focus && performance.now() - lastInput.current > 4000) c.azimuthAngle += dt * 0.06;
  });

  return (
    <CameraControls
      ref={ref}
      enabled={enabled}
      makeDefault
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2 + 0.05}
      smoothTime={0.6}
      draggingSmoothTime={0.15}
      onStart={() => { lastInput.current = performance.now(); }}
      onChange={() => { lastInput.current = performance.now(); invalidate(); }}
    />
  );
}
