import { cumulativeDistances } from '../../core/geo/distance';
import { pointAtDistance } from '../../core/geo/projection';
import type { LatLon, RoutePoint } from '../../core/types';

/** Fournisseur d'altitudes (MNT). Interface remplaçable (MNT local, autre API…). */
export interface ElevationProvider {
  id: string;
  attribution: string;
  /** Altitudes des points, `null` si inconnue. */
  getElevations(points: LatLon[], signal?: AbortSignal): Promise<(number | null)[]>;
}

/**
 * API Open-Meteo (https://open-meteo.com/en/docs/elevation-api) : gratuite, sans clé,
 * MNT Copernicus GLO-90, 100 points par requête.
 */
export function createOpenMeteoProvider(): ElevationProvider {
  const cache = new Map<string, number | null>();
  const key = (p: LatLon) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  return {
    id: 'open-meteo',
    attribution: 'Altitudes : Open-Meteo (Copernicus GLO-90)',
    async getElevations(points, signal) {
      const missing = [...new Set(points.map(key).filter((k) => !cache.has(k)))];
      for (let i = 0; i < missing.length; i += 100) {
        const batch = missing.slice(i, i + 100).map((k) => k.split(',').map(Number));
        const url =
          'https://api.open-meteo.com/v1/elevation?latitude=' +
          batch.map((b) => b[0]).join(',') +
          '&longitude=' +
          batch.map((b) => b[1]).join(',');
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`Open-Meteo : HTTP ${res.status}`);
        const json = (await res.json()) as { elevation?: number[] };
        batch.forEach((b, k) => {
          const e = json.elevation?.[k];
          cache.set(`${b[0].toFixed(5)},${b[1].toFixed(5)}`, typeof e === 'number' && Number.isFinite(e) ? e : null);
        });
      }
      return points.map((p) => cache.get(key(p)) ?? null);
    },
  };
}

export const elevationProvider = createOpenMeteoProvider();

/**
 * Complète les altitudes manquantes d'une trace : échantillonnage tous les `step` mètres
 * (la résolution du MNT étant ~90 m, inutile d'interroger chaque point), puis interpolation.
 * Les altitudes déjà présentes sont conservées.
 */
export async function fillMissingElevations(
  points: RoutePoint[],
  provider: ElevationProvider = elevationProvider,
  step = 40,
  signal?: AbortSignal,
): Promise<RoutePoint[]> {
  if (points.length === 0 || points.every((p) => p.ele !== null)) return points;
  const cum = cumulativeDistances(points);
  const total = cum[cum.length - 1];
  const samples: number[] = [];
  for (let d = 0; d < total; d += step) samples.push(d);
  samples.push(total);
  const sampledPoints = samples.map((d) => pointAtDistance(points, cum, d));
  const eles = await provider.getElevations(sampledPoints, signal);
  let j = 0;
  return points.map((p, i) => {
    if (p.ele !== null) return p;
    const d = cum[i];
    while (j < samples.length - 2 && samples[j + 1] < d) j++;
    const e0 = eles[j];
    const e1 = eles[Math.min(j + 1, eles.length - 1)];
    const span = samples[Math.min(j + 1, samples.length - 1)] - samples[j];
    const t = span > 0 ? (d - samples[j]) / span : 0;
    const ele = e0 !== null && e1 !== null ? e0 + (e1 - e0) * t : (e0 ?? e1);
    return { ...p, ele: ele === null ? null : Math.round(ele * 10) / 10 };
  });
}
