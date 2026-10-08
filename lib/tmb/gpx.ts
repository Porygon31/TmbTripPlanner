import { gpx } from "@tmcw/togeojson";
import { uid, distance } from "./geo";
import { newRoute } from "./catalog";
import type { Route, RoutePoint, Provenance } from "./types";
const esc = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function parseGpx(
  text: string,
  filename = "Parcours importé",
  Parser: typeof DOMParser = DOMParser,
): Route {
  if (new TextEncoder().encode(text).length > 10 * 1024 * 1024)
    throw Error("Le fichier dépasse la limite de 10 Mo.");
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw Error("Les déclarations XML externes ne sont pas acceptées.");
  const StrictParser = Parser as unknown as new (options?: {
    onError: () => never;
  }) => DOMParser;
  const doc = new StrictParser({
    onError: () => { throw Error("Fichier XML mal formé."); },
  }).parseFromString(text, "text/xml");
  const root = doc.documentElement;
  if (
    doc.getElementsByTagName("parsererror").length ||
    !root || root.localName !== "gpx" ||
    !["1.0", "1.1"].includes(root.getAttribute("version") ?? "")
  )
    throw Error("Fichier GPX 1.0 ou 1.1 invalide.");
  const pointCount =
    doc.getElementsByTagName("trkpt").length +
    doc.getElementsByTagName("rtept").length;
  if (!pointCount) throw Error("Le fichier ne contient aucune trace ou route.");
  if (pointCount > 100000) throw Error("Le fichier dépasse 100 000 points.");
  for (const tag of ["trkpt", "rtept"])
    for (const p of Array.from(doc.getElementsByTagName(tag))) {
      const lat = p.getAttribute("lat"),
        lon = p.getAttribute("lon");
      if (
        lat === null ||
        lon === null ||
        lat.trim() === "" ||
        lon.trim() === "" ||
        !Number.isFinite(+lat) ||
        !Number.isFinite(+lon) ||
        Math.abs(+lat) > 90 ||
        Math.abs(+lon) > 180
      )
        throw Error("Le GPX contient des coordonnées invalides.");
      const e = p.getElementsByTagName("ele")[0]?.textContent;
      if (
        e !== undefined &&
        e !== null &&
        (e.trim() === "" || !Number.isFinite(+e))
      )
        throw Error("Le GPX contient une altitude invalide.");
    }
  // The converter validates feature structure; XML traversal below preserves each original segment and its exact point order.
  gpx(doc);
  const route = {
    ...newRoute(),
    name:
      doc.getElementsByTagName("name")[0]?.textContent?.slice(0, 120) ||
      filename.replace(/\.gpx$/i, ""),
    mode: "import" as const,
  };
  const copyright = doc.getElementsByTagName("copyright")[0];
  const attribution = [
    doc.getElementsByTagName("desc")[0]?.textContent,
    copyright?.getAttribute("author"),
    copyright?.getElementsByTagName("year")[0]?.textContent,
    copyright?.getElementsByTagName("license")[0]?.textContent,
  ].filter(Boolean).join(" — ");
  const source: Provenance = {
    kind: "import",
    label: filename,
    license: attribution.slice(0, 6000) || undefined,
  };
  const nodes = Array.from(root.getElementsByTagName("*")).filter(
    (n) => n.localName === "trkseg" || n.localName === "rte",
  );
  for (const node of nodes) {
    const tag = node.localName === "rte" ? "rtept" : "trkpt";
    const points: RoutePoint[] = Array.from(node.getElementsByTagName(tag)).map(
      (p) => {
        const ele = p.getElementsByTagName("ele")[0]?.textContent;
        return {
          lat: +p.getAttribute("lat")!,
          lon: +p.getAttribute("lon")!,
          ...(ele !== null && ele !== undefined ? { ele: +ele } : {}),
        };
      },
    );
    if (!points.length) continue;
    const a = {
        ...points[0],
        id: uid(),
        name: `Début ${route.segments.length + 1}`,
      },
      b = {
        ...points.at(-1)!,
        id: uid(),
        name: `Fin ${route.segments.length + 1}`,
      };
    route.waypoints.push(a, b);
    route.segments.push({
      id: uid(),
      points,
      from: a.id,
      to: b.id,
      breakBefore:
        route.segments.length > 0 &&
        distance(route.segments.at(-1)!.points.at(-1)!, points[0]) > 0.5,
      source,
    });
  }
  return route;
}
export function exportGpx(route: Route): string {
  const attribution = [
    ...new Set(
      route.segments.map(
        (s) =>
          `${s.source.label}${s.source.url ? " — " + s.source.url : ""}${s.source.license ? " — " + s.source.license : ""}${s.source.elevation ? " ; altitudes : " + s.source.elevation : ""}`,
      ),
    ),
  ].join("\n");
  const tracks = route.segments
    .map(
      (s) =>
        `<trkseg>${s.points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele === undefined ? "" : `<ele>${p.ele}</ele>`}</trkpt>`).join("")}</trkseg>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="TMB Atelier" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 https://www.topografix.com/GPX/1/1/gpx.xsd"><metadata><name>${esc(route.name)}</name><desc>${esc(attribution)}</desc><time>${new Date().toISOString()}</time></metadata><trk><name>${esc(route.name)}</name><desc>${esc(attribution)}</desc>${tracks}</trk></gpx>`;
}
export function downloadGpx(route: Route) {
  const url = URL.createObjectURL(
    new Blob([exportGpx(route)], { type: "application/gpx+xml" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download =
    (route.name.replace(/[^\p{L}\p{N}_-]+/gu, "-") || "parcours") + ".gpx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
