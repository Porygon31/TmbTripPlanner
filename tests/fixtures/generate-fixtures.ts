/**
 * Génère des GPX SYNTHÉTIQUES pour les tests automatiques (jamais livrés dans l'application).
 * Ce ne sont PAS des tracés réels : une ellipse autour du massif et deux détours.
 *
 *   tsx tests/fixtures/generate-fixtures.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateGpx } from '../../src/core/gpx/generate';
import type { RoutePoint } from '../../src/core/types';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'data');
const CENTER = { lat: 45.84, lon: 6.88 };
const RX = 0.17; // degrés de longitude
const RY = 0.1; // degrés de latitude

/** Point de l'ellipse ; `angle` en degrés, 0 = nord, sens antihoraire (vers l'ouest). */
function ellipse(angle: number, scale = 1): { lat: number; lon: number } {
  const a = (angle * Math.PI) / 180;
  return { lat: CENTER.lat + RY * scale * Math.cos(a), lon: CENTER.lon - RX * scale * Math.sin(a) };
}

const ele = (angle: number, bump = 0) => Math.round((1500 + 700 * Math.sin((angle * Math.PI) / 45) + bump) * 10) / 10;

function arc(from: number, to: number, scale: number, n: number, bump: (t: number) => number): RoutePoint[] {
  const pts: RoutePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = from + (to - from) * t;
    pts.push({ ...ellipse(ang, scale), ele: ele(ang, bump(t)) });
  }
  return pts;
}

function detour(from: number, to: number): RoutePoint[] {
  const n = 120;
  const pts: RoutePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = from + (to - from) * t;
    const scale = 1 + 0.08 * Math.sin(Math.PI * t);
    pts.push({ ...ellipse(ang, scale), ele: ele(ang, 600 * Math.sin(Math.PI * t)) });
  }
  return pts;
}

async function write(path: string, name: string, segments: RoutePoint[][]) {
  const xml = generateGpx({ name, desc: 'Données SYNTHÉTIQUES de test — pas un tracé réel.', tracks: [{ name, segments }], time: new Date('2026-01-01T00:00:00Z') });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, xml);
}

async function main() {
  const loop = arc(0, 360, 1, 1800, () => 0);
  loop[loop.length - 1] = { ...loop[0] };
  await write(join(out, 'gpx/tmb-principal.gpx'), 'FIXTURE boucle principale', [loop]);
  // Variante écrite à l'envers pour vérifier la réorientation automatique.
  await write(join(out, 'gpx/variantes/fixture-col-nord.gpx'), 'FIXTURE variante nord', [detour(30, 60).reverse()]);
  await write(join(out, 'gpx/variantes/fixture-col-sud.gpx'), 'FIXTURE variante sud', [detour(190, 230)]);
  await write(join(out, 'import/fixture-import.gpx'), 'FIXTURE import', [arc(100, 120, 0.6, 200, (t) => 300 * t)]);
  await writeFile(
    join(out, 'catalog.config.json'),
    JSON.stringify(
      {
        main: { file: 'gpx/tmb-principal.gpx', name: 'FIXTURE boucle principale', description: 'Données synthétiques de test.', source: { label: 'Fixture de test' }, direction: 'counterclockwise' },
        variants: [
          { id: 'fixture-col-nord', file: 'gpx/variantes/fixture-col-nord.gpx', name: 'FIXTURE variante nord', description: 'Détour synthétique.', departureName: 'Jonction A', rejoinName: 'Jonction B', source: { label: 'Fixture de test' } },
          { id: 'fixture-col-sud', file: 'gpx/variantes/fixture-col-sud.gpx', name: 'FIXTURE variante sud', description: null, difficulty: 'T3', source: null },
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Fixtures écrites dans ${out}`);
}

main();
