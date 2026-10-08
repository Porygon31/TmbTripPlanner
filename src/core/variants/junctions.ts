import { haversine } from '../geo/distance';
import { projectOnPolyline } from '../geo/projection';
import type { RoutePoint } from '../types';
import type { IndexedTrack } from '../route/tracks';

/** Au-delà de cette distance (m) au TMB, une extrémité de variante n'est pas considérée comme raccordée. */
export const MAX_ATTACH_DISTANCE = 300;

export interface VariantOrientation {
  /** Points de la variante, orientés dans le sens de parcours du TMB principal. */
  points: RoutePoint[];
  reversed: boolean;
  start: { distOnMain: number; snapDistance: number; point: RoutePoint };
  end: { distOnMain: number; snapDistance: number; point: RoutePoint };
  /** La variante enjambe le point de départ/arrivée d'un TMB en boucle. */
  wrapsAroundStart: boolean;
  attachable: boolean;
  warnings: string[];
}

/** Oriente une variante dans le sens du TMB et calcule ses points de départ et de jonction. */
export function orientVariant(main: IndexedTrack, variantPoints: RoutePoint[]): VariantOrientation {
  const warnings: string[] = [];
  const first = variantPoints[0];
  const last = variantPoints[variantPoints.length - 1];
  const pa = projectOnPolyline(main.points, main.cum, first)!;
  const pb = projectOnPolyline(main.points, main.cum, last)!;
  const isLoop = haversine(main.points[0], main.points[main.points.length - 1]) < 500;
  let reversed = pa.distanceAlong > pb.distanceAlong;
  let wraps = false;
  if (isLoop && Math.abs(pb.distanceAlong - pa.distanceAlong) > main.length / 2) {
    // Le chemin le plus court sur la boucle passe par le départ : on inverse le choix.
    reversed = !reversed;
    wraps = true;
    warnings.push('La variante passe par le point de départ du TMB : greffe automatique impossible.');
  }
  const points = reversed ? [...variantPoints].reverse() : variantPoints;
  const [s, e] = reversed ? [pb, pa] : [pa, pb];
  const attachable = !wraps && s.offset <= MAX_ATTACH_DISTANCE && e.offset <= MAX_ATTACH_DISTANCE && s.distanceAlong < e.distanceAlong;
  if (s.offset > MAX_ATTACH_DISTANCE) warnings.push(`Départ éloigné du TMB (${Math.round(s.offset)} m).`);
  if (e.offset > MAX_ATTACH_DISTANCE) warnings.push(`Arrivée éloignée du TMB (${Math.round(e.offset)} m).`);
  return {
    points,
    reversed,
    start: { distOnMain: s.distanceAlong, snapDistance: s.offset, point: s.point },
    end: { distOnMain: e.distanceAlong, snapDistance: e.offset, point: e.point },
    wrapsAroundStart: wraps,
    attachable,
    warnings,
  };
}
