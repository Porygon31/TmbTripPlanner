import type { ElevationPoint, RoutePoint, RouteStatistics } from '../types';
import { cumulativeDistances } from '../geo/distance';
import { walkingTimeHours } from './time';

/**
 * Seuil d'hystérésis (m) pour le cumul du dénivelé : une variation n'est comptée
 * qu'une fois dépassé ce seuil, ce qui évite de cumuler le bruit des altitudes GPS/MNT.
 */
export const ELEVATION_THRESHOLD = 5;

export interface AscentDescent {
  ascent: number;
  descent: number;
}

/** Dénivelés positif et négatif par hystérésis. Les altitudes `null` sont ignorées. */
export function ascentDescent(elevations: Iterable<number | null>, threshold = ELEVATION_THRESHOLD): AscentDescent {
  let ascent = 0;
  let descent = 0;
  let ref: number | null = null;
  let last: number | null = null;
  for (const e of elevations) {
    if (e === null || Number.isNaN(e)) continue;
    last = e;
    if (ref === null) {
      ref = e;
      continue;
    }
    const diff = e - ref;
    if (diff >= threshold) {
      ascent += diff;
      ref = e;
    } else if (diff <= -threshold) {
      descent -= diff;
      ref = e;
    }
  }
  // Reliquat final (inférieur au seuil) : garantit D+ − D- = altitude d'arrivée − altitude de départ.
  if (ref !== null && last !== null) {
    if (last > ref) ascent += last - ref;
    else descent += ref - last;
  }
  return { ascent, descent };
}

/** Filtre le bruit du MNT à distance régulière, sans changer les points de la trace. */
function filteredAscentDescent(points: readonly RoutePoint[], cum: Float64Array, from: number, to: number): AscentDescent {
  let ascent = 0;
  let descent = 0;
  let samples: number[] = [];
  let previous: number | null = null;
  let previousDistance = 0;
  let nextSample = 0;

  const flush = () => {
    if (previous !== null && samples[samples.length - 1] !== previous) samples.push(previous);
    // Médiane sur cinq échantillons espacés de 25 m ; extrémités conservées.
    const filtered = samples.map((ele, i) => {
      if (i === 0 || i === samples.length - 1) return ele;
      const window = samples.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b);
      return window[Math.floor(window.length / 2)];
    });
    const change = ascentDescent(filtered);
    ascent += change.ascent;
    descent += change.descent;
    samples = [];
    previous = null;
  };

  for (let i = from; i <= to; i++) {
    const ele = points[i].ele;
    if (ele === null || !Number.isFinite(ele)) {
      flush();
      continue;
    }
    if (previous === null) {
      samples.push(ele);
      nextSample = cum[i] + 25;
    } else {
      const length = cum[i] - previousDistance;
      while (length > 0 && nextSample <= cum[i]) {
        samples.push(previous + (ele - previous) * (nextSample - previousDistance) / length);
        nextSample += 25;
      }
    }
    previous = ele;
    previousDistance = cum[i];
  }
  flush();
  return { ascent, descent };
}

/**
 * Statistiques complètes d'une portion `[from, to]` (indices inclus) d'une suite de points.
 * `cum` (distances cumulées) peut être fourni pour éviter de le recalculer.
 */
export function computeStatistics(
  points: readonly RoutePoint[],
  cum: Float64Array = cumulativeDistances(points),
  from = 0,
  to = points.length - 1,
): RouteStatistics {
  if (points.length === 0 || to < from) {
    return {
      distance: 0,
      ascent: 0,
      descent: 0,
      minEle: null,
      maxEle: null,
      pointCount: 0,
      elevationCoverage: 0,
      durationHours: 0,
    };
  }
  let minEle: number | null = null;
  let maxEle: number | null = null;
  let withEle = 0;
  for (let i = from; i <= to; i++) {
    const e = points[i].ele;
    if (e === null) continue;
    withEle++;
    if (minEle === null || e < minEle) minEle = e;
    if (maxEle === null || e > maxEle) maxEle = e;
  }
  const { ascent, descent } = filteredAscentDescent(points, cum, from, to);
  const distance = cum[to] - cum[from];
  const count = to - from + 1;
  return {
    distance,
    ascent,
    descent,
    minEle,
    maxEle,
    pointCount: count,
    elevationCoverage: withEle / count,
    durationHours: walkingTimeHours(distance, ascent, descent),
  };
}

/** Profil altimétrique : altitude en fonction de la distance cumulée. */
export function buildProfile(points: readonly RoutePoint[], cum: Float64Array = cumulativeDistances(points)): ElevationPoint[] {
  return points.map((p, i) => ({ distance: cum[i], ele: p.ele, lat: p.lat, lon: p.lon }));
}

/**
 * Pente moyenne maximale (en %, valeur absolue) sur une fenêtre glissante de `window` mètres.
 * Sert à l'estimation de difficulté. Renvoie `null` sans altitude.
 */
export function maxSustainedGradient(
  points: readonly RoutePoint[],
  cum: Float64Array = cumulativeDistances(points),
  window = 200,
): number | null {
  let best: number | null = null;
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].ele === null) continue;
    if (j < i) j = i;
    while (j < points.length - 1 && cum[j] - cum[i] < window) j++;
    const d = cum[j] - cum[i];
    if (d < window * 0.9) break;
    const ej = points[j].ele;
    if (ej === null) continue;
    const g = (Math.abs(ej - (points[i].ele as number)) / d) * 100;
    if (best === null || g > best) best = g;
  }
  return best;
}
