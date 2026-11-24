import { AnimatePresence, motion } from 'framer-motion';
import { LoaderCircle, X } from 'lucide-react';
import { fmtBytes, fmtNum } from '@/lib/format';
import { useApp } from '@/store/app';
import { Button } from './ui/button';

export function ParseOverlay() {
  const parse = useApp((s) => s.parse);
  const cancel = useApp((s) => s.cancelParse);
  const p = parse.progress;
  const pct = p && p.totalBytes ? Math.min(100, (p.bytesRead / p.totalBytes) * 100) : 0;
  return (
    <AnimatePresence>
      {parse.status === 'parsing' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-20 left-1/2 z-50 w-[min(420px,calc(100%-2rem))] -translate-x-1/2 glass-strong glass-edge p-4 md:bottom-6"
          role="status" aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <LoaderCircle className="size-5 animate-spin text-accent" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">Parsing {p?.file ?? 'logs'}…</div>
              <div className="mono text-ink-3">{p ? `${fmtBytes(p.bytesRead)} / ${fmtBytes(p.totalBytes)} · ${fmtNum(p.lines)} lines` : 'Starting worker'}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={cancel} aria-label="Cancel parsing"><X /></Button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" animate={{ width: `${pct}%` }} transition={{ ease: 'linear', duration: 0.1 }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
