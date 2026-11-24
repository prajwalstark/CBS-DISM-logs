import { animate } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/store/app';
import { Glass } from './Glass';

export function StatCard({ icon: Icon, label, value, tone = '#00C8FF', hint, onClick }: { icon: LucideIcon; label: string; value: number; tone?: string; hint?: string; onClick?: () => void }) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setV(value); return; }
    const c = animate(0, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [value, reduced]);
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg" style={{ background: `${tone}1a`, color: tone }}><Icon className="size-4" /></span>
      </div>
      <div className="mt-2 font-display text-3xl font-bold" style={{ color: value > 0 ? tone : undefined }}>{v.toLocaleString()}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </>
  );
  return (
    <Glass interactive className="p-4">
      {onClick ? <button type="button" onClick={onClick} className="block w-full text-left" aria-label={`${label}: ${value}. Open details`}>{body}</button> : body}
    </Glass>
  );
}
