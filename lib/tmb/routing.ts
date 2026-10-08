import type { RoutingProvider, RoutePoint } from "./types";
async function request(
  path: string,
  coordinates: number[][],
  signal?: AbortSignal,
): Promise<RoutePoint[]> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates }),
    signal,
  });
  const data = (await r.json()) as { error?: string; points: RoutePoint[] };
  if (!r.ok)
    throw new Error(data.error ?? "Le service ne répond pas. Réessayez.");
  return data.points;
}
export const routingProvider: RoutingProvider = {
  route: (a, b, signal) =>
    request(
      "/api/route",
      [
        [a.lon, a.lat],
        [b.lon, b.lat],
      ],
      signal,
    ),
  elevation: (p, signal) =>
    request(
      "/api/elevation",
      p.map((v) => [v.lon, v.lat]),
      signal,
    ),
};
