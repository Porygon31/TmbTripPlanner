import { samePoint, uid } from "./geo";
import type { Route, RoutingProvider, RouteSegment, Waypoint } from "./types";
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
