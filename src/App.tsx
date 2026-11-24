import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { lazy, Suspense, useEffect } from 'react';
import { ParseOverlay } from '@/components/ParseOverlay';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Shell } from '@/layout/Shell';
import { NAV } from '@/layout/nav';
import { ROUTES, useRoute, type RouteId } from '@/lib/router';
import { useApp, useReducedMotion } from '@/store/app';

const PAGES: Record<RouteId, React.LazyExoticComponent<React.ComponentType>> = {
  overview: lazy(() => import('@/pages/Overview')),
  cbs: lazy(() => import('@/pages/Analyzer').then((m) => ({ default: () => <m.default source="cbs" /> }))),
  dism: lazy(() => import('@/pages/Analyzer').then((m) => ({ default: () => <m.default source="dism" /> }))),
  errors: lazy(() => import('@/pages/ErrorExplorer')),
  repair: lazy(() => import('@/pages/RepairCenter')),
  map: lazy(() => import('@/pages/SystemMap')),
  history: lazy(() => import('@/pages/History')),
  reports: lazy(() => import('@/pages/Reports')),
  settings: lazy(() => import('@/pages/Settings')),
};

// Prefetch page chunks when idle so navigation is instant.
function usePrefetch() {
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
    idle(() => {
      import('@/pages/Analyzer'); import('@/pages/ErrorExplorer'); import('@/pages/RepairCenter');
      import('@/pages/SystemMap'); import('@/pages/History'); import('@/pages/Reports'); import('@/pages/Settings');
    });
  }, []);
}

let lastIndex = 0;

export default function App() {
  const { route } = useRoute();
  const reduced = useReducedMotion();
  const refreshHistory = useApp((s) => s.refreshHistory);
  const Page = PAGES[route];
  const index = ROUTES.indexOf(route);
  // Contextual direction: moving down the nav slides up, moving up slides down.
  const dir = index >= lastIndex ? 1 : -1;
  lastIndex = index;
  usePrefetch();
  useEffect(() => { refreshHistory(); }, [refreshHistory]);
  useEffect(() => {
    const label = NAV.find((n) => n.id === route)?.label ?? 'Overview';
    document.title = `${label} · CBS & DISM Diagnostic Studio`;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [route]);
  useEffect(() => { document.documentElement.classList.toggle('reduce-motion', reduced); }, [reduced]);
  // Keep keyboard users oriented: if the control they used unmounted (e.g. the
  // dropzone after loading logs), move focus to the main region instead of <body>.
  const analysisId = useApp((s) => s.analysis?.id);
  useEffect(() => {
    if (!analysisId) return;
    const t = setTimeout(() => {
      if (document.activeElement === document.body) document.getElementById('main')?.focus({ preventScroll: true });
    }, 400);
    return () => clearTimeout(t);
  }, [analysisId]);

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <TooltipProvider delayDuration={250}>
        <Shell>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={route}
              initial={{ opacity: 0, y: 14 * dir, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10 * dir, filter: 'blur(4px)' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={<div className="h-[60vh]" aria-busy="true" />}>
                <Page />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </Shell>
        <ParseOverlay />
      </TooltipProvider>
    </MotionConfig>
  );
}
