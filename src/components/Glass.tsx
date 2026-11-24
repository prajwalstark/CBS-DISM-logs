import { motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/store/app';

interface GlassProps extends HTMLMotionProps<'div'> {
  /** Subtle 3D tilt toward the pointer + elevation on hover. */
  interactive?: boolean;
  edge?: boolean;
  strong?: boolean;
}

export function Glass({ interactive, edge, strong, className, children, style, ...rest }: GlassProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 220, damping: 22 });
  const sy = useSpring(my, { stiffness: 220, damping: 22 });
  const rotateX = useTransform(sy, [0, 1], [3.5, -3.5]);
  const rotateY = useTransform(sx, [0, 1], [-3.5, 3.5]);
  const glowX = useTransform(sx, (v) => `${v * 100}%`);
  const glowY = useTransform(sy, (v) => `${v * 100}%`);
  const sheen = useTransform([glowX, glowY], ([x, y]) => `radial-gradient(420px circle at ${x} ${y}, rgba(0,200,255,0.10), transparent 45%)`);
  const live = interactive && !reduced;

  return (
    <motion.div
      ref={ref}
      className={cn(strong ? 'glass-strong' : 'glass', edge && 'glass-edge', live && 'transition-shadow duration-base hover:shadow-glow', className)}
      style={live ? { rotateX, rotateY, transformPerspective: 900, ...style } : style}
      whileHover={live ? { y: -3 } : undefined}
      onPointerMove={live ? (e) => {
        const r = ref.current!.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      } : undefined}
      onPointerLeave={live ? () => { mx.set(0.5); my.set(0.5); } : undefined}
      {...rest}
    >
      {live && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-slow group-hover:opacity-100 [div:hover>&]:opacity-100"
          style={{ background: sheen }}
        />
      )}
      {children as React.ReactNode}
    </motion.div>
  );
}
