import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBRouterProvider } from '../../src/services/routing/brouter';
import { RoutingQueue } from '../../src/services/routing/queue';
import { RoutingError, type RoutingProvider } from '../../src/services/routing/types';
import { fillMissingElevations, type ElevationProvider } from '../../src/services/elevation/elevation';
import { line } from './helpers';

afterEach(() => vi.unstubAllGlobals());

const from = { lat: 45.89, lon: 6.79 };
const to = { lat: 45.88, lon: 6.77 };

describe('BRouter', () => {
  it('construit la requête et lit le GeoJSON avec altitude', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ features: [{ geometry: { coordinates: [[6.79, 45.89, 1010], [6.78, 45.885, 1100], [6.77, 45.88, 1200]] } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const leg = await createBRouterProvider('https://brouter.de/brouter/', 'hiking-mountain').route(from, to);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toBe('https://brouter.de/brouter?lonlats=6.790000,45.890000|6.770000,45.880000&profile=hiking-mountain&alternativeidx=0&format=geojson');
    expect(leg.points).toHaveLength(3);
    expect(leg.points[1]).toEqual({ lat: 45.885, lon: 6.78, ele: 1100 });
  });

  it('traduit « aucun chemin » en erreur compréhensible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('to-position not mapped in existing datafile', { status: 400 })));
    await expect(createBRouterProvider('https://brouter.de/brouter', 'hiking-mountain').route(from, to)).rejects.toMatchObject({ kind: 'no-path' });
  });

  it('signale une coupure réseau', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(createBRouterProvider('https://brouter.de/brouter', 'x').route(from, to)).rejects.toBeInstanceOf(RoutingError);
  });
});

describe('file de calcul', () => {
  it('met en cache et mutualise les requêtes identiques', async () => {
    let calls = 0;
    const provider: RoutingProvider = {
      id: 'fake',
      label: 'fake',
      attribution: '',
      providesElevation: true,
      async route(a, b) {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return { points: [{ ...a, ele: 1 }, { ...b, ele: 2 }], provider: 'fake' };
      },
    };
    const q = new RoutingQueue(1);
    const ctrl = new AbortController();
    const [l1, l2] = await Promise.all([q.request(provider, 'k', from, to, ctrl.signal), q.request(provider, 'k', from, to, ctrl.signal)]);
    expect(l1).toBe(l2);
    await q.request(provider, 'k', from, to, ctrl.signal);
    expect(calls).toBe(1);
    await q.request(provider, 'k', to, from, ctrl.signal);
    expect(calls).toBe(2);
  });

  it('n’envoie pas une requête déjà annulée', async () => {
    const provider: RoutingProvider = { id: 'f', label: 'f', attribution: '', providesElevation: false, route: vi.fn() };
    const q = new RoutingQueue(1);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(q.request(provider, 'k', from, to, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(provider.route).not.toHaveBeenCalled();
  });
});

describe('altitudes manquantes', () => {
  it('échantillonne puis interpole, sans toucher aux altitudes existantes', async () => {
    const pts = line({ lat: 45.9, lon: 6.8 }, { lat: 45.9, lon: 6.81 }, 10);
    pts[0] = { ...pts[0], ele: 999 };
    const requested: number[] = [];
    const provider: ElevationProvider = {
      id: 'fake',
      attribution: '',
      async getElevations(points) {
        requested.push(points.length);
        return points.map((p) => (p.lon - 6.8) * 100000);
      },
    };
    const out = await fillMissingElevations(pts, provider, 40);
    expect(out[0].ele).toBe(999);
    expect(requested[0]).toBeLessThan(pts.length / 2);
    const last = out[out.length - 1];
    expect(last.ele).toBeCloseTo(1000, 0);
    expect(out.every((p) => p.ele !== null)).toBe(true);
  });
});
