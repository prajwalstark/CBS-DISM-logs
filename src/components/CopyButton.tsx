import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { copyText } from '@/lib/download';
import { cn } from '@/lib/utils';

export function CopyButton({ text, className, label = 'Copy command' }: { text: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? 'Copied' : label}
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1400); }
      }}
      className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-2 hover:text-ink hover:bg-white/10 transition-colors', className)}
    >
      {done ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export function CommandBlock({ command }: { command: string }) {
  return (
    <div className="group relative mt-1.5 rounded-lg border border-white/10 bg-void-2/80 pr-16">
      <pre className="mono overflow-x-auto whitespace-pre-wrap break-all p-2.5 text-accent/90">{command}</pre>
      <CopyButton text={command} className="absolute right-1.5 top-1.5" />
    </div>
  );
}
