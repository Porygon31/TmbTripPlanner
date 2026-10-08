import { describe, expect, it } from 'vitest';
import { haversine } from '../../src/core/geo/distance';
import { parseGpxString, gpxToTrack } from '../../src/core/gpx/parse';
import { routeToGpx, STAGE_END_TYPE } from '../../src/core/gpx/exportRoute';
import { buildRouteGeometry } from '../../src/core/route/geometry';
import { commit, createHistory, redo, undo } from '../../src/core/route/history';
import {
  appendWaypoint,
  applySegmentResult,
  emptyRoute,
  LOCAL_DETOUR_DISTANCE,
  moveWaypoint,
  removeWaypoint,
  reorderWaypoint,
  reverseRoute,
  routeFromTrack,
  splitSegmentAt,
  updateWaypoint,
} from '../../src/core/route/operations';
import { routeStatistics, stageStatistics } from '../../src/core/route/stats';
import { indexTrack } from '../../src/core/route/tracks';
import type { Route } from '../../src/core/types';
import { line, maxStep, squareLoop, xmlParser } from './helpers';

/** Simule un moteur de routage : remplit les segments en attente par une ligne découpée. */
function resolveAll(route: Route): Route {
  let r = route;
  route.segments.forEach((s, i) => {
    if (s.status === 'pending') {
      const pts = line(route.waypoints[i], route.waypoints[i + 1], 20, () => 1000);
      r = applySegmentResult(r, s.id, { status: 'ok', points: pts, provider: 'test' });
    }
  });
  return r;
}

const P = [
  { lat: 45.9, lon: 6.8 },
  { lat: 45.91, lon: 6.81 },
  { lat: 45.92, lon: 6.8 },
  { lat: 45.93, lon: 6.81 },
];

function threePointRoute(): Route {
  let r = emptyRoute();
  for (const p of P.slice(0, 3)) r = appendWaypoint(r, p);
  return resolveAll(r);
}

describe('édition d’itinéraire', () => {
  it('ajout de points : un segment à calculer par paire', () => {
    let r = emptyRoute();
    r = appendWaypoint(r, P[0]);
    expect(r.segments).toHaveLength(0);
    r = appendWaypoint(r, P[1]);
    r = appendWaypoint(r, P[2]);
    expect(r.segments).toHaveLength(2);
    expect(r.segments.every((s) => s.status === 'pending')).toBe(true);
  });

  it('déplacement : seuls les segments adjacents sont recalculés', () => {
    let r = threePointRoute();
    r = appendWaypoint(r, P[3]);
    r = resolveAll(r);
    const before = r.segments.map((s) => s.id);
    const moved = moveWaypoint(r, 3, { lat: 45.935, lon: 6.815 });
    expect(moved.segments[0].id).toBe(before[0]);
    expect(moved.segments[1].id).toBe(before[1]);
    expect(moved.segments[2].status).toBe('pending');
    const movedMiddle = moveWaypoint(r, 1, { lat: 45.911, lon: 6.812 });
    expect(movedMiddle.segments[0].status).toBe('pending');
    expect(movedMiddle.segments[1].status).toBe('pending');
    expect(movedMiddle.segments[2].id).toBe(before[2]);
  });

  it('suppression : les voisins sont reliés', () => {
    const r = removeWaypoint(threePointRoute(), 1);
    expect(r.waypoints).toHaveLength(2);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].status).toBe('pending');
    const first = removeWaypoint(threePointRoute(), 0);
    expect(first.segments).toHaveLength(1);
    expect(first.segments[0].status).toBe('ok');
  });

  it('réordonnancement : réutilise les segments encore valides', () => {
    let r = threePointRoute();
    r = resolveAll(appendWaypoint(r, P[3]));
    const keep = r.segments[2].id;
    const re = reorderWaypoint(r, 0, 1);
    expect(re.waypoints.map((w) => w.lat)).toEqual([P[1].lat, P[0].lat, P[2].lat, P[3].lat]);
    expect(re.segments[2].id).toBe(keep);
    expect(re.segments[0].status).toBe('pending');
    expect(re.segments[1].status).toBe('pending');
  });

  it('insertion sur le tracé sans recalcul', () => {
    const r = threePointRoute();
    const { route, waypointIndex } = splitSegmentAt(r, 0, { lat: 45.905, lon: 6.805 });
    expect(waypointIndex).toBe(1);
    expect(route.waypoints).toHaveLength(4);
    expect(route.segments.every((s) => s.status === 'ok')).toBe(true);
    expect(routeStatistics(route).distance).toBeCloseTo(routeStatistics(r).distance, 0);
  });

  it('inversion du sens', () => {
    const r = threePointRoute();
    const rev = reverseRoute(r);
    expect(rev.waypoints[0].id).toBe(r.waypoints[2].id);
    expect(rev.segments[0].points[0]).toEqual(r.segments[1].points[r.segments[1].points.length - 1]);
    expect(routeStatistics(rev).distance).toBeCloseTo(routeStatistics(r).distance, 3);
  });

  it('géométrie continue et sans doublon aux jonctions', () => {
    const r = threePointRoute();
    const g = buildRouteGeometry(r);
    expect(g.complete).toBe(true);
    expect(g.waypointIndex).toHaveLength(3);
    expect(g.points.length).toBe(r.segments[0].points.length + r.segments[1].points.length - 1);
    expect(maxStep(g.points)).toBeLessThan(30);
  });
});

describe('trace figée et recalcul local', () => {
  const track = indexTrack({ id: 'loop', name: 'Loop', kind: 'tmb', points: squareLoop(), breaks: [] });
  const lookup = (id: string) => (id === 'loop' ? track : undefined);

  it('itinéraire depuis une trace avec points d’édition', () => {
    const r = routeFromTrack('loop', lookup, 'x', 5000);
    expect(r.segments.every((s) => s.mode === 'track')).toBe(true);
    expect(routeStatistics(r).distance).toBeCloseTo(track.length, 0);
    expect(r.waypoints.length).toBeGreaterThan(3);
  });

  it('déplacer un point sur une longue trace ne recalcule qu’une fenêtre locale', () => {
    const r = routeFromTrack('loop', lookup, 'x', 0);
    const { route: split, waypointIndex } = splitSegmentAt(r, 0, { lat: 45.86, lon: 6.74 });
    const moved = moveWaypoint(split, waypointIndex, { lat: 45.855, lon: 6.735 });
    // Avant et après : trace conservée + raccord + segment à calculer de chaque côté.
    expect(moved.waypoints).toHaveLength(split.waypoints.length + 2);
    const pending = moved.segments.filter((s) => s.status === 'pending');
    expect(pending).toHaveLength(2);
    const kept = moved.segments.filter((s) => s.mode === 'track');
    expect(kept).toHaveLength(2);
    const keptLength = kept.reduce((sum, s) => sum + Math.abs(s.trackRef!.endDist - s.trackRef!.startDist), 0);
    expect(keptLength).toBeCloseTo(track.length - 2 * LOCAL_DETOUR_DISTANCE, -1);
  });

  it('les trous de la trace deviennent des segments signalés', () => {
    const pts = squareLoop();
    const t = indexTrack({ id: 'gap', name: 'g', kind: 'import', points: pts, breaks: [100] });
    const r = routeFromTrack('gap', (id) => (id === 'gap' ? t : undefined), 'x');
    expect(r.segments.some((s) => s.gap)).toBe(true);
  });
});

describe('étapes et export', () => {
  it('statistiques par étape cohérentes avec le total', () => {
    let r = threePointRoute();
    r = resolveAll(appendWaypoint(r, P[3]));
    r = updateWaypoint(r, 1, { stageEnd: true, name: 'Refuge X' });
    const stages = stageStatistics(r);
    expect(stages).toHaveLength(2);
    expect(stages[0].toName).toBe('Refuge X');
    expect(stages[1].fromName).toBe('Refuge X');
    const sum = stages.reduce((s, x) => s + x.distance, 0);
    expect(sum).toBeCloseTo(routeStatistics(r).distance, 3);
  });

  it('export GPX puis relecture : mêmes points, même ordre, mêmes statistiques', () => {
    let r = threePointRoute();
    r = resolveAll(appendWaypoint(r, P[3]));
    r = updateWaypoint(r, 2, { stageEnd: true });
    r = { ...r, name: 'Mon TMB' };
    const xml = routeToGpx(r);
    const parsed = parseGpxString(xml, xmlParser);
    expect(parsed.name).toBe('Mon TMB');
    const t = gpxToTrack(parsed, 'x', 'import', 'x');
    const g = buildRouteGeometry(r);
    expect(t.points).toHaveLength(g.points.length);
    t.points.forEach((p, i) => {
      expect(haversine(p, g.points[i])).toBeLessThan(0.05);
    });
    expect(parsed.waypoints.filter((w) => w.type === STAGE_END_TYPE)).toHaveLength(1);

    const perStage = parseGpxString(routeToGpx(r, { perStage: true }), xmlParser);
    expect(perStage.lines).toHaveLength(2);
  });

  it('refuse d’exporter un itinéraire incomplet', () => {
    let r = emptyRoute();
    r = appendWaypoint(appendWaypoint(r, P[0]), P[1]);
    expect(() => routeToGpx(r)).toThrow();
  });
});

describe('historique', () => {
  it('annuler / rétablir', () => {
    let h = createHistory(1);
    h = commit(h, 2);
    h = commit(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(2);
    h = commit(h, 4);
    expect(h.future).toHaveLength(0);
  });
});
