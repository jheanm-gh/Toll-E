import { describe, expect, it } from 'vitest';

import {
  buildTariffIndex,
  calculate,
  directionFromBearing,
  matchRouteToPlazas,
  matchToEvents,
  projectOntoPolyline,
} from '../src';
import { TODAY, dataset, plaza, tariff } from './fixtures';

/*
 * A synthetic straight route heading due south along longitude 28.0 from -26.0 to -27.0
 * (about 111 km), tagged as N9. Plaza positions are placed at known offsets.
 */
const route = {
  points: [
    { lat: -26.0, lng: 28.0 },
    { lat: -26.5, lng: 28.0 },
    { lat: -27.0, lng: 28.0 },
  ],
  roadRefs: [{ fromIndex: 0, toIndex: 2, ref: 'N9' }],
  attribution: 'test',
};
const v = (lat: number, lng: number) => ({ lat, lng, precision: 'verified' as const, sourceIds: ['src-official'] });
const a = (lat: number, lng: number) => ({ lat, lng, precision: 'approximate' as const, sourceIds: ['src-official'] });

const ds = dataset({
  plazas: [
    plaza('p-on', { location: v(-26.3, 28.0005) }), // ~50 m east of the line
    plaza('p-later', { location: v(-26.8, 28.0) }),
    plaza('p-off', { location: v(-26.4, 28.05) }), // ~5 km away
    plaza('p-other-road', { route: 'N1', location: v(-26.6, 28.001) }), // ~100 m, different road
    plaza('p-ramp', { type: 'ramp', location: v(-26.2, 28.0) }),
    plaza('p-approx', { location: a(-26.7, 28.01) }), // ~1 km, approximate position
    plaza('p-unlocated'),
  ],
  tariffs: [tariff('p-on', 'class1', 1000), tariff('p-later', 'class1', 2000), tariff('p-ramp', 'class1', 500)],
});

describe('projectOntoPolyline', () => {
  it('measures distance to the line and progress along it', () => {
    const p = projectOntoPolyline({ lat: -26.5, lng: 28.01 }, route.points)!;
    expect(p.distanceMetres).toBeGreaterThan(950);
    expect(p.distanceMetres).toBeLessThan(1050); // 0.01° of longitude at 26.5°S ≈ 995 m
    expect(p.alongMetres).toBeGreaterThan(55_000);
    expect(p.alongMetres).toBeLessThan(56_000);
    expect(directionFromBearing(p.segmentBearing)).toBe('southbound');
  });
});

describe('matchRouteToPlazas', () => {
  const match = matchRouteToPlazas(ds, route);
  const byId = Object.fromEntries(match.candidates.map((c) => [c.plazaId, c]));

  it('orders candidates along the route', () => {
    expect(match.candidates.map((c) => c.plazaId)).toEqual(['p-ramp', 'p-on', 'p-approx', 'p-later']);
  });
  it('confidently matches verified mainline plazas on the same road', () => {
    expect(byId['p-on']?.confidence).toBe('high');
    expect(byId['p-later']?.confidence).toBe('high');
    expect(byId['p-on']?.direction).toBe('southbound');
  });
  it('does not match plazas far from the route or on another road', () => {
    expect(byId['p-off']).toBeUndefined();
    expect(byId['p-other-road']).toBeUndefined();
  });
  it('never auto-confirms ramps or approximate positions', () => {
    expect(byId['p-ramp']?.confidence).toBe('low');
    expect(byId['p-approx']?.confidence).toBe('low');
    expect(match.needsConfirmation).toBe(true);
  });
  it('lists unlocated plazas on roads the route uses', () => {
    expect(match.unlocatedOnRoute).toEqual(['p-unlocated']);
  });
  it('charges only confident matches until the user confirms the rest', () => {
    const events = matchToEvents(match, new Map(ds.plazas.map((p) => [p.id, p])));
    const r = calculate(buildTariffIndex(ds), {
      mode: 'manual',
      sequenceVerified: false,
      outbound: events,
      trip: 'one_way',
      standardClass: 'class1',
      date: TODAY,
    });
    expect(r.totalCents).toBe(3000); // p-on R10 + p-later R20; ramp excluded until confirmed
    expect(r.lines.find((l) => l.plazaId === 'p-ramp')?.status).toBe('excluded');
  });
  it('treats a route without road identity as needing confirmation', () => {
    const m = matchRouteToPlazas(ds, { points: route.points, attribution: 'test' });
    expect(m.needsConfirmation).toBe(true);
    expect(m.candidates.every((c) => c.confidence === 'low')).toBe(true);
  });
});
