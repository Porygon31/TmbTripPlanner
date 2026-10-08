import type { LatLon } from '../types';

/** Rayon terrestre moyen (m), identique à celui de Turf.js. */
export const EARTH_RADIUS = 6371008.8;
const RAD = Math.PI / 180;

/** Distance orthodromique (formule de haversine), en mètres. */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Distances cumulées depuis le premier point (m). `result[0] === 0`. */
export function cumulativeDistances(points: readonly LatLon[]): Float64Array {
  const cum = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) {
    cum[i] = cum[i - 1] + haversine(points[i - 1], points[i]);
  }
  return cum;
}

export function pathLength(points: readonly LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
  return total;
}

/** Emprise [ouest, sud, est, nord]. */
export function bbox(points: readonly LatLon[]): [number, number, number, number] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    if (p.lon < w) w = p.lon;
    if (p.lon > e) e = p.lon;
    if (p.lat < s) s = p.lat;
    if (p.lat > n) n = p.lat;
  }
  return [w, s, e, n];
}

/**
 * Aire signée (formule du lacet, en degrés²) du polygone fermé formé par les points.
 * Positive quand le tracé tourne dans le sens antihoraire (carte orientée au nord).
 */
export function signedArea(points: readonly LatLon[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.lon * b.lat - b.lon * a.lat;
  }
  return area / 2;
}
