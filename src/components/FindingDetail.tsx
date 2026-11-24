import { ExternalLink, Link2 } from 'lucide-react';
import { MODULE_META } from '@/engine/modules';
import type { Analysis, Finding } from '@/engine/types';
import { fmtTs } from '@/lib/format';
import { navigate } from '@/lib/router';
import { useApp } from '@/store/app';
import { CommandBlock } from './CopyButton';
import { SeverityBadge } from './Status';
import { Badge } from './ui/badge';

export function FindingDetail({ finding, analysis }: { finding: Finding; analysis: Analysis }) {
  const select = useApp((s) => s.selectFinding);
  const related = analysis.correlations
    .filter((c) => c.a === finding.id || c.b === finding.id)
    .map((c) => ({ c, other: analysis.findings.find((f) => f.id === (c.a === finding.id ? c.b : c.a)) }))
    .filter((r) => r.other);

  return (
    <article className="flex flex-col gap-4" aria-labelledby={`f-${finding.id}`}>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          <Badge tone="muted">{finding.sources.join(' + ').toUpperCase()}</Badge>
          <Badge tone="violet">{MODULE_META[finding.module].label}</Badge>
        </div>
        <h3 id={`f-${finding.id}`} className="mt-2 font-display text-lg font-semibold leading-snug">{finding.title}</h3>
        <div className="mono mt-0.5 text-accent">{finding.code}{finding.name !== finding.code ? ` · ${finding.name}` : ''}</div>
        <p className="mt-2 text-sm text-ink-2">{finding.description}</p>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/[0.04] p-2"><dt className="label">Occurrences</dt><dd className="font-display text-lg font-bold">{finding.occurrences}</dd></div>
        <div className="rounded-lg bg-white/[0.04] p-2"><dt className="label">First</dt><dd className="mono mt-1">{fmtTs(finding.firstSeen, false)}</dd></div>
        <div className="rounded-lg bg-white/[0.04] p-2"><dt className="label">Last</dt><dd className="mono mt-1">{fmtTs(finding.lastSeen, false)}</dd></div>
      </dl>

      <section>
        <h4 className="label mb-1.5">Evidence</h4>
        <pre className="mono max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/10 bg-void-2/80 p-2.5 text-ink-2">{finding.sample}</pre>
        <div className="mt-2 flex flex-wrap gap-1">
          {finding.refs.slice(0, 12).map((r) => (
            <button key={`${r.file}:${r.line}`} className="mono rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-ink-2 hover:bg-accent/15 hover:text-accent"
              onClick={() => navigate(r.source === 'dism' ? 'dism' : 'cbs', { file: r.file, line: String(r.line) })}>
              {r.file}:{r.line}
            </button>
          ))}
          {finding.refs.length > 12 && <span className="text-[11px] text-ink-3">+{finding.occurrences - 12} more</span>}
        </div>
      </section>

      {finding.causes.length > 0 && (
        <section>
          <h4 className="label mb-1.5">Likely causes</h4>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-2">{finding.causes.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>
      )}

      {finding.steps.length > 0 && (
        <section>
          <h4 className="label mb-1.5">Troubleshooting</h4>
          <ol className="space-y-2.5">
            {finding.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">{i + 1}</span>
                <div className="min-w-0 flex-1 text-ink-2">{s.text}{s.command && <CommandBlock command={s.command} />}</div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {finding.links.length > 0 && (
        <section>
          <h4 className="label mb-1.5">Microsoft documentation</h4>
          <ul className="space-y-1">
            {finding.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5 text-sm text-accent hover:underline">
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 opacity-70 group-hover:opacity-100" />{l.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section>
          <h4 className="label mb-1.5">Correlated errors</h4>
          <ul className="space-y-1.5">
            {related.map(({ c, other }) => (
              <li key={`${other!.id}-${c.kind}`}>
                <button onClick={() => select(other!.id)} className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] p-2 text-left hover:border-accent/40 hover:bg-accent/5">
                  <div className="flex items-center gap-2 text-sm">
                    <Link2 className="size-3.5 text-accent-2" />
                    <span className="font-medium">{other!.title}</span>
                    <span className="mono ml-auto text-[10px] text-ink-3">{other!.sources[0].toUpperCase()} · {c.kind}</span>
                  </div>
                  <div className="mt-0.5 pl-5 text-xs text-ink-3">{c.reason}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
