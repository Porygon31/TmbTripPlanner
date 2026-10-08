import { DOMParser } from '@xmldom/xmldom';
import { haversine } from '../../src/core/geo/distance';
import type { LatLon, RoutePoint } from '../../src/core/types';
import type { XmlParser } from '../../src/core/gpx/parse';

/** Analyseur XML pour Node (le navigateur utilise son DOMParser natif). */
export const xmlParser: XmlParser = new DOMParser() as unknown as XmlParser;

/** Ligne droite synthétique de `a` à `b`, découpée tous les `step` mètres environ. */
export function line(a: LatLon, b: LatLon, step = 25, ele: (t: number) => number | null = () => null): RoutePoint[] {
  const n = Math.max(1, Math.round(haversine(a, b) / step));
  const out: RoutePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, ele: ele(t) });
  }
  return out;
}

/** Concatène des lignes en supprimant les points en double aux raccords. */
export function chain(...parts: RoutePoint[][]): RoutePoint[] {
  const out: RoutePoint[] = [];
  for (const p of parts) {
    for (const q of p) {
      const last = out[out.length - 1];
      if (last && haversine(last, q) < 0.01) continue;
      out.push(q);
    }
  }
  return out;
}

export function maxStep(points: LatLon[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m = Math.max(m, haversine(points[i - 1], points[i]));
  return m;
}

/**
 * Boucle carrée SYNTHÉTIQUE (FIXTURE de test, pas un vrai tracé) parcourue dans le sens antihoraire :
 * A (NE) → B (NO) → C (SO) → D (SE) → A.
 */
export const A = { lat: 45.9, lon: 6.8 };
export const B = { lat: 45.9, lon: 6.74 };
export const C = { lat: 45.86, lon: 6.74 };
export const D = { lat: 45.86, lon: 6.8 };

export function squareLoop(): RoutePoint[] {
  const e = (base: number, delta: number) => (t: number) => base + delta * t;
  return chain(line(A, B, 25, e(1000, 500)), line(B, C, 25, e(1500, 500)), line(C, D, 25, e(2000, -600)), line(D, A, 25, e(1400, -400)));
}
