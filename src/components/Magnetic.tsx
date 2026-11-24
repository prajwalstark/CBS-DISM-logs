import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { useReducedMotion } from '@/store/app';

/** Wrap an interactive element so it is gently pulled toward the pointer. */
export function Magnetic({ children, strength = 0.25, className }: { children: ReactNode; strength?: number; className?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 300, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 300, damping: 18 });
  if (reduced) return <span className={className}>{children}</span>;
  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ x, y, display: 'inline-flex' }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.span>
  );
}
