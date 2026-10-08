import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { clickMap, openApp, routeInfo, setView, waitRouted } from './helpers';

const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });

test('mobile : carte plein écran, panneau inférieur rétractable, création au toucher', async ({ page }) => {
  await openApp(page);
  const map = page.locator('.leaflet-container');
  const box = (await map.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.height).toBeGreaterThan(viewport.height * 0.9);
  await page.screenshot({ path: `${SHOTS}/mobile-accueil.png` });

  // Ouvrir le panneau puis revenir à la carte.
  await page.getByTestId('sheet-handle').click();
  await expect(page.locator('.sidebar')).toHaveClass(/sheet-half/);
  await page.getByTestId('tab-variants').click();
  await expect(page.getByTestId('main-card')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/mobile-panneau.png` });
  await page.getByTestId('sheet-handle').click();
  await page.getByTestId('sheet-handle').click();
  await expect(page.locator('.sidebar')).toHaveClass(/sheet-peek/);

  // Création au toucher.
  await setView(page, 45.875, 6.86, 12);
  await page.getByTestId('toggle-edit').tap();
  await clickMap(page, 45.9, 6.83);
  await clickMap(page, 45.87, 6.89);
  await waitRouted(page);
  expect((await routeInfo(page)).segments).toHaveLength(1);
  await expect(page.getByTestId('route-summary')).toContainText('km');
  await page.screenshot({ path: `${SHOTS}/mobile-itineraire.png` });
});
