import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide border', {
  variants: {
    tone: {
      critical: 'bg-crit/15 text-crit border-crit/30',
      warning: 'bg-warn/15 text-warn border-warn/30',
      info: 'bg-accent/15 text-accent border-accent/30',
      ok: 'bg-ok/15 text-ok border-ok/30',
      muted: 'bg-white/5 text-ink-2 border-white/10',
      violet: 'bg-accent-2/15 text-[#a49dff] border-accent-2/30',
    },
  },
  defaultVariants: { tone: 'muted' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
