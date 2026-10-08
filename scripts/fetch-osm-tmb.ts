/**
 * OPTIONNEL — à lancer sur ta machine (accès Internet requis) :
 *
 *   npm run fetch:osm [-- --relation 124456] [-- --no-elevation]
 *
 * 1. Lit la super-relation OpenStreetMap du TMB (124456) via l'API Overpass.
 * 2. Pour chaque relation membre (itinéraire principal + variantes), récupère la géométrie
 *    des chemins dans l'ordre de la relation et les enchaîne en trace continue.
 * 3. Ajoute l'altitude via l'API Open-Meteo (MNT Copernicus GLO-90).
 * 4. Écrit data/gpx/… et renseigne la `source` (relation, licence ODbL, date) dans data/catalog.config.json.
 *
 * Données © contributeurs OpenStreetMap, licence ODbL 1.0.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { haversine } from '../src/core/geo/distance';
import { generateGpx } from '../src/core/gpx/generate';
import { slugify, type CatalogConfig, type CatalogConfigEntry } from '../src/core/variants/catalogConfig';
import type { RoutePoint } from '../src/core/types';

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const DATA = resolve('data');
const args = process.argv.slice(2);
const SUPER = Number(args[args.indexOf('--relation') + 1]) || 124456;
const WITH_ELEVATION = !args.includes('--no-elevation');
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OsmMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  geometry?: { lat: number; lon: number }[];
}
interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  members?: OsmMember[];
}

async function overpass(query: string): Promise<OsmElement[]> {
  let lastError: unknown;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'User-Agent': 'TmbTripPlanner/0.1 (fetch-osm-tmb)' },
      });
      if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
      return ((await res.json()) as { elements: OsmElement[] }).elements;
    } catch (e) {
      lastError = e;
      console.warn(`  Overpass indisponible (${url}), essai suivant…`);
    }
  }
  throw lastError;
}

/** Enchaîne les chemins d'une relation (dans l'ordre des membres) en parties continues. */
function chainWays(members: OsmMember[]): RoutePoint[][] {
  const parts: RoutePoint[][] = [];
  let current: RoutePoint[] = [];
  const ways = members.filter((m) => m.type === 'way' && m.geometry && m.geometry.length > 1);
  for (let i = 0; i < ways.length; i++) {
    let g = ways[i].geometry!.map((p) => ({ lat: p.lat, lon: p.lon, ele: null as number | null }));
    if (current.length === 0) {
      // Premier chemin d'une partie : on l'oriente vers le chemin suivant.
      const next = ways[i + 1]?.geometry;
      if (next) {
        const ends = [next[0], next[next.length - 1]];
        const dStart = Math.min(...ends.map((e) => haversine(g[0], e)));
        const dEnd = Math.min(...ends.map((e) => haversine(g[g.length - 1], e)));
        if (dStart < dEnd) g = g.reverse();
      }
      current = g;
      continue;
    }
    const tail = current[current.length - 1];
    const dFwd = haversine(tail, g[0]);
    const dRev = haversine(tail, g[g.length - 1]);
    if (dRev < dFwd) g = g.reverse();
    if (Math.min(dFwd, dRev) > 30) {
      parts.push(current);
      current = g;
    } else {
      current.push(...g.slice(1));
    }
  }
  if (current.length > 1) parts.push(current);
  return parts;
}

async function addElevation(parts: RoutePoint[][]): Promise<void> {
  const all = parts.flat();
  for (let i = 0; i < all.length; i += 100) {
    const batch = all.slice(i, i + 100);
    const url =
      'https://api.open-meteo.com/v1/elevation?latitude=' +
      batch.map((p) => p.lat.toFixed(6)).join(',') +
      '&longitude=' +
      batch.map((p) => p.lon.toFixed(6)).join(',');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo → HTTP ${res.status}`);
    const { elevation } = (await res.json()) as { elevation: number[] };
    batch.forEach((p, k) => (p.ele = Number.isFinite(elevation[k]) ? elevation[k] : null));
    process.stdout.write(`\r  altitude : ${Math.min(i + 100, all.length)}/${all.length}`);
    await sleep(120);
  }
  process.stdout.write('\n');
}

const KNOWN: [RegExp, string][] = [
  [/tricot/i, 'col-de-tricot'],
  [/fours/i, 'col-des-fours'],
  [/bernard/i, 'tete-bernarda'],
  [/arpette/i, 'fenetre-d-arpette'],
  [/grands/i, 'les-grands'],
  [/vallorcine/i, 'vallorcine'],
  [/\b(du|le) tour\b/i, 'le-tour'],
];

async function main() {
  console.log(`Super-relation OSM ${SUPER}…`);
  const [superRel] = await overpass(`[out:json][timeout:60];relation(${SUPER});out body;`);
  if (!superRel?.members) throw new Error('Super-relation introuvable.');
  const configPath = join(DATA, 'catalog.config.json');
  const config: CatalogConfig = existsSync(configPath) ? JSON.parse(await readFile(configPath, 'utf8')) : {};
  config.variants ??= [];

  for (const member of superRel.members.filter((m) => m.type === 'relation')) {
    const [rel] = await overpass(`[out:json][timeout:120];relation(${member.ref});out geom;`);
    const name = rel?.tags?.name ?? `Relation ${member.ref}`;
    const isMain = /principal/i.test(name) || member.role === 'main' || (!/variante/i.test(name) && member === superRel.members[0]);
    console.log(`• ${name} (${member.ref})${isMain ? ' — itinéraire principal' : ''}`);
    const parts = chainWays(rel?.members ?? []);
    if (parts.length === 0) {
      console.warn('  aucune géométrie, ignorée');
      continue;
    }
    if (parts.length > 1) console.warn(`  ⚠ ${parts.length} parties non jointives (trous dans la relation)`);
    if (WITH_ELEVATION) await addElevation(parts);

    const id = isMain ? 'tmb-principal' : (KNOWN.find(([re]) => re.test(name))?.[1] ?? slugify(name));
    const file = isMain ? 'gpx/tmb-principal.gpx' : `gpx/variantes/${id}.gpx`;
    const source = {
      label: `OpenStreetMap — relation ${member.ref}${WITH_ELEVATION ? ' ; altitude Open-Meteo (Copernicus GLO-90)' : ''}`,
      url: `https://www.openstreetmap.org/relation/${member.ref}`,
      license: 'ODbL 1.0',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
      retrieved: today,
    };
    const xml = generateGpx({
      name,
      desc: `Relation OpenStreetMap ${member.ref}, récupérée le ${today}.`,
      copyright: { author: 'Contributeurs OpenStreetMap', license: 'https://opendatacommons.org/licenses/odbl/1-0/' },
      links: [{ href: source.url, text: 'OpenStreetMap' }],
      tracks: [{ name, segments: parts }],
    });
    await mkdir(dirname(join(DATA, file)), { recursive: true });
    await writeFile(join(DATA, file), xml);

    if (isMain) {
      config.main = { ...(config.main ?? { file }), file, source };
    } else {
      const existing = config.variants.find((v: CatalogConfigEntry) => v.file === file);
      if (existing) existing.source = source;
      else config.variants.push({ id, file, name, description: null, source, references: [], difficulty: null });
    }
    await sleep(1000);
  }
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('Terminé. Lance `npm run build:data` pour régénérer le catalogue.');
}

main().catch((e) => {
  console.error('Échec :', e instanceof Error ? e.message : e);
  process.exit(1);
});
