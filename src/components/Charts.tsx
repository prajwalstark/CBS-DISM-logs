import { motion } from 'framer-motion';
import { useState } from 'react';

export interface BarDatum { label: string; value: number; color: string; hint?: string }

/** Horizontal bar list with hover readout. */
export function BarList({ data, onSelect }: { data: BarDatum[]; onSelect?: (d: BarDatum) => void }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={d.label}>
          <button type="button" disabled={!onSelect} onClick={() => onSelect?.(d)} className="group w-full text-left disabled:cursor-default" title={d.hint}>
            <div className="mb-1 flex justify-between text-xs"><span className="text-ink-2 group-hover:text-ink">{d.label}</span><span className="mono text-ink">{d.value.toLocaleString()}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div className="h-full rounded-full" style={{ background: d.color, boxShadow: `0 0 12px ${d.color}66` }}
                initial={{ width: 0 }} animate={{ width: `${(d.value / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Interactive donut: hover a segment to read its value. */
export function Donut({ data, size = 140, center }: { data: BarDatum[]; size?: number; center?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const active = hover !== null ? data[hover] : null;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90 shrink-0" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={hover === i ? 18 : 14}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} className="cursor-pointer transition-all duration-base"
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          );
          acc += len;
          return el;
        })}
        <text x="50%" y="50%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central" fill="#E6EDF7" fontFamily="Space Grotesk" fontWeight={700} fontSize={size * 0.17}>
          {active ? active.value.toLocaleString() : center ?? total.toLocaleString()}
        </text>
      </svg>
      <ul className="space-y-1 text-xs">
        {data.map((d, i) => (
          <li key={d.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} className={hover === i ? 'text-ink' : 'text-ink-2'}>
            <span className="mr-2 inline-block size-2 rounded-full" style={{ background: d.color }} />{d.label} <span className="mono text-ink-3">{d.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
