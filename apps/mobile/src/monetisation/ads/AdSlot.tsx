import type { AdPlacementId } from '../config';

/** Web build: no ads are shown in the browser. */
export function AdSlot(_props: { placement: AdPlacementId }) {
  return null;
}
