import { statistics } from "./geo";
import type { Route, RouteSegment } from "./types";
export function dailyStatistics(route: Route) {
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
  return days;
}
