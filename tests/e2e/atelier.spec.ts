import { expect, test } from '@playwright/test';
import { openApp, routeInfo, waitRouted } from './helpers';
import { installMocks } from './mocks';

test('nouveau parcours libre : le tour précédent reste récupérable', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('classic-start').click();
  await waitRouted(page);
  const original = await routeInfo(page);
  await page.getByTestId('tab-variants').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Créer un parcours libre' }).click();
  await expect(page.getByTestId('route-panel')).toBeVisible();
  expect((await routeInfo(page)).waypoints).toHaveLength(0);
  await page.getByRole('button', { name: 'Restaurer le dernier parcours', exact: true }).click();
  await expect.poll(async () => (await routeInfo(page)).waypoints.length).toBe(original.waypoints.length);
  expect(await routeInfo(page)).toEqual(original);
});

test('tutoriel : exercice isolé, sauvegarde personnelle et aide conservées', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('classic-start').click();
  await waitRouted(page);
  const before = await routeInfo(page);
  await page.getByRole('button', { name: 'Tutoriel', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Tutoriel interactif' })).toBeVisible();
  expect((await routeInfo(page)).waypoints).toHaveLength(0);
  await page.getByLabel('Étape du tutoriel').selectOption('5');
  await page.getByTestId('classic-start').click();
  await page.getByTestId('tab-variants').click();
  await page.getByTestId('add-fixture-col-nord').click();
  await page.getByLabel('Étape du tutoriel').selectOption('12');
  await page.getByRole('button', { name: 'Sauvegarder', exact: true }).click();
  await expect(page.locator('.toasts')).toContainText('Sauvegarde d’essai');
  await page.getByRole('button', { name: 'Quitter', exact: true }).click();
  expect(await routeInfo(page)).toEqual(before);
  // La sauvegarde d’essai ne survit pas au rechargement, le brouillon personnel oui.
  await page.reload();
  await page.waitForFunction(() => window.__tmb?.store.getState().restored);
  expect(await routeInfo(page)).toEqual(before);
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Le guide de TMB Atelier');
  await page.getByRole('button', { name: 'Fermer l’aide' }).click();
  // Une fermeture du navigateur au milieu d’un nouvel exercice garde aussi le brouillon.
  await page.getByRole('button', { name: 'Tutoriel', exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => window.__tmb?.store.getState().restored);
  expect(await routeInfo(page)).toEqual(before);
});

for (const width of [1140, 390]) {
  test(`Atelier : présentation, lieux et export (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1244 });
    await installMocks(page);
    await page.route(/\/data\/(catalog\.json|tracks\/.+\.json|gpx\/.+\.gpx|pois\.json)$/, (r) => r.continue());
    if (process.env.TMB_VISUAL_LIVE === '1') await page.route(/tile\.openstreetmap\.org/, (r) => r.continue());
    await page.goto('/');
    await expect(page.getByRole('dialog')).toContainText('Bienvenue dans TMB Atelier');
    await page.getByTestId('disclaimer-accept').click();
    await expect(page.locator('.atelier-brand')).toContainText('TMB Atelier');
    await expect.poll(() => page.evaluate(() => window.__tmb?.store.getState().basemap)).toBe('osm');
    await expect(page.locator('[title="Les Houches — départ du TMB"]')).toBeVisible();
    await expect(page.getByTestId('tab-variants')).toHaveText('Explorer');
    if (width === 390) await page.getByRole('button', { name: 'Points d’intérêt', exact: true }).click();
    await page.getByLabel('Hôtels', { exact: true }).check();
    if (width === 390) await page.getByRole('button', { name: 'Points d’intérêt', exact: true }).click();
    await page.evaluate(() => window.__tmb.map.setView([45.895989, 6.805748], 14, { animate: false }));
    await page.locator('[title="Le Saint-Antoine"]').click();
    await expect(page.locator('.poi-popup').getByRole('link', { name: /Site de l’hébergement/ })).toHaveAttribute('href', 'https://www.hotelsaintantoine.com/');
    await page.locator('.poi-popup').getByRole('button', { name: 'Ajouter au parcours' }).click();
    expect((await routeInfo(page)).waypoints).toHaveLength(1);
    await expect(page.getByLabel('Nom du point 1')).toHaveValue('Le Saint-Antoine');
    // Le menu et le clic sur un lieu n’ajoutent pas de point accidentel sur la carte.
    await page.getByTestId('tab-variants').click();
    await page.getByTestId('classic-start').click();
    await waitRouted(page);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('header-export').click()]);
    expect(download.suggestedFilename()).toMatch(/\.gpx$/);
    await page.getByTestId('tab-variants').click();
    await expect(page.locator('[data-testid^="variant-"]')).toHaveCount(7);
    if (width === 390) {
      // Dernière fiche accessible dans le panneau, aucune zone coupée en bas.
      await page.getByTestId('add-vallorcine').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('add-vallorcine')).toBeInViewport();
      await page.locator('.panel-scroll').evaluate((el) => { el.scrollTop = 0; });
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    while (await page.locator('.toast .icon-btn').count()) await page.locator('.toast .icon-btn').first().click();
    if (process.env.TMB_VISUAL_LIVE === '1') await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('.leaflet-tile')).every((tile) => tile.complete && tile.style.opacity === '1'));
    await page.screenshot({ path: `test-results/atelier-${width}.png`, animations: 'disabled' });
    if (width === 390) {
      await page.getByTestId('sheet-handle').click();
      await page.getByTestId('sheet-handle').click();
      await expect(page.locator('.sidebar')).toHaveClass(/sheet-peek/);
      await expect.poll(async () => Math.round((await page.locator('.sidebar').boundingBox())!.height)).toBe(112);
      const label = (await page.locator('.tmb-start-label').boundingBox())!;
      expect(label.x).toBeGreaterThanOrEqual(0);
      expect(label.x + label.width).toBeLessThanOrEqual(width);
      const key = (await page.locator('.map-key').boundingBox())!;
      const legend = (await page.locator('.poi-legend').boundingBox())!;
      expect(key.x + key.width).toBeLessThan(legend.x);
      await page.screenshot({ path: 'test-results/atelier-390-carte.png', animations: 'disabled' });
      await page.getByRole('button', { name: 'Tutoriel', exact: true }).click();
      await page.getByLabel('Étape du tutoriel').selectOption('13');
      const tutorial = page.getByRole('region', { name: 'Tutoriel interactif' });
      await expect(tutorial).toBeInViewport();
      await expect.poll(async () => {
        const sheet = (await page.locator('.sidebar').boundingBox())!;
        const guide = (await tutorial.boundingBox())!;
        return Math.abs(sheet.y + sheet.height - guide.y);
      }).toBeLessThan(2);
      await page.screenshot({ path: 'test-results/atelier-390-tutoriel.png', animations: 'disabled' });
      await page.getByRole('button', { name: 'Quitter', exact: true }).click();
    }
  });
}
