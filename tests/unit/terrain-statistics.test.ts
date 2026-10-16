import { describe, expect, it } from 'vitest';
import { computeStatistics } from '../../src/core/elevation/stats';
import type { RoutePoint } from '../../src/core/types';

describe('statistiques sur les altitudes du terrain', () => {
  it('filtre les pics isolés sans modifier la trace exportable', () => {
    // Montée régulière de 100 m, avec un pic de mesure de 30 m tous les 100 m.
    const points: RoutePoint[] = Array.from({ length: 401 }, (_, i) => ({
      lat: 45.9 + i * 0.0000225,
      lon: 6.8,
      ele: 1000 + i / 4 + (i > 0 && i < 400 && i % 40 === 0 ? 30 : 0),
    }));
    const original = structuredClone(points);
    const stats = computeStatistics(points);
    expect(stats.ascent).toBeCloseTo(100, 0);
    expect(stats.descent).toBeLessThan(1);
    expect(points).toEqual(original);
  });

  it('ne cumule pas un saut entre deux portions sans continuité altimétrique', () => {
    const points: RoutePoint[] = [1000, 1010, null, 1500, 1520].map((ele, i) => ({ lat: 45.9 + i * 0.001, lon: 6.8, ele }));
    const stats = computeStatistics(points);
    expect(stats.ascent).toBe(30);
    expect(stats.descent).toBe(0);
    expect(stats.elevationCoverage).toBe(0.8);
  });
});
