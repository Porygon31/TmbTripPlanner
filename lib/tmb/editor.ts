import { distance, samePoint, uid } from "./geo";
import { variantPieces } from "./catalog";
import { linkedWaypoints, withoutReturn } from "./loop";
import type { Route, RoutingProvider, RouteSegment, Waypoint, TmbVariant } from "./types";
export const routedSource = {
  kind: "routing" as const,
  label: "OpenRouteService · foot-hiking",
  url: "https://openrouteservice.org",
  license: "© OpenStreetMap contributors, ODbL ; OpenRouteService",
  elevation: "Modèle de terrain OpenRouteService",
};
export async function recalculate(
  route: Route,
  waypoints: Waypoint[],
  provider: RoutingProvider,
  signal?: AbortSignal,
): Promise<Route> {
  waypoints = linkedWaypoints(route, waypoints);
  const segments: RouteSegment[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (signal?.aborted) throw new DOMException("Annulé", "AbortError");
    const a = waypoints[i],
      b = waypoints[i + 1];
    const existing = route.segments.find(
      (s) => s.from === a.id && s.to === b.id,
    );
    const oldA = route.waypoints.find((w) => w.id === a.id),
      oldB = route.waypoints.find((w) => w.id === b.id);
    if (existing && oldA && oldB && samePoint(oldA, a) && samePoint(oldB, b)) {
      segments.push(existing);
      continue;
    }
    if (route.roundTrip?.arrivalId === b.id && samePoint(a, b))
      throw Error("Ajoutez ou insérez un point de passage avant de déplacer le départ de cette boucle.");
    if (!existing && oldA && oldB) {
      const ia = route.waypoints.indexOf(oldA),
        ib = route.waypoints.indexOf(oldB);
      let crossesGap=false;
      for(let j=ia;j<ib;j++)if(!route.segments.some(s=>s.from===route.waypoints[j].id&&s.to===route.waypoints[j+1].id)){crossesGap=true;break;}
      if(crossesGap)continue;
    }
    const points = await provider.route(a, b, signal);
    if (signal?.aborted) throw new DOMException("Annulé", "AbortError");
    if (points.length < 2) throw Error("Le service a renvoyé un segment vide.");
    segments.push({
      id: uid(),
      points,
      from: a.id,
      to: b.id,
      source: routedSource,
      bounds: existing?.bounds,
      breakBefore: existing?.breakBefore,
      variantId: existing?.variantId,
    });
  }
  return { ...route, waypoints, segments, updatedAt: new Date().toISOString() };
}

export async function setRoundTrip(
  route: Route,
  enabled: boolean,
  provider: RoutingProvider,
  signal?: AbortSignal,
): Promise<Route> {
  if (!!route.roundTrip === enabled) return route;
  if (!enabled) return { ...withoutReturn(route), updatedAt: new Date().toISOString() };
  const first = route.waypoints[0], last = route.waypoints.at(-1);
  const alreadyClosed = first && last && first.id !== last.id &&
    first.lat === last.lat && first.lon === last.lon;
  const linked = { ...route, roundTrip: { arrivalId: alreadyClosed ? last.id : uid() } };
  // Keep existing source geometry, including separate GPX segments, exactly as imported.
  if (alreadyClosed) return { ...linked, waypoints: linkedWaypoints(linked, linked.waypoints), updatedAt: new Date().toISOString() };
  return recalculate(linked, linked.waypoints, provider, signal);
}

/** Append a source variant before the return, committing both new connections together. */
export async function appendVariant(
  route: Route,
  variant: TmbVariant,
  provider: RoutingProvider,
  signal?: AbortSignal,
): Promise<Route> {
  const open = withoutReturn(route);
  let points = variant.points;
  const last = open.waypoints.at(-1);
  if (last && distance(last, points.at(-1)!) < distance(last, points[0])) points = [...points].reverse();
  const entry = { ...points[0], id: uid(), name: `${variant.name} · entrée` };
  const segments = [...open.segments], waypoints = [...open.waypoints];
  let from = last;
  if (last && !samePoint(last, entry)) {
    const connector = await provider.route(last, entry, signal);
    if (signal?.aborted) throw new DOMException("Annulé", "AbortError");
    if (connector.length < 2) throw Error("Le service a renvoyé un segment vide.");
    segments.push({ id: uid(), points: connector, from: last.id, to: entry.id, source: routedSource });
    waypoints.push(entry);
    from = entry;
  } else if (!last) {
    waypoints.push(entry);
    from = entry;
  }
  for (const piece of variantPieces(variant, points[0])) {
    const exit = {
      ...piece.points.at(-1)!, id: uid(),
      name: `${variant.name} · ${piece.source.kind === "routing" ? "raccord" : "sortie"}`,
    };
    segments.push({ id: uid(), points: piece.points, from: from!.id, to: exit.id, source: piece.source, variantId: variant.id });
    waypoints.push(exit);
    from = exit;
  }
  const appended = { ...route, segments, waypoints, variantIds: [...route.variantIds, variant.id], updatedAt: new Date().toISOString() };
  return route.roundTrip ? recalculate(appended, waypoints, provider, signal) : appended;
}
export class EditCoordinator {
  private controller?: AbortController;
  private revision = 0;
  cancel() {
    this.revision++;
    this.controller?.abort();
  }
  async run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    commit: (value: T) => void,
  ): Promise<boolean> {
    this.cancel();
    const version = this.revision;
    this.controller = new AbortController();
    const value = await operation(this.controller.signal);
    if (version !== this.revision) return false;
    commit(value);
    return true;
  }
}
