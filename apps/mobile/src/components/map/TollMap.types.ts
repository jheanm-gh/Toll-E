import type { LatLng, Plaza } from '@toll-e/core';

import type { MapBaseStatus } from './map-style';

export interface TollMapProps {
  /** Plazas to show. Those without a position are skipped. */
  plazas: readonly Plaza[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** When set, the camera moves here. */
  focus?: LatLng | null;
  onStatusChange?: (status: MapBaseStatus) => void;
}
