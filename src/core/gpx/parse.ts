import { gpx as gpxToGeoJson } from '@tmcw/togeojson';
import type { Feature, Geometry, Position } from 'geojson';
import type { RoutePoint, Track, TrackKind } from '../types';

export interface ParsedGpxLine {
  name: string | null;
  /** `trk` ou `rte` dans le fichier d'origine. */
  type: 'trk' | 'rte';
  /** Une entrée par `trkseg`. */
  parts: RoutePoint[][];
}

export interface ParsedGpxWaypoint {
  lat: number;
  lon: number;
  ele: number | null;
  name: string | null;
  desc: string | null;
  type: string | null;
}

export interface ParsedGpx {
  name: string | null;
  description: string | null;
  lines: ParsedGpxLine[];
  waypoints: ParsedGpxWaypoint[];
}

export class GpxParseError extends Error {}

/** Interface minimale d'un DOMParser (navigateur ou `@xmldom/xmldom` sous Node). */
export interface XmlParser {
  parseFromString(text: string, mimeType: 'application/xml' | 'text/xml'): unknown;
}

function toPoint(c: Position): RoutePoint {
  const ele = c.length > 2 && Number.isFinite(c[2]) ? (c[2] as number) : null;
  return { lat: c[1], lon: c[0], ele };
}

function isValid(p: RoutePoint): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

function lineParts(geometry: Geometry | null): RoutePoint[][] {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates.map(toPoint).filter(isValid)];
  if (geometry.type === 'MultiLineString') return geometry.coordinates.map((l) => l.map(toPoint).filter(isValid));
  return [];
}

function textOf(doc: Document, path: string[]): string | null {
  let node: Element | Document | null = doc;
  for (const tag of path) {
    if (!node) return null;
    const children: HTMLCollectionOf<Element> = node.getElementsByTagName(tag);
    node = children.length > 0 ? children[0] : null;
  }
  const text = node?.textContent?.trim();
  return text ? text : null;
}

/** Analyse un document GPX déjà chargé en DOM. */
export function parseGpxDocument(doc: Document): ParsedGpx {
  const root = doc.documentElement;
  if (!root || doc.getElementsByTagName('parsererror').length > 0) {
    throw new GpxParseError('Fichier XML invalide.');
  }
  if (root.nodeName.toLowerCase() !== 'gpx' && !root.nodeName.toLowerCase().endsWith(':gpx')) {
    throw new GpxParseError("Ce fichier n'est pas un GPX (élément racine <gpx> absent).");
  }
  const geojson = gpxToGeoJson(doc);
  const lines: ParsedGpxLine[] = [];
  const waypoints: ParsedGpxWaypoint[] = [];
  for (const f of geojson.features as Feature[]) {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    if (f.geometry?.type === 'Point') {
      const p = toPoint(f.geometry.coordinates);
      if (!isValid(p)) continue;
      waypoints.push({
        ...p,
        name: typeof props.name === 'string' ? props.name : null,
        desc: typeof props.desc === 'string' ? props.desc : null,
        type: typeof props.type === 'string' ? props.type : null,
      });
      continue;
    }
    const parts = lineParts(f.geometry).filter((part) => part.length > 0);
    if (parts.length === 0) continue;
    lines.push({
      name: typeof props.name === 'string' ? props.name : null,
      type: props._gpxType === 'rte' ? 'rte' : 'trk',
      parts,
    });
  }
  const metaName = textOf(doc, ['metadata', 'name']);
  return {
    name: metaName ?? lines.find((l) => l.name)?.name ?? null,
    description: textOf(doc, ['metadata', 'desc']),
    lines,
    waypoints,
  };
}

/** Analyse une chaîne GPX. `parser` vaut par défaut le `DOMParser` du navigateur. */
export function parseGpxString(text: string, parser?: XmlParser): ParsedGpx {
  const p: XmlParser | undefined = parser ?? (typeof DOMParser !== 'undefined' ? new DOMParser() : undefined);
  if (!p) throw new GpxParseError('Aucun analyseur XML disponible.');
  let doc: Document;
  try {
    doc = p.parseFromString(text, 'application/xml') as Document;
  } catch (e) {
    throw new GpxParseError(`Fichier XML invalide : ${(e as Error).message}`);
  }
  return parseGpxDocument(doc);
}

/**
 * Fusionne toutes les lignes d'un GPX en une seule trace, dans l'ordre du fichier.
 * Les traces (`trk`) sont prioritaires ; les routes (`rte`) ne sont utilisées qu'en l'absence de trace.
 * Chaque nouvelle partie est repérée dans `breaks`.
 */
export function gpxToTrack(parsed: ParsedGpx, id: string, kind: TrackKind, fallbackName: string): Track {
  const trk = parsed.lines.filter((l) => l.type === 'trk');
  const source = trk.length > 0 ? trk : parsed.lines;
  const points: RoutePoint[] = [];
  const breaks: number[] = [];
  for (const line of source) {
    for (const part of line.parts) {
      if (part.length === 0) continue;
      if (points.length > 0) breaks.push(points.length);
      for (const p of part) points.push(p);
    }
  }
  if (points.length < 2) throw new GpxParseError('Le GPX ne contient aucune trace exploitable (au moins 2 points).');
  return { id, name: parsed.name ?? fallbackName, kind, points, breaks };
}
