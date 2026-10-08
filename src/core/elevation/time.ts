/**
 * Temps de marche indicatif selon la norme DIN 33466 (méthode des clubs alpins) :
 * - horizontal : 4 km/h ;
 * - montée : 300 m/h ;
 * - descente : 500 m/h ;
 * - total = max(horizontal, vertical) + min(horizontal, vertical) / 2.
 * Hors pauses, pour un randonneur moyen avec sac, sur sentier sec.
 */
export const DIN33466 = {
  horizontalKmh: 4,
  ascentMh: 300,
  descentMh: 500,
} as const;

export function walkingTimeHours(distanceM: number, ascentM: number, descentM: number): number {
  const horizontal = distanceM / 1000 / DIN33466.horizontalKmh;
  const vertical = ascentM / DIN33466.ascentMh + descentM / DIN33466.descentMh;
  return Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
}
