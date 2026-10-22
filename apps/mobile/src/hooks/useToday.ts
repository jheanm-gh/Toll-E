import { useEffect, useState } from 'react';

import { saLocalDate } from '@toll-e/core';

/** Today's date in South Africa, updated when the date rolls over. */
export function useToday(): string {
  const [today, setToday] = useState(() => saLocalDate());
  useEffect(() => {
    const id = setInterval(() => {
      const now = saLocalDate();
      setToday((prev) => (prev === now ? prev : now));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}
