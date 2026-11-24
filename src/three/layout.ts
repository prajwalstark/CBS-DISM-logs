import * as THREE from 'three';
import { MODULE_IDS, type ModuleId } from '@/engine/types';

export const RING_RADIUS = 6.2;

/** Fixed hexagonal layout so the map is spatially stable between analyses. */
export const MODULE_POS: Record<ModuleId, THREE.Vector3> = Object.fromEntries(
  MODULE_IDS.map((m, i) => {
    const a = (i / MODULE_IDS.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / 6;
    return [m, new THREE.Vector3(Math.cos(a) * RING_RADIUS, Math.sin(i * 1.7) * 0.7, Math.sin(a) * RING_RADIUS)];
  }),
) as Record<ModuleId, THREE.Vector3>;

export function arc(a: THREE.Vector3, b: THREE.Vector3, lift = 1.5) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += lift;
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
}
