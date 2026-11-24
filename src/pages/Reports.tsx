import { FileBraces, FileCode, FileSpreadsheet, FileText, Printer, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Glass } from '@/components/Glass';
import { HealthRing } from '@/components/HealthRing';
import { Magnetic } from '@/components/Magnetic';
import { NoData } from '@/components/NoData';
import { PageHeader } from '@/components/PageHeader';
import { SeverityBadge, StatusBadge } from '@/components/Status';
import { Button } from '@/components/ui/button';
import { MODULE_META } from '@/engine/modules';
import { toCsv, toHtml, toJson, toMarkdown } from '@/engine/report';
import { downloadText } from '@/lib/download';
import { fmtBytes, fmtNum } from '@/lib/format';
import { useApp } from '@/store/app';

export default function Reports() {
  const a = useApp((s) => s.analysis);
  const [status, setStatus] = useState<string | null>(null);
  const base = useMemo(() => (a ? `diagnostic-report-${new Date(a.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}` : ''), [a]);
  if (!a) return <><PageHeader eyebrow="Manage" title="Reports" /><NoData what="Report export" /></>;

  const formats: { id: string; label: string; desc: string; icon: LucideIcon; run: () => void }[] = [
    { id: 'html', label: 'HTML report', desc: 'Self-contained, styled, printable. Safe to email.', icon: FileCode, run: () => downloadText(`${base}.html`, toHtml(a), 'text/html') },
    { id: 'md', label: 'Markdown', desc: 'For tickets, wikis and chat.', icon: FileText, run: () => downloadText(`${base}.md`, toMarkdown(a), 'text/markdown') },
    { id: 'csv', label: 'CSV findings', desc: 'One row per finding for spreadsheets.', icon: FileSpreadsheet, run: () => downloadText(`${base}.csv`, toCsv(a), 'text/csv') },
    { id: 'json', label: 'JSON', desc: 'Full structured analysis (without raw lines).', icon: FileBraces, run: () => downloadText(`${base}.json`, toJson(a), 'application/json') },
  ];
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) { setStatus('Pop-up blocked — download the HTML report and print it instead.'); return; }
    w.document.open();
    w.document.write(toHtml(a));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader eyebrow="Manage" title="Reports" description="Export the current analysis. Reports are generated locally from parsed data." />
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {formats.map((f) => (
          <Glass key={f.id} interactive className="flex flex-col p-4">
            <f.icon className="size-6 text-accent" />
            <div className="mt-3 font-display font-semibold">{f.label}</div>
            <p className="mb-4 mt-1 flex-1 text-xs text-ink-2">{f.desc}</p>
            <Magnetic><Button size="sm" onClick={() => { f.run(); setStatus(`${f.label} downloaded.`); }}>Download</Button></Magnetic>
          </Glass>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={print}><Printer /> Print report</Button>
        <span role="status" className="text-sm text-ink-3">{status}</span>
      </div>

      <Glass className="p-6">
        <div className="label mb-4">Preview</div>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <HealthRing score={a.overall.score} status={a.overall.status} size={120} sublabel="health" />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold">{a.label}</h2>
            <p className="mt-1 text-sm text-ink-2">{a.overall.verdict}</p>
            <p className="mono mt-2 text-ink-3">{fmtNum(a.totals.lines)} lines · {fmtBytes(a.totals.bytes)} · {a.findings.length} findings · {a.correlations.length} correlations</p>
          </div>
        </div>
        <div className="hairline my-6" />
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(a.modules).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
              <span className="text-sm">{MODULE_META[m.id].label}</span>
              <span className="flex items-center gap-2"><span className="mono text-ink-2">{m.status === 'no-data' ? '—' : m.score}</span><StatusBadge status={m.status} /></span>
            </div>
          ))}
        </div>
        <div className="hairline my-6" />
        <ul className="space-y-1.5">
          {a.findings.slice(0, 12).map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm"><SeverityBadge severity={f.severity} /><span className="truncate">{f.title}</span><span className="mono ml-auto text-ink-3">{f.code}</span></li>
          ))}
          {a.findings.length > 12 && <li className="text-xs text-ink-3">+ {a.findings.length - 12} more in the exported report</li>}
        </ul>
      </Glass>
    </div>
  );
}
