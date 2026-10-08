import type { LatLon, RoutePoint } from '../types';
import { EARTH_RADIUS, haversine } from './distance';

const RAD = Math.PI / 180;

export interface PolylineProjection {
  /** Indice du point de début du segment [index, index + 1] contenant la projection. */
  index: number;
  /** Position dans ce segment (0 à 1). */
  t: number;
  point: RoutePoint;
  /** Abscisse curviligne de la projection (m). */
  distanceAlong: number;
  /** Distance entre le point projeté et la polyligne (m). */
  offset: number;
}

function interpolateEle(a: number | null, b: number | null, t: number): number | null {
  if (a !== null && b !== null) return a + (b - a) * t;
  if (a !== null && t < 0.5) return a;
  if (b !== null) return b;
  return a;
}

export function interpolate(a: RoutePoint, b: RoutePoint, t: number): RoutePoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    ele: interpolateEle(a.ele, b.ele, t),
  };
}

/**
 * Projette `p` sur la polyligne (projection plane locale, précise à l'échelle d'un segment).
 * `fromIndex`/`toIndex` permettent de restreindre la recherche à une fenêtre de points.
 */
export function projectOnPolyline(
  points: readonly RoutePoint[],
  cum: Float64Array,
  p: LatLon,
  fromIndex = 0,
  toIndex = points.length - 1,
): PolylineProjection | null {
  if (points.length === 0) return null;
  if (points.length === 1 || fromIndex >= toIndex) {
    const q = points[Math.min(fromIndex, points.length - 1)];
    return { index: fromIndex, t: 0, point: { ...q }, distanceAlong: cum[fromIndex] ?? 0, offset: haversine(p, q) };
  }
  const kx = Math.cos(p.lat * RAD) * RAD * EARTH_RADIUS;
  const ky = RAD * EARTH_RADIUS;
  let best = -1;
  let bestT = 0;
  let bestD2 = Infinity;
  for (let i = fromIndex; i < toIndex; i++) {
    const a = points[i];
    const b = points[i + 1];
    const ax = (a.lon - p.lon) * kx;
    const ay = (a.lat - p.lat) * ky;
    const dx = (b.lon - a.lon) * kx;
    const dy = (b.lat - a.lat) * ky;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const x = ax + t * dx;
    const y = ay + t * dy;
    const d2 = x * x + y * y;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
      bestT = t;
    }
  }
  const a = points[best];
  const b = points[best + 1];
  const point = interpolate(a, b, bestT);
  return {
    index: best,
    t: bestT,
    point,
    distanceAlong: cum[best] + (cum[best + 1] - cum[best]) * bestT,
    offset: haversine(p, point),
  };
}

/** Indice du segment contenant l'abscisse `d` (recherche dichotomique). */
export function segmentIndexAtDistance(cum: Float64Array, d: number): number {
  const n = cum.length;
  if (n < 2) return 0;
  if (d <= 0) return 0;
  if (d >= cum[n - 1]) return n - 2;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Point interpolé à l'abscisse curviligne `d`. */
export function pointAtDistance(points: readonly RoutePoint[], cum: Float64Array, d: number): RoutePoint {
  if (points.length === 0) throw new Error('Trace vide');
  if (points.length === 1) return { ...points[0] };
  const i = segmentIndexAtDistance(cum, d);
  const len = cum[i + 1] - cum[i];
  const t = len > 0 ? Math.min(1, Math.max(0, (d - cum[i]) / len)) : 0;
  return interpolate(points[i], points[i + 1], t);
}

/**
 * Extrait la portion de trace entre deux abscisses, dans le sens `start → end`.
 * Si `start > end`, la portion est renvoyée à l'envers. Les extrémités sont interpolées.
 */
export function sliceByDistance(
  points: readonly RoutePoint[],
  cum: Float64Array,
  start: number,
  end: number,
): RoutePoint[] {
  if (points.length === 0) return [];
  const total = cum[cum.length - 1];
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(total, Math.max(start, end));
  const out: RoutePoint[] = [pointAtDistance(points, cum, lo)];
  for (let i = 0; i < points.length; i++) {
    if (cum[i] > lo && cum[i] < hi) out.push(points[i]);
  }
  const last = pointAtDistance(points, cum, hi);
  if (hi > lo) out.push(last);
  return start > end ? out.reverse() : out;
}

/** Indice du point le plus proche (recherche linéaire, adaptée au survol). */
export function nearestPointIndex(points: readonly LatLon[], p: LatLon): number {
  const k = Math.cos(p.lat * RAD);
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dx = (points[i].lon - p.lon) * k;
    const dy = points[i].lat - p.lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
