import { describe, expect, it } from 'vitest';
import { ascentDescent, computeStatistics, maxSustainedGradient } from '../../src/core/elevation/stats';
import { walkingTimeHours } from '../../src/core/elevation/time';
import { estimateDifficulty, configuredDifficulty } from '../../src/core/variants/difficulty';
import { line } from './helpers';

describe('dénivelé', () => {
  it('ignore le bruit inférieur au seuil', () => {
    const elevs: number[] = [];
    for (let i = 0; i <= 100; i++) elevs.push(1000 + i + (i % 2 === 0 ? 2 : -2));
    const { ascent, descent } = ascentDescent(elevs);
    expect(ascent).toBeGreaterThan(95);
    expect(ascent).toBeLessThan(105);
    expect(descent).toBe(0);
    expect(ascent - descent).toBe(elevs[elevs.length - 1] - elevs[0]);
  });

  it('cumule montées et descentes', () => {
    const { ascent, descent } = ascentDescent([1000, 1200, 1100, 1500, 1000]);
    expect(ascent).toBe(600);
    expect(descent).toBe(600);
  });

  it('ignore les altitudes inconnues', () => {
    expect(ascentDescent([null, 1000, null, 1100])).toEqual({ ascent: 100, descent: 0 });
  });

  it('compte le reliquat final sous le seuil', () => {
    expect(ascentDescent([1000, 1003])).toEqual({ ascent: 3, descent: 0 });
  });
});

describe('statistiques', () => {
  it('distance, D+, D-, min, max, temps', () => {
    const up = line({ lat: 45.9, lon: 6.8 }, { lat: 45.9, lon: 6.85 }, 20, (t) => 1000 + 500 * t);
    const stats = computeStatistics(up);
    expect(stats.distance).toBeCloseTo(3871, -1);
    expect(stats.ascent).toBeCloseTo(500, 0);
    expect(stats.descent).toBe(0);
    expect(stats.minEle).toBe(1000);
    expect(stats.maxEle).toBe(1500);
    expect(stats.elevationCoverage).toBe(1);
    expect(stats.pointCount).toBe(up.length);
  });

  it('sans altitude', () => {
    const flat = line({ lat: 45.9, lon: 6.8 }, { lat: 45.9, lon: 6.81 });
    const stats = computeStatistics(flat);
    expect(stats.minEle).toBeNull();
    expect(stats.elevationCoverage).toBe(0);
  });

  it('pente soutenue maximale', () => {
    const steep = line({ lat: 45.9, lon: 6.8 }, { lat: 45.9, lon: 6.81 }, 10, (t) => 1000 + 300 * t);
    const g = maxSustainedGradient(steep)!;
    expect(g).toBeCloseTo((300 / 774.4) * 100, 0);
  });
});

describe('temps de marche DIN 33466', () => {
  it('12 km, 600 m D+, 600 m D-', () => {
    // horizontal 3 h ; vertical 2 h + 1,2 h = 3,2 h → 3,2 + 3/2 = 4,7 h
    expect(walkingTimeHours(12000, 600, 600)).toBeCloseTo(4.7, 5);
  });
});

describe('difficulté', () => {
  it('estimation automatique', () => {
    const d = estimateDifficulty(
      { distance: 10000, ascent: 1400, descent: 900, minEle: 1200, maxEle: 2665, pointCount: 100, elevationCoverage: 1, durationHours: 5 },
      38,
    );
    expect(d.level).toBe('difficile');
    expect(d.origin).toBe('estimated');
    expect(d.criteria).toHaveLength(3);
  });

  it('non estimable sans altitude', () => {
    const d = estimateDifficulty(
      { distance: 10000, ascent: 0, descent: 0, minEle: null, maxEle: null, pointCount: 100, elevationCoverage: 0, durationHours: 2.5 },
      null,
    );
    expect(d.level).toBeNull();
  });

  it('cotation fournie', () => {
    expect(configuredDifficulty('T3').level).toBe('difficile');
    expect(configuredDifficulty('Très difficile').level).toBe('tres-difficile');
  });
});
