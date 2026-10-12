import fs from "node:fs/promises";
import { distance } from "../lib/tmb/geo";
import type { Catalog, RoutePoint } from "../lib/tmb/types";
const catalog = JSON.parse(
  await fs.readFile("public/data/catalog.json", "utf8"),
) as Catalog;
const centers: RoutePoint[] = [];
let d = 10000;
catalog.main.points.forEach((p, i) => {
  if (i) d += distance(p, catalog.main.points[i - 1]);
  if (d >= 10000) {
    centers.push(p);
    d = 0;
  }
});
catalog.variants.forEach((v) =>
  centers.push(v.points[Math.floor(v.points.length / 2)]),
);
const all = new Map();
const excerptDates: number[] = [];
await fs.mkdir("work/poi-cache", { recursive: true });
for (let i = 0; i < centers.length; i++) {
  const p = centers[i],
    bounds = [p.lon - 0.016, p.lat - 0.012, p.lon + 0.016, p.lat + 0.012]
      .map((n) => n.toFixed(5))
      .join(",");
  const cache = `work/poi-cache/${i}.json`;
  let data;
  try {
    data = JSON.parse(await fs.readFile(cache, "utf8"));
  } catch {
    const r = await fetch(
      `https://api.openstreetmap.org/api/0.6/map.json?bbox=${bounds}`,
      {
        headers: {
          "User-Agent":
            "TMB-Atelier/1.0 (https://tmb-atelier.poorygon.chatgpt.site)",
        },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!r.ok) throw Error(`OSM excerpt ${i}: ${r.status}`);
    data = await r.json();
    await fs.writeFile(cache, JSON.stringify(data));
  }
  excerptDates.push((await fs.stat(cache)).mtimeMs);
  const nodes = new Map<number, { lat: number; lon: number }>(
    data.elements
      .filter((e: { type: string }) => e.type === "node")
      .map((e: { id: number; lat: number; lon: number }) => [e.id, e]),
  );
  for (const e of data.elements) {
    const t = e.tags;
    if (!t?.name) continue;
    const type =
      t.tourism === "alpine_hut"
        ? "refuge"
        : t.tourism === "hotel"
          ? "hotel"
          : t.natural === "saddle"
            ? "col"
            : t.natural === "peak"
              ? "sommet"
              : ["village", "hamlet"].includes(t.place)
                ? "village"
                : t.tourism === "viewpoint"
                  ? "poi"
                  : null;
    if (!type) continue;
    let lat = e.lat,
      lon = e.lon;
    if (lat === undefined && e.nodes) {
      const points = e.nodes.map((id: number) => nodes.get(id)).filter(Boolean);
      if (!points.length) continue;
      lat =
        points.reduce((n: number, p: RoutePoint) => n + p.lat, 0) /
        points.length;
      lon =
        points.reduce((n: number, p: RoutePoint) => n + p.lon, 0) /
        points.length;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    all.set(`${e.type}/${e.id}`, {
      id: `${e.type}/${e.id}`,
      name: t.name,
      type,
      lat,
      lon,
      ...(Number.isFinite(+t.ele) ? { ele: +t.ele } : {}),
      version: e.version,
      url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    });
  }
  console.log(`POI excerpt ${i + 1}/${centers.length}: ${all.size} points`);
}
await fs.writeFile(
  "public/data/pois.json",
  JSON.stringify({
    extractedAt: new Date(Math.min(...excerptDates)).toISOString(),
    preparedAt: new Date().toISOString(),
    source: "OpenStreetMap API 0.6 / extraits autour du tracé",
    license: "© OpenStreetMap contributors · ODbL 1.0",
    coverage:
      "Extrait non exhaustif dans un voisinage de 1 à 2 km autour de points du catalogue, espacés de 10 km.",
    points: [...all.values()],
  }),
);
