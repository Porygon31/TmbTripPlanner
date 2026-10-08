import { distance as turfDistance } from "@turf/turf";
import type {
  RoutePoint,
  RouteSegment,
  RouteStatistics,
  ElevationPoint,
} from "./types";
export const distance = (a: RoutePoint, b: RoutePoint) =>
  turfDistance([a.lon, a.lat], [b.lon, b.lat], { units: "meters" });
export const samePoint = (a: RoutePoint, b: RoutePoint) => distance(a, b) < 0.5;
export const uid = () => crypto.randomUUID();
export function nearestIndex(points: RoutePoint[], point: RoutePoint) {
  let index = 0,
    min = Infinity;
  points.forEach((p, i) => {
    const d = distance(p, point);
    if (d < min) {
      min = d;
      index = i;
    }
  });
  return { index, distance: min };
}
export function length(points: RoutePoint[]) {
  return points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
}
export function profile(segments: RouteSegment[]): ElevationPoint[] {
  let d = 0;
  const out: ElevationPoint[] = [];
  for (const s of segments)
    s.points.forEach((p, i) => {
      if (i) d += distance(s.points[i - 1], p);
      out.push({
        ...p,
        distance: d,
        segmentId: s.id,
        pointIndex: i,
        breakBefore: i === 0,
      });
    });
  return out;
}
function filteredChange(points: RoutePoint[]) {
  let ascent = 0,
    descent = 0,
    samples: number[] = [],
    travel = 0,
    next = 25;
  const flush = () => {
    if (samples.length < 2) {
      samples = [];
      return;
    }
    const filtered = samples.map((v, i) => {
      if (i === 0 || i === samples.length - 1) return v;
      const window = samples
        .slice(Math.max(0, i - 2), i + 3)
        .sort((a, b) => a - b);
      return window[Math.floor(window.length / 2)];
    });
    let anchor = filtered[0];
    for (const e of filtered.slice(1)) {
      const d = e - anchor;
      if (Math.abs(d) >= 5) {
        if (d > 0) ascent += d;
        else descent -= d;
        anchor = e;
      }
    }
    samples = [];
    travel = 0;
    next = 25;
  };
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (p.ele === undefined) {
      flush();
      return;
    }
    if (!prev || prev.ele === undefined) {
      samples.push(p.ele);
      return;
    }
    const d = distance(prev, p);
    while (d > 0 && next <= travel + d) {
      samples.push(prev.ele + ((p.ele - prev.ele) * (next - travel)) / d);
      next += 25;
    }
    travel += d;
    if (i === points.length - 1) {
      samples.push(p.ele);
      flush();
    }
  });
  flush();
  return { ascent, descent };
}
export function statistics(
  segments: Pick<RouteSegment, "points" | "breakBefore">[],
): RouteStatistics {
  let d = 0,
    ascent = 0,
    descent = 0,
    count = 0,
    known = 0,
    min = Infinity,
    max = -Infinity,
    gaps = 0;
  for (let si = 0; si < segments.length; si++) {
    const s = segments[si];
    if (si && s.breakBefore) gaps++;
    const change = filteredChange(s.points);
    ascent += change.ascent;
    descent += change.descent;
    s.points.forEach((p, i) => {
      count++;
      if (i) d += distance(s.points[i - 1], p);
      if (p.ele !== undefined) {
        known++;
        min = Math.min(min, p.ele);
        max = Math.max(max, p.ele);
      }
    });
  }
  return {
    distance: d,
    ascent,
    descent,
    minElevation: known ? min : null,
    maxElevation: known ? max : null,
    pointCount: count,
    elevationCoverage: count ? known / count : 0,
    hours: d / 1000 / 4 + ascent / 600,
    gaps,
  };
}
export const km = (meters: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
    meters / 1000,
  );
export const meters = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
