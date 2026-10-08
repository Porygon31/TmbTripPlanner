import type { LatLon } from '../../core/types';
import { fetchOrNetworkError, RoutingError, type RoutingProvider } from './types';

/** openrouteservice (profil `foot-hiking`) — nécessite une clé d'API personnelle (offre gratuite disponible). */
export function createOpenRouteServiceProvider(apiKey: string): RoutingProvider {
  return {
    id: 'openrouteservice',
    label: 'openrouteservice (foot-hiking)',
    attribution: 'Itinéraire : openrouteservice.org, données © contributeurs OpenStreetMap',
    providesElevation: true,
    async route(from: LatLon, to: LatLon, signal?: AbortSignal) {
      if (!apiKey) throw new RoutingError('Clé openrouteservice manquante (Projet → Réglages).', 'config');
      const res = await fetchOrNetworkError('https://api.openrouteservice.org/v2/directions/foot-hiking/geojson', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: apiKey },
        body: JSON.stringify({
          coordinates: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ],
          elevation: true,
          instructions: false,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message: string = json?.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 401 || res.status === 403) throw new RoutingError('Clé openrouteservice refusée.', 'config');
        if (res.status === 429) throw new RoutingError('Quota openrouteservice atteint.', 'quota');
        if (res.status === 404) throw new RoutingError('Aucun chemin trouvé entre ces points.', 'no-path');
        throw new RoutingError(`openrouteservice : ${message}`, 'server');
      }
      const coords: number[][] | undefined = json?.features?.[0]?.geometry?.coordinates;
      if (!coords || coords.length < 2) throw new RoutingError('Aucun itinéraire renvoyé.', 'no-path');
      return { points: coords.map((c) => ({ lon: c[0], lat: c[1], ele: c.length > 2 ? c[2] : null })), provider: 'openrouteservice' };
    },
  };
}
