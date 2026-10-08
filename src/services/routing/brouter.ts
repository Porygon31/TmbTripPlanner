import type { LatLon, RoutePoint } from '../../core/types';
import { fetchOrNetworkError, RoutingError, type RoutingProvider } from './types';

/**
 * BRouter (https://brouter.de) : moteur libre basé sur OpenStreetMap, sans clé d'API.
 * Le profil `hiking-mountain` suit sentiers et chemins en respectant l'échelle SAC (≤ T3 par défaut)
 * et renvoie l'altitude de chaque point (MNT SRTM).
 */
export function createBRouterProvider(baseUrl: string, profile: string): RoutingProvider {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    id: 'brouter',
    label: `BRouter (${profile})`,
    attribution: 'Itinéraire : BRouter, données © contributeurs OpenStreetMap',
    providesElevation: true,
    async route(from: LatLon, to: LatLon, signal?: AbortSignal) {
      const lonlats = `${from.lon.toFixed(6)},${from.lat.toFixed(6)}|${to.lon.toFixed(6)},${to.lat.toFixed(6)}`;
      const url = `${base}?lonlats=${lonlats}&profile=${encodeURIComponent(profile)}&alternativeidx=0&format=geojson`;
      const res = await fetchOrNetworkError(url, { signal });
      const text = await res.text();
      if (!res.ok) throw toError(res.status, text);
      let json: { features?: { geometry?: { coordinates?: number[][] } }[] };
      try {
        json = JSON.parse(text);
      } catch {
        throw toError(res.status, text);
      }
      const coords = json.features?.[0]?.geometry?.coordinates;
      if (!coords || coords.length < 2) throw new RoutingError('Aucun itinéraire renvoyé.', 'no-path');
      const points: RoutePoint[] = coords.map((c) => ({ lon: c[0], lat: c[1], ele: c.length > 2 && Number.isFinite(c[2]) ? c[2] : null }));
      return { points, provider: 'brouter' };
    },
  };
}

function toError(status: number, body: string): RoutingError {
  const msg = body.slice(0, 300);
  if (/not mapped|no track found|target island|from-position|to-position|via-position/i.test(msg)) {
    return new RoutingError('Aucun sentier praticable trouvé à proximité de ce point (ou entre ces points).', 'no-path');
  }
  if (status === 429 || /too many/i.test(msg)) return new RoutingError('Service de calcul saturé, réessayez dans un instant.', 'quota');
  return new RoutingError(`Erreur du service de calcul (${status}) : ${msg || 'réponse vide'}`, 'server');
}
