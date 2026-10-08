import type { Route } from '../types';
import { buildRouteGeometry } from '../route/geometry';
import { stageStatistics, waypointLabel } from '../route/stats';
import { generateGpx, type GpxTrackInput, type GpxWaypointInput } from './generate';

export const SAFETY_NOTICE =
  "Itinéraire indicatif, non garanti praticable. Les conditions météorologiques peuvent modifier la difficulté, " +
  'certains passages peuvent être enneigés et des sentiers peuvent être temporairement fermés. ' +
  'Vérifiez les conditions locales auprès des offices de tourisme, gardiens de refuge et services officiels avant le départ.';

export const STAGE_END_TYPE = "Fin d'étape";

export interface ExportOptions {
  /** Une trace (`trk`) par étape au lieu d'une trace unique. */
  perStage?: boolean;
  /** Sources de données à citer (ex. « © contributeurs OpenStreetMap (ODbL) »). */
  attributions?: string[];
  time?: Date;
}

export class ExportError extends Error {}

/** Exporte l'itinéraire au format GPX 1.1 (géométrie complète, jamais la version simplifiée). */
export function routeToGpx(route: Route, options: ExportOptions = {}): string {
  const geometry = buildRouteGeometry(route);
  if (route.waypoints.length < 2 || geometry.points.length < 2) {
    throw new ExportError("L'itinéraire doit contenir au moins deux points.");
  }
  if (!geometry.complete) {
    throw new ExportError('Certains tronçons ne sont pas encore calculés (ou en erreur). Corrigez-les avant d’exporter.');
  }
  const stages = stageStatistics(route);
  const tracks: GpxTrackInput[] = [];
  if (options.perStage && stages.length > 1) {
    let startWp = 0;
    const ends = route.waypoints.map((w, i) => (w.stageEnd && i > 0 && i < route.waypoints.length - 1 ? i : -1)).filter((i) => i >= 0);
    ends.push(route.waypoints.length - 1);
    ends.forEach((endWp, k) => {
      const from = geometry.waypointIndex[startWp];
      const to = geometry.waypointIndex[endWp];
      tracks.push({
        name: `Jour ${k + 1} — ${waypointLabel(route, startWp)} → ${waypointLabel(route, endWp)}`,
        segments: [geometry.points.slice(from, to + 1)],
      });
      startWp = endWp;
    });
  } else {
    tracks.push({ name: route.name, segments: [geometry.points] });
  }

  const waypoints: GpxWaypointInput[] = [];
  route.waypoints.forEach((w, i) => {
    const isStart = i === 0;
    const isEnd = i === route.waypoints.length - 1;
    const isStage = !!w.stageEnd && !isStart && !isEnd;
    if (!isStart && !isEnd && !isStage && !(w.role === 'user' && w.name)) return;
    const p = geometry.points[geometry.waypointIndex[i]] ?? { lat: w.lat, lon: w.lon, ele: null };
    waypoints.push({
      lat: w.lat,
      lon: w.lon,
      ele: p.ele,
      name: waypointLabel(route, i),
      type: isStage ? STAGE_END_TYPE : isStart ? 'Départ' : isEnd ? 'Arrivée' : 'Point de passage',
    });
  });

  const attributions = options.attributions ?? [];
  return generateGpx({
    name: route.name,
    desc: [SAFETY_NOTICE, attributions.length ? `Sources : ${attributions.join(' ; ')}.` : ''].filter(Boolean).join(' '),
    copyright: {
      author: 'Contributeurs OpenStreetMap et sources citées',
      license: 'https://opendatacommons.org/licenses/odbl/1-0/',
    },
    time: options.time,
    keywords: 'Tour du Mont-Blanc, TMB, randonnée',
    waypoints,
    tracks,
  });
}
