import { haversine } from '../geo/distance';
import { pointAtDistance, projectOnPolyline, sliceByDistance } from '../geo/projection';
import type { Route, RoutePoint, RouteSegment, Waypoint } from '../types';
import { createId } from './ids';
import { createWaypoint, pendingSegment, reverseRoute, straightSegment, trackSegment } from './operations';
import type { IndexedTrack, TrackLookup } from './tracks';

/**
 * Composition d'itinéraires à partir de traces existantes :
 * greffe d'une variante sur le TMB, retrait, ajout d'une trace en mode libre.
 */

/** En dessous de cette distance (m), deux extrémités sont considérées comme jointives. */
export const JOIN_TOLERANCE = 15;
/** Jusqu'à cette distance (m), un raccord est tracé en ligne droite ; au-delà il est calculé. */
export const STRAIGHT_CONNECTOR_MAX = 50;
/** Distance (m) sous laquelle le dernier point est considéré comme posé sur une trace. */
export const ON_TRACK_TOLERANCE = 30;

export class ComposeError extends Error {}

export interface VariantJunctions {
  id: string;
  name: string;
  /** Abscisse du départ de la variante sur le TMB principal (m). */
  startOnMain: number;
  /** Abscisse de la jonction avec le TMB principal (m). */
  endOnMain: number;
}

const isMainSegment = (s: RouteSegment, mainId: string) => s.mode === 'track' && s.trackRef?.trackId === mainId;

/** L'itinéraire est construit sur le TMB principal (au moins un tronçon en est issu). */
export function isBasedOnMain(route: Route, mainId: string): boolean {
  return route.segments.some((s) => isMainSegment(s, mainId));
}

function isReversedOnMain(route: Route, mainId: string): boolean {
  const s = route.segments.find((seg) => isMainSegment(seg, mainId));
  return !!s && !!s.trackRef && s.trackRef.endDist < s.trackRef.startDist;
}

/**
 * Intervalle du TMB principal couvert (ou remplacé) par chaque segment, dans le sens canonique.
 * Un segment qui n'est pas issu du TMB couvre l'intervalle compris entre les tronçons du TMB qui l'encadrent.
 */
export function mainIntervals(route: Route, mainId: string): ([number, number] | null)[] {
  const segs = route.segments;
  const out: ([number, number] | null)[] = segs.map((s) =>
    isMainSegment(s, mainId) && s.trackRef
      ? [Math.min(s.trackRef.startDist, s.trackRef.endDist), Math.max(s.trackRef.startDist, s.trackRef.endDist)]
      : null,
  );
  for (let i = 0; i < segs.length; i++) {
    if (out[i] !== null || isMainSegment(segs[i], mainId)) continue;
    let lo: number | null = null;
    let hi: number | null = null;
    for (let k = i - 1; k >= 0; k--) {
      if (isMainSegment(segs[k], mainId)) {
        lo = out[k]![1];
        break;
      }
    }
    for (let k = i + 1; k < segs.length; k++) {
      if (isMainSegment(segs[k], mainId)) {
        hi = out[k]![0];
        break;
      }
    }
    if (lo === null && hi === null) continue;
    lo ??= hi!;
    hi ??= lo;
    out[i] = [Math.min(lo, hi), Math.max(lo, hi)];
  }
  return out;
}

function mainSlice(main: IndexedTrack, a: number, b: number): RouteSegment {
  return trackSegment(sliceByDistance(main.points, main.cum, a, b), {
    trackId: main.id,
    trackKind: main.kind,
    startDist: a,
    endDist: b,
  });
}

/** Coupe le tronçon principal `segIndex` à l'abscisse `d` et renvoie l'indice du waypoint obtenu. */
function cutMainAt(route: Route, main: IndexedTrack, segIndex: number, d: number): { route: Route; wp: number } {
  const seg = route.segments[segIndex];
  const { startDist: s, endDist: e } = seg.trackRef!;
  if (Math.abs(d - s) < 1) return { route, wp: segIndex };
  if (Math.abs(d - e) < 1) return { route, wp: segIndex + 1 };
  const wp = createWaypoint(pointAtDistance(main.points, main.cum, d), 'junction');
  const waypoints = [...route.waypoints];
  waypoints.splice(segIndex + 1, 0, wp);
  const segments = [...route.segments];
  segments.splice(segIndex, 1, mainSlice(main, s, d), mainSlice(main, d, e));
  return { route: { ...route, waypoints, segments }, wp: segIndex + 1 };
}

function findMainSegmentAt(route: Route, mainId: string, d: number): number {
  return route.segments.findIndex((seg) => {
    if (!isMainSegment(seg, mainId) || !seg.trackRef) return false;
    const lo = Math.min(seg.trackRef.startDist, seg.trackRef.endDist);
    const hi = Math.max(seg.trackRef.startDist, seg.trackRef.endDist);
    return d >= lo - 0.5 && d <= hi + 0.5;
  });
}

/** Segments et points intermédiaires pour relier `from` → trace → `to`, sans trou. */
function bridgeTrack(
  from: Waypoint,
  to: Waypoint,
  track: IndexedTrack,
  startDist: number,
  endDist: number,
  connectorFor: string,
): { waypoints: Waypoint[]; segments: RouteSegment[] } {
  const pts: RoutePoint[] = sliceByDistance(track.points, track.cum, startDist, endDist);
  const waypoints: Waypoint[] = [];
  const segments: RouteSegment[] = [];
  const entry = pts[0];
  const exit = pts[pts.length - 1];
  const gapIn = haversine(from, entry);
  const gapOut = haversine(exit, to);
  const ref = { trackId: track.id, trackKind: track.kind, startDist, endDist };

  if (gapIn > JOIN_TOLERANCE) {
    const wpIn = createWaypoint(entry, 'junction');
    segments.push(
      gapIn <= STRAIGHT_CONNECTOR_MAX
        ? straightSegment(from, wpIn, { connectorFor })
        : { ...pendingSegment(), connectorFor },
    );
    waypoints.push(wpIn);
  } else if (gapIn > 0.5) {
    pts.unshift({ lat: from.lat, lon: from.lon, ele: entry.ele });
  }
  if (gapOut > JOIN_TOLERANCE) {
    const wpOut = createWaypoint(exit, 'junction');
    segments.push(trackSegment(pts, ref));
    waypoints.push(wpOut);
    segments.push(
      gapOut <= STRAIGHT_CONNECTOR_MAX
        ? straightSegment(wpOut, to, { connectorFor })
        : { ...pendingSegment(), connectorFor },
    );
  } else {
    if (gapOut > 0.5) pts.push({ lat: to.lat, lon: to.lon, ele: exit.ele });
    segments.push(trackSegment(pts, ref));
  }
  return { waypoints, segments };
}

/**
 * Greffe une variante sur un itinéraire construit à partir du TMB principal :
 * le tronçon classique entre le départ et la jonction de la variante est remplacé par celle-ci.
 * Refuse les doublons et les chevauchements avec une autre portion déjà modifiée.
 * `variantNames` sert à nommer la portion en conflit dans le message d'erreur.
 */
export function spliceVariant(
  route: Route,
  lookup: TrackLookup,
  mainId: string,
  variant: VariantJunctions,
  variantNames: (id: string) => string | undefined = () => undefined,
): { route: Route; droppedStageEnds: number } {
  const main = lookup(mainId);
  const vTrack = lookup(variant.id);
  if (!main || !vTrack) throw new ComposeError('Trace non chargée.');
  if (route.segments.some((s) => s.trackRef?.trackId === variant.id)) {
    throw new ComposeError(`« ${variant.name} » fait déjà partie de l'itinéraire.`);
  }
  if (!isBasedOnMain(route, mainId)) throw new ComposeError("L'itinéraire n'est pas construit sur le TMB principal.");
  if (isReversedOnMain(route, mainId)) {
    const res = spliceVariant(reverseRoute(route), lookup, mainId, variant, variantNames);
    return { route: reverseRoute(res.route), droppedStageEnds: res.droppedStageEnds };
  }
  const a = variant.startOnMain;
  const b = variant.endOnMain;
  if (!(a < b)) throw new ComposeError('Jonctions de la variante incohérentes avec le sens du TMB.');

  // Chevauchements avec des portions déjà modifiées.
  const intervals = mainIntervals(route, mainId);
  for (let i = 0; i < route.segments.length; i++) {
    const seg = route.segments[i];
    const iv = intervals[i];
    if (isMainSegment(seg, mainId) || !iv) continue;
    const overlap = Math.min(iv[1], b) - Math.max(iv[0], a);
    if (overlap > 1) {
      const otherId = seg.trackRef?.trackId ?? seg.connectorFor;
      const other = (otherId && variantNames(otherId)) || 'une portion déjà modifiée de votre itinéraire';
      throw new ComposeError(`« ${variant.name} » chevauche ${other.startsWith('une ') ? other : `« ${other} »`}. Retirez-la d'abord.`);
    }
  }

  const ia = findMainSegmentAt(route, mainId, a);
  if (ia < 0) throw new ComposeError("Le départ de la variante n'est pas sur la portion du TMB de votre itinéraire.");
  const cutA = cutMainAt(route, main, ia, a);
  let r = cutA.route;
  const wa = cutA.wp;
  const ib = findMainSegmentAt(r, mainId, b);
  if (ib < 0) throw new ComposeError("La jonction de la variante n'est pas sur la portion du TMB de votre itinéraire.");
  const cutB = cutMainAt(r, main, ib, b);
  r = cutB.route;
  const wb = cutB.wp;
  if (wb <= wa) throw new ComposeError('Jonctions de la variante incohérentes.');

  const dropped = r.waypoints.slice(wa + 1, wb).filter((w) => w.stageEnd).length;
  const bridge = bridgeTrack(r.waypoints[wa], r.waypoints[wb], vTrack, 0, vTrack.length, variant.id);
  const waypoints = [...r.waypoints.slice(0, wa + 1), ...bridge.waypoints, ...r.waypoints.slice(wb)];
  const segments = [...r.segments.slice(0, wa), ...bridge.segments, ...r.segments.slice(wb)];
  return { route: { ...r, waypoints, segments }, droppedStageEnds: dropped };
}

/** Fusionne deux tronçons consécutifs du TMB principal autour d'un point de raccord automatique. */
function mergeMainAt(route: Route, main: IndexedTrack, wpIndex: number): Route {
  const wp = route.waypoints[wpIndex];
  const prev = route.segments[wpIndex - 1];
  const next = route.segments[wpIndex];
  if (!wp || wp.role !== 'junction' || wp.stageEnd || !prev || !next) return route;
  if (!isMainSegment(prev, main.id) || !isMainSegment(next, main.id)) return route;
  if (Math.abs(prev.trackRef!.endDist - next.trackRef!.startDist) > 1) return route;
  const waypoints = route.waypoints.filter((_, i) => i !== wpIndex);
  const segments = [...route.segments];
  segments.splice(wpIndex - 1, 2, mainSlice(main, prev.trackRef!.startDist, next.trackRef!.endDist));
  return { ...route, waypoints, segments };
}

/** Retire une variante et restaure le tronçon du TMB classique correspondant. */
export function removeVariant(route: Route, lookup: TrackLookup, mainId: string, variantId: string): Route {
  const main = lookup(mainId);
  if (!main) throw new ComposeError('Trace non chargée.');
  const idx = route.segments.findIndex((s) => s.trackRef?.trackId === variantId);
  if (idx < 0) return route;
  if (isReversedOnMain(route, mainId)) return reverseRoute(removeVariant(reverseRoute(route), lookup, mainId, variantId));

  let first = idx;
  while (first > 0 && route.segments[first - 1].connectorFor === variantId) first--;
  let last = idx;
  while (last < route.segments.length - 1 && route.segments[last + 1].connectorFor === variantId) last++;

  const prev = route.segments[first - 1];
  const next = route.segments[last + 1];
  const project = (w: Waypoint) => projectOnPolyline(main.points, main.cum, w)?.distanceAlong ?? 0;
  const a = prev && isMainSegment(prev, mainId) ? prev.trackRef!.endDist : project(route.waypoints[first]);
  const b = next && isMainSegment(next, mainId) ? next.trackRef!.startDist : project(route.waypoints[last + 1]);
  if (!(a < b)) throw new ComposeError('Impossible de restaurer le tronçon classique.');

  const waypoints = [...route.waypoints.slice(0, first + 1), ...route.waypoints.slice(last + 1)];
  const segments = [...route.segments.slice(0, first), mainSlice(main, a, b), ...route.segments.slice(last + 1)];
  let r: Route = { ...route, waypoints, segments };
  r = mergeMainAt(r, main, first + 1);
  r = mergeMainAt(r, main, first);
  return r;
}

/**
 * Mode libre : ajoute une trace (variante, GPX importé) à la fin de l'itinéraire.
 * L'orientation est choisie pour partir de l'extrémité la plus proche du dernier point
 * (jamais de tronçon inversé inutilement) ; si le dernier point est déjà sur la trace,
 * on part de là (pas d'aller-retour). Un raccord est ajouté si nécessaire (pas de trou).
 */
export function appendTrack(route: Route, lookup: TrackLookup, trackId: string, trackName: string): Route {
  const track = lookup(trackId);
  if (!track) throw new ComposeError('Trace non chargée.');
  if (route.segments.some((s) => s.trackRef?.trackId === trackId)) {
    throw new ComposeError(`« ${trackName} » fait déjà partie de l'itinéraire.`);
  }
  if (route.waypoints.length === 0) {
    const start = createWaypoint(track.points[0], 'user');
    const end = createWaypoint(track.points[track.points.length - 1], 'user');
    const seg = trackSegment(sliceByDistance(track.points, track.cum, 0, track.length), {
      trackId: track.id,
      trackKind: track.kind,
      startDist: 0,
      endDist: track.length,
    });
    return { ...route, waypoints: [start, end], segments: [seg] };
  }
  const last = route.waypoints[route.waypoints.length - 1];
  const proj = projectOnPolyline(track.points, track.cum, last);
  let s: number;
  let e: number;
  if (proj && proj.offset <= ON_TRACK_TOLERANCE) {
    const d = proj.distanceAlong;
    [s, e] = track.length - d >= d ? [d, track.length] : [d, 0];
  } else {
    const dStart = haversine(last, track.points[0]);
    const dEnd = haversine(last, track.points[track.points.length - 1]);
    [s, e] = dStart <= dEnd ? [0, track.length] : [track.length, 0];
  }
  const exitPoint = pointAtDistance(track.points, track.cum, e);
  const end = createWaypoint(exitPoint, 'user');
  const bridge = bridgeTrack(last, end, track, s, e, trackId);
  return {
    ...route,
    waypoints: [...route.waypoints, ...bridge.waypoints, end],
    segments: [...route.segments, ...bridge.segments],
  };
}

/** Itinéraire « TMB complet » : un seul tronçon couvrant tout le tracé principal. */
export function routeFromMain(main: IndexedTrack, name: string): Route {
  const start = createWaypoint(main.points[0], 'base', { name: 'Départ' });
  const end = createWaypoint(main.points[main.points.length - 1], 'base', { name: 'Arrivée' });
  return { id: createId('route'), name, waypoints: [start, end], segments: [mainSlice(main, 0, main.length)] };
}
