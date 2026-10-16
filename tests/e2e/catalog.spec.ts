import { expect, test } from '@playwright/test';
import { installMocks } from './mocks';
import { routeInfo, waitRouted } from './helpers';

for (const viewport of [{ width: 1400, height: 900 }, { width: 390, height: 844 }]) {
  test(`catalogue réel : TMB et variantes utilisables (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const services = await installMocks(page);
    // On garde les services externes simulés, mais charge les fichiers réellement livrés.
    await page.route(/\/data\/(catalog\.json|tracks\/.+\.json|gpx\/.+\.gpx)$/, (route) => route.continue());
    await page.goto('/');
    await page.getByTestId('disclaimer-accept').click();
    if (viewport.width < 700) await page.getByTestId('sheet-handle').click();
    await page.getByTestId('tab-variants').click();
    await expect(page.getByTestId('main-card')).toContainText('TMB classique — données OpenStreetMap');
    await expect(page.locator('[data-testid^="variant-"]')).toHaveCount(7);
    await page.getByTestId('classic-start').click();
    await waitRouted(page);
    await page.getByTestId('tab-variants').click();
    await page.getByTestId('add-le-tour').click();
    await waitRouted(page);
    const route = await routeInfo(page);
    expect(route.segments.some((segment) => segment.trackId === 'le-tour')).toBe(true);
    expect(route.segments.every((segment) => segment.mode === 'track' && segment.status === 'ok')).toBe(true);
    expect(services.brouter).toHaveLength(0);
    expect(services.elevation).toBe(0);
    await page.screenshot({ path: `test-results/catalogue-reel-${viewport.width}.png` });
  });
}
