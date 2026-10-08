import type { RoutePoint } from '../types';

export interface GpxWaypointInput {
  lat: number;
  lon: number;
  ele?: number | null;
  name?: string;
  desc?: string;
  /** Catégorie libre (`<type>`), ex. « Fin d'étape ». */
  type?: string;
}

export interface GpxTrackInput {
  name: string;
  desc?: string;
  /** Un tableau de points par `<trkseg>`. */
  segments: RoutePoint[][];
}

export interface GpxLink {
  href: string;
  text?: string;
}

export interface GpxDocumentInput {
  name: string;
  desc?: string;
  author?: string;
  copyright?: { author: string; license?: string };
  links?: GpxLink[];
  time?: Date;
  keywords?: string;
  waypoints?: GpxWaypointInput[];
  tracks: GpxTrackInput[];
  creator?: string;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Caractères de contrôle interdits en XML 1.0
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

const coord = (v: number) => v.toFixed(7).replace(/\.?0+$/, '');
const elevation = (v: number) => v.toFixed(1);

function bounds(tracks: GpxTrackInput[], waypoints: GpxWaypointInput[]): string | null {
  let minlat = Infinity;
  let minlon = Infinity;
  let maxlat = -Infinity;
  let maxlon = -Infinity;
  const visit = (p: { lat: number; lon: number }) => {
    if (p.lat < minlat) minlat = p.lat;
    if (p.lat > maxlat) maxlat = p.lat;
    if (p.lon < minlon) minlon = p.lon;
    if (p.lon > maxlon) maxlon = p.lon;
  };
  for (const t of tracks) for (const s of t.segments) for (const p of s) visit(p);
  for (const w of waypoints) visit(w);
  if (!Number.isFinite(minlat)) return null;
  return `<bounds minlat="${coord(minlat)}" minlon="${coord(minlon)}" maxlat="${coord(maxlat)}" maxlon="${coord(maxlon)}"/>`;
}

/**
 * Génère un document GPX 1.1 conforme au schéma http://www.topografix.com/GPX/1/1/gpx.xsd
 * (ordre des éléments respecté : metadata, wpt*, rte*, trk*).
 */
export function generateGpx(input: GpxDocumentInput): string {
  const waypoints = input.waypoints ?? [];
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    `<gpx version="1.1" creator="${escapeXml(input.creator ?? 'TMB Trip Planner')}" ` +
      'xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
  );

  // metadata : name, desc, author, copyright, link*, time, keywords, bounds
  out.push('  <metadata>');
  out.push(`    <name>${escapeXml(input.name)}</name>`);
  if (input.desc) out.push(`    <desc>${escapeXml(input.desc)}</desc>`);
  if (input.author) out.push(`    <author><name>${escapeXml(input.author)}</name></author>`);
  if (input.copyright) {
    out.push(`    <copyright author="${escapeXml(input.copyright.author)}">`);
    if (input.copyright.license) out.push(`      <license>${escapeXml(input.copyright.license)}</license>`);
    out.push('    </copyright>');
  }
  for (const link of input.links ?? []) {
    out.push(`    <link href="${escapeXml(link.href)}">${link.text ? `<text>${escapeXml(link.text)}</text>` : ''}</link>`);
  }
  out.push(`    <time>${(input.time ?? new Date()).toISOString()}</time>`);
  if (input.keywords) out.push(`    <keywords>${escapeXml(input.keywords)}</keywords>`);
  const b = bounds(input.tracks, waypoints);
  if (b) out.push(`    ${b}`);
  out.push('  </metadata>');

  // wpt : ele, time, magvar, geoidheight, name, cmt, desc, src, link, sym, type
  for (const w of waypoints) {
    out.push(`  <wpt lat="${coord(w.lat)}" lon="${coord(w.lon)}">`);
    if (w.ele !== null && w.ele !== undefined && Number.isFinite(w.ele)) out.push(`    <ele>${elevation(w.ele)}</ele>`);
    if (w.name) out.push(`    <name>${escapeXml(w.name)}</name>`);
    if (w.desc) out.push(`    <desc>${escapeXml(w.desc)}</desc>`);
    if (w.type) out.push(`    <type>${escapeXml(w.type)}</type>`);
    out.push('  </wpt>');
  }

  // trk : name, cmt, desc, src, link, number, type, extensions, trkseg*
  for (const t of input.tracks) {
    out.push('  <trk>');
    out.push(`    <name>${escapeXml(t.name)}</name>`);
    if (t.desc) out.push(`    <desc>${escapeXml(t.desc)}</desc>`);
    out.push('    <type>hiking</type>');
    for (const seg of t.segments) {
      if (seg.length === 0) continue;
      out.push('    <trkseg>');
      for (const p of seg) {
        if (p.ele !== null && Number.isFinite(p.ele)) {
          out.push(`      <trkpt lat="${coord(p.lat)}" lon="${coord(p.lon)}"><ele>${elevation(p.ele)}</ele></trkpt>`);
        } else {
          out.push(`      <trkpt lat="${coord(p.lat)}" lon="${coord(p.lon)}"/>`);
        }
      }
      out.push('    </trkseg>');
    }
    out.push('  </trk>');
  }
  out.push('</gpx>');
  return out.join('\n') + '\n';
}

/** Nom de fichier sûr à partir d'un nom d'itinéraire. */
export function gpxFileName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'itineraire'}.gpx`;
}
