import type { DataSource, Reference } from '../types';

/** Format de `data/catalog.config.json` (voir `data/README.md`). */
export interface CatalogConfigEntry {
  /** Identifiant stable (lettres, chiffres, tirets). Par défaut : nom du fichier. */
  id?: string;
  /** Chemin du GPX, relatif au dossier `data/`. */
  file: string;
  name?: string;
  description?: string | null;
  source?: DataSource | null;
  references?: Reference[];
  /** Cotation fournie par une source (ex. « T3 », « Difficile »). Sinon estimation automatique. */
  difficulty?: string | null;
  departureName?: string | null;
  rejoinName?: string | null;
  color?: string;
}

export interface CatalogConfig {
  main?: CatalogConfigEntry & {
    /** Sens de parcours souhaité (le tracé est retourné si nécessaire). */
    direction?: 'counterclockwise' | 'clockwise' | 'as-is';
    /** Pour un tracé en boucle : faire commencer le tracé au point le plus proche. */
    startNear?: { name?: string; lat: number; lon: number } | null;
  };
  variants?: CatalogConfigEntry[];
}

/**
 * Palette des variantes, dans un ordre fixe validé pour la séparation entre teintes voisines
 * (y compris daltonismes protan/deutan/tritan), distincte du rouge du TMB et du bleu de l'itinéraire.
 * Les couleurs ne sont jamais le seul repère : nom au survol, pastille dans le catalogue.
 */
export const VARIANT_COLORS = ['#1baf7a', '#4a3aa7', '#eda100', '#008300', '#e87ba4', '#8a5a00', '#eb6834', '#0e7490', '#9d174d', '#4d7c0f'];

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\.gpx$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
