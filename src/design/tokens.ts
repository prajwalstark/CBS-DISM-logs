// Single source of truth for colours used inside WebGL (mirrors tailwind.config.ts).
export const color = {
  void: '#050810',
  void2: '#0A1020',
  accent: '#00C8FF',
  accent2: '#7067FF',
  ok: '#00E6A0',
  warn: '#FFB547',
  crit: '#FF4568',
  muted: '#64728C',
  ink: '#E6EDF7',
} as const;

export const motion = {
  fast: 0.15,
  base: 0.25,
  slow: 0.45,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  spring: { type: 'spring', stiffness: 380, damping: 32 } as const,
};

export const statusColor = {
  healthy: color.ok,
  degraded: color.warn,
  critical: color.crit,
  'no-data': color.muted,
} as const;

export const severityColor = {
  critical: color.crit,
  warning: color.warn,
  info: color.accent,
  milestone: color.accent2,
} as const;

export const stageColor = {
  passed: color.ok,
  failed: color.crit,
  warning: color.warn,
  'not-run': color.muted,
  'in-progress': color.accent,
} as const;
