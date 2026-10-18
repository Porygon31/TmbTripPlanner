import { z } from "zod";
const buckets = new Map<string, { count: number; until: number }>();
const coordinate = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
export async function handleORS(request: Request, kind: "route" | "elevation") {
  const headers = { "Cache-Control": "no-store" };
  const fail = (error: string, status: number, retry?: string) =>
    Response.json(
      { error },
      {
        status,
        headers: { ...headers, ...(retry ? { "Retry-After": retry } : {}) },
      },
    );
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return fail("Origine non autorisée.", 403);
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const now = Date.now();
  const id = `${ip}:${kind}`;
  if (buckets.size > 2000)
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  const bucket = buckets.get(id);
  if (
    bucket &&
    bucket.until > now &&
    bucket.count >= (kind === "route" ? 30 : 15)
  )
    return fail("Trop de demandes. Patientez une minute.", 429, "60");
  if (bucket && bucket.until > now) bucket.count++;
  else buckets.set(id, { count: 1, until: now + 60000 });
  const key = process.env.ORS_API_KEY?.trim();
  if (!key)
    return fail(
      "Le routage est en attente de configuration par le gestionnaire du site.",
      503,
    );
  try {
    if(Number(request.headers.get('content-length'))>160000)return fail('Requête trop volumineuse.',413);
    const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let bytes=0;
    if(reader)for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>160000){await reader.cancel();return fail('Requête trop volumineuse.',413);}chunks.push(chunk.value);}
    const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
    const raw=new TextDecoder().decode(buffer);
    const parsed = z
      .object({
        coordinates: z
          .array(coordinate)
          .min(2)
          .max(kind === "route" ? 2 : 2000),
      })
      .strict()
      .safeParse(JSON.parse(raw));
    if (!parsed.success)
      return fail(
        "Coordonnées invalides. Deux points sont requis pour un segment, 2 à 2 000 pour les altitudes.",
        400,
      );
    const coordinates = parsed.data.coordinates;
    // Restrict this public service to the Mont-Blanc region to protect the shared free quota.
    if (
      coordinates.some(
        ([lon, lat]) => lon < 6.1 || lon > 7.8 || lat < 45.2 || lat > 46.5,
      )
    )
      return fail(
        "Le calcul est limité au massif du Mont-Blanc (45,2–46,5° N ; 6,1–7,8° E).",
        400,
      );
    const url =
      kind === "route"
        ? (process.env.ORS_DIRECTIONS_URL ??
          "https://api.heigit.org/openrouteservice/v2/directions/foot-hiking/geojson")
        : (process.env.ORS_ELEVATION_URL ??
          "https://api.heigit.org/openelevationservice/v0/line");
    const body =
      kind === "route"
        ? {
            coordinates,
            elevation: true,
            instructions: false,
            preference: "recommended",
            radiuses: [100, 100],
          }
        : {
            format_in: "geojson",
            format_out: "geojson",
            geometry: { type: "LineString", coordinates },
          };
    // A real short route near Les Houches took 44 s; keep a bounded wait for hiking.
    const timeoutMs = kind === "route" ? 60000 : 25000;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { Authorization: key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      console.warn("OpenRouteService request failed", { kind, reason: timeout ? "timeout" : "network" });
      return fail(timeout
        ? `OpenRouteService n’a pas répondu dans les ${timeoutMs / 1000} secondes. Le service peut être temporairement indisponible. Réessayez plus tard ; votre parcours est conservé.`
        : "La connexion à OpenRouteService a échoué. Réessayez plus tard ; votre parcours est conservé.",
        timeout ? 504 : 502);
    }
    if (response.status === 429)
      return fail(
        "Le quota OpenRouteService est atteint. Réessayez plus tard ; le dernier parcours valide est conservé.",
        429,
        response.headers.get("retry-after") ?? "60",
      );
    if ([401, 403].includes(response.status))
      return fail(
        "OpenRouteService refuse la clé ou son quota. Le gestionnaire doit vérifier la configuration.",
        503,
      );
    if (!response.ok)
      return fail(
        response.status < 500
          ? "Aucun itinéraire pédestre trouvé entre ces points. Rapprochez-les des sentiers."
          : "OpenRouteService est indisponible. Réessayez plus tard.",
        response.status < 500 ? 422 : 502,
      );
    let result: {
      features?: { geometry?: { coordinates?: number[][] } }[];
      geometry?: { coordinates?: number[][] };
    } | null;
    try { result = await response.json(); }
    catch { return fail("OpenRouteService a renvoyé une réponse illisible. Votre parcours est conservé.", 502); }
    const values =
      kind === "route"
        ? result?.features?.[0]?.geometry?.coordinates
        : result?.geometry?.coordinates;
    if (
      !Array.isArray(values) || !values.length ||
      values.some((p) => !Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))
    )
      return fail("Réponse géographique invalide du service.", 502);
    return Response.json(
      {
        points: values.map((p) => ({
          lon: p[0],
          lat: p[1],
          ...(Number.isFinite(p[2]) ? { ele: p[2] } : {}),
        })),
        source: "OpenRouteService / OpenStreetMap",
        elevation: "Modèle de terrain OpenRouteService",
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      return fail("Le corps doit être un objet JSON.", 400);
    return fail(
      "Le calcul n’a pas pu être effectué. Le parcours reste inchangé.",
      500,
    );
  }
}
