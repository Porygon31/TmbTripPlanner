import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import {
  composeTmb,
  conflicts,
  integrateVariant,
  newRoute,
  splitSegment,
} from "../lib/tmb/catalog";
import { distance, length, statistics } from "../lib/tmb/geo";
import { exportGpx, parseGpx } from "../lib/tmb/gpx";
import { EditCoordinator, recalculate } from "../lib/tmb/editor";
import * as routeEditor from "../lib/tmb/editor";
import {dailyStatistics}from'../lib/tmb/stages';
import {validateStoredRoute}from'../lib/tmb/storage';
import { selectRouteSection, combineSegmentStatistics } from "../lib/tmb/sections";
import type { Catalog, RoutePoint, RoutingProvider } from "../lib/tmb/types";
const parser = DOMParser as unknown as typeof globalThis.DOMParser;
const catalog = JSON.parse(
  fs.readFileSync("public/data/catalog.json", "utf8"),
) as Catalog;

test('daily stages end at marked waypoints and use the documented walking formula',()=>{const r=composeTmb(catalog,[]);r.waypoints[2].stageEnd=true;const days=dailyStatistics(r);assert.equal(days.length,2);assert.ok(Math.abs(days.reduce((sum,d)=>sum+d.stats.distance,0)-statistics(r.segments).distance)<.01);for(const d of days)assert.equal(d.stats.hours,d.stats.distance/1000/4+d.stats.ascent/600);});
test('stored drafts reject malformed data and preserve valid projects',()=>{const r=composeTmb(catalog,[]);assert.equal(validateStoredRoute({version:1,route:r,savedAt:''}),r);assert.equal(validateStoredRoute({version:2,route:r}),null);assert.equal(validateStoredRoute({version:1,route:{...r,segments:[{id:'x',source:{},points:[{lat:NaN,lon:6}]}]}}),null);});
test('deleting beside an imported gap does not invent a connecting segment',async()=>{const r=parseGpx('<gpx version="1.1"><trk><trkseg><trkpt lat="45.8" lon="6.8"/><trkpt lat="45.81" lon="6.8"/></trkseg><trkseg><trkpt lat="45.9" lon="6.8"/><trkpt lat="45.91" lon="6.8"/></trkseg></trk></gpx>','gap.gpx',parser);let calls=0;const provider:RoutingProvider={route:async(a,b)=>{calls++;return[a,b];},elevation:async p=>p};const result=await recalculate(r,r.waypoints.filter((_,i)=>i!==1),provider);assert.equal(calls,0);assert.equal(result.segments.length,1);});
const p = (lat: number, lon = 6.8, ele?: number) => ({
  lat,
  lon,
  ...(ele === undefined ? {} : { ele }),
});
const makeRoute = () => {
  const r = newRoute();
  r.waypoints = [0, 1, 2, 3, 4].map((i) => ({
    ...p(45.8 + i * 0.01),
    id: String(i),
    name: String(i),
  }));
  r.segments = r.waypoints
    .slice(1)
    .map((w, i) => ({
      id: "s" + i,
      from: String(i),
      to: String(i + 1),
      points: [r.waypoints[i], w],
      source: { kind: "osm", label: "Source" },
    }));
  return r;
};
test("section statistics follow the selected waypoints, including intermediate segments", () => {
  const route = makeRoute();
  route.segments.forEach((s, i) => { s.points = s.points.map((p, j) => ({ ...p, ele: 100 * i + 20 * j })); });
  const section = selectRouteSection(route, "1", "3");
  assert.deepEqual(section?.map(s => s.id), ["s1", "s2"]);
  const bySegment = Object.fromEntries(route.segments.map(s => [s.id, statistics([s])]));
  const actual = combineSegmentStatistics(section!, bySegment)!;
  const expected = statistics(route.segments.slice(1, 3));
  assert.deepEqual(actual, expected);
  assert.ok(actual.distance < statistics(route.segments).distance);
  assert.equal(actual.minElevation, 100);
  assert.equal(actual.maxElevation, 220);
  assert.equal(actual.hours, actual.distance / 4000 + actual.ascent / 600);
});
test("invalid or deleted section bounds never fall back to unrelated segments", () => {
  const route = makeRoute();
  for (const [from, to] of [["2", "1"], ["1", "1"], ["deleted", "2"], ["0", "missing"]]) {
    assert.equal(selectRouteSection(route, from, to), null);
  }
  const section = selectRouteSection(route, "0", "2")!;
  assert.equal(combineSegmentStatistics(section, { s0: statistics([route.segments[0]]) }), null);
});
test("section selection distinguishes a tour's arrival from its identical departure coordinates", () => {
  const route = composeTmb(catalog, []);
  const start = route.waypoints[0], arrival = route.waypoints.at(-1)!;
  assert.ok(distance(start, arrival) < 0.5);
  assert.deepEqual(selectRouteSection(route, start.id, arrival.id)?.map(s => s.id), route.segments.map(s => s.id));
  assert.deepEqual(selectRouteSection(route, route.waypoints.at(-2)!.id, arrival.id)?.map(s => s.id), [route.segments.at(-1)!.id]);
});
test("partial and missing elevations stay explicit in selected sections", () => {
  const route = makeRoute();
  route.segments[0].points[0].ele = 0;
  const bySegment = Object.fromEntries(route.segments.map(s => [s.id, statistics([s])]));
  const partial = combineSegmentStatistics(selectRouteSection(route, "0", "2")!, bySegment)!;
  assert.deepEqual(partial, statistics(route.segments.slice(0, 2)));
  assert.equal(partial.elevationCoverage, 0.25);
  assert.equal(partial.minElevation, 0);
  const missing = combineSegmentStatistics(selectRouteSection(route, "1", "2")!, bySegment)!;
  assert.equal(missing.elevationCoverage, 0);
  assert.equal(missing.minElevation, null);
});
test("sections across GPX breaks exclude unrecorded connectors and outside breaks", () => {
  const route = parseGpx('<gpx version="1.1"><trk><trkseg><trkpt lat="45.8" lon="6.8"/><trkpt lat="45.81" lon="6.8"/></trkseg><trkseg><trkpt lat="45.9" lon="6.8"/><trkpt lat="45.91" lon="6.8"/></trkseg></trk></gpx>', "gap.gpx", parser);
  const [a, b, c, d] = route.waypoints;
  assert.equal(selectRouteSection(route, b.id, c.id), null);
  const bySegment = Object.fromEntries(route.segments.map(s => [s.id, statistics([s])]));
  const all = combineSegmentStatistics(selectRouteSection(route, a.id, d.id)!, bySegment)!;
  assert.ok(Math.abs(all.distance - 2223.9) < 2);
  assert.equal(all.gaps, 1);
  assert.equal(combineSegmentStatistics(selectRouteSection(route, c.id, d.id)!, bySegment)!.gaps, 0);
});
test("geodesic distances and gaps exclude synthetic joins", () => {
  const s = statistics([
    { points: [p(45.8), p(45.81)] },
    { points: [p(46), p(46.01)], breakBefore: true },
  ]);
  assert.ok(Math.abs(s.distance - 2223.9) < 2);
  assert.equal(s.gaps, 1);
  assert.equal(s.minElevation, null);
  assert.equal(s.elevationCoverage, 0);
});
test("elevation noise, zero altitude and partial data are explicit", () => {
  const s = statistics([
    {
      points: [
        p(45, 6, 0),
        p(45.01, 6, 2),
        p(45.02, 6, 1),
        p(45.03, 6, 20),
        p(45.04, 6, 20),
        p(45.05),
      ],
    },
  ]);
  assert.equal(s.minElevation, 0);
  assert.equal(s.maxElevation, 20);
  assert.equal(s.elevationCoverage, 5 / 6);
  assert.ok(s.ascent >= 15 && s.ascent <= 20);
});
test("catalogue is a closed anticlockwise loop with real source metadata", () => {
  assert.equal(catalog.variants.length, 5);
  assert.ok(
    distance(catalog.main.points[0], catalog.main.points.at(-1)!) < 0.1,
  );
  assert.ok(
    distance(catalog.main.points[0], { lat: 45.8908, lon: 6.7981 }) < 700,
  );
  assert.ok(catalog.main.source.sha256?.length === 64);
  assert.ok(catalog.main.points.every((p) => Number.isFinite(p.ele)));
  let area = 0;
  catalog.main.points.slice(1).forEach((q, i) => {
    const p = catalog.main.points[i];
    area += p.lon * q.lat - q.lon * p.lat;
  });
  assert.ok(area > 0);
});
test("all variants replace only their intended interval with correct direction", () => {
  for (const v of catalog.variants) {
    const r = composeTmb(catalog, [v.id]);
    assert.ok(
      Math.abs(
        statistics(r.segments).distance -
          (length(catalog.main.points) + v.delta),
      ) < 1,
    );
    const segment = r.segments.find((s) => s.variantId === v.id)!;
    assert.ok(
      distance(segment.points[0], catalog.main.points[v.anchors[0]]) < 0.5,
    );
    const flipped = {
      ...catalog,
      variants: catalog.variants.map((x) =>
        x.id === v.id ? { ...v, points: [...v.points].reverse() } : x,
      ),
    };
    assert.ok(
      Math.abs(
        statistics(composeTmb(flipped, [v.id]).segments).distance -
          statistics(r.segments).distance,
      ) < 1,
    );
  }
});
test("duplicate additions are idempotent and overlaps are rejected", () => {
  const v = catalog.variants[0];
  const r = composeTmb(catalog, [v.id, v.id]);
  assert.deepEqual(r.variantIds, [v.id]);
  assert.equal(integrateVariant(r, v), r);
  const clone = { ...v, id: "overlap" };
  const c = { ...catalog, variants: [...catalog.variants, clone] };
  assert.equal(conflicts(c, [v.id], clone).length, 1);
  assert.throws(() => composeTmb(c, [v.id, clone.id]), /chevauchent/);
});
test("variant insertion preserves all unaffected source geometry", () => {
  const r = composeTmb(catalog, []),
    v = catalog.variants[0];
  const n = integrateVariant(r, v);
  assert.ok(
    Math.abs(
      statistics(n.segments).distance - (length(catalog.main.points) + v.delta),
    ) < 1,
  );
  assert.ok(n.segments.some((s) => r.segments.includes(s)));
});
test("inserting a waypoint preserves every coordinate", () => {
  const r = makeRoute();
  r.segments[0].points.splice(1, 0, p(45.805));
  const s = splitSegment(r, "s0", 1);
  assert.equal(s.segments.length, r.segments.length + 1);
  assert.ok(
    Math.abs(
      statistics(s.segments).distance - statistics(r.segments).distance,
    ) < 0.001,
  );
});
test("moving a waypoint recalculates exactly its two adjacent segments", async () => {
  const r = makeRoute(),
    calls: RoutePoint[][] = [];
  const provider: RoutingProvider = {
    route: async (a, b) => {
      calls.push([a, b]);
      return [a, b];
    },
    elevation: async (p) => p,
  };
  const w = r.waypoints.map((x) => (x.id === "2" ? { ...x, lon: 6.81 } : x));
  const result = await recalculate(r, w, provider);
  assert.equal(calls.length, 2);
  assert.equal(result.segments[0], r.segments[0]);
  assert.equal(result.segments[3], r.segments[3]);
  assert.equal(result.segments[1].source.kind, "routing");
});
test("a failed edit cannot mutate the previous route", async () => {
  const r = makeRoute(),
    before = JSON.stringify(r);
  const provider: RoutingProvider = {
    route: async () => {
      throw Error("quota");
    },
    elevation: async (p) => p,
  };
  await assert.rejects(
    recalculate(
      r,
      r.waypoints.map((x) => (x.id === "2" ? { ...x, lon: 6.81 } : x)),
      provider,
    ),
    /quota/,
  );
  assert.equal(JSON.stringify(r), before);
});
test("late server responses cannot overwrite a newer edit", async () => {
  const c = new EditCoordinator(),
    commits: number[] = [];
  let finish!: (n: number) => void;
  const old = c.run(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    (n) => commits.push(n),
  );
  await c.run(
    async () => 2,
    (n) => commits.push(n),
  );
  finish(1);
  assert.equal(await old, false);
  assert.deepEqual(commits, [2]);
});
test("GPX roundtrip keeps exact coordinates, altitude and segment boundaries", () => {
  const r = composeTmb(
    catalog,
    catalog.variants.map((v) => v.id),
  );
  r.name = "Tour <test> & montagne";
  const xml = exportGpx(r);
  const parsed = parseGpx(xml, "roundtrip.gpx", parser);
  assert.equal(parsed.name, r.name);
  assert.deepEqual(
    parsed.segments.map((s) => s.points),
    r.segments.map((s) => s.points),
  );
  fs.mkdirSync("outputs", { recursive: true });
  fs.writeFileSync("outputs/roundtrip.gpx", xml);
});
test("GPX 1.0 route and disconnected 1.1 tracks are accepted", () => {
  const r = parseGpx(
    '<gpx version="1.0"><rte><rtept lat="45" lon="6"><ele>0</ele></rtept><rtept lat="45.01" lon="6"/></rte></gpx>',
    "v1.gpx",
    parser,
  );
  assert.equal(r.segments[0].points[0].ele, 0);
  const s = parseGpx(
    '<gpx version="1.1"><trk><trkseg><trkpt lat="45" lon="6"/></trkseg><trkseg><trkpt lat="46" lon="7"/></trkseg></trk></gpx>',
    "segments.gpx",
    parser,
  );
  assert.equal(s.segments.length, 2);
  assert.equal(statistics(s.segments).distance, 0);
  assert.equal(s.segments[1].breakBefore, true);
});
test("invalid, empty and oversized GPX files are rejected", () => {
  for (const xml of [
    '<gpx version="1.1"><rte><rtept lat="45" lon="6"></rte></gpx>',
    '<gpx version="1.1"><rte><rtept lat="45" lon="6"/>',
    '<gpx version="1.1"/>',
    '<gpx version="1.1"><rte><rtept lat="bad" lon="6"/></rte></gpx>',
    '<!DOCTYPE gpx><gpx version="1.1"/>',
    "x".repeat(10 * 1024 * 1024 + 1),
  ])
    assert.throws(() => parseGpx(xml, "bad.gpx", parser));
  const huge =
    '<gpx version="1.1"><rte>' +
    '<rtept lat="45" lon="6"/>'.repeat(100001) +
    "</rte></gpx>";
  assert.throws(() => parseGpx(huge, "huge.gpx", parser), /100 000/);
});
test("catalog difficulty and imported attribution retain their actual sources", () => {
  assert.match(catalog.variants.find(v => v.id === '9678380')!.difficulty, /SAC T4/);
  const r = parseGpx('<gpx version="1.1"><metadata><copyright author="Auteur"><year>2026</year><license>https://example.org/licence</license></copyright></metadata><trk><trkseg><trkpt lat="45" lon="6"/></trkseg></trk></gpx>', 'attribution.gpx', parser);
  assert.match(exportGpx(r), /Auteur — 2026 — https:\/\/example.org\/licence/);
});

test("the classic TMB links its existing arrival to the first waypoint", () => {
  const route = composeTmb(catalog, [catalog.variants[0].id]);
  assert.equal(route.roundTrip?.arrivalId, route.waypoints.at(-1)!.id);
  assert.ok(distance(route.waypoints[0], route.waypoints.at(-1)!) < 0.01);
  assert.equal(route.waypoints.length, route.segments.length + 1);
});

const recordingProvider = () => {
  const calls: RoutePoint[][] = [];
  const provider: RoutingProvider = {
    route: async (a, b) => {
      calls.push([a, b]);
      // Include an intermediate point to verify the complete routed return is kept.
      return [a, { lat: (a.lat + b.lat) / 2, lon: a.lon + 0.001, ele: 1234 }, b];
    },
    elevation: async points => points,
  };
  return { calls, provider };
};

test("closing a route routes only its return and exports that complete geometry", async () => {
  const original = makeRoute(), { calls, provider } = recordingProvider();
  const closed = await routeEditor.setRoundTrip(original, true, provider);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0], original.waypoints.at(-1));
  assert.equal(calls[0][1].lat, original.waypoints[0].lat);
  assert.equal(closed.waypoints.length, original.waypoints.length + 1);
  original.segments.forEach((segment, i) => assert.equal(closed.segments[i], segment));
  assert.equal(closed.segments.at(-1)!.source.kind, "routing");
  assert.equal(await routeEditor.setRoundTrip(closed, true, provider), closed);
  const exported = parseGpx(exportGpx(closed), "closed.gpx", parser);
  assert.deepEqual(exported.segments.map(s => s.points), closed.segments.map(s => s.points.map(({ lat, lon, ele }) => ({ lat, lon, ...(ele === undefined ? {} : { ele }) }))));
  assert.ok(statistics(closed.segments).distance > statistics(original.segments).distance);
  const reopened = await routeEditor.setRoundTrip(closed, false, provider);
  assert.equal(reopened.roundTrip, undefined);
  assert.deepEqual(reopened.waypoints, original.waypoints);
  assert.deepEqual(reopened.segments, original.segments);
  assert.equal(calls.length, 1);
});

test("a single departure can be linked before adding stops without a zero-length leg", async () => {
  const route = newRoute(), { calls, provider } = recordingProvider();
  route.waypoints = [makeRoute().waypoints[0]];
  const linked = await routeEditor.setRoundTrip(route, true, provider);
  assert.ok(linked.roundTrip);
  assert.equal(linked.waypoints.length, 1);
  assert.equal(linked.segments.length, 0);
  assert.equal(calls.length, 0);
  const withStop = await recalculate(linked, [...linked.waypoints, makeRoute().waypoints[1]], provider);
  assert.equal(calls.length, 2);
  assert.equal(withStop.waypoints.length, 3);
  assert.equal(withStop.waypoints.at(-1)!.id, linked.roundTrip!.arrivalId);
  const reduced = await recalculate(withStop, [withStop.waypoints[0]], provider);
  assert.equal(reduced.waypoints.length, 1);
  assert.equal(reduced.segments.length, 0);
  assert.equal(calls.length, 2);
});

test("moving a linked departure recalculates only outgoing and returning legs", async () => {
  const { calls, provider } = recordingProvider();
  const closed = await routeEditor.setRoundTrip(makeRoute(), true, provider);
  calls.length = 0;
  const moved = await recalculate(closed, closed.waypoints.map((w, i) => i ? w : { ...w, lon: 6.81, name: "Nouveau départ" }), provider);
  assert.equal(calls.length, 2);
  assert.equal(moved.waypoints.at(-1)!.lon, 6.81);
  assert.match(moved.waypoints.at(-1)!.name, /Nouveau départ/);
  assert.equal(moved.roundTrip!.arrivalId, closed.roundTrip!.arrivalId);
  for (let i = 1; i < closed.segments.length - 1; i++) assert.equal(moved.segments[i], closed.segments[i]);
});

test("added stops, reordering and deletion keep the linked arrival last", async () => {
  const { calls, provider } = recordingProvider();
  const closed = await routeEditor.setRoundTrip(makeRoute(), true, provider);
  calls.length = 0;
  const added = await recalculate(closed, [...closed.waypoints, { ...p(45.87), id: "extra", name: "Détour" }], provider);
  assert.equal(calls.length, 2);
  assert.equal(added.waypoints.at(-2)!.id, "extra");
  assert.equal(added.waypoints.at(-1)!.id, closed.roundTrip!.arrivalId);
  closed.segments.slice(0, -1).forEach((s, i) => assert.equal(added.segments[i], s));
  const reordered = await recalculate(added, [added.waypoints[1], added.waypoints[0], ...added.waypoints.slice(2)], provider);
  assert.equal(reordered.waypoints.at(-1)!.lat, reordered.waypoints[0].lat);
  const deleted = await recalculate(reordered, reordered.waypoints.slice(1), provider);
  assert.equal(deleted.waypoints.at(-1)!.lat, deleted.waypoints[0].lat);
});

test("enabling an already closed GPX keeps its segments and gaps exactly", async () => {
  const imported = parseGpx('<gpx version="1.1"><trk><trkseg><trkpt lat="45.8" lon="6.8"/><trkpt lat="45.81" lon="6.8"/></trkseg><trkseg><trkpt lat="45.9" lon="6.8"/><trkpt lat="45.8" lon="6.8"/></trkseg></trk></gpx>', "closed.gpx", parser);
  const { calls, provider } = recordingProvider();
  const result = await routeEditor.setRoundTrip(imported, true, provider);
  assert.deepEqual(result.segments, imported.segments);
  assert.equal(result.waypoints.length, imported.waypoints.length);
  assert.equal(calls.length, 0);
});

test("a failed or cancelled closure cannot overwrite the last valid route", async () => {
  const original = makeRoute(), before = JSON.stringify(original);
  const failing: RoutingProvider = { route: async () => { throw Error("quota"); }, elevation: async p => p };
  await assert.rejects(routeEditor.setRoundTrip(original, true, failing), /quota/);
  assert.equal(JSON.stringify(original), before);
  const coordinator = new EditCoordinator();
  let finish!: (points: RoutePoint[]) => void;
  let committed = original;
  const pending = coordinator.run(signal => routeEditor.setRoundTrip(original, true, { ...failing, route: () => new Promise(resolve => { finish = resolve; }) }, signal), result => { committed = result; });
  coordinator.cancel();
  finish([original.waypoints.at(-1)!, original.waypoints[0]]);
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(committed, original);
});

test("linked arrival metadata survives storage and malformed links are rejected", async () => {
  const { provider } = recordingProvider();
  const route = await routeEditor.setRoundTrip(makeRoute(), true, provider);
  const stored = JSON.parse(JSON.stringify({ version: 1, route, savedAt: "" }));
  assert.deepEqual(validateStoredRoute(stored), JSON.parse(JSON.stringify(route)));
  stored.route.roundTrip.arrivalId = stored.route.waypoints[1].id;
  assert.equal(validateStoredRoute(stored), null);
});

test("appending a variant inserts it before the return and keeps other source geometry", async () => {
  const { calls, provider } = recordingProvider();
  const route = await routeEditor.setRoundTrip(makeRoute(), true, provider);
  calls.length = 0;
  const variant = catalog.variants[0];
  const result = await routeEditor.appendVariant(route, variant, provider);
  assert.equal(calls.length, 2); // Connection to the variant, then return to departure.
  assert.equal(calls[0][0].lat, route.waypoints.at(-2)!.lat);
  assert.equal(result.waypoints.at(-1)!.id, route.roundTrip!.arrivalId);
  assert.equal(result.waypoints.at(-1)!.lat, result.waypoints[0].lat);
  route.segments.slice(0, -1).forEach((s, i) => assert.equal(result.segments[i], s));
  assert.ok(result.segments.some(s => s.variantId === variant.id && s.source.kind === "osm"));
  const before = JSON.stringify(route);
  let request = 0;
  await assert.rejects(routeEditor.appendVariant(route, variant, {
    ...provider, route: async (a, b) => { if (++request === 2) throw Error("return failed"); return [a, b]; },
  }), /return failed/);
  assert.equal(JSON.stringify(route), before);
});

test("a single closed imported segment is preserved when linking its departure", async () => {
  const route = parseGpx('<gpx version="1.1"><trk><trkseg><trkpt lat="45.8" lon="6.8"/><trkpt lat="45.9" lon="6.9"/><trkpt lat="45.8" lon="6.8"/></trkseg></trk></gpx>', "loop.gpx", parser);
  const { calls, provider } = recordingProvider();
  const linked = await routeEditor.setRoundTrip(route, true, provider);
  assert.equal(linked.waypoints.length, 2);
  assert.deepEqual(linked.segments, route.segments);
  assert.equal(calls.length, 0);
  await assert.rejects(recalculate(linked, linked.waypoints.map((w, i) => i ? w : { ...w, lon: 6.81 }), provider), /point de passage/);
});
