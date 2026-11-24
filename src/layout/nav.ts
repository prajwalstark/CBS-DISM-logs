import { Bug, FileClock, FileSearch, FileText, LayoutDashboard, Network, Settings, Terminal, Wrench, type LucideIcon } from 'lucide-react';
import type { RouteId } from '@/lib/router';

export const NAV: { id: RouteId; label: string; icon: LucideIcon; group: 'analyse' | 'act' | 'manage' }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'analyse' },
  { id: 'cbs', label: 'CBS Analyzer', icon: FileSearch, group: 'analyse' },
  { id: 'dism', label: 'DISM Analyzer', icon: Terminal, group: 'analyse' },
  { id: 'errors', label: 'Error Explorer', icon: Bug, group: 'analyse' },
  { id: 'repair', label: 'Repair Center', icon: Wrench, group: 'act' },
  { id: 'map', label: '3D System Map', icon: Network, group: 'act' },
  { id: 'history', label: 'Diagnostic History', icon: FileClock, group: 'manage' },
  { id: 'reports', label: 'Reports', icon: FileText, group: 'manage' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'manage' },
];
