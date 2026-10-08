import type { BrowserContext, Page, Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const GENERATED = 'tests/.generated/data';

// Tuile PNG 1×1 gris clair.
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+XJ/PUwAAAABJRU5ErkJggg==', 'base64');

export interface MockStats {
  brouter: { from: [number, number]; to: [number, number] }[];
  tiles: number;
  elevation: number;
}

/** Altitude synthétique déterministe (pour le faux service d'altitude et le faux BRouter). */
export const fakeEle = (lat: number, lon: number) => Math.round((1200 + 800 * Math.sin(lat * 40) + 400 * Math.cos(lon * 30)) * 10) / 10;

/**
 * Faux BRouter : renvoie un trajet qui n'est PAS une ligne droite (détour latéral, ~30 points),
 * au format GeoJSON de BRouter, avec altitude.
 */
function fakeBRouter(lonlats: string) {
  const [[lon1, lat1], [lon2, lat2]] = lonlats.split('|').map((p) => p.split(',').map(Number));
  const n = 30;
  const coords: number[][] = [];
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const bulge = Math.sin(Math.PI * t) * 0.12;
    const lon = lon1 + dx * t - dy * bulge;
    const lat = lat1 + dy * t + dx * bulge;
    coords.push([Number(lon.toFixed(6)), Number(lat.toFixed(6)), fakeEle(lat, lon)]);
  }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { creator: 'BRouter-test' }, geometry: { type: 'LineString', coordinates: coords } }],
  };
}

export async function installMocks(target: Page | BrowserContext): Promise<MockStats> {
  const stats: MockStats = { brouter: [], tiles: 0, elevation: 0 };

  // Par défaut, tout appel externe non prévu est bloqué (le test ne dépend jamais d'Internet).
  await target.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort('blockedbyclient'));

  const tile = (route: Route) => {
    stats.tiles++;
    return route.fulfill({ status: 200, contentType: 'image/png', body: TILE });
  };
  await target.route(/tile\.opentopomap\.org|tile\.openstreetmap\.org|arcgisonline\.com|waymarkedtrails\.org\/hiking|geopf\.fr|geo\.admin\.ch/, tile);

  await target.route(/brouter\.de\/brouter\?/, async (route) => {
    const url = new URL(route.request().url());
    const lonlats = url.searchParams.get('lonlats')!;
    const [[lon1, lat1], [lon2, lat2]] = lonlats.split('|').map((p) => p.split(',').map(Number));
    stats.brouter.push({ from: [lat1, lon1], to: [lat2, lon2] });
    await new Promise((r) => setTimeout(r, 60));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(fakeBRouter(lonlats)) });
  });

  await target.route(/api\.open-meteo\.com\/v1\/elevation/, async (route) => {
    stats.elevation++;
    const url = new URL(route.request().url());
    const lats = url.searchParams.get('latitude')!.split(',').map(Number);
    const lons = url.searchParams.get('longitude')!.split(',').map(Number);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ elevation: lats.map((lat, i) => fakeEle(lat, lons[i])) }),
    });
  });

  await target.route(/overpass-api\.de/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        elements: [
          { type: 'node', id: 1, lat: 45.93, lon: 6.88, tags: { tourism: 'alpine_hut', name: 'FIXTURE Refuge' } },
          { type: 'node', id: 2, lat: 45.84, lon: 6.86, tags: { natural: 'peak', name: 'FIXTURE Sommet', ele: '4000' } },
        ],
      }),
    }),
  );

  // Catalogue de test (données synthétiques) à la place du catalogue réel.
  await target.route(/\/data\/(catalog\.json|tracks\/.+\.json|gpx\/.+\.gpx|pois\.json)$/, async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/data\//, '');
    try {
      const body = await readFile(join(GENERATED, path));
      await route.fulfill({ status: 200, contentType: path.endsWith('.json') ? 'application/json' : 'application/gpx+xml', body });
    } catch {
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  return stats;
}
