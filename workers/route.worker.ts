import { simplify, lineString } from "@turf/turf";
import { statistics, profile } from "../lib/tmb/geo";
import type { Route, RoutePoint, RouteSegment } from "../lib/tmb/types";
declare const self: {
  onmessage: ((e: MessageEvent<{ id: number; route: Route }>) => void) | null;
  postMessage: (data: unknown) => void;
};
const cache = new Map<
  string,
  { display: RoutePoint[]; stats: ReturnType<typeof statistics> }
>();
self.onmessage = (e) => {
  const { id, route } = e.data;
  try {
    const display: Record<string, RoutePoint[]> = {};
    const segmentStats: Record<string, ReturnType<typeof statistics>> = {};
    for (const s of route.segments) {
      let result = cache.get(s.id);
      if (!result) {
        const geometry =
          s.points.length > 2
            ? simplify(lineString(s.points.map((p) => [p.lon, p.lat])), {
                tolerance: 0.000045,
                highQuality: true,
              }).geometry.coordinates.map((p) => ({ lon: p[0], lat: p[1] }))
            : s.points;
        result = { display: geometry, stats: statistics([s]) };
        cache.set(s.id, result);
      }
      display[s.id] = result.display;
      segmentStats[s.id] = result.stats;
    }
    if (cache.size > 200) {
      const keep = new Set(route.segments.map((s) => s.id));
      for (const id of cache.keys()) if (!keep.has(id)) cache.delete(id);
    }
    const days: { name: string; stats: ReturnType<typeof statistics> }[] = [];
    let group: RouteSegment[] = [];
    for (let i = 0; i < route.segments.length; i++) {
      const s = route.segments[i];
      group.push(s);
      const end = route.waypoints.find((w) => w.id === s.to);
      if (end?.stageEnd || i === route.segments.length - 1) {
        days.push({
          name: end?.name ?? `Étape ${days.length + 1}`,
          stats: statistics(group),
        });
        group = [];
      }
    }
    self.postMessage({
      id,
      stats: statistics(route.segments),
      segmentStats,
      profile: profile(route.segments),
      display,
      days,
    });
  } catch (e) {
    self.postMessage({ id, error: (e as Error).message });
  }
};
