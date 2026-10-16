import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { haversine, signedArea } from '../../src/core/geo/distance';
import { parseGpxString, gpxToTrack, type XmlParser } from '../../src/core/gpx/parse';
import { generateGpx } from '../../src/core/gpx/generate';
import { spliceVariant, routeFromMain } from '../../src/core/route/compose';
import { buildRouteGeometry } from '../../src/core/route/geometry';
import { indexTrack } from '../../src/core/route/tracks';
import { orientVariant } from '../../src/core/variants/junctions';
import type { CatalogConfig } from '../../src/core/variants/catalogConfig';

const parser = new DOMParser() as unknown as XmlParser;
const config: CatalogConfig = JSON.parse(readFileSync('data/catalog.config.json', 'utf8'));
const entries = [config.main!, ...config.variants!];
const tracks = entries.map((entry, i) => indexTrack(gpxToTrack(
  parseGpxString(readFileSync(`data/${entry.file}`, 'utf8'), parser),
  entry.id ?? 'tmb', i === 0 ? 'tmb' : 'variant', entry.name!,
)));
const main = tracks[0];
const lookup = (id: string) => tracks.find((track) => track.id === id);

describe('catalogue GPX livré', () => {
  it('conserve les sources, versions OSM et empreintes des huit fichiers', () => {
    const manifest = JSON.parse(readFileSync('data/provenance.json', 'utf8')) as {
      tracks: { file: string; sha256: string; sourceFile: string; sourceSha256: string; relationId: number; version: number }[];
    };
    expect(manifest.tracks.map((t) => t.relationId).sort()).toEqual([9678267, 9678296, 9678362, 9678375, 9678380, 9678437, 9678501, 9678726]);
    for (const trace of manifest.tracks) {
      expect(createHash('sha256').update(readFileSync(`data/${trace.file}`)).digest('hex')).toBe(trace.sha256);
      expect(createHash('sha256').update(readFileSync(`data/${trace.sourceFile}`)).digest('hex')).toBe(trace.sourceSha256);
      const metadata = JSON.parse(readFileSync(`data/sources/${trace.relationId}-metadata.json`, 'utf8'));
      expect(metadata.elements[0].version).toBe(trace.version);
    }
  });

  it('forme une boucle antihoraire depuis Les Houches, avec altitude complète', () => {
    expect(haversine(main.points[0], { lat: 45.8903, lon: 6.7987 })).toBeLessThan(150);
    expect(haversine(main.points[0], main.points.at(-1)!)).toBeLessThan(1);
    expect(signedArea(main.points)).toBeGreaterThan(0);
    expect(main.length).toBeGreaterThan(160_000);
    expect(main.length).toBeLessThan(180_000);
    for (const track of tracks) {
      expect(track.points.every((p) => p.ele !== null && Number.isFinite(p.ele))).toBe(true);
      // Un raccord de provenance distincte ne doit pas introduire une rupture.
      for (const boundary of track.breaks) expect(haversine(track.points[boundary - 1], track.points[boundary])).toBeLessThan(1);
    }
  });

  it.each(tracks.slice(1))('raccorde $name sans ligne droite ni recalcul', (variant) => {
    const orientation = orientVariant(main, variant.points);
    expect(orientation.attachable).toBe(true);
    expect(orientation.start.snapDistance).toBeLessThan(1);
    expect(orientation.end.snapDistance).toBeLessThan(1);
    const oriented = indexTrack({ ...variant, points: orientation.points });
    const { route } = spliceVariant(routeFromMain(main, 'TMB'), (id) => id === variant.id ? oriented : lookup(id), 'tmb', {
      id: variant.id, name: variant.name, startOnMain: orientation.start.distOnMain, endOnMain: orientation.end.distOnMain,
    });
    expect(route.segments.every((segment) => segment.mode === 'track' && segment.status === 'ok')).toBe(true);
    expect(buildRouteGeometry(route).complete).toBe(true);
  });

  it.each(entries)('préserve coordonnées, altitudes et parties de $file après export/réimport', (entry) => {
    const parsed = parseGpxString(readFileSync(`data/${entry.file}`, 'utf8'), parser);
    const xml = generateGpx({ name: parsed.name!, tracks: parsed.lines.map((line) => ({ name: line.name!, segments: line.parts })) });
    const reopened = parseGpxString(xml, parser);
    expect(reopened.lines.map((line) => line.parts)).toEqual(parsed.lines.map((line) => line.parts));
  });
});
