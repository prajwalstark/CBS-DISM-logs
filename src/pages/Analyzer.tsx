import { motion } from 'framer-motion';
import { ChevronRight, Clock, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarList, Donut } from '@/components/Charts';
import { Dropzone } from '@/components/Dropzone';
import { Glass } from '@/components/Glass';
import { LogViewer } from '@/components/LogViewer';
import { NoData } from '@/components/NoData';
import { PageHeader } from '@/components/PageHeader';
import { Timeline } from '@/components/Timeline';
import { Badge } from '@/components/ui/badge';
import { color, severityColor } from '@/design/tokens';
import type { Analysis, DismSession, LogSource } from '@/engine/types';
import { fmtBytes, fmtDuration, fmtNum, fmtTs } from '@/lib/format';
import { navigate, useRoute } from '@/lib/router';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/app';

function Section({ title, children, className, aside }: { title: string; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <Glass className={cn('p-5', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="font-display text-base font-semibold">{title}</h2>{aside}</div>
      {children}
    </Glass>
  );
}

function Overview({ a, source }: { a: Analysis; source: LogSource }) {
  const files = a.files.filter((f) => f.source === source);
  const levels = files.reduce((acc, f) => { for (const k of Object.keys(f.levels) as (keyof typeof f.levels)[]) acc[k] = (acc[k] || 0) + f.levels[k]; return acc; }, {} as Record<string, number>);
  const comps = files.reduce((acc, f) => { for (const [k, v] of Object.entries(f.components)) acc[k] = (acc[k] || 0) + v; return acc; }, {} as Record<string, number>);
  const codes = a.findings.filter((f) => f.sources[0] === source && f.kind === 'hresult').slice(0, 8);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
      <Section title="Files">
        <ul className="space-y-3">
          {files.map((f) => (
            <li key={f.name} className="rounded-lg bg-white/[0.03] p-3">
              <div className="truncate font-medium">{f.name}</div>
              <div className="mono mt-1 text-ink-3">{fmtBytes(f.size)} · {fmtNum(f.lines)} lines · {fmtNum(f.parsedLines)} timestamped</div>
              <div className="mono text-ink-3">{fmtTs(f.first)} → {fmtTs(f.last)}</div>
              {f.first && f.last && <div className="mono text-ink-3">span {fmtDuration(f.last - f.first)}</div>}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Severity distribution">
        <Donut size={150} data={[
          { label: 'Error', value: levels.Error || 0, color: color.crit },
          { label: 'Warning', value: levels.Warning || 0, color: color.warn },
          { label: 'Info', value: levels.Info || 0, color: color.accent },
          { label: 'Perf', value: levels.Perf || 0, color: color.accent2 },
          { label: 'Continuation', value: levels.Unknown || 0, color: color.muted },
        ].filter((d) => d.value > 0)} />
      </Section>
      <Section title={codes.length ? 'HRESULTs' : 'Components'}>
        {codes.length ? (
          <BarList data={codes.map((f) => ({ label: `${f.code} ${f.name}`, value: f.occurrences, color: severityColor[f.severity], hint: f.title }))}
            onSelect={(d) => { const f = codes.find((x) => d.label.startsWith(x.code)); if (f) { useApp.getState().selectFinding(f.id); navigate('errors', { finding: f.id }); } }} />
        ) : (
          <BarList data={Object.entries(comps).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => ({ label: k, value: v, color: color.accent }))} />
        )}
      </Section>
    </div>
  );
}

function CbsPanels({ a }: { a: Analysis }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="SFC scans" aside={<span className="text-xs text-ink-3">{a.sfcRuns.length} run(s)</span>}>
        {a.sfcRuns.length === 0 ? <p className="text-sm text-ink-3">No [SR] activity in this log.</p> : (
          <ul className="space-y-2">
            {a.sfcRuns.map((r) => (
              <li key={r.startLine} className="grid grid-cols-4 gap-2 rounded-lg bg-white/[0.03] p-3 text-center text-sm">
                <div><div className="label">Started</div><div className="mono mt-1">{fmtTs(r.start, false)}</div></div>
                <div><div className="label">Verified</div><div className="font-display font-bold">{r.verified ?? '—'}</div></div>
                <div><div className="label">Repaired</div><div className="font-display font-bold text-warn">{r.repairedFiles}</div></div>
                <div><div className="label">Unrepairable</div><div className={cn('font-display font-bold', r.unrepairedFiles && 'text-crit')}>{r.unrepairedFiles}</div></div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Checker summaries" aside={<span className="text-xs text-ink-3">System Update Readiness</span>}>
        {a.checker.length === 0 ? <p className="text-sm text-ink-3">No checker summary block found.</p> : a.checker.map((c) => (
          <div key={c.line} className="rounded-lg bg-white/[0.03] p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.operation ?? 'Summary'}</span>
              {c.result && <Badge tone={c.result === '0x00000000' ? 'ok' : 'critical'}>{c.result}</Badge>}
              <span className="mono ml-auto text-ink-3">line {c.line}</span>
            </div>
            <div className="mt-2 flex gap-6">
              <div><div className="label">Detected</div><div className="font-display text-xl font-bold text-crit">{c.totalDetected}</div></div>
              <div><div className="label">Repaired</div><div className="font-display text-xl font-bold text-ok">{c.totalRepaired}</div></div>
              <div className="flex-1 text-xs text-ink-2">{Object.entries(c.breakdown).filter(([, v]) => v > 0).map(([k, v]) => <div key={k}>{k}: <b>{v}</b></div>)}</div>
            </div>
          </div>
        ))}
      </Section>
      <Section title="TrustedInstaller sessions">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="label text-left"><th className="pb-2 font-medium">Start</th><th className="pb-2 font-medium">Duration</th><th className="pb-2 font-medium">Stack</th><th className="pb-2 text-right font-medium">Err/Warn</th></tr></thead>
            <tbody>
              {a.cbsSessions.map((s) => (
                <tr key={s.id} className="border-t border-white/[0.05]">
                  <td className="mono py-1.5">{fmtTs(s.start)}</td>
                  <td className="mono">{s.start && s.end ? fmtDuration(s.end - s.start) : '—'}</td>
                  <td className="mono text-ink-3">{s.version ?? '—'}</td>
                  <td className="mono text-right"><span className={s.errors ? 'text-crit' : ''}>{s.errors}</span> / <span className={s.warnings ? 'text-warn' : ''}>{s.warnings}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.cbsSessions.length === 0 && <p className="text-sm text-ink-3">No sessions found.</p>}
        </div>
      </Section>
      <Section title="Update packages" aside={<span className="text-xs text-ink-3">{a.packages.length} seen</span>}>
        {a.packages.length === 0 ? <p className="text-sm text-ink-3">No package activity.</p> : (
          <ul className="max-h-64 space-y-1.5 overflow-auto">
            {a.packages.map((p) => (
              <li key={p.name} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                <Badge tone={p.state === 'failed' ? 'critical' : p.state === 'pending' ? 'warning' : p.state === 'installed' ? 'ok' : 'muted'}>{p.state}</Badge>
                <span className="min-w-0 flex-1 truncate" title={p.name}>{p.kb ?? p.name.split('~')[0]}</span>
                {p.hresult && <span className="mono text-crit">{p.hresult}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function DismSessions({ a, onJump }: { a: Analysis; onJump: (s: DismSession) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Section title="DISM sessions" aside={<span className="text-xs text-ink-3">{a.dismSessions.length} session(s)</span>}>
      <ol className="relative space-y-2 border-l border-white/10 pl-5">
        {a.dismSessions.map((s) => {
          const failed = s.errors > 0;
          const isOpen = open === s.id;
          return (
            <li key={s.id} className="relative">
              <span className={cn('absolute -left-[26px] top-3.5 size-3 rounded-full ring-4 ring-void', failed ? 'bg-crit' : s.warnings ? 'bg-warn' : 'bg-ok')} />
              <button onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}
                className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]">
                <ChevronRight className={cn('size-4 text-ink-3 transition-transform duration-base', isOpen && 'rotate-90')} />
                <span className="font-display font-semibold">/{s.operation ?? 'Unknown'}</span>
                {s.usesSource && <Badge tone="info">/Source</Badge>}
                {s.componentStoreState && <Badge tone={s.componentStoreState === 'healthy' || s.componentStoreState === 'repaired' ? 'ok' : s.componentStoreState === 'repairable' ? 'warning' : 'critical'}>store {s.componentStoreState}</Badge>}
                <span className="ml-auto flex items-center gap-3 text-xs text-ink-3">
                  <span className="mono flex items-center gap-1"><Clock className="size-3" />{fmtTs(s.start)}</span>
                  {s.start && s.end && <span className="mono">{fmtDuration(s.end - s.start)}</span>}
                  <Badge tone={failed ? 'critical' : 'ok'}>{failed ? s.result ?? 'failed' : 'ok'}</Badge>
                </span>
              </button>
              <motion.div initial={false} animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }} className="overflow-hidden">
                <div className="space-y-2 px-3 pb-1 pt-2 text-sm">
                  <div className="flex items-start gap-2"><Terminal className="mt-0.5 size-4 shrink-0 text-accent" /><code className="mono break-all text-accent">{s.command ?? '(command line not logged)'}</code></div>
                  <div className="flex flex-wrap gap-4 text-xs text-ink-2">
                    <span>Errors: <b className={failed ? 'text-crit' : ''}>{s.errors}</b></span>
                    <span>Warnings: <b>{s.warnings}</b></span>
                    <span>Reboot required: <b>{s.rebootRequired === undefined ? 'n/a' : s.rebootRequired ? 'yes' : 'no'}</b></span>
                    <span>LimitAccess: <b>{s.limitAccess ? 'yes' : 'no'}</b></span>
                  </div>
                  <button className="text-xs text-accent hover:underline" onClick={() => onJump(s)}>Show in log at line {s.startLine} →</button>
                </div>
              </motion.div>
            </li>
          );
        })}
      </ol>
      {a.dismSessions.length === 0 && <p className="text-sm text-ink-3">No DISM sessions found.</p>}
    </Section>
  );
}

export default function AnalyzerPage({ source }: { source: LogSource }) {
  const a = useApp((s) => s.analysis);
  const { params } = useRoute();
  const [jump, setJump] = useState<{ file: string; line: number } | null>(null);
  const focus = useMemo(() => {
    if (jump) return jump;
    const file = params.get('file'), line = params.get('line');
    return file && line ? { file, line: Number(line) } : null;
  }, [params, jump]);
  const title = source === 'cbs' ? 'CBS Analyzer' : 'DISM Analyzer';
  const entries = useMemo(() => (a ? a.entries.filter((e) => e.source === source) : []), [a, source]);

  if (!a) return <><PageHeader eyebrow="Analyse" title={title} /><NoData what={`The ${title}`} /></>;
  const has = a.files.some((f) => f.source === source);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader eyebrow="Analyse" title={title}
        description={source === 'cbs' ? 'Component-Based Servicing activity: TrustedInstaller sessions, SFC, the component store checker and update packages.' : 'DISM sessions, commands and results from dism.log.'} />
      {!has ? (
        <Glass className="p-6">
          <p className="mb-4 text-sm text-ink-2">This analysis contains no {source.toUpperCase()} log. Add {source === 'cbs' ? 'C:\\Windows\\Logs\\CBS\\CBS.log' : 'C:\\Windows\\Logs\\DISM\\dism.log'} to analyse it. Select CBS.log and dism.log together to analyse and correlate them in one pass.</p>
          <Dropzone compact />
        </Glass>
      ) : (
        <>
          <Overview a={a} source={source} />
          {source === 'cbs' ? <CbsPanels a={a} /> : <DismSessions a={a} onJump={(s) => setJump({ file: s.file, line: s.startLine })} />}
          <Section title="Timeline"><Timeline events={a.timeline} source={source} onOpenFinding={(id) => navigate('errors', { finding: id })} /></Section>
          <Section title="Log entries" aside={<span className="text-xs text-ink-3">errors, warnings, HRESULTs, patterns & milestones</span>}>
            <LogViewer entries={entries} focusLine={focus} truncated={a.entriesTruncated} />
          </Section>
        </>
      )}
    </div>
  );
}
