import { standardClassSchema, type StandardClassId } from '@toll-e/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { KEYS, readJson, writeJson } from './storage';

const preferencesSchema = z.object({
  defaultClass: standardClassSchema.default('class1'),
  /** Personalised ads are off unless the user opts in. */
  personalisedAds: z.boolean().default(false),
  /** Development builds only: use the simulated store to exercise purchase states. */
  simulatedStore: z.boolean().default(false),
});
export type Preferences = z.infer<typeof preferencesSchema>;

const DEFAULTS: Preferences = { defaultClass: 'class1', personalisedAds: false, simulatedStore: false };

interface PreferencesState extends Preferences {
  loaded: boolean;
  update: (patch: Partial<Preferences>) => void;
}

const Ctx = createContext<PreferencesState | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void readJson(KEYS.preferences, preferencesSchema).then((stored) => {
      if (stored) setPrefs(stored);
      setLoaded(true);
    });
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void writeJson(KEYS.preferences, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...prefs, loaded, update }), [prefs, loaded, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreferences(): PreferencesState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}

export type { StandardClassId };
