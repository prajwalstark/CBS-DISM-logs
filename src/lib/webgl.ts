export type Quality = 'high' | 'medium' | 'low';

let cached: boolean | null = null;
export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    cached = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    cached = false;
  }
  return cached;
}

/** Heuristic starting tier; PerformanceMonitor refines it at runtime. */
export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 8;
  const mobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  if (mobile || cores <= 4 || mem <= 4) return mobile ? 'low' : 'medium';
  return 'high';
}
