import { AnimatePresence, motion } from 'framer-motion';
import { FileText, FlaskConical, CloudUpload } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/app';
import { Button } from './ui/button';
import { Magnetic } from './Magnetic';

export function Dropzone({ compact }: { compact?: boolean }) {
  const loadFiles = useApp((s) => s.loadFiles);
  const loadSample = useApp((s) => s.loadSample);
  const error = useApp((s) => s.parse.error);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Load CBS.log or dism.log files: press Enter to browse or drop files here"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); loadFiles([...e.dataTransfer.files]); }}
        className={cn(
          'group relative cursor-pointer overflow-hidden rounded-2xl border border-dashed transition-all duration-base',
          over ? 'border-accent bg-accent/10 shadow-glow' : 'border-white/15 bg-white/[0.02] hover:border-accent/50 hover:bg-white/[0.04]',
          compact ? 'p-4' : 'p-8 md:p-10',
        )}
      >
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
        <div className={cn('relative flex items-center gap-4', compact ? 'flex-row' : 'flex-col text-center')}>
          <motion.div
            animate={over ? { scale: 1.12, y: -4 } : { scale: 1, y: 0 }}
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/30"
          >
            <CloudUpload className="size-7" />
          </motion.div>
          <div>
            <div className="font-display text-base font-semibold text-ink">{over ? 'Release to analyse' : 'Drop CBS.log / dism.log here'}</div>
            <div className="mt-1 text-xs text-ink-2">
              From <span className="mono text-ink">C:\Windows\Logs\CBS\CBS.log</span> and <span className="mono text-ink">C:\Windows\Logs\DISM\dism.log</span>. Parsed locally in your browser — nothing is uploaded.
            </div>
          </div>
        </div>
        <input ref={input} type="file" multiple accept=".log,.txt,text/plain" className="sr-only" tabIndex={-1}
          onChange={(e) => { loadFiles([...(e.target.files || [])]); e.target.value = ''; }} />
      </div>
      <div className={cn('flex flex-wrap items-center gap-2', compact ? '' : 'justify-center')}>
        <Magnetic><Button onClick={() => input.current?.click()}><FileText /> Browse log files</Button></Magnetic>
        <Magnetic><Button variant="secondary" onClick={loadSample}><FlaskConical /> Load labelled sample logs</Button></Magnetic>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="rounded-lg border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
