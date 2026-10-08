import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASEMAPS, OVERLAYS } from '../../src/services/map/basemaps';
import { clickMap, routeInfo, setView, waitRouted } from '../e2e/helpers';

const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });

/** Seul le catalogue est simulé (données de test) ; tout le reste passe par Internet. */
async function open(page: Page) {
  await page.route(/\/data\/(catalog\.json|tracks\/.+\.json|gpx\/.+\.gpx)$/, async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/data\//, '');
    await route.fulfill({ status: 200, body: await readFile(join('tests/.generated/data', path)) });
  });
  await page.goto('/');
  await page.getByTestId('disclaimer-accept').click();
  await page.waitForFunction(() => !!window.__tmb && !!window.__tmb.store.getState().tracks['tmb']);
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const s = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

test('tous les fonds de carte et calques répondent', async ({ page }) => {
  test.setTimeout(300_000);
  const statuses = new Map<string, (number | string)[]>();
  const record = (url: string, value: number | string) => {
    const host = new URL(url).host;
    statuses.set(host, [...(statuses.get(host) ?? []), value]);
  };
  page.on('response', (r) => r.request().resourceType() === 'image' && record(r.url(), r.status()));
  page.on('requestfailed', (r) => r.resourceType() === 'image' && record(r.url(), r.failure()?.errorText ?? 'failed'));
  await open(page);
  await setView(page, 45.92, 6.87, 13);
  const soft = expect.configure({ soft: true });
  const has200 = (host: string) => [...statuses.entries()].some(([h, list]) => h.endsWith(host) && list.includes(200));
  // Chaque fond est laissé affiché jusqu'à réception d'une tuile (changer trop tôt annule les requêtes en cours).
  for (const b of [...BASEMAPS, ...OVERLAYS]) {
    const host = new URL(b.url.replace('{s}', 'a')).host.replace(/^a\./, '');
    if (b.id !== 'topo') {
      await page.evaluate((id) => {
        const s = window.__tmb.store.getState();
        if (['trails', 'hillshade'].includes(id)) s.toggleOverlay(id);
        else s.setBasemap(id);
      }, b.id);
    }
    await soft
      .poll(() => has200(host), {
        timeout: 30_000,
        message: `${b.label} (${host}) : ${JSON.stringify([...statuses.entries()].filter(([h]) => h.endsWith(host))).slice(0, 300)}`,
      })
      .toBe(true);
  }
  await page.evaluate(() => window.__tmb.store.getState().setBasemap('topo'));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/live-fonds.png` });
});

test('BRouter calcule un vrai itinéraire de randonnée (pas une ligne droite)', async ({ page }) => {
  await open(page);
  // Chamonix (centre) → Les Praz : fond de vallée, nombreux chemins.
  const a = { lat: 45.9229, lon: 6.8697 };
  const b = { lat: 45.9386, lon: 6.889 };
  await setView(page, 45.931, 6.879, 14);
  await page.getByTestId('toggle-edit').click();
  await clickMap(page, a.lat, a.lon);
  await clickMap(page, b.lat, b.lon);
  await waitRouted(page);
  const seg = await page.evaluate(() => window.__tmb.store.getState().history.present.segments[0]);
  expect(seg.status).toBe('ok');
  expect(seg.provider).toContain('BRouter');
  expect(seg.points.length).toBeGreaterThan(10);
  let length = 0;
  for (let i = 1; i < seg.points.length; i++) length += haversine(seg.points[i - 1], seg.points[i]);
  expect(length).toBeGreaterThan(haversine(a, b) * 1.02);
  expect(seg.points.every((p) => p.ele !== null)).toBe(true);
  expect((await routeInfo(page)).segments).toHaveLength(1);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/live-itineraire.png` });
});

test('Open-Meteo complète les altitudes d’un GPX qui n’en a pas', async ({ page }) => {
  await open(page);
  await page.getByTestId('tab-import').click();
  const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Sans altitude</name><trkseg>
    <trkpt lat="45.9229" lon="6.8697"/><trkpt lat="45.9300" lon="6.8790"/><trkpt lat="45.9386" lon="6.8890"/></trkseg></trk></gpx>`;
  await page.getByTestId('gpx-input').setInputFiles({ name: 'sans-altitude.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) });
  await page.waitForFunction(() => window.__tmb.store.getState().imports[0]?.elevationFilled === true, null, { timeout: 30_000 });
  const stats = await page.evaluate(() => {
    const s = window.__tmb.store.getState();
    return s.trackStats[s.imports[0].id];
  });
  expect(stats.minEle).toBeGreaterThan(900);
  expect(stats.maxEle).toBeLessThan(1500);
});

test('points d’intérêt OpenStreetMap (Overpass) — informatif', async ({ page }) => {
  const waiting = page.waitForResponse((r) => r.url().includes('overpass'), { timeout: 60_000 }).catch(() => null);
  await open(page);
  const res = await waiting;
  if (!res || res.status() !== 200) {
    console.warn(`⚠ Overpass indisponible (${res?.status() ?? 'pas de réponse'}) : couche POI vide, l’application reste utilisable.`);
    return;
  }
  const json = await res.json();
  expect(json.elements.length).toBeGreaterThan(10);
});
