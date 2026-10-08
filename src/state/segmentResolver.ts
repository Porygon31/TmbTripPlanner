import type { RoutePoint } from '../core/types';
import { fillMissingElevations } from '../services/elevation/elevation';
import { RoutingQueue } from '../services/routing/queue';
import { createRoutingProvider } from '../services/routing/registry';
import { RoutingError, type RoutingProvider, type RoutingSettings } from '../services/routing/types';
import { useApp } from './store';

export const routingQueue = new RoutingQueue(2);

function providerKey(s: RoutingSettings): string {
  return s.providerId === 'brouter' ? `brouter:${s.brouterUrl}:${s.brouterProfile}` : s.providerId;
}

/**
 * Surveille l'itinéraire : chaque segment « à calculer » est envoyé au moteur de routage.
 * Les requêtes des segments disparus (point déplacé à nouveau, annulation…) sont interrompues.
 * Retourne une fonction d'arrêt.
 */
export function startSegmentResolver(): () => void {
  const inflight = new Map<string, AbortController>();
  let provider: RoutingProvider = createRoutingProvider(useApp.getState().settings);
  let key = providerKey(useApp.getState().settings);

  const run = () => {
    const state = useApp.getState();
    const route = state.history.present;
    const present = new Set(route.segments.map((s) => s.id));
    for (const [id, ctrl] of inflight) {
      if (!present.has(id)) {
        ctrl.abort();
        inflight.delete(id);
      }
    }
    route.segments.forEach((seg, i) => {
      if (seg.status !== 'pending' || inflight.has(seg.id)) return;
      const from = route.waypoints[i];
      const to = route.waypoints[i + 1];
      if (!from || !to) return;
      const ctrl = new AbortController();
      inflight.set(seg.id, ctrl);
      const segId = seg.id;
      const p = provider;
      routingQueue
        .request(p, key, from, to, ctrl.signal)
        .then(async (leg) => {
          let points: RoutePoint[] = leg.points;
          if (points.some((pt) => pt.ele === null)) {
            try {
              points = await fillMissingElevations(points, undefined, 40, ctrl.signal);
            } catch {
              // Altitude facultative : on garde le tracé.
            }
          }
          if (ctrl.signal.aborted) return;
          useApp.getState().applyRoutingResult(segId, { status: 'ok', points, provider: p.label, error: undefined });
        })
        .catch((e) => {
          if ((e as Error).name === 'AbortError' || ctrl.signal.aborted) return;
          const message = e instanceof RoutingError ? e.message : `Erreur de calcul : ${(e as Error).message}`;
          useApp.getState().applyRoutingResult(segId, { status: 'error', error: message, points: [] });
        })
        .finally(() => {
          if (inflight.get(segId) === ctrl) inflight.delete(segId);
        });
    });
  };

  const unsub = useApp.subscribe((s, prev) => {
    if (s.settings !== prev.settings) {
      provider = createRoutingProvider(s.settings);
      key = providerKey(s.settings);
    }
    if (s.history.present.segments !== prev.history.present.segments) run();
  });
  run();
  return () => {
    unsub();
    inflight.forEach((c) => c.abort());
  };
}
