import { useSyncExternalStore } from 'react';

export type RouteId = 'overview' | 'cbs' | 'dism' | 'errors' | 'repair' | 'map' | 'history' | 'reports' | 'settings';
export const ROUTES: RouteId[] = ['overview', 'cbs', 'dism', 'errors', 'repair', 'map', 'history', 'reports', 'settings'];

function read(): { route: RouteId; params: URLSearchParams } {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const route = (ROUTES as string[]).includes(path) ? (path as RouteId) : 'overview';
  return { route, params: new URLSearchParams(query) };
}

let snapshot = read();
const listeners = new Set<() => void>();
window.addEventListener('hashchange', () => {
  snapshot = read();
  listeners.forEach((l) => l());
});

export function navigate(route: RouteId, params?: Record<string, string>) {
  const q = params ? `?${new URLSearchParams(params)}` : '';
  location.hash = `/${route}${q}`;
}

export function useRoute() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => snapshot,
  );
}
