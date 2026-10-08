import { describe, expect, it } from 'vitest';
import { haversine } from '../../src/core/geo/distance';
import { pointAtDistance } from '../../src/core/geo/projection';
import { buildRouteGeometry } from '../../src/core/route/geometry';
import { appendTrack, ComposeError, removeVariant, routeFromMain, spliceVariant } from '../../src/core/route/compose';
import { appendWaypoint, emptyRoute, reverseRoute } from '../../src/core/route/operations';
import { routeStatistics } from '../../src/core/route/stats';
import { indexTrack, type IndexedTrack } from '../../src/core/route/tracks';
import { orientVariant } from '../../src/core/variants/junctions';
import type { RoutePoint } from '../../src/core/types';
import { chain, line, maxStep, squareLoop } from './helpers';

const main = indexTrack({ id: 'main', name: 'Boucle', kind: 'tmb', points: squareLoop(), breaks: [] });

/** Variante SYNTHÉTIQUE : détour vers le nord entre deux abscisses du côté A → B. */
function detour(id: string, d0: number, d1: number, north = 0.003): IndexedTrack {
  const p0 = pointAtDistance(main.points, main.cum, d0);
  const p1 = pointAtDistance(main.points, main.cum, d1);
  const up0 = { lat: p0.lat + north, lon: p0.lon };
  const up1 = { lat: p1.lat + north, lon: p1.lon };
  const ele = () => 1300;
  const pts: RoutePoint[] = chain(line(p0, up0, 25, ele), line(up0, up1, 25, ele), line(up1, p1, 25, ele));
  return indexTrack({ id, name: id, kind: 'variant', points: pts, breaks: [] });
}

const v1 = detour('v1', 1000, 2500);
const v2 = detour('v2', 3000, 4000);
const vOverlap = detour('vOverlap', 2000, 3500);
const tracks = new Map<string, IndexedTrack>([main, v1, v2, vOverlap].map((t) => [t.id, t]));
const lookup = (id: string) => tracks.get(id);
const junctions = (t: IndexedTrack) => {
  const o = orientVariant(main, t.points);
  return { id: t.id, name: t.name, startOnMain: o.start.distOnMain, endOnMain: o.end.distOnMain };
};

describe('orientation des variantes', () => {
  it('remet une variante dans le sens du TMB', () => {
    const reversed = [...v1.points].reverse();
    const o = orientVariant(main, reversed);
    expect(o.reversed).toBe(true);
    expect(o.start.distOnMain).toBeCloseTo(1000, 0);
    expect(o.end.distOnMain).toBeCloseTo(2500, 0);
    expect(o.attachable).toBe(true);
  });

  it('signale une variante non raccordée', () => {
    const far = line({ lat: 46.5, lon: 7 }, { lat: 46.51, lon: 7 });
    expect(orientVariant(main, far).attachable).toBe(false);
  });
});

describe('TMB personnalisé', () => {
  it('greffe une variante sans trou ni doublon', () => {
    const base = routeFromMain(main, 'Mon TMB');
    const { route } = spliceVariant(base, lookup, 'main', junctions(v1));
    const g = buildRouteGeometry(route);
    expect(g.complete).toBe(true);
    expect(maxStep(g.points)).toBeLessThan(30);
    expect(route.segments.filter((s) => s.trackRef?.trackId === 'v1')).toHaveLength(1);
    // Le tronçon classique remplacé (1,5 km) disparaît, le détour (+2 × 333 m) apparaît.
    const expected = main.length - 1500 + v1.length;
    expect(routeStatistics(route).distance).toBeCloseTo(expected, -1);
    // Départ et arrivée du TMB inchangés.
    expect(haversine(g.points[0], main.points[0])).toBeLessThan(1);
    expect(haversine(g.points[g.points.length - 1], main.points[main.points.length - 1])).toBeLessThan(1);
  });

  it('refuse les doublons et les chevauchements', () => {
    const { route } = spliceVariant(routeFromMain(main, 'x'), lookup, 'main', junctions(v1));
    expect(() => spliceVariant(route, lookup, 'main', junctions(v1))).toThrow(ComposeError);
    expect(() => spliceVariant(route, lookup, 'main', junctions(vOverlap), (id) => id)).toThrow(/chevauche « v1 »/);
  });

  it('combine plusieurs variantes compatibles', () => {
    let r = routeFromMain(main, 'x');
    r = spliceVariant(r, lookup, 'main', junctions(v2)).route;
    r = spliceVariant(r, lookup, 'main', junctions(v1)).route;
    const ids = r.segments.map((s) => s.trackRef?.trackId);
    expect(ids.indexOf('v1')).toBeLessThan(ids.indexOf('v2'));
    expect(maxStep(buildRouteGeometry(r).points)).toBeLessThan(30);
  });

  it('retirer une variante restaure le TMB classique', () => {
    const base = routeFromMain(main, 'x');
    let r = spliceVariant(base, lookup, 'main', junctions(v1)).route;
    r = spliceVariant(r, lookup, 'main', junctions(v2)).route;
    r = removeVariant(r, lookup, 'main', 'v1');
    r = removeVariant(r, lookup, 'main', 'v2');
    expect(r.segments).toHaveLength(1);
    expect(r.waypoints).toHaveLength(2);
    expect(routeStatistics(r).distance).toBeCloseTo(main.length, 0);
  });

  it('fonctionne aussi dans le sens horaire', () => {
    const base = reverseRoute(routeFromMain(main, 'x'));
    const { route } = spliceVariant(base, lookup, 'main', junctions(v1));
    const g = buildRouteGeometry(route);
    expect(maxStep(g.points)).toBeLessThan(30);
    expect(haversine(g.points[0], main.points[main.points.length - 1])).toBeLessThan(1);
  });
});

describe('mode libre', () => {
  it('ajoute une variante depuis l’extrémité la plus proche, avec raccord', () => {
    let r = emptyRoute();
    const end = v1.points[v1.points.length - 1];
    r = appendWaypoint(r, { lat: end.lat - 0.002, lon: end.lon + 0.002 });
    const out = appendTrack(r, lookup, 'v1', 'V1');
    // Raccord calculé (> 50 m) puis la variante parcourue à l'envers depuis sa fin.
    expect(out.segments[0].status).toBe('pending');
    expect(out.segments[0].connectorFor).toBe('v1');
    const t = out.segments[1];
    expect(t.trackRef!.startDist).toBeCloseTo(v1.length, 3);
    expect(t.trackRef!.endDist).toBe(0);
    expect(() => appendTrack(out, lookup, 'v1', 'V1')).toThrow(ComposeError);
  });

  it('part du point courant si celui-ci est déjà sur la trace', () => {
    let r = emptyRoute();
    const mid = pointAtDistance(v1.points, v1.cum, v1.length * 0.3);
    r = appendWaypoint(r, mid);
    const out = appendTrack(r, lookup, 'v1', 'V1');
    expect(out.segments).toHaveLength(1);
    expect(out.segments[0].trackRef!.startDist).toBeCloseTo(v1.length * 0.3, 0);
    expect(out.segments[0].trackRef!.endDist).toBeCloseTo(v1.length, 3);
  });
});
