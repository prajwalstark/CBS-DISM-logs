import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Cpu, Menu, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StatusDot } from '@/components/Status';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { navigate, useRoute, type RouteId } from '@/lib/router';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/app';
import { NAV } from './nav';

function NavItem({ id, label, icon: Icon, active, collapsed, onClick, index }: { id: RouteId; label: string; icon: (typeof NAV)[number]['icon']; active: boolean; collapsed?: boolean; onClick?: () => void; index: number }) {
  const link = (
    <a
      href={`#/${id}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-keyshortcuts={`Alt+${index + 1}`}
      className={cn('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-colors duration-base',
        active ? 'text-ink' : 'text-ink-2 hover:text-ink', collapsed && 'justify-center px-0')}
    >
      {active && (
        <motion.span layoutId="nav-indicator" className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/15 to-accent-2/10 shadow-[inset_0_0_0_1px_rgba(0,200,255,0.25)]"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
      )}
      {active && <motion.span layoutId="nav-bar" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent shadow-[0_0_12px_#00C8FF]" />}
      <Icon className={cn('relative size-[18px] shrink-0 transition-transform duration-base group-hover:scale-110', active && 'text-accent')} />
      {!collapsed && <span className="relative truncate">{label}</span>}
    </a>
  );
  return collapsed ? <Tip content={`${label} (Alt+${index + 1})`} side="right">{link}</Tip> : link;
}

export function Shell({ children }: { children: ReactNode }) {
  const { route } = useRoute();
  const analysis = useApp((s) => s.analysis);
  const loadFiles = useApp((s) => s.loadFiles);
  const [sheet, setSheet] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= NAV.length) { e.preventDefault(); navigate(NAV[n - 1].id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setSheet(false), [route]);

  const brand = (collapsed?: boolean) => (
    <a href="#/overview" className={cn('flex items-center gap-2.5 px-2', collapsed && 'justify-center px-0')} aria-label="CBS & DISM Diagnostic Studio home">
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/30 ring-1 ring-white/15">
        <Cpu className="size-5 text-accent" />
        <span className="absolute -inset-1 -z-10 rounded-xl bg-accent/20 blur-md" />
      </span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-bold">Diagnostic Studio</span>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-3">CBS · DISM</span>
        </span>
      )}
    </a>
  );

  return (
    <div className="flex min-h-full">
      <a href="#main" className="sr-only z-50 rounded bg-accent px-3 py-2 text-void focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      {/* Desktop sidebar / tablet rail */}
      <LayoutGroup id="nav-desktop">
        <aside className="sticky top-0 hidden h-screen shrink-0 flex-col gap-6 border-r border-white/[0.06] bg-void/60 p-3 backdrop-blur-xl md:flex md:w-[72px] lg:w-[244px]">
          <div className="pt-2 lg:hidden">{brand(true)}</div>
          <div className="hidden pt-2 lg:block">{brand()}</div>
          <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
            {(['analyse', 'act', 'manage'] as const).map((g) => (
              <div key={g} className="mb-2">
                <div className="label mb-1 hidden px-3 lg:block">{g}</div>
                {NAV.filter((n) => n.group === g).map((n) => (
                  <div key={n.id}>
                    <div className="lg:hidden"><NavItem {...n} index={NAV.indexOf(n)} active={route === n.id} collapsed /></div>
                    <div className="hidden lg:block"><NavItem {...n} index={NAV.indexOf(n)} active={route === n.id} /></div>
                  </div>
                ))}
              </div>
            ))}
          </nav>
          <div className="hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-ink-3 lg:block">
            <kbd className="mono rounded bg-white/10 px-1">Alt</kbd> + <kbd className="mono rounded bg-white/10 px-1">1–9</kbd> to switch views
          </div>
        </aside>
      </LayoutGroup>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-void/70 px-4 backdrop-blur-xl md:px-6">
          <div className="md:hidden">{brand(true)}</div>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {analysis ? (
              <button onClick={() => navigate('overview')} className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-white/5" title={analysis.label}>
                <StatusDot status={analysis.overall.status} />
                <span className="truncate text-sm text-ink">{analysis.label}</span>
                <span className="mono hidden text-ink-3 sm:inline">{analysis.overall.score}/100</span>
              </button>
            ) : (
              <span className="text-sm text-ink-3">No analysis loaded</span>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => file.current?.click()}><Upload /> <span className="hidden sm:inline">Load logs</span></Button>
          <input ref={file} type="file" multiple accept=".log,.txt,text/plain" className="sr-only" tabIndex={-1} aria-hidden
            onChange={(e) => { loadFiles([...(e.target.files || [])]); e.target.value = ''; }} />
        </header>

        <main id="main" tabIndex={-1} className="flex-1 outline-none px-4 pb-28 pt-6 md:px-6 md:pb-10 lg:px-8">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <LayoutGroup id="nav-mobile">
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-void/85 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-xl md:hidden">
          <ul className="grid grid-cols-5">
            {NAV.slice(0, 4).map((n) => {
              const active = route === n.id;
              return (
                <li key={n.id}>
                  <a href={`#/${n.id}`} aria-current={active ? 'page' : undefined} className="relative flex flex-col items-center gap-0.5 py-1.5 text-[10px] text-ink-2">
                    {active && <motion.span layoutId="mnav" className="absolute inset-x-2 inset-y-0 rounded-xl bg-accent/12" />}
                    <n.icon className={cn('relative size-5', active && 'text-accent')} />
                    <span className={cn('relative', active && 'text-ink')}>{n.label.split(' ')[0]}</span>
                  </a>
                </li>
              );
            })}
            <li>
              <button onClick={() => setSheet(true)} aria-expanded={sheet} className="flex w-full flex-col items-center gap-0.5 py-1.5 text-[10px] text-ink-2">
                <Menu className={cn('size-5', NAV.slice(4).some((n) => n.id === route) && 'text-accent')} />More
              </button>
            </li>
          </ul>
        </nav>
      </LayoutGroup>
      <AnimatePresence>
        {sheet && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-void/60 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(false)} />
            <motion.div role="dialog" aria-label="More navigation" className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl glass-strong p-4 pb-8 md:hidden"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="label">More</span>
                <button onClick={() => setSheet(false)} aria-label="Close" className="rounded-md p-1 text-ink-2 hover:bg-white/10"><X className="size-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {NAV.slice(4).map((n) => <NavItem key={n.id} {...n} index={NAV.indexOf(n)} active={route === n.id} />)}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
