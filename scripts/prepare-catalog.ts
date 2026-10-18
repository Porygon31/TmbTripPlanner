import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import { distance, length, nearestIndex, statistics } from "../lib/tmb/geo";
import type { RoutePoint, Provenance, TmbVariant } from "../lib/tmb/types";
process.loadEnvFile(".env.local");
const descriptions = [
  [
    9678267,
    "Col de Tricot",
    "#c58047",
    "Par les alpages de Miage, entre le col de Voza et les Contamines.",
  ],
  [
    9678296,
    "Col des Fours",
    "#8667a8",
    "Un passage en altitude entre la Croix du Bonhomme et la Ville des Glaciers.",
  ],
  [
    9678375,
    "Tête Bernarda",
    "#519e93",
    "Les crêtes au-dessus de Courmayeur, de Bertone à Bonatti.",
  ],
  [
    9678380,
    "Fenêtre d’Arpette",
    "#5385b9",
    "Une traversée minérale entre Champex et le vallon du Trient.",
  ],
  [
    9678437,
    "Variante des Grands",
    "#b86379",
    "Un balcon face au glacier du Trient, par le refuge des Grands.",
  ],
] as const;
const idList = [9678362, ...descriptions.map((v) => v[0])];
const now = new Date().toISOString();
const audit: Record<string, unknown> = {};
const sac = [
  "hiking",
  "mountain_hiking",
  "demanding_mountain_hiking",
  "alpine_hiking",
  "demanding_alpine_hiking",
  "difficult_alpine_hiking",
];
async function load(id: number) {
  const raw = await fs.readFile(`public/data/sources/${id}.gpx`, "utf8");
  const doc = new DOMParser().parseFromString(raw, "text/xml");
  const segments = Array.from(doc.getElementsByTagName("trkseg")).map((s) =>
    Array.from(s.getElementsByTagName("trkpt")).map((p) => ({
      lat: +p.getAttribute("lat")!,
      lon: +p.getAttribute("lon")!,
    })),
  );
  const ways = JSON.parse(
    await fs.readFile(`public/data/sources/${id}-ways.json`, "utf8"),
  );
  const meta = JSON.parse(
    await fs.readFile(`public/data/sources/${id}-metadata.json`, "utf8"),
  ).elements[0];
  const tags: string[] = [];
  let total = 0;
  function walk(n: Record<string, unknown>) {
    if (n.type === "base" || n.route_type === "base") {
      total++;
      const t = n.tags as Record<string, string>;
      if (t?.sac_scale) tags.push(t.sac_scale);
    }
    for (const v of Object.values(n)) {
      if (Array.isArray(v))
        v.forEach((x) => {
          if (x && typeof x === "object") walk(x);
        });
      else if (v && typeof v === "object") walk(v as Record<string, unknown>);
    }
  }
  walk(ways.route);
  const rank = Math.max(-1, ...tags.map((t) => sac.indexOf(t)));
  const difficulty = rank < 0 ? "Non renseignée" : `SAC T${rank + 1}${tags.length < total ? " · partiel" : ""}`;
  const source: Provenance = {
    kind: "osm",
    label: id === 9678362 ? "TMB classique — données OpenStreetMap" : ways.name,
    url: `https://hiking.waymarkedtrails.org/#route?id=${id}`,
    relationId: id,
    version: meta.version,
    extractedAt: now,
    license: "© OpenStreetMap contributors — ODbL 1.0",
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
  const points: RoutePoint[] = [];
  const gaps: number[] = [];
  for (const s of segments) {
    if (!s.length) continue;
    if (points.length) {
      const d = distance(points.at(-1)!, s[0]);
      if (d > 0.5) gaps.push(d);
      else s.shift();
    }
    points.push(...s);
  }
  audit[id] = {
    originalSegments: segments.length,
    points: points.length,
    gaps,
    version: meta.version,
    osmTimestamp: meta.timestamp,
    difficultyCoverage: tags.length / total,
  };
  if (gaps.length) throw Error(`Discontinuity ${id}: ${gaps.join(", ")}m`);
  return {
    points,
    source,
    difficulty,
    difficultyCoverage: tags.length / total,
  };
}
async function elevate(id: number, points: RoutePoint[], source: Provenance) {
  const cache = `public/data/sources/${id}-elevation.json`;
  let saved: RoutePoint[];
  try {
    saved = JSON.parse(await fs.readFile(cache, "utf8"));
    if (
      saved.length === points.length &&
      saved.every((p, i) => p.lon === points[i].lon && p.lat === points[i].lat)
    ) {
      points.forEach((p, i) => (p.ele = saved[i].ele));
      source.elevation = "Modèle de terrain OpenRouteService / SRTM";
      return;
    }
  } catch {}
  if (!process.env.ORS_API_KEY) throw Error("Missing ORS_API_KEY");
  for (let start = 0; start < points.length; start += 1999) {
    const batch = points.slice(start, start + 1999);
    if (batch.length === 1) batch.unshift(points[start - 1]);
    const r = await fetch("https://api.heigit.org/openelevationservice/v0/line", {
      method: "POST",
      headers: {
        Authorization: process.env.ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        format_in: "geojson",
        format_out: "geojson",
        geometry: {
          type: "LineString",
          coordinates: batch.map((p) => [p.lon, p.lat]),
        },
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!r.ok) throw Error(`Elevation ${id} HTTP ${r.status}`);
    const data = (await r.json()) as { geometry: { coordinates: number[][] } };
    if (data.geometry.coordinates.length !== batch.length)
      throw Error("Elevation point count changed");
    data.geometry.coordinates.forEach((p, i) => {
      if (!Number.isFinite(p[2])) throw Error("Missing terrain elevation");
      batch[i].ele = p[2];
    });
    console.log(
      `Elevation ${id} ${Math.min(start + 1999, points.length)}/${points.length}`,
    );
    await new Promise((r) => setTimeout(r, 1300));
  }
  await fs.writeFile(cache, JSON.stringify(points));
  source.elevation = "Modèle de terrain OpenRouteService / SRTM";
}
const loaded = new Map<number, Awaited<ReturnType<typeof load>>>();
for (const id of idList) {
  const result = await load(id);
  await elevate(id, result.points, result.source);
  loaded.set(id, result);
}
const main = loaded.get(9678362)!;
let loop = main.points;
if (distance(loop[0], loop.at(-1)!) > 0.5)
  throw Error("Main loop is not closed");
loop = loop.slice(0, -1);
let area = 0;
loop.forEach((p, i) => {
  const q = loop[(i + 1) % loop.length];
  area += p.lon * q.lat - q.lon * p.lat;
});
if (area < 0) loop.reverse();
const start = nearestIndex(loop, { lat: 45.8908, lon: 6.7981 });
loop = [...loop.slice(start.index), ...loop.slice(0, start.index)];
loop.push({ ...loop[0] });
audit.start = {
  name: "Les Houches",
  distanceToCentre: start.distance,
  orientation: "counterclockwise",
};
const variants: TmbVariant[] = [];
for (const [id, name, color, description] of descriptions) {
  const data = loaded.get(id)!;
  let points = data.points;
  let a = nearestIndex(loop, points[0]),
    b = nearestIndex(loop, points.at(-1)!);
  let reversed = false;
  // Arpette ends at Chalet du Glacier; reconnect down the Trient valley at the verified Grands/main junction.
  if (id === 9678380) a = nearestIndex(loop, loaded.get(9678437)!.points[0]);
  if (a.index > b.index) {
    points = [...points].reverse();
    [a, b] = [b, a];
    reversed = true;
  }
  const pieces: { points: RoutePoint[]; source: Provenance }[] = [];
  async function connector(from: RoutePoint, to: RoutePoint, side: string) {
    const cache = `public/data/sources/${id}-connector-${side}.json`;
    let route: RoutePoint[];
    try {
      route = JSON.parse(await fs.readFile(cache, "utf8"));
    } catch {
      const r = await fetch(
        "https://api.heigit.org/openrouteservice/v2/directions/foot-hiking/geojson",
        {
          method: "POST",
          headers: {
            Authorization: process.env.ORS_API_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coordinates: [
              [from.lon, from.lat],
              [to.lon, to.lat],
            ],
            elevation: true,
            preference: "recommended",
            instructions: false,
            radiuses: [40, 40],
          }),
          signal: AbortSignal.timeout(40000),
        },
      );
      if (!r.ok) throw Error(`Connector ${id} HTTP ${r.status}`);
      const result = (await r.json()) as {
        features: { geometry: { coordinates: number[][] } }[];
      };
      route = result.features[0].geometry.coordinates.map((p) => ({
        lon: p[0],
        lat: p[1],
        ele: p[2],
      }));
      await fs.writeFile(cache, JSON.stringify(route));
    }
    if (distance(route[0], from) > 2 || distance(route.at(-1)!, to) > 2)
      throw Error(`Connector snapped too far ${id}`);
    route[0] = { ...from };
    route[route.length - 1] = { ...to };
    return {
      points: route,
      source: {
        kind: "routing" as const,
        label: `Liaison pédestre · ${name} · OpenRouteService`,
        url: "https://openrouteservice.org",
        license: "© OpenStreetMap contributors — ODbL 1.0 ; OpenRouteService",
        extractedAt: now,
        elevation: "Modèle de terrain OpenRouteService",
      },
    };
  }
  if (distance(loop[a.index], points[0]) > 0.5)
    pieces.push(await connector(loop[a.index], points[0], "start"));
  pieces.push({ points, source: data.source });
  if (distance(points.at(-1)!, loop[b.index]) > 0.5)
    pieces.push(await connector(points.at(-1)!, loop[b.index], "end"));
  const full = pieces.flatMap((p, i) => (i ? p.points.slice(1) : p.points));
  audit[id] = {
    ...(audit[id] as object),
    anchors: [a, b],
    reversed,
    connectors: pieces
      .filter((p) => p.source.kind === "routing")
      .map((p) => ({
        points: p.points.length,
        distance: length(p.points),
        source: p.source.label,
      })),
  };
  variants.push({
    id: String(id),
    name,
    color,
    description,
    ...data,
    points: full,
    pieces,
    anchors: [a.index, b.index],
    reversed,
    gaps: 0,
    delta: length(full) - length(loop.slice(a.index, b.index + 1)),
    statistics: statistics(pieces),
  });
}
await fs.writeFile(
  "public/data/catalog.json",
  JSON.stringify({
    main: { ...main, points: loop, segments: [loop] },
    variants,
    extractedAt: now,
    audit,
  }),
);
await fs.writeFile(
  "public/data/catalog-audit.json",
  JSON.stringify(audit, null, 2),
);
console.log(
  "Catalogue complete",
  statistics([{ points: loop }]),
  variants.map((v) => ({ name: v.name, anchors: v.anchors, delta: v.delta })),
);
