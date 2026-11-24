import { useMemo } from 'react';
import type { Analysis, ModuleId } from '@/engine/types';
import { MODULE_IDS } from '@/engine/types';
import { useApp } from '@/store/app';
import { CameraRig } from './CameraRig';
import { Connections } from './Connections';
import { Dust, HoloGrid, Lights } from './Environment';
import { Effects } from './Effects';
import { MODULE_POS } from './layout';
import { ModuleNode } from './ModuleNode';
import { SystemCore } from './SystemCore';
import type { SceneProps } from './Canvas3D';

interface Props extends SceneProps {
  analysis: Analysis | null;
  selected: ModuleId | null;
  hovered: ModuleId | null;
  onSelect: (m: ModuleId | null) => void;
  onHover: (m: ModuleId | null) => void;
  compact?: boolean;
}

export default function OverviewScene({ analysis, selected, hovered, onSelect, onHover, quality, reduced, compact }: Props) {
  const settings = useApp((s) => s.settings);
  const focus = useMemo(() => (selected ? MODULE_POS[selected] : null), [selected]);
  const home = useMemo<[number, number, number]>(() => (compact ? [0, 9, 19] : [0, 6.5, 15.5]), [compact]);
  const pulse = analysis?.overall.status === 'critical' ? 1 : analysis ? 0.4 : 0;
  return (
    <>
      <Lights />
      <fog attach="fog" args={['#050810', 18, 42]} />
      <SystemCore analysis={analysis} quality={quality} onClick={() => onSelect(null)} />
      {MODULE_IDS.map((m) => (
        <ModuleNode
          key={m}
          id={m}
          analysis={analysis}
          health={analysis?.modules[m] ?? null}
          position={MODULE_POS[m]}
          selected={selected === m}
          dimmed={!!(selected || hovered) && selected !== m && hovered !== m}
          showLabel={selected !== m}
          onSelect={(id) => onSelect(selected === id ? null : id)}
          onHover={onHover}
        />
      ))}
      <Connections analysis={analysis} focus={selected ?? hovered} />
      <HoloGrid y={-2.6} pulse={pulse} />
      <Dust quality={quality} enabled={settings.particles} />
      <CameraRig focus={focus} home={home} autoRotate={settings.autoRotate} reduced={reduced} />
      <Effects quality={quality} dof={false} />
    </>
  );
}
