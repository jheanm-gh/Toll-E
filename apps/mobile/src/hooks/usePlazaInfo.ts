import {
  STANDARD_CLASSES,
  resolveStandardTariff,
  weakestTrust,
  type Operator,
  type Plaza,
  type StandardClassId,
  type TariffResolution,
  type TollRoad,
  type Trust,
} from '@toll-e/core';
import { useMemo } from 'react';

import { useData } from '@/data/DataProvider';

import { useToday } from './useToday';

export interface PlazaInfo {
  plaza: Plaza;
  operator: Operator | undefined;
  road: TollRoad | undefined;
  byClass: Record<StandardClassId, TariffResolution & { vehicleClassId: string | null }>;
  /** Weakest trust over the classes that have a current tariff; 'unavailable' if none. */
  overallTrust: Trust | 'unavailable';
  pricedClasses: number;
  supportedClasses: number;
}

export function computePlazaInfo(data: ReturnType<typeof useData>, plaza: Plaza, date: string): PlazaInfo {
  const { dataset, index } = data;
  const byClass = Object.fromEntries(
    STANDARD_CLASSES.map((c) => [c, resolveStandardTariff(index, plaza.id, c, { date })]),
  ) as PlazaInfo['byClass'];
  const current = STANDARD_CLASSES.map((c) => byClass[c]).filter((r) => r.kind === 'current');
  const trust = weakestTrust(current.map((r) => (r.kind === 'current' ? r.trust : 'unverified')));
  return {
    plaza,
    operator: dataset.operators.find((o) => o.id === plaza.operatorId),
    road: dataset.tollRoads.find((r) => r.id === plaza.tollRoadId),
    byClass,
    overallTrust: trust ?? 'unavailable',
    pricedClasses: current.length,
    supportedClasses: STANDARD_CLASSES.filter((c) => {
      const r = byClass[c];
      return !(r.kind === 'none' && r.reason === 'class_not_supported');
    }).length,
  };
}

export function usePlazaInfo(plaza: Plaza | undefined): PlazaInfo | null {
  const data = useData();
  const today = useToday();
  return useMemo(() => (plaza ? computePlazaInfo(data, plaza, today) : null), [data, plaza, today]);
}
