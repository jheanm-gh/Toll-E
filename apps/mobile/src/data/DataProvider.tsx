import {
  buildTariffIndex,
  compareDatasetVersions,
  parseAndValidate,
  saLocalDate,
  type Dataset,
  type TariffIndex,
} from '@toll-e/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { backendConfigured } from '@/config/env';
import { useOnline } from '@/hooks/useOnline';
import { KEYS, readJson, writeJson } from '@/state/storage';

import bundledJson from './generated/dataset.json';
import { fetchPublishedDataset } from './remote';

/**
 * Where the data on screen came from. These are shown to the user verbatim:
 * - bundled  shipped inside this version of the app
 * - cached   downloaded earlier and stored on this device
 * - live     downloaded from the Toll-E server during this session
 */
export type DataOrigin = 'bundled' | 'cached' | 'live';

export interface DataState {
  dataset: Dataset;
  index: TariffIndex;
  origin: DataOrigin;
  /** When the current data was downloaded (null for bundled data). */
  retrievedAt: string | null;
  refreshing: boolean;
  lastError: string | null;
  remoteConfigured: boolean;
  refresh: () => Promise<void>;
}

const bundled = bundledJson as unknown as Dataset;
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

const cacheSchema = z.object({ retrievedAt: z.string(), dataset: z.unknown() });

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ dataset: Dataset; origin: DataOrigin; retrievedAt: string | null }>({
    dataset: bundled,
    origin: 'bundled',
    retrievedAt: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const online = useOnline();
  const inFlight = useRef(false);

  // Load a previously downloaded dataset, if it is valid and at least as new as the bundle.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await readJson(KEYS.datasetCache, cacheSchema);
      if (!cached || cancelled) return;
      const { dataset, issues } = parseAndValidate(cached.dataset, { today: saLocalDate() });
      if (!dataset || issues.some((i) => i.severity === 'error')) return;
      if (compareDatasetVersions(dataset.datasetVersion, bundled.datasetVersion) < 0) return;
      setState({ dataset, origin: 'cached', retrievedAt: cached.retrievedAt });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!backendConfigured || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const dataset = await fetchPublishedDataset();
      const retrievedAt = new Date().toISOString();
      setState((prev) =>
        compareDatasetVersions(dataset.datasetVersion, prev.dataset.datasetVersion) >= 0
          ? { dataset, origin: 'live', retrievedAt }
          : prev,
      );
      setLastError(null);
      await writeJson(KEYS.datasetCache, { retrievedAt, dataset });
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'Could not update toll data');
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  // Refresh when online and the data is older than the refresh interval.
  useEffect(() => {
    if (!backendConfigured || online === false) return;
    const age = state.retrievedAt ? Date.now() - Date.parse(state.retrievedAt) : Number.POSITIVE_INFINITY;
    if (state.origin === 'live' || age <= REFRESH_AFTER_MS) return;
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [online, refresh, state.origin, state.retrievedAt]);

  const index = useMemo(() => buildTariffIndex(state.dataset), [state.dataset]);
  const value = useMemo<DataState>(
    () => ({ ...state, index, refreshing, lastError, remoteConfigured: backendConfigured, refresh }),
    [state, index, refreshing, lastError, refresh],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

/** Convenience lookups. */
export function usePlaza(id: string | undefined) {
  const { dataset } = useData();
  return useMemo(() => dataset.plazas.find((p) => p.id === id), [dataset, id]);
}
