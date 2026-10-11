import type { Route, Waypoint } from "./types";

/** Editable stops exclude the linked copy of the departure at the end of a tour. */
export function routeStops(route: Route): Waypoint[] {
  return route.waypoints.filter(w => w.id !== route.roundTrip?.arrivalId);
}

export function linkedWaypoints(route: Route, requested: Waypoint[]): Waypoint[] {
  if (!route.roundTrip) return requested;
  const { arrivalId } = route.roundTrip;
  const stops = requested.filter(w => w.id !== arrivalId);
  const first = stops[0];
  if (!first) return stops;
  // A closed imported track may be one complete segment with only two handles.
  const hasSourceLoop = route.segments.some(s => s.from === first.id && s.to === arrivalId);
  if (stops.length === 1 && !hasSourceLoop) return stops;
  return [...stops, {
    ...first,
    id: arrivalId,
    name: `Retour à ${first.name.replace(/ · (départ|arrivée)$/, "")}`,
    stageEnd: true,
  }];
}

export function withoutReturn(route: Route): Route {
  if (!route.roundTrip) return route;
  const { roundTrip, ...open } = route;
  return {
    ...open,
    waypoints: routeStops(route),
    segments: route.segments.filter(s => s.to !== roundTrip.arrivalId),
  };
}
