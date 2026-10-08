/**
 * Types du domaine. Ce module ne dépend ni de React ni du navigateur :
 * tout `src/core` peut tourner dans Node (tests, script de catalogue) ou dans un Web Worker.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

/** Point d'une trace. `ele` vaut `null` quand l'altitude est inconnue. */
export interface RoutePoint extends LatLon {
  ele: number | null;
}

export type TrackKind = 'tmb' | 'variant' | 'import';

/** Trace « source » figée : TMB principal, variante ou GPX importé. */
export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  points: RoutePoint[];
  /** Indices de points où commence une nouvelle partie (trou dans la trace d'origine). */
  breaks: number[];
}

export type WaypointRole = 'user' | 'junction' | 'base';

export interface Waypoint extends LatLon {
  id: string;
  name?: string;
  /** Ce point termine une étape (journée). */
  stageEnd?: boolean;
  /** `junction` : créé automatiquement (raccord de variante, découpe locale). */
  role: WaypointRole;
}

/**
 * Référence vers une portion de trace. Les distances sont exprimées dans le sens
 * canonique de la trace ; le sens de parcours va de `startDist` vers `endDist`
 * (si `startDist > endDist`, la trace est parcourue à l'envers).
 */
export interface TrackRef {
  trackId: string;
  trackKind: TrackKind;
  startDist: number;
  endDist: number;
}

export type SegmentMode = 'routed' | 'track' | 'straight';
export type SegmentStatus = 'ok' | 'pending' | 'error';

/** Portion d'itinéraire entre deux waypoints consécutifs. */
export interface RouteSegment {
  id: string;
  mode: SegmentMode;
  status: SegmentStatus;
  points: RoutePoint[];
  error?: string;
  /** Fournisseur de routage ayant calculé la géométrie. */
  provider?: string;
  trackRef?: TrackRef;
  /** Raccord court ajouté automatiquement autour d'une variante. */
  connectorFor?: string;
  /** Trou présent dans la trace importée d'origine. */
  gap?: boolean;
}

/**
 * Itinéraire : `segments[i]` relie `waypoints[i]` à `waypoints[i + 1]`.
 * Invariant : `segments.length === max(0, waypoints.length - 1)`.
 */
export interface Route {
  id: string;
  name: string;
  waypoints: Waypoint[];
  segments: RouteSegment[];
}

export interface ElevationPoint {
  /** Distance cumulée depuis le départ, en mètres. */
  distance: number;
  ele: number | null;
  lat: number;
  lon: number;
}

export interface RouteStatistics {
  /** Distance totale en mètres. */
  distance: number;
  /** Dénivelé positif en mètres. */
  ascent: number;
  /** Dénivelé négatif en mètres (valeur positive). */
  descent: number;
  minEle: number | null;
  maxEle: number | null;
  pointCount: number;
  /** Part des points ayant une altitude (0 à 1). */
  elevationCoverage: number;
  /** Temps de marche indicatif (DIN 33466), en heures, hors pauses. */
  durationHours: number;
}

export interface StageStatistics extends RouteStatistics {
  index: number;
  fromName: string;
  toName: string;
  startDistance: number;
  endDistance: number;
}

export interface DataSource {
  label: string;
  url?: string;
  license?: string;
  licenseUrl?: string;
  retrieved?: string;
  notes?: string;
}

export type DifficultyLevel = 'facile' | 'moderee' | 'difficile' | 'tres-difficile';

export interface Difficulty {
  /** Niveau normalisé, ou `null` s'il n'est pas estimable. */
  level: DifficultyLevel | null;
  /** Libellé affiché (ex. « Difficile » ou « T3 » si fourni par la configuration). */
  label: string;
  origin: 'config' | 'estimated' | 'unknown';
  /** Critères utilisés pour une estimation automatique. */
  criteria: string[];
}

export interface Junction extends LatLon {
  /** Abscisse curviligne sur le TMB principal (m). */
  distOnMain: number;
  /** Distance entre l'extrémité de la variante et le TMB (m). */
  snapDistance: number;
  name: string | null;
}

export interface Reference {
  label: string;
  url: string;
}

export interface CatalogTrackInfo {
  id: string;
  name: string;
  description: string | null;
  /** Origine du fichier GPX (auteur, licence). */
  source: DataSource | null;
  /** Pages consultées pour la description (« En savoir plus »). */
  references: Reference[];
  stats: RouteStatistics;
  bbox: [number, number, number, number];
  /** Chemin relatif (depuis `data/`) du JSON de points. */
  file: string;
  /** Chemin relatif (depuis `data/`) du GPX source, téléchargeable. */
  gpxFile: string;
  warnings: string[];
}

export interface TmbVariant extends CatalogTrackInfo {
  color: string;
  difficulty: Difficulty;
  departure: Junction | null;
  rejoin: Junction | null;
  /** Statistiques du tronçon du TMB classique remplacé par la variante. */
  mainSection: RouteStatistics | null;
  /** Écart de distance par rapport au tronçon classique (m, positif = plus long). */
  deltaDistance: number | null;
  deltaAscent: number | null;
  /** La variante peut être greffée sur le TMB (extrémités assez proches du tracé). */
  attachable: boolean;
}

export interface Catalog {
  generatedAt: string;
  main: CatalogTrackInfo | null;
  variants: TmbVariant[];
  warnings: string[];
}

/** Format compact des fichiers `tracks/<id>.json` : [lat, lon, ele|null]. */
export interface TrackFile {
  id: string;
  points: [number, number, number | null][];
  breaks: number[];
}
