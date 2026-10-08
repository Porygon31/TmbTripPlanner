import type { LatLon } from '../../core/types';
import { fetchOrNetworkError, RoutingError, type RoutingProvider } from './types';

/** GraphHopper (profil `hike`) — nécessite une clé d'API personnelle (offre gratuite disponible). */
export function createGraphHopperProvider(apiKey: string): RoutingProvider {
  return {
    id: 'graphhopper',
    label: 'GraphHopper (hike)',
    attribution: 'Itinéraire : GraphHopper, données © contributeurs OpenStreetMap',
    providesElevation: true,
    async route(from: LatLon, to: LatLon, signal?: AbortSignal) {
      if (!apiKey) throw new RoutingError('Clé GraphHopper manquante (Projet → Réglages).', 'config');
      const res = await fetchOrNetworkError(`https://graphhopper.com/api/1/route?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ],
          profile: 'hike',
          elevation: true,
          points_encoded: false,
          instructions: false,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message: string = json?.message ?? `HTTP ${res.status}`;
        if (res.status === 401) throw new RoutingError('Clé GraphHopper refusée.', 'config');
        if (res.status === 429) throw new RoutingError('Quota GraphHopper atteint.', 'quota');
        if (/connection between locations not found|cannot find point/i.test(message)) throw new RoutingError('Aucun chemin trouvé entre ces points.', 'no-path');
        throw new RoutingError(`GraphHopper : ${message}`, 'server');
      }
      const coords: number[][] | undefined = json?.paths?.[0]?.points?.coordinates;
      if (!coords || coords.length < 2) throw new RoutingError('Aucun itinéraire renvoyé.', 'no-path');
      return { points: coords.map((c) => ({ lon: c[0], lat: c[1], ele: c.length > 2 ? c[2] : null })), provider: 'graphhopper' };
    },
  };
}
