import { nearestIndex, samePoint, uid } from "./geo";
import type {
  Catalog,
  Route,
  RoutePoint,
  RouteSegment,
  TmbVariant,
  Waypoint,
} from "./types";
const stamp = () => new Date().toISOString();
export function newRoute(): Route {
  return {
    id: uid(),
    name: "Mon Tour du Mont-Blanc",
    mode: "free",
    waypoints: [],
    segments: [],
    variantIds: [],
    updatedAt: stamp(),
  };
}
export function conflicts(
  catalog: Catalog,
  selected: string[],
  variant: TmbVariant,
) {
  const [a, b] = variant.anchors;
  return catalog.variants.filter(
    (v) =>
      selected.includes(v.id) &&
      v.id !== variant.id &&
      Math.max(a, v.anchors[0]) < Math.min(b, v.anchors[1]),
  );
}
export function composeTmb(catalog: Catalog, ids: string[]): Route {
  const selected = catalog.variants
    .filter((v) => ids.includes(v.id))
    .sort((a, b) => a.anchors[0] - b.anchors[0]);
  for (const v of selected) {
    if (v.anchors[0] < 0 || v.anchors[1] < 0 || v.gaps)
      throw Error("Cette variante ne possède pas de raccordement vérifié.");
    if (conflicts(catalog, ids, v).length)
      throw Error(
        "Deux variantes se chevauchent. Choisissez celle à conserver.",
      );
  }
  const p = catalog.main.points;
  let cursor = 0;
  const chunks: {
    points: RoutePoint[];
    variant?: TmbVariant;
    source?: RouteSegment["source"];
    bounds: [number, number];
  }[] = [];
  for (const v of selected) {
    const [a, b] = v.anchors;
    if (a > cursor)
      chunks.push({ points: p.slice(cursor, a + 1), bounds: [cursor, a] });
    const points = samePoint(v.points[0], p[a])
      ? v.points
      : [...v.points].reverse();
    if (!samePoint(points[0], p[a]) || !samePoint(points.at(-1)!, p[b]))
      throw Error("Les raccordements de la variante ne coïncident pas.");
    for (const piece of variantPieces(v, points[0]))
      chunks.push({ ...piece, variant: v, bounds: [a, b] });
    cursor = b;
  }
  if (cursor < p.length - 1)
    chunks.push({ points: p.slice(cursor), bounds: [cursor, p.length - 1] });
  // Expose source geometry boundaries every ~10 km; edits reroute only a bounded section.
  const stops = [
    { name: "Les Houches", lat: 45.8908, lon: 6.7981 },
    { name: "Les Contamines", lat: 45.8207, lon: 6.7286 },
    { name: "Les Chapieux", lat: 45.6963, lon: 6.7339 },
    { name: "Courmayeur", lat: 45.791, lon: 6.968 },
    { name: "La Fouly", lat: 45.9325, lon: 7.098 },
    { name: "Champex", lat: 46.029, lon: 7.116 },
    { name: "Trient", lat: 46.055, lon: 7.002 },
    { name: "Tré-le-Champ", lat: 46.003, lon: 6.92 },
  ];
  const route = {
    ...newRoute(),
    mode: "tmb" as const,
    variantIds: selected.map((v) => v.id),
  };
  const add = (points: RoutePoint[], chunk: (typeof chunks)[number]) => {
    if (points.length < 2) return;
    let from = route.waypoints.at(-1);
    if (!from) {
      from = { ...points[0], id: uid(), name: "Les Houches · départ" };
      route.waypoints.push(from);
    }
    const last = points.at(-1)!;
    const nearest = stops
      .map((s) => ({ ...s, d: nearestIndex([last], s).distance }))
      .sort((a, b) => a.d - b.d)[0];
    const to: Waypoint = {
      ...last,
      id: uid(),
      name:
        nearest.d < 1300 ? nearest.name : `Point ${route.waypoints.length + 1}`,
    };
    route.waypoints.push(to);
    route.segments.push({
      id: uid(),
      points,
      from: from.id,
      to: to.id,
      source: chunk.source ?? chunk.variant?.source ?? catalog.main.source,
      variantId: chunk.variant?.id,
      bounds: chunk.bounds,
    });
  };
  for (const chunk of chunks) {
    if (chunk.variant) {
      add(chunk.points, chunk);
      continue;
    }
    let start = 0;
    const cuts = stops
      .slice(1)
      .map((s) => nearestIndex(chunk.points, s))
      .filter(
        (n) =>
          n.distance < 1200 && n.index > 0 && n.index < chunk.points.length - 1,
      )
      .map((n) => n.index)
      .sort((a, b) => a - b);
    for (const cut of [...new Set(cuts), chunk.points.length - 1]) {
      if (cut <= start) continue;
      add(chunk.points.slice(start, cut + 1), chunk);
      start = cut;
    }
  }
  if (route.waypoints.length)
    route.waypoints.at(-1)!.name = "Les Houches · arrivée";
  return route;
}
export function splitSegment(
  route: Route,
  segmentId: string,
  pointIndex: number,
): Route {
  const segment = route.segments.find((s) => s.id === segmentId);
  if (!segment || pointIndex < 1 || pointIndex >= segment.points.length - 1)
    return route;
  const w: Waypoint = {
    ...segment.points[pointIndex],
    id: uid(),
    name: `Point ${route.waypoints.length + 1}`,
  };
  const index = route.waypoints.findIndex((p) => p.id === segment.to);
  const waypoints = [...route.waypoints];
  waypoints.splice(index, 0, w);
  const parts: RouteSegment[] = [
    {
      ...segment,
      id: uid(),
      to: w.id,
      points: segment.points.slice(0, pointIndex + 1),
    },
    {
      ...segment,
      id: uid(),
      from: w.id,
      points: segment.points.slice(pointIndex),
    },
  ];
  return {
    ...route,
    waypoints,
    segments: route.segments.flatMap((s) => (s.id === segmentId ? parts : [s])),
    updatedAt: stamp(),
  };
}

export function variantPieces(v: TmbVariant, start: RoutePoint) {
  let pieces = v.pieces ?? [{ points: v.points, source: v.source }];
  if (!samePoint(pieces[0].points[0], start))
    pieces = [...pieces]
      .reverse()
      .map((p) => ({ ...p, points: [...p.points].reverse() }));
  return pieces;
}
export function integrateVariant(input: Route, variant: TmbVariant): Route {
  if (input.variantIds.includes(variant.id)) return input;
  let route = input;
  const locate = (p: RoutePoint) => {
    let best = { segment: -1, index: 0, distance: Infinity };
    route.segments.forEach((s, i) => {
      const n = nearestIndex(s.points, p);
      if (n.distance < best.distance) best = { segment: i, ...n };
    });
    return best;
  };
  let start = locate(variant.points[0]),
    end = locate(variant.points.at(-1)!);
  let points = variant.points;
  if (
    start.segment > end.segment ||
    (start.segment === end.segment && start.index > end.index)
  ) {
    points = [...points].reverse();
    [start, end] = [end, start];
  }
  if (start.distance > 0.5 || end.distance > 0.5)
    throw Error(
      "Un raccordement a été déplacé. Rétablissez cette portion du classique avant d’ajouter la variante.",
    );
  // Split from the end first so that both source bounds become editable waypoints.
  route = splitSegment(route, route.segments[end.segment].id, end.index);
  start = locate(points[0]);
  route = splitSegment(route, route.segments[start.segment].id, start.index);
  const first = route.segments.findIndex((s) =>
    samePoint(s.points[0], points[0]),
  );
  let last = -1;
  for (let i = first; i < route.segments.length; i++)
    if (samePoint(route.segments[i].points.at(-1)!, points.at(-1)!)) {
      last = i;
      break;
    }
  if (first < 0 || last < first)
    throw Error("Les bornes de remplacement n’ont pas pu être identifiées.");
  const from = route.segments[first].from,
    to = route.segments[last].to;
  const ia = route.waypoints.findIndex((w) => w.id === from),
    ib = route.waypoints.findIndex((w) => w.id === to);
  const pieces = variantPieces(variant, points[0]),
    extra: Waypoint[] = [],
    added: RouteSegment[] = [];
  let fromId = from;
  pieces.forEach((piece, i) => {
    const endId = i === pieces.length - 1 ? to : uid();
    if (i < pieces.length - 1)
      extra.push({
        ...piece.points.at(-1)!,
        id: endId,
        name: `${variant.name} · raccord`,
      });
    added.push({
      id: uid(),
      points: piece.points,
      source: piece.source,
      from: fromId,
      to: endId,
      variantId: variant.id,
      bounds: variant.anchors,
    });
    fromId = endId;
  });
  return {
    ...route,
    variantIds: [...route.variantIds, variant.id],
    waypoints: [
      ...route.waypoints.slice(0, ia + 1),
      ...extra,
      ...route.waypoints.slice(ib),
    ],
    segments: [
      ...route.segments.slice(0, first),
      ...added,
      ...route.segments.slice(last + 1),
    ],
    updatedAt: stamp(),
  };
}
export function removeVariant(
  route: Route,
  variant: TmbVariant,
  catalog: Catalog,
): Route {
  if (
    route.segments.some(
      (s) =>
        s.variantId === variant.id &&
        s.source.label === "OpenRouteService · foot-hiking",
    )
  )
    throw Error(
      "Annulez la personnalisation de cette variante avant de la retirer.",
    );
  const indices = route.segments
    .map((s, i) => (s.variantId === variant.id ? i : -1))
    .filter((i) => i >= 0);
  if (!indices.length)
    throw Error(
      "Cette variante a été personnalisée. Annulez la modification avant de la retirer.",
    );
  const first = indices[0],
    last = indices.at(-1)!,
    from = route.segments[first].from,
    to = route.segments[last].to;
  const ia = route.waypoints.findIndex((w) => w.id === from),
    ib = route.waypoints.findIndex((w) => w.id === to);
  return {
    ...route,
    variantIds: route.variantIds.filter((id) => id !== variant.id),
    waypoints: [
      ...route.waypoints.slice(0, ia + 1),
      ...route.waypoints.slice(ib),
    ],
    segments: [
      ...route.segments.slice(0, first),
      {
        id: uid(),
        points: catalog.main.points.slice(
          variant.anchors[0],
          variant.anchors[1] + 1,
        ),
        source: catalog.main.source,
        from,
        to,
      },
      ...route.segments.slice(last + 1),
    ],
    updatedAt: stamp(),
  };
}
