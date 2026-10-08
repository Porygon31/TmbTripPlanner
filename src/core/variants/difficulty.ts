import type { Difficulty, DifficultyLevel, RouteStatistics } from '../types';

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  facile: 'Facile',
  moderee: 'Modérée',
  difficile: 'Difficile',
  'tres-difficile': 'Très difficile',
};

/**
 * Estimation automatique et transparente de la difficulté d'une portion, à partir de
 * critères objectifs mesurés sur la trace (et non d'une cotation officielle) :
 * - altitude maximale (≥ 2 500 m : +1, ≥ 2 800 m : +2) ;
 * - pente moyenne maximale sur 200 m (≥ 25 % : +1, ≥ 35 % : +2) ;
 * - dénivelé positif (≥ 800 m : +1, ≥ 1 300 m : +2).
 * Score 0–1 : facile, 2–3 : modérée, 4–5 : difficile, 6 : très difficile.
 * Ne tient pas compte de l'exposition, du terrain ni de la météo.
 */
export function estimateDifficulty(stats: RouteStatistics, maxGradient: number | null): Difficulty {
  if (stats.maxEle === null || maxGradient === null || stats.elevationCoverage < 0.8) {
    return { level: null, label: 'Non estimable (altitudes absentes)', origin: 'unknown', criteria: [] };
  }
  const criteria: string[] = [];
  let score = 0;
  const alt = stats.maxEle;
  const altPts = alt >= 2800 ? 2 : alt >= 2500 ? 1 : 0;
  score += altPts;
  criteria.push(`Altitude max ${Math.round(alt)} m (+${altPts})`);
  const gradPts = maxGradient >= 35 ? 2 : maxGradient >= 25 ? 1 : 0;
  score += gradPts;
  criteria.push(`Pente max ${Math.round(maxGradient)} % sur 200 m (+${gradPts})`);
  const upPts = stats.ascent >= 1300 ? 2 : stats.ascent >= 800 ? 1 : 0;
  score += upPts;
  criteria.push(`D+ ${Math.round(stats.ascent)} m (+${upPts})`);
  const level: DifficultyLevel = score <= 1 ? 'facile' : score <= 3 ? 'moderee' : score <= 5 ? 'difficile' : 'tres-difficile';
  return { level, label: DIFFICULTY_LABELS[level], origin: 'estimated', criteria };
}

/** Difficulté renseignée dans la configuration (ex. « T3 », « Difficile »). */
export function configuredDifficulty(label: string): Difficulty {
  const normalized = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  const map: Record<string, DifficultyLevel> = {
    facile: 'facile',
    moderee: 'moderee',
    modere: 'moderee',
    difficile: 'difficile',
    'tres difficile': 'tres-difficile',
    't1': 'facile',
    't2': 'moderee',
    't3': 'difficile',
    't4': 'tres-difficile',
    't5': 'tres-difficile',
    't6': 'tres-difficile',
  };
  return { level: map[normalized] ?? null, label, origin: 'config', criteria: [] };
}
