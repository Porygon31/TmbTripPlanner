import { haversine } from '../geo/distance';
import { pointAtDistance, projectOnPolyline, sliceByDistance } from '../geo/projection';
import { cumulativeDistances } from '../geo/distance';
import type { LatLon, Route, RoutePoint, RouteSegment, TrackRef, Waypoint, WaypointRole } from '../types';
import { createId } from './ids';
import type { TrackLookup } from './tracks';

/**
 * Opérations d'édition. Toutes sont pures : elles renvoient un nouvel itinéraire
 * (avec un nouveau tableau `segments`) et ne modifient jamais l'entrée.
 */

/** Longueur conservée en recalcul local quand on déplace un point posé sur une trace figée. */
export const LOCAL_DETOUR_DISTANCE = 1500;

export function emptyRoute(name = 'Mon itinéraire'): Route {
  return { id: createId('route'), name, waypoints: [], segments: [] };
}

export function createWaypoint(p: LatLon, role: WaypointRole = 'user', extra: Partial<Waypoint> = {}): Waypoint {
  return { id: createId('wp'), lat: p.lat, lon: p.lon, role, ...extra };
}

export function pendingSegment(): RouteSegment {
  return { id: createId('seg'), mode: 'routed', status: 'pending', points: [] };
}

export function straightSegment(a: LatLon, b: LatLon, extra: Partial<RouteSegment> = {}): RouteSegment {
  return {
    id: createId('seg'),
    mode: 'straight',
    status: 'ok',
    points: [
      { lat: a.lat, lon: a.lon, ele: null },
      { lat: b.lat, lon: b.lon, ele: null },
    ],
    ...extra,
  };
}

export function trackSegment(points: RoutePoint[], ref: TrackRef, extra: Partial<RouteSegment> = {}): RouteSegment {
  return { id: createId('seg'), mode: 'track', status: 'ok', points, trackRef: ref, ...extra };
}

/** Ajoute un point en fin d'itinéraire (le nouveau segment est à calculer). */
export function appendWaypoint(route: Route, p: LatLon): Route {
  const wp = createWaypoint(p);
  const segments = route.waypoints.length > 0 ? [...route.segments, pendingSegment()] : [...route.segments];
  return { ...route, waypoints: [...route.waypoints, wp], segments };
}

/** Ajoute un point en début d'itinéraire. */
export function prependWaypoint(route: Route, p: LatLon): Route {
  const wp = createWaypoint(p);
  const segments = route.waypoints.length > 0 ? [pendingSegment(), ...route.segments] : [...route.segments];
  return { ...route, waypoints: [wp, ...route.waypoints], segments };
}

/**
 * Découpe un segment en deux au point de sa géométrie le plus proche de `p`,
 * sans recalcul : les deux moitiés conservent leur géométrie.
 * Renvoie aussi l'indice du nouveau waypoint.
 */
export function splitSegmentAt(
  route: Route,
  segmentIndex: number,
  p: LatLon,
  role: WaypointRole = 'user',
  extra: Partial<Waypoint> = {},
): { route: Route; waypointIndex: number } {
  const seg = route.segments[segmentIndex];
  if (!seg) throw new Error(`Segment ${segmentIndex} inexistant`);
  const insertAt = segmentIndex + 1;
  if (seg.status !== 'ok' || seg.points.length < 2) {
    // Géométrie inconnue : on insère le point et on recalcule les deux moitiés.
    const wp = createWaypoint(p, role, extra);
    const waypoints = [...route.waypoints];
    waypoints.splice(insertAt, 0, wp);
    const segments = [...route.segments];
    segments.splice(segmentIndex, 1, pendingSegment(), pendingSegment());
    return { route: { ...route, waypoints, segments }, waypointIndex: insertAt };
  }
  const cum = cumulativeDistances(seg.points);
  const proj = projectOnPolyline(seg.points, cum, p);
  if (!proj) throw new Error('Projection impossible');
  const d = proj.distanceAlong;
  const total = cum[cum.length - 1];
  const first = sliceByDistance(seg.points, cum, 0, d);
  const second = sliceByDistance(seg.points, cum, d, total);
  const wp = createWaypoint(proj.point, role, extra);

  const half = (pts: RoutePoint[], refStart: number, refEnd: number): RouteSegment => {
    const out: RouteSegment = { ...seg, id: createId('seg'), points: pts };
    if (seg.trackRef) {
      const { startDist, endDist } = seg.trackRef;
      const dir = endDist >= startDist ? 1 : -1;
      out.trackRef = { ...seg.trackRef, startDist: startDist + dir * refStart, endDist: startDist + dir * refEnd };
    }
    return out;
  };
  const waypoints = [...route.waypoints];
  waypoints.splice(insertAt, 0, wp);
  const segments = [...route.segments];
  segments.splice(segmentIndex, 1, half(first, 0, d), half(second, d, total));
  return { route: { ...route, waypoints, segments }, waypointIndex: insertAt };
}

/**
 * Raccourcit un segment « trace » en conservant ses `keep` premiers (ou derniers) mètres.
 * Utilisé pour limiter le recalcul à la zone modifiée.
 */
function trimTrackSegment(seg: RouteSegment, keepFromStart: boolean, keep: number): { kept: RouteSegment; cut: RoutePoint } {
  const cum = cumulativeDistances(seg.points);
  const total = cum[cum.length - 1];
  const a = keepFromStart ? 0 : total - keep;
  const b = keepFromStart ? keep : total;
  const pts = sliceByDistance(seg.points, cum, a, b);
  const cut = pointAtDistance(seg.points, cum, keepFromStart ? keep : total - keep);
  const kept: RouteSegment = { ...seg, id: createId('seg'), points: pts };
  if (seg.trackRef) {
    const { startDist, endDist } = seg.trackRef;
    const dir = endDist >= startDist ? 1 : -1;
    kept.trackRef = { ...seg.trackRef, startDist: startDist + dir * a, endDist: startDist + dir * b };
  }
  return { kept, cut };
}

function segmentLength(seg: RouteSegment): number {
  const cum = cumulativeDistances(seg.points);
  return cum.length > 0 ? cum[cum.length - 1] : 0;
}

/**
 * Déplace un waypoint. Seuls les segments adjacents sont recalculés.
 * Si un segment adjacent est une longue trace figée (TMB, variante, import), il est
 * conservé et seule sa partie proche du point (≈ 1,5 km) est recalculée, via un point de raccord.
 */
export function moveWaypoint(route: Route, index: number, p: LatLon): Route {
  const old = route.waypoints[index];
  if (!old) return route;
  const waypoints = [...route.waypoints];
  const segments = [...route.segments];
  waypoints[index] = { ...old, lat: p.lat, lon: p.lon };

  // Segment suivant (index → index + 1), traité en premier pour ne pas décaler les indices.
  const next = segments[index];
  if (next) {
    if (next.mode === 'track' && next.status === 'ok' && segmentLength(next) > LOCAL_DETOUR_DISTANCE * 2) {
      const len = segmentLength(next);
      const { kept, cut } = trimTrackSegment(next, false, len - LOCAL_DETOUR_DISTANCE);
      const junction = createWaypoint(cut, 'junction');
      waypoints.splice(index + 1, 0, junction);
      segments.splice(index, 1, pendingSegment(), kept);
    } else {
      segments[index] = pendingSegment();
    }
  }
  const prev = index > 0 ? segments[index - 1] : undefined;
  if (prev) {
    if (prev.mode === 'track' && prev.status === 'ok' && segmentLength(prev) > LOCAL_DETOUR_DISTANCE * 2) {
      const len = segmentLength(prev);
      const { kept, cut } = trimTrackSegment(prev, true, len - LOCAL_DETOUR_DISTANCE);
      const junction = createWaypoint(cut, 'junction');
      waypoints.splice(index, 0, junction);
      segments.splice(index - 1, 1, kept, pendingSegment());
    } else {
      segments[index - 1] = pendingSegment();
    }
  }
  return { ...route, waypoints, segments };
}

/** Supprime un waypoint ; ses deux voisins sont reliés par un nouveau segment calculé. */
export function removeWaypoint(route: Route, index: number): Route {
  const n = route.waypoints.length;
  if (index < 0 || index >= n) return route;
  const waypoints = route.waypoints.filter((_, i) => i !== index);
  const segments = [...route.segments];
  if (n === 1) return { ...route, waypoints, segments: [] };
  if (index === 0) segments.splice(0, 1);
  else if (index === n - 1) segments.splice(n - 2, 1);
  else segments.splice(index - 1, 2, pendingSegment());
  return { ...route, waypoints, segments };
}

/**
 * Reconstruit les segments après un changement d'ordre des waypoints :
 * un segment existant est réutilisé s'il relie toujours les deux mêmes points dans le même sens.
 */
export function rebuildSegments(route: Route, waypoints: Waypoint[]): Route {
  const byPair = new Map<string, RouteSegment>();
  route.segments.forEach((s, i) => byPair.set(`${route.waypoints[i].id}>${route.waypoints[i + 1].id}`, s));
  const segments: RouteSegment[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    segments.push(byPair.get(`${waypoints[i].id}>${waypoints[i + 1].id}`) ?? pendingSegment());
  }
  return { ...route, waypoints, segments };
}

/** Déplace un waypoint dans la liste (réordonnancement). */
export function reorderWaypoint(route: Route, from: number, to: number): Route {
  if (from === to || from < 0 || to < 0 || from >= route.waypoints.length || to >= route.waypoints.length) return route;
  const waypoints = [...route.waypoints];
  const [wp] = waypoints.splice(from, 1);
  waypoints.splice(to, 0, wp);
  return rebuildSegments(route, waypoints);
}

/** Inverse le sens de parcours (les traces figées sont parcourues à l'envers). */
export function reverseRoute(route: Route): Route {
  const waypoints = [...route.waypoints].reverse();
  const segments = [...route.segments].reverse().map((s) => {
    const out: RouteSegment = { ...s, id: createId('seg'), points: [...s.points].reverse() };
    if (s.trackRef) out.trackRef = { ...s.trackRef, startDist: s.trackRef.endDist, endDist: s.trackRef.startDist };
    return out;
  });
  // Les fins d'étape restent attachées au même lieu ; le dernier point n'en a pas besoin.
  return { ...route, waypoints, segments };
}

export function updateWaypoint(route: Route, index: number, patch: Partial<Pick<Waypoint, 'name' | 'stageEnd'>>): Route {
  const old = route.waypoints[index];
  if (!old) return route;
  const waypoints = [...route.waypoints];
  waypoints[index] = { ...old, ...patch };
  return { ...route, waypoints, segments: [...route.segments] };
}

/** Remplace un segment en erreur par un segment à recalculer (bouton « Réessayer »). */
export function retrySegment(route: Route, segmentIndex: number): Route {
  if (!route.segments[segmentIndex]) return route;
  const segments = [...route.segments];
  segments[segmentIndex] = pendingSegment();
  return { ...route, segments };
}

/** Relie deux points par une ligne droite (choix explicite de l'utilisateur, hors sentier). */
export function setStraight(route: Route, segmentIndex: number): Route {
  if (!route.segments[segmentIndex]) return route;
  const segments = [...route.segments];
  segments[segmentIndex] = straightSegment(route.waypoints[segmentIndex], route.waypoints[segmentIndex + 1]);
  return { ...route, segments };
}

/** Applique un résultat de calcul à un segment encore présent. */
export function applySegmentResult(route: Route, segmentId: string, result: Partial<RouteSegment>): Route {
  const i = route.segments.findIndex((s) => s.id === segmentId);
  if (i < 0) return route;
  const segments = [...route.segments];
  segments[i] = { ...segments[i], ...result };
  return { ...route, segments };
}

/** Distance entre deux points (exposée pour l'interface). */
export const distanceBetween = haversine;

/**
 * Crée un itinéraire à partir d'une trace complète (TMB, variante, GPX importé).
 * La trace est conservée telle quelle (segments « track ») ; des points d'édition
 * sont posés tous les `handleSpacing` mètres pour permettre des modifications locales.
 * Les trous de la trace d'origine deviennent des segments droits signalés.
 */
export function routeFromTrack(trackId: string, lookup: TrackLookup, name: string, handleSpacing = 0): Route {
  const track = lookup(trackId);
  if (!track) throw new Error(`Trace inconnue : ${trackId}`);
  const parts: [number, number][] = [];
  let start = 0;
  for (const b of [...track.breaks, track.points.length]) {
    if (b - 1 > start) parts.push([start, b - 1]);
    start = b;
  }
  const waypoints: Waypoint[] = [];
  const segments: RouteSegment[] = [];
  parts.forEach(([i0, i1], partIndex) => {
    const d0 = track.cum[i0];
    const d1 = track.cum[i1];
    const cuts = [d0];
    if (handleSpacing > 0) for (let d = d0 + handleSpacing; d < d1 - handleSpacing / 2; d += handleSpacing) cuts.push(d);
    cuts.push(d1);
    if (partIndex > 0) {
      const prev = waypoints[waypoints.length - 1];
      const startPt = pointAtDistance(track.points, track.cum, d0);
      const wp = createWaypoint(startPt, 'base');
      segments.push(straightSegment(prev, wp, { gap: true }));
      waypoints.push(wp);
    } else {
      waypoints.push(createWaypoint(pointAtDistance(track.points, track.cum, d0), 'base'));
    }
    for (let k = 1; k < cuts.length; k++) {
      const pts = sliceByDistance(track.points, track.cum, cuts[k - 1], cuts[k]);
      segments.push(
        trackSegment(pts, { trackId: track.id, trackKind: track.kind, startDist: cuts[k - 1], endDist: cuts[k] }),
      );
      waypoints.push(createWaypoint(pts[pts.length - 1], 'base'));
    }
  });
  return { id: createId('route'), name, waypoints, segments };
}
