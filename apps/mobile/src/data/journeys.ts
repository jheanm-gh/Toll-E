import { offeredJourneys, type Journey } from '@toll-e/core';
import { useMemo } from 'react';

import { env } from '@/config/env';

import { useData } from './DataProvider';

/** Journeys this build offers (see offeredJourneys); unverified sequences only in test builds. */
export function useOfferedJourneys(): Journey[] {
  const { dataset } = useData();
  return useMemo(
    () => offeredJourneys(dataset.journeys, { includeUnverifiedSequences: env.showUnverifiedJourneys }),
    [dataset.journeys],
  );
}
