import { get, set } from "idb-keyval";
import type { Route } from "./types";
import { samePoint } from "./geo";
type Envelope = { version: 1; route: Route; savedAt: string };
const key = (kind: "draft" | "saved") => `tmb-atelier:v1:${kind}`;
export function validateStoredRoute(value: unknown): Route | null {
  const record = value as Envelope;
  if (
    record?.version !== 1 ||
    !record.route ||
    !Array.isArray(record.route.segments) ||
    !Array.isArray(record.route.waypoints) ||
    !Array.isArray(record.route.variantIds)
  )
    return null;
  const r = record.route;
  if (r.roundTrip !== undefined) {
    if (!r.roundTrip || typeof r.roundTrip.arrivalId !== "string" || !r.roundTrip.arrivalId) return null;
    const first = r.waypoints[0], last = r.waypoints.at(-1);
    if (r.waypoints.length > 1 && (!first || !last || last.id !== r.roundTrip.arrivalId || first.id === last.id || !samePoint(first, last))) return null;
    if (r.waypoints.slice(0, -1).some(w => w.id === r.roundTrip!.arrivalId)) return null;
    if (r.waypoints.length === 1 && first.id === r.roundTrip.arrivalId) return null;
  }
  if (
    typeof r.id !== "string" ||
    typeof r.name !== "string" ||
    !["free", "tmb", "import"].includes(r.mode)
  )
    return null;
  let n = 0;
  for (const s of r.segments) {
    if (!s.id || !s.source || !Array.isArray(s.points)) return null;
    n += s.points.length;
    if (
      n > 100000 ||
      s.points.some(
        (p) =>
          !Number.isFinite(p.lat) ||
          Math.abs(p.lat) > 90 ||
          !Number.isFinite(p.lon) ||
          Math.abs(p.lon) > 180 ||
          (p.ele !== undefined && !Number.isFinite(p.ele)),
      )
    )
      return null;
  }
  return r;
}
export async function loadProject(kind: "draft" | "saved") {
  return validateStoredRoute(await get(key(kind)));
}
export async function saveProject(kind: "draft" | "saved", route: Route) {
  await set(key(kind), {
    version: 1,
    route,
    savedAt: new Date().toISOString(),
  } satisfies Envelope);
}
