import { get, set } from 'idb-keyval';

export type PoiKind = 'hut' | 'pass' | 'peak' | 'village' | 'hamlet';

export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  lat: number;
  lon: number;
  ele: number | null;
}

/** Fournisseur de points d'intérêt (remplaçable : fichier statique, Overpass, autre API…). */
export interface PoiProvider {
  attribution: string;
  load(signal?: AbortSignal): Promise<Poi[]>;
}

/** Emprise du massif (sud, ouest, nord, est), couvrant le TMB et ses variantes. */
export const MASSIF_BBOX: [number, number, number, number] = [45.66, 6.6, 46.12, 7.2];

const CACHE_KEY = 'pois:v1';
let lastLoaded: Poi[] = [];

/**
 * Point d'intérêt nommé le plus proche (parmi ceux déjà chargés), pour proposer
 * un nom aux fins d'étape. Renvoie `null` si aucun n'est à moins de `maxDistance` mètres.
 */
export function nearestPoi(p: { lat: number; lon: number }, maxDistance = 500, kinds: PoiKind[] = ['hut', 'village', 'hamlet', 'pass']): Poi | null {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111_320;
  let best: Poi | null = null;
  let bestD = maxDistance;
  for (const poi of lastLoaded) {
    if (!kinds.includes(poi.kind)) continue;
    const d = Math.hypot((poi.lon - p.lon) * k, (poi.lat - p.lat) * 111_320);
    if (d < bestD) {
      bestD = d;
      best = poi;
    }
  }
  return best;
}
const CACHE_TTL = 30 * 24 * 3600 * 1000;

function kindOf(tags: Record<string, string>): PoiKind | null {
  if (tags.tourism === 'alpine_hut' || tags.tourism === 'wilderness_hut') return 'hut';
  if (tags.mountain_pass === 'yes' || tags.natural === 'saddle') return 'pass';
  if (tags.natural === 'peak') return 'peak';
  if (tags.place === 'town' || tags.place === 'village') return 'village';
  if (tags.place === 'hamlet') return 'hamlet';
  return null;
}

function parseEle(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number.parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Points d'intérêt OpenStreetMap via l'API Overpass (refuges, cols, sommets, villages),
 * mis en cache 30 jours dans le navigateur. Données © contributeurs OpenStreetMap (ODbL).
 */
export function createOverpassPoiProvider(endpoint = 'https://overpass-api.de/api/interpreter'): PoiProvider {
  return {
    attribution: 'Points d’intérêt © contributeurs OpenStreetMap',
    async load(signal) {
      try {
        const cached = (await get(CACHE_KEY)) as { at: number; pois: Poi[] } | undefined;
        if (cached && Date.now() - cached.at < CACHE_TTL) return cached.pois;
      } catch {
        // Stockage indisponible (navigation privée…) : on continue sans cache.
      }
      const [s, w, n, e] = MASSIF_BBOX;
      const bb = `(${s},${w},${n},${e})`;
      const query = `[out:json][timeout:30];(
        nwr["tourism"~"^(alpine_hut|wilderness_hut)$"]${bb};
        node["mountain_pass"="yes"]["name"]${bb};
        node["natural"="saddle"]["name"]${bb};
        node["natural"="peak"]["name"]["ele"]${bb};
        node["place"~"^(town|village|hamlet)$"]["name"]${bb};
      );out center tags;`;
      const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), signal });
      if (!res.ok) throw new Error(`Overpass : HTTP ${res.status}`);
      const json = (await res.json()) as {
        elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
      };
      const pois: Poi[] = [];
      for (const el of json.elements) {
        const tags = el.tags ?? {};
        const kind = kindOf(tags);
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        const name = tags['name:fr'] ?? tags.name;
        if (!kind || lat === undefined || lon === undefined || !name) continue;
        pois.push({ id: `${el.type}/${el.id}`, name, kind, lat, lon, ele: parseEle(tags.ele) });
      }
      try {
        await set(CACHE_KEY, { at: Date.now(), pois });
      } catch {
        // ignore
      }
      return pois;
    },
  };
}

/** Fichier statique `data/pois.json` (s'il a été généré), sinon Overpass. */
export function createPoiProvider(baseUrl: string): PoiProvider {
  const overpass = createOverpassPoiProvider();
  return {
    attribution: overpass.attribution,
    async load(signal) {
      try {
        const res = await fetch(`${baseUrl}data/pois.json`, { signal });
        if (res.ok && res.headers.get('content-type')?.includes('json')) {
          lastLoaded = (await res.json()) as Poi[];
          return lastLoaded;
        }
      } catch {
        // pas de fichier statique
      }
      lastLoaded = await overpass.load(signal);
      return lastLoaded;
    },
  };
}

export const POI_LABELS: Record<PoiKind, string> = {
  hut: 'Refuge',
  pass: 'Col',
  peak: 'Sommet',
  village: 'Village',
  hamlet: 'Hameau',
};
