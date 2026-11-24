import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import { statusColor } from '@/design/tokens';
import type { ModuleHealth } from '@/engine/types';
import { useReducedMotion } from '@/store/app';

interface Props {
  score: number;
  status: ModuleHealth['status'];
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
}

/** Animated diagnostic ring. Arc length = score, colour = status. */
export function HealthRing({ score, status, size = 120, stroke = 10, label, sublabel }: Props) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const noData = status === 'no-data';
  const mv = useMotionValue(0);
  const offset = useTransform(mv, (v) => c * (1 - v / 100));
  const [display, setDisplay] = useState(0);
  const color = statusColor[status];

  useEffect(() => {
    const target = noData ? 0 : score;
    if (reduced) { mv.set(target); setDisplay(target); return; }
    const ctl = animate(mv, target, { duration: 1.2, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => ctl.stop();
  }, [score, noData, reduced, mv]);

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Health'}: ${noData ? 'no data' : `${score} of 100, ${status}`}`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <filter id={`glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r - stroke} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="2 6" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} style={{ strokeDashoffset: offset }} filter={`url(#glow-${size})`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display font-bold leading-none" style={{ fontSize: size * 0.28, color: noData ? undefined : color }}>{noData ? '—' : display}</div>
          {sublabel && <div className="label mt-1" style={{ fontSize: Math.max(9, size * 0.08) }}>{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}
