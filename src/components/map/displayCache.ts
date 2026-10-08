import type { LatLngTuple } from 'leaflet';
import { simplifyForDisplay } from '../../core/geo/simplify';
import type { RoutePoint } from '../../core/types';

const cache = new WeakMap<RoutePoint[], LatLngTuple[]>();

/** Géométrie simplifiée (~2 m) pour l'affichage, mémoïsée par tableau de points. */
export function displayLine(points: RoutePoint[]): LatLngTuple[] {
  let line = cache.get(points);
  if (!line) {
    line = points.length > 50 ? (simplifyForDisplay(points, 2) as LatLngTuple[]) : points.map((p) => [p.lat, p.lon] as LatLngTuple);
    cache.set(points, line);
  }
  return line;
}
