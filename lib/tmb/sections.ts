import type { Route, RouteSegment, RouteStatistics } from "./types";
import { statistics } from "./geo";

export function selectRouteSection(route: Route, from: string, to: string): RouteSegment[] | null {
  const indices = new Map(route.waypoints.map((w, i) => [w.id, i]));
  const first = indices.get(from), last = indices.get(to);
  if (first === undefined || last === undefined || first >= last) return null;
  const selected = route.segments.filter(s => {
    const a = indices.get(s.from), b = indices.get(s.to);
    return a !== undefined && b !== undefined && a >= first && b <= last && a < b;
  });
  // Bounds must lie on recorded segments, never in an imported gap.
  return selected[0]?.from === from && selected.at(-1)?.to === to ? selected : null;
}

export function combineSegmentStatistics(segments: RouteSegment[], bySegment: Record<string, RouteStatistics>): RouteStatistics | null {
  const result = statistics([]);
  let known = 0;
  for (const [i, segment] of segments.entries()) {
    const value = bySegment[segment.id];
    if (!value) return null;
    result.distance += value.distance;
    result.ascent += value.ascent;
    result.descent += value.descent;
    result.pointCount += value.pointCount;
    known += Math.round(value.pointCount * value.elevationCoverage);
    if (value.minElevation !== null) result.minElevation = Math.min(result.minElevation ?? Infinity, value.minElevation);
    if (value.maxElevation !== null) result.maxElevation = Math.max(result.maxElevation ?? -Infinity, value.maxElevation);
    if (i > 0 && segment.breakBefore) result.gaps++;
  }
  result.elevationCoverage = result.pointCount ? known / result.pointCount : 0;
  result.hours = result.distance / 1000 / 4 + result.ascent / 600;
  return result;
}
