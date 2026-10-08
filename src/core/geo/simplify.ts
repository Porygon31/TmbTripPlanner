import { lineString, simplify } from '@turf/turf';
import type { LatLon } from '../types';

/**
 * Simplification Douglas-Peucker (Turf.js) réservée à l'affichage.
 * Les données d'origine restent intactes pour les calculs et l'export GPX.
 * `toleranceMeters` est converti approximativement en degrés.
 */
export function simplifyForDisplay(points: readonly LatLon[], toleranceMeters = 2): [number, number][] {
  if (points.length < 3) return points.map((p) => [p.lat, p.lon]);
  const line = lineString(points.map((p) => [p.lon, p.lat]));
  const simplified = simplify(line, { tolerance: toleranceMeters / 111_320, highQuality: false, mutate: true });
  return simplified.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
}
