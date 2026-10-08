import { describe, expect, it } from 'vitest';
import { generateGpx, gpxFileName } from '../../src/core/gpx/generate';
import { GpxParseError, gpxToTrack, parseGpxString } from '../../src/core/gpx/parse';
import { line, xmlParser } from './helpers';

describe('GPX', () => {
  const seg1 = line({ lat: 45.9, lon: 6.8 }, { lat: 45.91, lon: 6.81 }, 50, (t) => 1000 + 100 * t);
  const seg2 = line({ lat: 45.92, lon: 6.82 }, { lat: 45.93, lon: 6.83 }, 50, () => null);

  it('aller-retour génération → lecture', () => {
    const xml = generateGpx({
      name: 'Test & « accents » <ok>',
      desc: 'Description',
      tracks: [{ name: 'Trace', segments: [seg1, seg2] }],
      waypoints: [{ lat: 45.9, lon: 6.8, ele: 1000, name: 'Départ', type: "Fin d'étape" }],
      time: new Date('2026-01-01T00:00:00Z'),
    });
    expect(xml).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(xml).toContain('version="1.1"');
    const parsed = parseGpxString(xml, xmlParser);
    expect(parsed.name).toBe('Test & « accents » <ok>');
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].parts).toHaveLength(2);
    expect(parsed.waypoints[0]).toMatchObject({ name: 'Départ', type: "Fin d'étape", ele: 1000 });
    const track = gpxToTrack(parsed, 'id', 'import', 'x');
    expect(track.points).toHaveLength(seg1.length + seg2.length);
    expect(track.breaks).toEqual([seg1.length]);
    expect(track.points[0].lat).toBeCloseTo(45.9, 7);
    expect(track.points[seg1.length - 1].ele).toBeCloseTo(1100, 1);
    expect(track.points[seg1.length].ele).toBeNull();
  });

  it('rejette un fichier non GPX', () => {
    expect(() => parseGpxString('<kml></kml>', xmlParser)).toThrow(GpxParseError);
  });

  it('rejette un GPX sans trace', () => {
    const xml = generateGpx({ name: 'vide', tracks: [] });
    expect(() => gpxToTrack(parseGpxString(xml, xmlParser), 'id', 'import', 'x')).toThrow(GpxParseError);
  });

  it('utilise les routes <rte> en l’absence de trace', () => {
    const xml = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <rte><name>R</name><rtept lat="45.9" lon="6.8"><ele>1000</ele></rtept><rtept lat="45.91" lon="6.81"/></rte></gpx>`;
    const track = gpxToTrack(parseGpxString(xml, xmlParser), 'id', 'import', 'x');
    expect(track.points).toHaveLength(2);
    expect(track.name).toBe('R');
  });

  it('nom de fichier', () => {
    expect(gpxFileName('Mon TMB : Col des Fours & Arpette')).toBe('mon-tmb-col-des-fours-arpette.gpx');
  });
});
