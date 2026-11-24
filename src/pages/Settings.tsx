import { Cpu, Monitor } from 'lucide-react';
import type { ReactNode } from 'react';
import { Glass } from '@/components/Glass';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { knownHresultCount, PATTERNS } from '@/engine/knowledge';
import { cn } from '@/lib/utils';
import { useApp, useQuality, useReducedMotion, type Settings as S } from '@/store/app';

function Row({ title, desc, children, id }: { title: string; desc: string; children: ReactNode; id: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><label htmlFor={id} className="font-medium">{title}</label><p className="text-xs text-ink-3">{desc}</p></div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-white/[0.05] p-0.5">
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={cn('rounded-md px-2.5 py-1 text-xs transition-colors', value === o.v ? 'bg-accent/20 text-accent' : 'text-ink-2 hover:text-ink')}>{o.l}</button>
      ))}
    </div>
  );
}

export default function Settings() {
  const s = useApp((x) => x.settings);
  const update = useApp((x) => x.updateSettings);
  const webgl = useApp((x) => x.webgl);
  const auto = useApp((x) => x.autoQuality);
  const effective = useQuality();
  const reduced = useReducedMotion();
  const sw = (k: keyof S, id: string) => <Switch id={id} checked={!!s[k]} onCheckedChange={(v) => update({ [k]: v } as Partial<S>)} />;

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <PageHeader eyebrow="Manage" title="Settings" description="Preferences are stored in this browser." />
      <Glass className="divide-y divide-white/[0.06] px-5 py-2">
        <h2 className="label pb-2 pt-3">Rendering</h2>
        <Row id="q" title="3D quality" desc={`Auto-detected tier for this device: ${auto}. Currently rendering at ${effective}. High enables ambient occlusion and MSAA; low disables post-processing.`}>
          <Segmented label="3D quality" value={s.quality} onChange={(v) => update({ quality: v })} options={[{ v: 'auto', l: 'Auto' }, { v: 'high', l: 'High' }, { v: 'medium', l: 'Medium' }, { v: 'low', l: 'Low' }]} />
        </Row>
        <Row id="e3d" title="3D visualisations" desc={webgl ? 'Turn off to use the lightweight 2D fallback views everywhere.' : 'WebGL is not available in this browser — 2D views are used.'}>
          <Switch id="e3d" checked={s.enable3D && webgl} disabled={!webgl} onCheckedChange={(v) => update({ enable3D: v })} />
        </Row>
        <Row id="bloom" title="Bloom glow" desc="Selective glow on status indicators (medium/high quality).">{sw('bloom', 'bloom')}</Row>
        <Row id="particles" title="Ambient particles" desc="Background dust in 3D scenes.">{sw('particles', 'particles')}</Row>
        <Row id="rotate" title="Auto-rotate overview" desc="Slowly orbit the system map when idle.">{sw('autoRotate', 'rotate')}</Row>
        <Row id="rm" title="Reduced motion" desc={`System preference is respected by default. Currently ${reduced ? 'reduced' : 'full'} motion.`}>
          <Segmented label="Reduced motion" value={s.reducedMotion} onChange={(v) => update({ reducedMotion: v })} options={[{ v: 'system', l: 'System' }, { v: 'on', l: 'Reduce' }, { v: 'off', l: 'Full' }]} />
        </Row>
      </Glass>
      <Glass className="divide-y divide-white/[0.06] px-5 py-2">
        <h2 className="label pb-2 pt-3">Data</h2>
        <Row id="save" title="Save analyses to history" desc="Store each analysis in IndexedDB after parsing.">{sw('autoSave', 'save')}</Row>
      </Glass>
      <Glass className="grid min-w-0 grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div className="flex gap-3"><Monitor className="size-5 text-accent" /><div><div className="font-medium">Graphics</div><div className="text-xs text-ink-3">WebGL: {webgl ? <Badge tone="ok">available</Badge> : <Badge tone="critical">unavailable</Badge>} · {navigator.hardwareConcurrency || '?'} logical cores</div></div></div>
        <div className="flex gap-3"><Cpu className="size-5 text-accent-2" /><div><div className="font-medium">Knowledge base</div><div className="text-xs text-ink-3">{knownHresultCount()} documented HRESULTs · {Object.keys(PATTERNS).length} log patterns · unknown codes decoded by facility</div></div></div>
      </Glass>
    </div>
  );
}
