import { expect, type Page } from '@playwright/test';
import { installMocks, type MockStats } from './mocks';

declare global {
  interface Window {
    __tmb: {
      map: import('leaflet').Map;
      store: { getState(): import('../../src/state/store').AppState };
    };
  }
}

export async function openApp(page: Page, { acceptDisclaimer = true } = {}): Promise<MockStats> {
  const stats = await installMocks(page);
  await page.goto('/');
  if (acceptDisclaimer) {
    await page.getByTestId('disclaimer-accept').click();
  }
  await page.waitForFunction(() => !!window.__tmb && !!window.__tmb.store.getState().tracks['tmb']);
  return stats;
}

/** Point écran (dans la page) correspondant à une coordonnée. */
export async function screenPoint(page: Page, lat: number, lon: number): Promise<{ x: number; y: number }> {
  const pt = await page.evaluate(([la, lo]) => {
    const p = window.__tmb.map.latLngToContainerPoint([la, lo]);
    return { x: p.x, y: p.y };
  }, [lat, lon] as const);
  const box = (await page.locator('.leaflet-container').boundingBox())!;
  return { x: box.x + pt.x, y: box.y + pt.y };
}

export async function clickMap(page: Page, lat: number, lon: number) {
  const p = await screenPoint(page, lat, lon);
  await page.mouse.click(p.x, p.y);
}

export async function setView(page: Page, lat: number, lon: number, zoom: number) {
  await page.evaluate(([la, lo, z]) => window.__tmb.map.setView([la, lo], z, { animate: false }), [lat, lon, zoom] as const);
}

/** Attend que tous les tronçons de l'itinéraire soient calculés. */
export async function waitRouted(page: Page) {
  await page.waitForFunction(() => {
    const r = window.__tmb.store.getState().history.present;
    return r.segments.length > 0 && r.segments.every((s) => s.status === 'ok');
  });
}

export async function routeInfo(page: Page) {
  return page.evaluate(() => {
    const r = window.__tmb.store.getState().history.present;
    return {
      waypoints: r.waypoints.map((w) => ({ lat: w.lat, lon: w.lon, role: w.role, stageEnd: !!w.stageEnd })),
      segments: r.segments.map((s) => ({ id: s.id, status: s.status, mode: s.mode, points: s.points.length, trackId: s.trackRef?.trackId ?? null })),
    };
  });
}

/** Plus grand écart (m) entre deux points consécutifs de la géométrie de l'itinéraire. */
export async function maxGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const r = window.__tmb.store.getState().history.present;
    const pts = r.segments.flatMap((s) => s.points);
    const R = 6371008.8;
    const rad = Math.PI / 180;
    let max = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const s = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
      max = Math.max(max, 2 * R * Math.asin(Math.sqrt(s)));
    }
    return max;
  });
}

/** Plus grand écart (m) entre la fin d'un tronçon et le début du suivant. */
export async function junctionGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const segs = window.__tmb.store.getState().history.present.segments;
    const R = 6371008.8;
    const rad = Math.PI / 180;
    let max = 0;
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1].points[segs[i - 1].points.length - 1];
      const b = segs[i].points[0];
      const s = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
      max = Math.max(max, 2 * R * Math.asin(Math.sqrt(s)));
    }
    return max;
  });
}

export async function expectNoErrors(page: Page) {
  await expect(page.getByTestId('route-status')).toHaveCount(0);
}
