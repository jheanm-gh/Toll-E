import { standardClassSchema } from '@toll-e/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { KEYS, readJson, writeJson } from './storage';

export const calculationRequestSchema = z.object({
  mode: z.enum(['journey', 'manual']),
  journeyId: z.string().optional(),
  plazaIds: z.array(z.string()).default([]),
  includeConditional: z.array(z.string()).default([]),
  trip: z.enum(['one_way', 'return']),
  standardClass: standardClassSchema,
  /** null = "today" when reopened */
  date: z.string().nullable(),
});
export type CalculationRequest = z.infer<typeof calculationRequestSchema>;

const savedCalculationSchema = z.object({
  id: z.string(),
  savedAt: z.string(),
  label: z.string(),
  request: calculationRequestSchema,
  /** What the result was when saved, so changes can be pointed out later. */
  snapshot: z.object({
    totalCents: z.number().int(),
    confidence: z.enum(['confirmed', 'estimate', 'partial', 'unavailable']),
    pricedCount: z.number().int(),
    chargeableCount: z.number().int(),
    tariffDate: z.string(),
    datasetVersion: z.string(),
  }),
});
export type SavedCalculation = z.infer<typeof savedCalculationSchema>;

const savedSchema = z.object({
  favouritePlazaIds: z.array(z.string()).default([]),
  savedCalculations: z.array(savedCalculationSchema).default([]),
  recentCalculations: z.array(savedCalculationSchema).default([]),
  recentPlazaIds: z.array(z.string()).default([]),
});
type Saved = z.infer<typeof savedSchema>;

const EMPTY: Saved = { favouritePlazaIds: [], savedCalculations: [], recentCalculations: [], recentPlazaIds: [] };
const MAX_SAVED = 50;
const MAX_RECENT = 10;

interface SavedState extends Saved {
  loaded: boolean;
  isFavourite: (plazaId: string) => boolean;
  toggleFavourite: (plazaId: string) => boolean;
  saveCalculation: (c: Omit<SavedCalculation, 'id' | 'savedAt'>) => void;
  removeCalculation: (id: string) => void;
  recordRecentCalculation: (c: Omit<SavedCalculation, 'id' | 'savedAt'>) => void;
  recordPlazaView: (plazaId: string) => void;
  /** Clears history: recent calculations, recently viewed plazas, or both (the default). */
  clearRecent: (what?: 'calculations' | 'plazas') => void;
  /** Deletes everything this provider stores: saved trips, favourites and history. */
  clearAll: () => void;
}

const Ctx = createContext<SavedState | null>(null);
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const sameRequest = (a: CalculationRequest, b: CalculationRequest) => JSON.stringify(a) === JSON.stringify(b);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void readJson(KEYS.saved, savedSchema).then((s) => {
      if (s) setSaved(s);
      setLoaded(true);
    });
  }, []);

  const mutate = useCallback((fn: (s: Saved) => Saved) => {
    setSaved((prev) => {
      const next = fn(prev);
      void writeJson(KEYS.saved, next);
      return next;
    });
  }, []);

  const value = useMemo<SavedState>(
    () => ({
      ...saved,
      loaded,
      isFavourite: (id) => saved.favouritePlazaIds.includes(id),
      toggleFavourite: (id) => {
        const willBeFavourite = !saved.favouritePlazaIds.includes(id);
        mutate((s) => ({
          ...s,
          favouritePlazaIds: willBeFavourite
            ? [id, ...s.favouritePlazaIds]
            : s.favouritePlazaIds.filter((x) => x !== id),
        }));
        return willBeFavourite;
      },
      saveCalculation: (c) =>
        mutate((s) => ({
          ...s,
          savedCalculations: [{ ...c, id: newId(), savedAt: new Date().toISOString() }, ...s.savedCalculations].slice(
            0,
            MAX_SAVED,
          ),
        })),
      removeCalculation: (id) =>
        mutate((s) => ({
          ...s,
          savedCalculations: s.savedCalculations.filter((x) => x.id !== id),
          recentCalculations: s.recentCalculations.filter((x) => x.id !== id),
        })),
      recordRecentCalculation: (c) =>
        mutate((s) => ({
          ...s,
          recentCalculations: [
            { ...c, id: newId(), savedAt: new Date().toISOString() },
            ...s.recentCalculations.filter((x) => !sameRequest(x.request, c.request)),
          ].slice(0, MAX_RECENT),
        })),
      recordPlazaView: (id) =>
        mutate((s) =>
          s.recentPlazaIds[0] === id
            ? s
            : { ...s, recentPlazaIds: [id, ...s.recentPlazaIds.filter((x) => x !== id)].slice(0, MAX_RECENT) },
        ),
      clearRecent: (what) =>
        mutate((s) => ({
          ...s,
          recentCalculations: what === 'plazas' ? s.recentCalculations : [],
          recentPlazaIds: what === 'calculations' ? s.recentPlazaIds : [],
        })),
      clearAll: () => mutate(() => EMPTY),
    }),
    [saved, loaded, mutate],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSaved(): SavedState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSaved must be used inside SavedProvider');
  return ctx;
}
