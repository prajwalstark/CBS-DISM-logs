import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Badge } from './ui/badge';
import { useApp } from '@/store/app';

export function PageHeader({ title, eyebrow, description, actions }: { title: string; eyebrow?: string; description?: ReactNode; actions?: ReactNode }) {
  const analysis = useApp((s) => s.analysis);
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
    >
      <div className="min-w-0">
        {eyebrow && <div className="label mb-1.5 text-accent/80">{eyebrow}</div>}
        <h1 className="text-2xl font-bold text-ink md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{description}</p>}
        {analysis?.isSample && <Badge tone="violet" className="mt-2">Sample dataset — not from your system</Badge>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}
