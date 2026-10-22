import type { Plaza } from '@toll-e/core';
import type { FeatureCollection, Point } from 'geojson';

import { colors } from '@/theme/tokens';

import outline from './region-outline.json';

/**
 * Map styling shared by the native (MapLibre Native) and web (MapLibre GL JS) maps, so both
 * look and behave the same. Kept as plain style-spec objects.
 */

/** [west, south, east, north] */
export const SOUTH_AFRICA_BOUNDS: [number, number, number, number] = [16.3, -35.0, 33.0, -22.0];

export type MapBaseStatus = 'loading' | 'online' | 'offline' | 'failed';

export const OFFLINE_ATTRIBUTION = 'Boundaries: Natural Earth';

/**
 * A self-contained style used when online tiles cannot load: country outlines only, from
 * bundled Natural Earth data. No network access, no glyphs or sprites required.
 */
export function offlineStyle() {
  return {
    version: 8 as const,
    name: 'Toll-E offline',
    sources: {
      region: {
        type: 'geojson' as const,
        data: outline as unknown as FeatureCollection,
        attribution: OFFLINE_ATTRIBUTION,
      },
    },
    layers: [
      { id: 'background', type: 'background' as const, paint: { 'background-color': '#DCE8EE' } },
      {
        id: 'neighbours',
        type: 'fill' as const,
        source: 'region',
        filter: ['==', ['get', 'home'], false],
        paint: { 'fill-color': '#EFEDE7' },
      },
      {
        id: 'home',
        type: 'fill' as const,
        source: 'region',
        filter: ['==', ['get', 'home'], true],
        paint: { 'fill-color': '#FBFAF6' },
      },
      {
        id: 'borders',
        type: 'line' as const,
        source: 'region',
        paint: { 'line-color': '#B9B5AA', 'line-width': 0.8 },
      },
    ],
  };
}

export interface PlazaFeatureProps {
  id: string;
  name: string;
  route: string;
  kind: 'mainline' | 'other';
  approximate: boolean;
}

export function plazaFeatures(plazas: readonly Plaza[]): FeatureCollection<Point, PlazaFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: plazas
      .filter((p) => p.location)
      .map((p) => ({
        type: 'Feature' as const,
        id: p.id,
        properties: {
          id: p.id,
          name: p.name,
          route: p.route,
          kind: p.type === 'mainline' ? ('mainline' as const) : ('other' as const),
          approximate: p.location!.precision !== 'verified',
        },
        geometry: { type: 'Point' as const, coordinates: [p.location!.lng, p.location!.lat] },
      })),
  };
}

export const PLAZA_SOURCE_ID = 'plazas';
export const PLAZA_LAYER_ID = 'plaza-circle';
export const PLAZA_HALO_LAYER_ID = 'plaza-halo';

export const plazaCirclePaint = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 5.5, 8, 8, 12, 11],
  'circle-color': ['match', ['get', 'kind'], 'mainline', colors.navy900, colors.teal600],
  // An amber ring marks positions that are approximate rather than verified.
  'circle-stroke-color': ['case', ['get', 'approximate'], colors.amber500, colors.white],
  'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 2, 10, 3],
};

export function haloFilter(selectedId: string | null) {
  return ['==', ['get', 'id'], selectedId ?? '__none__'];
}

export const plazaHaloPaint = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 14, 10, 20],
  'circle-color': colors.teal500,
  'circle-opacity': 0.28,
  'circle-stroke-color': colors.teal600,
  'circle-stroke-width': 1.5,
};
