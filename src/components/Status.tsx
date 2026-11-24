import { cn } from '@/lib/utils';
import { severityColor, stageColor, statusColor } from '@/design/tokens';
import type { ModuleHealth, Severity, StageStatus } from '@/engine/types';
import { Badge } from './ui/badge';

export function StatusDot({ status, pulse = true, className }: { status: ModuleHealth['status']; pulse?: boolean; className?: string }) {
  const c = statusColor[status];
  return (
    <span className={cn('relative inline-flex size-2.5', className)} aria-hidden>
      {pulse && status !== 'healthy' && status !== 'no-data' && <span className="absolute inset-0 rounded-full animate-pulse-ring" style={{ background: c }} />}
      <span className="relative inline-flex size-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={severity}>{severity}</Badge>;
}

export function StatusBadge({ status }: { status: ModuleHealth['status'] }) {
  const tone = status === 'healthy' ? 'ok' : status === 'degraded' ? 'warning' : status === 'critical' ? 'critical' : 'muted';
  return <Badge tone={tone}>{status === 'no-data' ? 'no data' : status}</Badge>;
}

export function StageBadge({ status }: { status: StageStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: stageColor[status] }}>
      <span className="size-1.5 rounded-full" style={{ background: stageColor[status] }} />
      {status.replace('-', ' ')}
    </span>
  );
}

export const sevColor = severityColor;
