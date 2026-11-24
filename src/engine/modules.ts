import type { ModuleId } from './types';

export interface ModuleMeta {
  id: ModuleId;
  label: string;
  short: string;
  description: string;
  /** Hex colour used for the node identity (status colour is separate). */
  hue: string;
}

export const MODULE_META: Record<ModuleId, ModuleMeta> = {
  cbs: { id: 'cbs', label: 'CBS Engine', short: 'CBS', description: 'Component-Based Servicing: TrustedInstaller sessions and package execution.', hue: '#00C8FF' },
  dism: { id: 'dism', label: 'DISM Engine', short: 'DISM', description: 'Deployment Image Servicing and Management sessions and their results.', hue: '#7067FF' },
  sfc: { id: 'sfc', label: 'SFC Scanner', short: 'SFC', description: 'System File Checker ([SR]) verification and repair of protected files.', hue: '#38E8FF' },
  store: { id: 'store', label: 'Component Store', short: 'WinSxS', description: 'WinSxS component store integrity: CSI payloads, manifests and metadata.', hue: '#9C8CFF' },
  wu: { id: 'wu', label: 'Windows Update', short: 'WU', description: 'Update packages processed by CBS and their install state.', hue: '#4FA3FF' },
  integrity: { id: 'integrity', label: 'System Integrity', short: 'INT', description: 'Aggregate corruption verdict from checker summaries, SFC and DISM store state.', hue: '#00E6A0' },
};
