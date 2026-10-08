import { describe, expect, it } from 'vitest';
import { bbox, cumulativeDistances, haversine, signedArea } from '../../src/core/geo/distance';
import { nearestPointIndex, pointAtDistance, projectOnPolyline, sliceByDistance } from '../../src/core/geo/projection';
import { simplifyForDisplay } from '../../src/core/geo/simplify';
import { line, squareLoop } from './helpers';

describe('distances', () => {
  it('1° de latitude ≈ 111,195 km', () => {
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111194.93, 0);
  });

  it('distances cumulées cohérentes avec la longueur totale', () => {
    const pts = line({ lat: 45.9, lon: 6.8 }, { lat: 45.9, lon: 6.9 }, 50);
    const cum = cumulativeDistances(pts);
    expect(cum[0]).toBe(0);
    expect(cum[cum.length - 1]).toBeCloseTo(haversine(pts[0], pts[pts.length - 1]), 2);
  });

  it('emprise et sens de rotation', () => {
    const loop = squareLoop();
    expect(bbox(loop)).toEqual([6.74, 45.86, 6.8, 45.9]);
    expect(signedArea(loop)).toBeGreaterThan(0); // antihoraire
    expect(signedArea([...loop].reverse())).toBeLessThan(0);
  });
});

describe('projection et découpe', () => {
  const pts = line({ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }, 20);
  const cum = cumulativeDistances(pts);
  const total = cum[cum.length - 1];

  it('projette un point au milieu', () => {
    const proj = projectOnPolyline(pts, cum, { lat: 0.0001, lon: 0.005 })!;
    expect(proj.distanceAlong).toBeCloseTo(total / 2, 0);
    expect(proj.offset).toBeCloseTo(11.12, 1);
  });

  it('découpe par distance, dans les deux sens', () => {
    const s = sliceByDistance(pts, cum, 200, 400);
    expect(haversine(s[0], s[s.length - 1])).toBeCloseTo(200, 1);
    const r = sliceByDistance(pts, cum, 400, 200);
    expect(r[0].lon).toBeCloseTo(s[s.length - 1].lon, 9);
    expect(r[r.length - 1].lon).toBeCloseTo(s[0].lon, 9);
  });

  it('point à une distance donnée', () => {
    const p = pointAtDistance(pts, cum, 500);
    expect(haversine(pts[0], p)).toBeCloseTo(500, 1);
  });

  it('point le plus proche', () => {
    expect(nearestPointIndex(pts, { lat: 0, lon: 0.00999 })).toBe(pts.length - 1);
  });

  it('simplification réservée à l’affichage', () => {
    const simplified = simplifyForDisplay(pts, 2);
    expect(simplified.length).toBe(2);
    expect(pts.length).toBeGreaterThan(10);
  });
});
