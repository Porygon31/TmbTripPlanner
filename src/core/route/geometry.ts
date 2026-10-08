import { cumulativeDistances, haversine } from '../geo/distance';
import type { LatLon, Route, RoutePoint, RouteSegment } from '../types';

/** Géométrie complète d'un itinéraire, prête pour l'affichage, les statistiques et l'export. */
export interface RouteGeometry {
  points: RoutePoint[];
  cum: Float64Array;
  /** Pour chaque segment : indices [début, fin] (inclus) dans `points`. */
  segmentRanges: [number, number][];
  /** Pour chaque waypoint : indice du point correspondant dans `points`. */
  waypointIndex: number[];
  /** Tous les segments sont calculés. */
  complete: boolean;
}

/** Points « affichables » d'un segment : sa géométrie, ou une ligne droite provisoire. */
export function segmentDisplayPoints(seg: RouteSegment, from: LatLon, to: LatLon): RoutePoint[] {
  if (seg.status === 'ok' && seg.points.length > 0) return seg.points;
  return [
    { lat: from.lat, lon: from.lon, ele: null },
    { lat: to.lat, lon: to.lon, ele: null },
  ];
}

const cache = new WeakMap<RouteSegment[], RouteGeometry>();

/**
 * Concatène les segments en une seule suite de points (en supprimant les doublons aux jonctions).
 * Les segments non calculés sont remplacés par une ligne droite provisoire et `complete` vaut `false`.
 * Résultat mémoïsé par tableau de segments (l'état étant immuable, c'est sûr).
 */
export function buildRouteGeometry(route: Route): RouteGeometry {
  const cached = cache.get(route.segments);
  if (cached && cached.waypointIndex.length === route.waypoints.length) return cached;

  const points: RoutePoint[] = [];
  const segmentRanges: [number, number][] = [];
  const waypointIndex: number[] = [];
  let complete = true;

  if (route.waypoints.length === 1) {
    const w = route.waypoints[0];
    points.push({ lat: w.lat, lon: w.lon, ele: null });
    waypointIndex.push(0);
  }

  route.segments.forEach((seg, i) => {
    if (seg.status !== 'ok') complete = false;
    const pts = segmentDisplayPoints(seg, route.waypoints[i], route.waypoints[i + 1]);
    let start = 0;
    if (points.length > 0 && pts.length > 0 && haversine(points[points.length - 1], pts[0]) < 0.5) start = 1;
    const rangeStart = start === 1 ? points.length - 1 : points.length;
    if (i === 0) waypointIndex.push(rangeStart);
    for (let k = start; k < pts.length; k++) points.push(pts[k]);
    const rangeEnd = points.length - 1;
    segmentRanges.push([rangeStart, rangeEnd]);
    waypointIndex.push(rangeEnd);
  });

  const geometry: RouteGeometry = {
    points,
    cum: cumulativeDistances(points),
    segmentRanges,
    waypointIndex,
    complete,
  };
  cache.set(route.segments, geometry);
  return geometry;
}
