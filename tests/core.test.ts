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
import {dailyStatistics}from'../lib/tmb/stages';
import {validateStoredRoute}from'../lib/tmb/storage';
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
