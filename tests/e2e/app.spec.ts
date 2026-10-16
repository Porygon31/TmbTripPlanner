import { expect, test } from '@playwright/test';
import { DOMParser } from '@xmldom/xmldom';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gpxToTrack, parseGpxString, type XmlParser } from '../../src/core/gpx/parse';
import { computeStatistics } from '../../src/core/elevation/stats';
import { installMocks } from './mocks';
import { clickMap, junctionGap, maxGap, openApp, routeInfo, screenPoint, setView, waitRouted } from './helpers';

const xml = new DOMParser() as unknown as XmlParser;
const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });

// Points de test dans l'emprise des données synthétiques.
const A = { lat: 45.905, lon: 6.8 };
const B = { lat: 45.885, lon: 6.86 };
const C = { lat: 45.86, lon: 6.92 };
const D = { lat: 45.84, lon: 6.97 };

async function createRoute(page: import('@playwright/test').Page, points = [A, B, C]) {
  await setView(page, 45.87, 6.88, 12);
  await page.getByTestId('toggle-edit').click();
  for (const p of points) await clickMap(page, p.lat, p.lon);
  await waitRouted(page);
}

test.describe('Carte et catalogue', () => {
  test('charge la carte, les tuiles et le tracé du TMB', async ({ page }) => {
    const stats = await openApp(page);
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect.poll(() => stats.tiles).toBeGreaterThan(0);
    // Les tuiles sont réellement affichées (une requête CORS refusée les laisserait vides).
    await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
    // Le tracé est dessiné (rendu canvas) et le profil du TMB est affiché par défaut.
    await expect(page.locator('.leaflet-overlay-pane canvas')).toHaveCount(1);
    await expect(page.getByTestId('elevation-profile')).toBeVisible();
    await page.getByTestId('tab-variants').click();
    const card = page.getByTestId('main-card');
    await expect(card).toContainText('FIXTURE boucle principale');
    await card.locator('.track-details summary').click();
    await expect(card.locator('[data-stat="distance"] dd')).toHaveText('76,4 km');
    await page.screenshot({ path: `${SHOTS}/desktop-accueil.png` });
  });

  test('fond de carte indisponible : bascule automatique sur la carte classique', async ({ page }) => {
    await installMocks(page);
    await page.route(/tile\.opentopomap\.org/, (route) => route.fulfill({ status: 503, body: 'indisponible' }));
    await page.goto('/');
    await page.getByTestId('disclaimer-accept').click();
    await page.getByTestId('layers-button').click();
    await page.getByRole('radio', { name: 'Topographique', exact: true }).check();
    await expect.poll(() => page.evaluate(() => window.__tmb?.store.getState().basemap)).toBe('osm');
    await expect(page.locator('.toast')).toContainText('indisponible');
    await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
  });

  test('clic sur le tracé : fiche avec distance, dénivelés et altitudes', async ({ page }) => {
    await openApp(page);
    // Point exact du tracé de test (sommet nord de l'ellipse).
    await setView(page, 45.94, 6.88, 13);
    const p = await screenPoint(page, 45.94, 6.88);
    await page.mouse.click(p.x, p.y);
    const popup = page.getByTestId('track-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('FIXTURE boucle principale');
    for (const key of ['distance', 'ascent', 'descent', 'min', 'max']) {
      await expect(popup.locator(`[data-stat="${key}"] dd`)).not.toHaveText('—');
    }
  });

  test('afficher/masquer le TMB et plusieurs variantes', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('layers-button').click();
    await page.getByTestId('toggle-tmb').uncheck();
    expect(await page.evaluate(() => window.__tmb.store.getState().visible['tmb'])).toBe(false);
    await page.getByTestId('toggle-tmb').check();
    await page.getByTestId('layers-button').click();

    await page.getByTestId('tab-variants').click();
    const nord = page.getByTestId('variant-fixture-col-nord');
    const sud = page.getByTestId('variant-fixture-col-sud');
    await nord.getByTestId('show-fixture-col-nord').click();
    await sud.getByTestId('show-fixture-col-sud').click();
    await expect(nord.getByTestId('show-fixture-col-nord')).toHaveText(/Masquer/);
    await page.waitForFunction(() => {
      const t = window.__tmb.store.getState().tracks;
      return !!t['fixture-col-nord'] && !!t['fixture-col-sud'];
    });
    // Écart de distance par rapport au tronçon classique, difficulté, jonctions.
    await expect(nord.getByTestId('delta-distance')).toHaveText(/\+ 0,\d km/);
    await expect(nord).toContainText('Jonction A → Jonction B');
    await expect(sud).toContainText('T3');
    await expect(sud).toContainText('Description non renseignée');
    await page.screenshot({ path: `${SHOTS}/desktop-variantes.png` });
  });
});

test.describe('Créateur d’itinéraire', () => {
  test('3 clics : itinéraire routé sur les sentiers (pas de ligne droite)', async ({ page }) => {
    const stats = await openApp(page);
    await createRoute(page);
    const info = await routeInfo(page);
    expect(info.waypoints).toHaveLength(3);
    expect(info.segments).toHaveLength(2);
    for (const s of info.segments) {
      expect(s.mode).toBe('routed');
      expect(s.points).toBeGreaterThan(2);
    }
    expect(stats.brouter).toHaveLength(2);
    // Une fois calculés, les tronçons sont dessinés en trait plein (plus en pointillé « en calcul »).
    const dashed = await page.evaluate(() => {
      let n = 0;
      window.__tmb.map.eachLayer((l) => {
        const o = (l as unknown as { options?: { color?: string; weight?: number; dashArray?: unknown } }).options;
        if (o?.color === '#ed693d' && o.weight === 4 && o.dashArray) n++;
      });
      return n;
    });
    expect(dashed).toBe(0);
    await expect(page.getByTestId('route-panel').locator('[data-stat="distance"] dd')).not.toHaveText('0,0 km');
    await expect(page.getByTestId('route-panel').locator('[data-stat="ascent"] dd')).not.toHaveText('—');
    await expect(page.getByTestId('elevation-profile')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-itineraire.png` });
  });

  test('déplacer un point ne recalcule que les deux tronçons voisins', async ({ page }) => {
    const stats = await openApp(page);
    await createRoute(page, [A, B, C, D]);
    const before = await routeInfo(page);
    expect(stats.brouter).toHaveLength(3);
    const marker = page.locator('.leaflet-marker-icon.wp-marker', { hasText: /^2$/ });
    const box = (await marker.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 30, y + 10, { steps: 5 });
    await page.mouse.move(x + 60, y + 25, { steps: 5 });
    await page.mouse.up();
    await waitRouted(page);
    const after = await routeInfo(page);
    expect(stats.brouter).toHaveLength(5);
    expect(after.segments[2].id).toBe(before.segments[2].id);
    expect(after.segments[0].id).not.toBe(before.segments[0].id);
    expect(after.waypoints[1].lon).not.toBeCloseTo(before.waypoints[1].lon, 4);
  });

  test('ajouter, supprimer, réordonner, annuler, rétablir, effacer', async ({ page }) => {
    await openApp(page);
    await createRoute(page);
    // Insertion d'un point en touchant le tracé (sans recalcul).
    const seg = await page.evaluate(() => {
      const s = window.__tmb.store.getState().history.present.segments[0];
      const p = s.points[Math.floor(s.points.length / 2)];
      return { lat: p.lat, lon: p.lon };
    });
    await clickMap(page, seg.lat, seg.lon);
    expect((await routeInfo(page)).waypoints).toHaveLength(4);
    // Suppression depuis la liste.
    await page.getByRole('button', { name: 'Supprimer le point 2' }).click();
    await waitRouted(page);
    expect((await routeInfo(page)).waypoints).toHaveLength(3);
    // Réordonnancement.
    const firstLat = (await routeInfo(page)).waypoints[0].lat;
    await page.getByTestId('waypoint-list').getByRole('button', { name: 'Descendre' }).first().click();
    await waitRouted(page);
    expect((await routeInfo(page)).waypoints[1].lat).toBeCloseTo(firstLat, 6);
    // Annuler / rétablir (raccourcis clavier).
    await page.locator('.leaflet-container').focus();
    await page.keyboard.press('Control+z');
    expect((await routeInfo(page)).waypoints[0].lat).toBeCloseTo(firstLat, 6);
    await page.keyboard.press('Control+y');
    expect((await routeInfo(page)).waypoints[1].lat).toBeCloseTo(firstLat, 6);
    // Effacer.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Effacer' }).click();
    expect((await routeInfo(page)).waypoints).toHaveLength(0);
    await page.getByRole('button', { name: 'Annuler' }).first().click();
    expect((await routeInfo(page)).waypoints).toHaveLength(3);
  });

  test('étapes : statistiques par journée', async ({ page }) => {
    await openApp(page);
    await createRoute(page, [A, B, C, D]);
    await page.getByRole('button', { name: 'Marquer comme fin d’étape' }).first().click();
    const table = page.getByTestId('stages-table');
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table).toContainText('J1');
    await expect(table).toContainText('J2');
  });

  test('l’itinéraire est restauré après rechargement de la page', async ({ page }) => {
    await openApp(page);
    await createRoute(page);
    await page.waitForTimeout(1500); // sauvegarde automatique (1 s)
    await page.reload();
    await page.waitForFunction(() => window.__tmb?.store.getState().restored);
    const info = await routeInfo(page);
    expect(info.waypoints).toHaveLength(3);
    expect(info.segments.every((s) => s.status === 'ok')).toBe(true);
  });
});

test.describe('TMB personnalisé', () => {
  test('partir du TMB, greffer deux variantes, sans trou', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('classic-start').click();
    await page.getByTestId('tab-variants').click();
    await page.getByTestId('add-fixture-col-nord').click();
    await page.getByTestId('add-fixture-col-sud').click();
    await expect(page.getByTestId('variant-fixture-col-nord')).toContainText('Intégrée');
    await expect(page.getByTestId('variant-fixture-col-sud')).toContainText('Intégrée');
    const info = await routeInfo(page);
    expect(info.segments.filter((s) => s.trackId === 'fixture-col-nord')).toHaveLength(1);
    expect(info.segments.filter((s) => s.trackId === 'fixture-col-sud')).toHaveLength(1);
    // Aucun trou aux raccords, et pas d'écart anormal (les traces de test sont échantillonnées ~50–90 m).
    expect(await junctionGap(page)).toBeLessThan(1);
    expect(await maxGap(page)).toBeLessThan(120);
    // Retirer une variante restaure le tronçon classique.
    await page.getByTestId('variant-fixture-col-nord').getByRole('button', { name: 'Intégrée' }).click();
    const after = await routeInfo(page);
    expect(after.segments.some((s) => s.trackId === 'fixture-col-nord')).toBe(false);
    await page.screenshot({ path: `${SHOTS}/desktop-tmb-personnalise.png` });
  });
});

test.describe('Import et export GPX', () => {
  test('import : nom, distance, dénivelés, altitudes, nombre de points', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('tab-import').click();
    await page.getByTestId('gpx-input').setInputFiles('tests/fixtures/data/import/fixture-import.gpx');
    const card = page.getByTestId('import-card');
    await expect(card).toContainText('FIXTURE import');
    await expect(card.getByTestId('import-filename')).toHaveText('fixture-import.gpx');
    await expect(card.getByTestId('import-points')).toHaveText('201 points');
    for (const key of ['distance', 'ascent', 'descent', 'min', 'max']) {
      await expect(card.locator(`[data-stat="${key}"] dd`)).not.toHaveText('—');
    }
    // Utiliser comme base.
    await card.getByTestId('use-as-base').click();
    const info = await routeInfo(page);
    expect(info.segments.length).toBeGreaterThan(0);
    expect(info.segments.every((s) => s.mode === 'track')).toBe(true);
  });

  test('refuse un fichier qui n’est pas un GPX', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('tab-import').click();
    await page.getByTestId('gpx-input').setInputFiles({ name: 'faux.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from('<kml></kml>') });
    await expect(page.locator('.toast-error')).toContainText('Import impossible');
  });

  test('export GPX 1.1 valide, puis réouverture du fichier exporté', async ({ page }) => {
    await openApp(page);
    await createRoute(page, [A, B, C, D]);
    await page.getByRole('button', { name: 'Marquer comme fin d’étape' }).first().click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('header-export').click()]);
    expect(download.suggestedFilename()).toBe('mon-itineraire.gpx');
    const file = 'test-results/export.gpx';
    await download.saveAs(file);
    const text = readFileSync(file, 'utf8');

    // 1. Validité XML et, si disponible, conformité au schéma officiel GPX 1.1.
    const xsd = process.env.GPX_XSD ?? 'tests/.generated/gpx.xsd';
    const args = existsSync(xsd) ? ['--noout', '--schema', xsd, file] : ['--noout', file];
    execFileSync('xmllint', args, { stdio: 'pipe' });
    if (!existsSync(xsd)) console.warn('⚠ XSD GPX 1.1 absent : seule la validité XML est vérifiée (la CI télécharge le schéma officiel).');

    // 2. Contenu : nom, ordre des points, altitudes, étapes.
    const parsed = parseGpxString(text, xml);
    expect(parsed.name).toBe('Mon itinéraire');
    expect(text).toContain('version="1.1"');
    expect(text).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    const track = gpxToTrack(parsed, 'x', 'import', 'x');
    const expected = await page.evaluate(() => window.__tmb.store.getState().history.present.segments.reduce((n, s, i) => n + s.points.length - (i > 0 ? 1 : 0), 0));
    expect(track.points.length).toBe(expected);
    expect(track.points.every((p) => p.ele !== null)).toBe(true);
    const first = (await routeInfo(page)).waypoints[0];
    expect(Math.abs(track.points[0].lat - first.lat)).toBeLessThan(0.0005);
    expect(parsed.waypoints.some((w) => w.type === "Fin d'étape")).toBe(true);
    const exportedStats = computeStatistics(track.points);

    // 3. Réimport du fichier exporté dans l'application : mêmes statistiques.
    await page.getByTestId('tab-import').click();
    await page.getByTestId('gpx-input').setInputFiles(file);
    const card = page.getByTestId('import-card');
    await expect(card).toContainText('Mon itinéraire');
    const reStats = await page.evaluate(() => {
      const s = window.__tmb.store.getState();
      const id = s.imports[s.imports.length - 1].id;
      return s.trackStats[id];
    });
    expect(reStats.distance).toBeCloseTo(exportedStats.distance, 0);
    expect(reStats.ascent).toBeCloseTo(exportedStats.ascent, 0);
    // Les fins d'étape sont restaurées en utilisant le fichier comme base.
    await card.getByTestId('use-as-base').click();
    expect((await routeInfo(page)).waypoints.some((w) => w.stageEnd)).toBe(true);
    writeFileSync(`${SHOTS}/export-ok.txt`, `${track.points.length} points\n`);
  });
});

test('le profil met en évidence le point correspondant sur la carte', async ({ page }) => {
  await openApp(page);
  await createRoute(page);
  const chart = page.locator('.profile-canvas .u-over');
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByTestId('profile-tip')).toContainText(/km · .* m/);
  // Marqueur de survol ajouté sur la carte (rendu canvas → on vérifie la couche).
  await expect
    .poll(() =>
      page.evaluate(() => {
        let n = 0;
        window.__tmb.map.eachLayer((l) => {
          const opts = (l as unknown as { options?: { fillColor?: string } }).options;
          if (opts?.fillColor === '#111827') n++;
        });
        return n;
      }),
    )
    .toBe(1);
});
