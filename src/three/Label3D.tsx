import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export interface LabelLine { text: string; className?: string; color?: string }

interface Props {
  /** Static world position, or a getter for moving anchors (graph nodes). */
  position?: THREE.Vector3 | [number, number, number];
  track?: (out: THREE.Vector3) => void;
  lines: LabelLine[];
  /** Classes for the label box. */
  className?: string;
  align?: 'center' | 'left' | 'right';
  /** Screen-space offset in px (y negative = up). */
  offset?: [number, number];
  /** Perspective scale constant; scale = k / distance, clamped. */
  k?: number;
  visible?: boolean;
}

/**
 * Lightweight HTML label projected from 3D. Unlike drei <Html>, it creates no
 * React root per label: the DOM node is managed imperatively and positioned in
 * useFrame. This avoids React 19 root-unmount races and keeps labels cheap.
 * Scale is clamped so labels never balloon when the camera flies in close.
 */
export function Label3D({ position, track, lines, className = '', align = 'center', offset = [0, 0], k = 12, visible = true }: Props) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const el = useMemo(() => document.createElement('div'), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const last = useRef('');
  const linesKey = JSON.stringify(lines);

  useLayoutEffect(() => {
    // Hidden until the first frame positions it, so it never flashes at the top-left corner.
    el.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;will-change:transform;z-index:5;display:none;';
    last.current = 'hidden';
    const host = gl.domElement.parentElement;
    host?.appendChild(el);
    return () => { el.parentNode?.removeChild(el); };
  }, [el, gl]);

  useLayoutEffect(() => {
    el.className = className;
    el.replaceChildren(...lines.map((l) => {
      const d = document.createElement('div');
      d.textContent = l.text;
      if (l.className) d.className = l.className;
      if (l.color) d.style.color = l.color;
      return d;
    }));
  }, [el, className, linesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (!visible) { if (last.current !== 'hidden') { el.style.display = 'none'; last.current = 'hidden'; } return; }
    if (track) track(v);
    else if (Array.isArray(position)) v.set(position[0], position[1], position[2]);
    else if (position) v.copy(position);
    // Controls move the camera before render, but matrixWorldInverse is only refreshed during
    // render; update it now so labels use this frame's camera instead of lagging one frame behind.
    camera.updateMatrixWorld();
    const dist = camera.position.distanceTo(v);
    v.project(camera);
    if (v.z > 1 || v.z < -1) { el.style.display = 'none'; last.current = 'hidden'; return; }
    const x = (v.x * 0.5 + 0.5) * size.width + offset[0];
    const y = (-v.y * 0.5 + 0.5) * size.height + offset[1];
    // Quantise scale so text isn't re-rasterised at a new size every frame (shimmer).
    const s = Math.round(Math.min(1.15, Math.max(0.55, k / Math.max(0.001, dist))) * 50) / 50;
    const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0%';
    const t = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(${tx},-50%) scale(${s.toFixed(2)})`;
    if (t !== last.current) {
      el.style.display = '';
      el.style.transformOrigin = align === 'center' ? '50% 50%' : align === 'right' ? '100% 50%' : '0% 50%';
      el.style.transform = t;
      last.current = t;
    }
  });
  return null;
}
