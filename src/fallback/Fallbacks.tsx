import { severityColor, stageColor, statusColor } from '@/design/tokens';
import { MODULE_META } from '@/engine/modules';
import type { Analysis, Finding, ModuleId, RepairStage } from '@/engine/types';
import { MODULE_IDS } from '@/engine/types';
import { useApp } from '@/store/app';

function Notice() {
  const webgl = useApp((s) => s.webgl);
  return (
    <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-void-2/80 px-2 py-1 text-[10px] text-ink-3">
      {webgl ? '2D mode (3D disabled in Settings)' : 'WebGL unavailable — 2D fallback'}
    </div>
  );
}

/** 2D system map: core + six module nodes, same data and interactions as 3D. */
export function SvgSystemMap({ analysis, selected, onSelect }: { analysis: Analysis | null; selected: ModuleId | null; onSelect: (m: ModuleId | null) => void }) {
  const W = 600, H = 420, cx = W / 2, cy = H / 2, R = 150;
  const st = analysis?.overall.status ?? 'no-data';
  const score = analysis?.overall.score ?? 0;
  const circ = 2 * Math.PI * 56;
  return (
    <div className="relative h-full w-full">
      <Notice />
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="group" aria-label="System map">
        {MODULE_IDS.map((m, i) => {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * R * 1.35, y = cy + Math.sin(a) * R;
          const h = analysis?.modules[m];
          return <line key={m} x1={cx} y1={cy} x2={x} y2={y} stroke={statusColor[h?.status ?? 'no-data']} strokeOpacity={selected && selected !== m ? 0.15 : 0.5} strokeWidth={2} strokeDasharray="6 6" />;
        })}
        <circle cx={cx} cy={cy} r={56} fill="#0A1020" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
        <circle cx={cx} cy={cy} r={56} fill="none" stroke={statusColor[st]} strokeWidth={8} strokeDasharray={`${(score / 100) * circ} ${circ}`} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round" />
        <text x={cx} y={cy + 4} textAnchor="middle" fill={statusColor[st]} fontSize={28} fontWeight={700} fontFamily="Space Grotesk">{st === 'no-data' ? '—' : score}</text>
        <text x={cx} y={cy + 22} textAnchor="middle" fill="#64728C" fontSize={9} letterSpacing={2}>SYSTEM</text>
        {MODULE_IDS.map((m, i) => {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * R * 1.35, y = cy + Math.sin(a) * R;
          const h = analysis?.modules[m];
          const s = h?.status ?? 'no-data';
          return (
            <g key={m} role="button" tabIndex={0} aria-pressed={selected === m} aria-label={`${MODULE_META[m].label}: ${s === 'no-data' ? 'no data' : `${h!.score}, ${s}`}`}
              onClick={() => onSelect(selected === m ? null : m)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(selected === m ? null : m); } }}
              className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-white" opacity={selected && selected !== m ? 0.45 : 1}>
              <circle cx={x} cy={y} r={selected === m ? 34 : 30} fill="#0d1830" stroke={statusColor[s]} strokeWidth={3} />
              <text x={x} y={y + 4} textAnchor="middle" fill="#E6EDF7" fontSize={12} fontWeight={600}>{MODULE_META[m].short}</text>
              <text x={x} y={y + 48} textAnchor="middle" fill="#9AA8C2" fontSize={11}>{MODULE_META[m].label}</text>
              <text x={x} y={y + 62} textAnchor="middle" fill={statusColor[s]} fontSize={10} fontFamily="JetBrains Mono">{s === 'no-data' ? 'no data' : `${h!.score} · ${s}`}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function SvgCorrelation({ analysis, selected, onSelect }: { analysis: Analysis; selected: string | null; onSelect: (id: string | null) => void }) {
  const involved = new Set(analysis.correlations.flatMap((c) => [c.a, c.b]));
  const list = analysis.findings.filter((f) => involved.has(f.id));
  const left = list.filter((f) => f.sources[0] === 'cbs'), right = list.filter((f) => f.sources[0] === 'dism');
  const W = 640, rowH = 30, H = Math.max(left.length, right.length) * rowH + 40;
  const y = (i: number) => 30 + i * rowH;
  const pos = new Map<string, [number, number]>();
  left.forEach((f, i) => pos.set(f.id, [190, y(i)]));
  right.forEach((f, i) => pos.set(f.id, [450, y(i)]));
  const node = (f: Finding, x: number, yy: number, anchor: 'end' | 'start') => (
    <g key={f.id} role="button" tabIndex={0} aria-label={`${f.title} (${f.sources[0]})`} className="cursor-pointer" onClick={() => onSelect(f.id === selected ? null : f.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(f.id === selected ? null : f.id); }} opacity={selected && selected !== f.id && !f.related.includes(selected) ? 0.35 : 1}>
      <circle cx={x} cy={yy} r={selected === f.id ? 8 : 6} fill={severityColor[f.severity]} />
      <text x={anchor === 'end' ? x - 12 : x + 12} y={yy + 4} textAnchor={anchor} fill="#E6EDF7" fontSize={11}>{f.title.length > 26 ? f.title.slice(0, 26) + '…' : f.title}</text>
    </g>
  );
  return (
    <div className="relative h-full w-full overflow-auto">
      <Notice />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: H }}>
        <text x={190} y={14} textAnchor="middle" fill="#00C8FF" fontSize={11} fontWeight={700}>CBS</text>
        <text x={450} y={14} textAnchor="middle" fill="#a49dff" fontSize={11} fontWeight={700}>DISM</text>
        {analysis.correlations.map((c) => {
          const a = pos.get(c.a), b = pos.get(c.b);
          if (!a || !b) return null;
          const on = !selected || c.a === selected || c.b === selected;
          const mx = a[0] === b[0] ? a[0] + (a[0] < 320 ? -60 : 60) : 320;
          return <path key={`${c.a}${c.b}${c.kind}`} d={`M${a[0]},${a[1]} Q${mx},${(a[1] + b[1]) / 2} ${b[0]},${b[1]}`} fill="none" stroke="#7067FF" strokeOpacity={on ? 0.3 + c.strength * 0.6 : 0.05} strokeWidth={1 + c.strength * 2} />;
        })}
        {left.map((f, i) => node(f, 190, y(i), 'end'))}
        {right.map((f, i) => node(f, 450, y(i), 'start'))}
      </svg>
    </div>
  );
}

export function SvgPipeline({ stages, selected, onSelect }: { stages: RepairStage[]; selected: string | null; onSelect: (id: string | null) => void }) {
  return (
    <div className="relative flex h-full w-full items-center overflow-x-auto px-6">
      <Notice />
      <ol className="flex min-w-max items-center gap-2">
        {stages.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <button onClick={() => onSelect(selected === s.id ? null : s.id)} aria-pressed={selected === s.id}
              className="flex w-28 flex-col items-center gap-1 rounded-xl border p-3 transition-colors hover:bg-white/5"
              style={{ borderColor: selected === s.id ? stageColor[s.status] : 'rgba(255,255,255,0.1)' }}>
              <span className="grid size-10 place-items-center rounded-full border-2 font-display font-bold" style={{ borderColor: stageColor[s.status], color: stageColor[s.status] }}>{i + 1}</span>
              <span className="text-sm font-semibold">{s.label}</span>
              <span className="text-[10px] uppercase" style={{ color: stageColor[s.status] }}>{s.status.replace('-', ' ')}</span>
            </button>
            {i < stages.length - 1 && <span className="h-0.5 w-6" style={{ background: stageColor[s.status], opacity: 0.6 }} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SvgSeverity({ findings, selected, onSelect }: { findings: Finding[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const max = Math.max(1, ...findings.map((f) => Math.log2(1 + f.occurrences)));
  return (
    <div className="relative h-full w-full overflow-auto p-4 pt-10">
      <Notice />
      <div className="flex h-full min-h-[200px] items-end gap-1.5">
        {findings.map((f) => (
          <button key={f.id} onClick={() => onSelect(f.id === selected ? null : f.id)} aria-label={`${f.title}, ${f.severity}, ${f.occurrences} occurrences`}
            className="min-w-[14px] flex-1 rounded-t-md transition-all hover:brightness-125"
            style={{ height: `${15 + (Math.log2(1 + f.occurrences) / max) * 85}%`, background: severityColor[f.severity], opacity: selected && selected !== f.id ? 0.35 : 0.9, boxShadow: selected === f.id ? `0 0 16px ${severityColor[f.severity]}` : undefined }} />
        ))}
      </div>
    </div>
  );
}
