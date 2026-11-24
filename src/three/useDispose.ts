import { useEffect } from 'react';

/** Dispose GPU resources created outside JSX (useMemo geometries/textures) when they change or unmount. */
export function useDispose<T extends { dispose: () => void } | null | undefined>(obj: T): T {
  useEffect(() => () => obj?.dispose(), [obj]);
  return obj;
}
