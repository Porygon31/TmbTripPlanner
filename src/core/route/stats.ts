import { computeStatistics } from '../elevation/stats';
import type { Route, RouteStatistics, StageStatistics } from '../types';
import { buildRouteGeometry } from './geometry';

const statsCache = new WeakMap<object, RouteStatistics>();

/** Statistiques de l'itinéraire complet (mémoïsées : recalculées seulement si les segments changent). */
export function routeStatistics(route: Route): RouteStatistics {
  const geometry = buildRouteGeometry(route);
  const cached = statsCache.get(geometry);
  if (cached) return cached;
  const stats = computeStatistics(geometry.points, geometry.cum);
  statsCache.set(geometry, stats);
  return stats;
}

export function waypointLabel(route: Route, index: number): string {
  const w = route.waypoints[index];
  if (w?.name) return w.name;
  if (index === 0) return 'Départ';
  if (index === route.waypoints.length - 1) return 'Arrivée';
  return `Point ${index + 1}`;
}

/**
 * Découpage en étapes : chaque waypoint marqué « fin d'étape » termine une journée,
 * la dernière étape se termine à l'arrivée.
 */
export function stageStatistics(route: Route): StageStatistics[] {
  if (route.waypoints.length < 2) return [];
  const geometry = buildRouteGeometry(route);
  const ends: number[] = [];
  route.waypoints.forEach((w, i) => {
    if (w.stageEnd && i > 0 && i < route.waypoints.length - 1) ends.push(i);
  });
  ends.push(route.waypoints.length - 1);
  const stages: StageStatistics[] = [];
  let startWp = 0;
  ends.forEach((endWp, k) => {
    const from = geometry.waypointIndex[startWp];
    const to = geometry.waypointIndex[endWp];
    const stats = computeStatistics(geometry.points, geometry.cum, from, to);
    stages.push({
      ...stats,
      index: k,
      fromName: waypointLabel(route, startWp),
      toName: waypointLabel(route, endWp),
      startDistance: geometry.cum[from] ?? 0,
      endDistance: geometry.cum[to] ?? 0,
    });
    startWp = endWp;
  });
  return stages;
}
