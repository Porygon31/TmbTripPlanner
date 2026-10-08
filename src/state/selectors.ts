import { buildRouteGeometry } from '../core/route/geometry';
import { routeStatistics } from '../core/route/stats';
import type { RoutePoint, RouteStatistics } from '../core/types';
import { MAIN_ID, ROUTE_TARGET, type AppState } from './store';

export interface TargetGeometry {
  points: RoutePoint[];
  cum: Float64Array;
  /** Intervalles de distance de chaque segment (itinéraire uniquement). */
  segmentBands?: [number, number][];
  /** Distances des fins d'étape (itinéraire uniquement). */
  stageMarks?: { distance: number; label: string }[];
}

/** Géométrie de la cible du profil : l'itinéraire ou une trace (TMB, variante, import). */
export function targetGeometry(s: AppState, target: string): TargetGeometry | null {
  if (target === ROUTE_TARGET) {
    const route = s.history.present;
    if (route.waypoints.length < 2) return null;
    const g = buildRouteGeometry(route);
    let stage = 1;
    const stageMarks: { distance: number; label: string }[] = [];
    route.waypoints.forEach((w, i) => {
      if (w.stageEnd && i > 0 && i < route.waypoints.length - 1) {
        stage++;
        stageMarks.push({ distance: g.cum[g.waypointIndex[i]], label: `J${stage}` });
      }
    });
    return {
      points: g.points,
      cum: g.cum,
      segmentBands: g.segmentRanges.map(([a, b]) => [g.cum[a], g.cum[b]]),
      stageMarks,
    };
  }
  const t = s.tracks[target];
  return t ? { points: t.points, cum: t.cum } : null;
}

export function trackStatistics(s: AppState, id: string): RouteStatistics | null {
  if (s.trackStats[id]) return s.trackStats[id];
  const c = s.catalog;
  if (c?.main?.id === id) return c.main.stats;
  return c?.variants.find((v) => v.id === id)?.stats ?? null;
}

export const selectRouteStats = (s: AppState) => routeStatistics(s.history.present);

/** Cible réelle du profil : le TMB est montré tant que l'itinéraire compte moins de deux points. */
export function effectiveTarget(s: AppState): string {
  if (s.profileTarget === ROUTE_TARGET && s.history.present.waypoints.length < 2 && s.tracks[MAIN_ID]) return MAIN_ID;
  return s.profileTarget;
}
