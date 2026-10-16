/**
 * Construit le catalogue de l'application à partir des GPX fournis dans `data/`.
 *
 *   tsx scripts/build-catalog.ts [--src data] [--out public/data]
 *
 * Entrées :
 *   data/catalog.config.json        métadonnées (facultatif, voir data/README.md)
 *   data/gpx/tmb-principal.gpx      tracé de référence
 *   data/gpx/variantes/*.gpx        variantes
 * Sorties :
 *   <out>/catalog.json              fiches (statistiques, jonctions, difficulté, sources)
 *   <out>/tracks/<id>.json          points [lat, lon, ele]
 *   <out>/gpx/<id>.gpx              copie du GPX source (téléchargeable)
 *
 * Aucune donnée n'est inventée : un champ absent reste `null` et s'affiche « non renseigné ».
 */
import { DOMParser } from '@xmldom/xmldom';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { bbox, haversine, signedArea } from '../src/core/geo/distance';
import { sliceByDistance } from '../src/core/geo/projection';
import { computeStatistics, maxSustainedGradient } from '../src/core/elevation/stats';
import { gpxToTrack, parseGpxString, type XmlParser } from '../src/core/gpx/parse';
import { indexTrack, type IndexedTrack } from '../src/core/route/tracks';
import { configuredDifficulty, estimateDifficulty } from '../src/core/variants/difficulty';
import { orientVariant } from '../src/core/variants/junctions';
import { slugify, VARIANT_COLORS, type CatalogConfig, type CatalogConfigEntry } from '../src/core/variants/catalogConfig';
import type { Catalog, CatalogTrackInfo, RoutePoint, Track, TrackFile, TmbVariant } from '../src/core/types';

const GAP_WARNING = 100;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const SRC = resolve(arg('src', 'data'));
const OUT = resolve(arg('out', 'public/data'));
const parser = new DOMParser() as unknown as XmlParser;

const log = (msg: string) => console.log(`[catalogue] ${msg}`);
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

async function loadConfig(): Promise<CatalogConfig> {
  const path = join(SRC, 'catalog.config.json');
  const config: CatalogConfig = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : {};
  // Découverte automatique des fichiers non déclarés.
  const mainDefault = 'gpx/tmb-principal.gpx';
  if (!config.main && existsSync(join(SRC, mainDefault))) config.main = { file: mainDefault };
  const declared = new Set((config.variants ?? []).map((v) => v.file));
  const dir = join(SRC, 'gpx/variantes');
  if (existsSync(dir)) {
    for (const f of (await readdir(dir)).sort()) {
      const file = `gpx/variantes/${f}`;
      if (f.toLowerCase().endsWith('.gpx') && !declared.has(file)) {
        config.variants = [...(config.variants ?? []), { file }];
      }
    }
  }
  return config;
}

async function readTrack(entry: CatalogConfigEntry, id: string, kind: Track['kind']): Promise<Track | null> {
  const path = join(SRC, entry.file);
  if (!existsSync(path)) {
    log(`  ⚠ fichier absent, ignoré : ${relative(process.cwd(), path)}`);
    return null;
  }
  const parsed = parseGpxString(await readFile(path, 'utf8'), parser);
  return gpxToTrack(parsed, id, kind, basename(entry.file, '.gpx'));
}

function gapWarnings(points: RoutePoint[]): string[] {
  let count = 0;
  let max = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    if (d > GAP_WARNING) {
      count++;
      max = Math.max(max, d);
    }
  }
  return count > 0 ? [`${count} intervalle(s) de plus de ${GAP_WARNING} m entre points (max ${Math.round(max)} m) : vérifier ces portions peu détaillées.`] : [];
}

function elevationWarnings(coverage: number): string[] {
  if (coverage >= 0.999) return [];
  if (coverage === 0) return ['Aucune altitude dans le GPX : dénivelés et profil indisponibles (altitude complétée en ligne par l’application si possible).'];
  return [`Altitudes manquantes sur ${Math.round((1 - coverage) * 100)} % des points.`];
}

/** Oriente le tracé principal selon le sens demandé et le fait éventuellement commencer à un lieu donné. */
function prepareMain(track: Track, cfg: NonNullable<CatalogConfig['main']>): { track: Track; warnings: string[] } {
  const warnings: string[] = [];
  let points = track.points;
  let breaks = track.breaks;
  const isLoop = haversine(points[0], points[points.length - 1]) < 500;
  const direction = cfg.direction ?? 'counterclockwise';
  if (direction !== 'as-is') {
    const ccw = signedArea(points) > 0;
    if ((direction === 'counterclockwise') !== ccw) {
      points = [...points].reverse();
      breaks = breaks.map((b) => points.length - b).reverse();
      log('  ↺ tracé principal retourné pour respecter le sens ' + (direction === 'counterclockwise' ? 'antihoraire' : 'horaire'));
    }
  }
  if (cfg.startNear && isLoop) {
    if (breaks.length > 0) {
      warnings.push('Départ non modifié : la trace contient plusieurs parties.');
    } else {
      let best = 0;
      let bestD = Infinity;
      points.forEach((p, i) => {
        const d = haversine(p, cfg.startNear!);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best > 0 && best < points.length - 1) {
        const closed = haversine(points[0], points[points.length - 1]) < 1 ? points.slice(0, -1) : points;
        points = [...closed.slice(best), ...closed.slice(0, best + 1)];
        log(`  ⇥ départ placé au plus près de ${cfg.startNear.name ?? 'startNear'} (${Math.round(bestD)} m)`);
      }
    }
  }
  return { track: { ...track, points, breaks }, warnings };
}

function trackFile(track: Track): TrackFile {
  return {
    id: track.id,
    points: track.points.map((p) => [round(p.lat, 6), round(p.lon, 6), p.ele === null ? null : round(p.ele, 1)]),
    breaks: track.breaks,
  };
}

async function main() {
  log(`source : ${relative(process.cwd(), SRC) || '.'} → sortie : ${relative(process.cwd(), OUT)}`);
  const config = await loadConfig();
  await rm(join(OUT, 'tracks'), { recursive: true, force: true });
  await rm(join(OUT, 'gpx'), { recursive: true, force: true });
  await mkdir(join(OUT, 'tracks'), { recursive: true });
  await mkdir(join(OUT, 'gpx'), { recursive: true });

  const catalog: Catalog = { generatedAt: new Date().toISOString(), main: null, variants: [], warnings: [] };
  const writeTrack = async (track: Track, entry: CatalogConfigEntry) => {
    await writeFile(join(OUT, 'tracks', `${track.id}.json`), JSON.stringify(trackFile(track)));
    await copyFile(join(SRC, entry.file), join(OUT, 'gpx', `${track.id}.gpx`));
  };

  let main: IndexedTrack | null = null;
  if (config.main) {
    const raw = await readTrack(config.main, 'tmb', 'tmb');
    if (raw) {
      const { track, warnings } = prepareMain(raw, config.main);
      main = indexTrack({ ...track, name: config.main.name ?? track.name });
      const stats = computeStatistics(main.points, main.cum);
      const info: CatalogTrackInfo = {
        id: main.id,
        name: main.name,
        description: config.main.description ?? null,
        source: config.main.source ?? null,
        references: config.main.references ?? [],
        stats,
        bbox: bbox(main.points),
        file: `tracks/${main.id}.json`,
        gpxFile: `gpx/${main.id}.gpx`,
        warnings: [...warnings, ...gapWarnings(main.points), ...elevationWarnings(stats.elevationCoverage)],
      };
      catalog.main = info;
      await writeTrack(main, config.main);
      log(`✓ TMB principal : ${(stats.distance / 1000).toFixed(1)} km, D+ ${Math.round(stats.ascent)} m, ${main.points.length} points`);
      info.warnings.forEach((w) => log(`  ⚠ ${w}`));
    } else {
      catalog.warnings.push(`Tracé principal absent : déposez ${config.main.file} dans data/ (voir data/README.md).`);
    }
  } else {
    catalog.warnings.push('Aucun tracé principal : déposez data/gpx/tmb-principal.gpx (voir data/README.md).');
    log('⚠ aucun tracé principal (data/gpx/tmb-principal.gpx)');
  }

  const usedIds = new Set<string>(['tmb']);
  for (const [k, entry] of (config.variants ?? []).entries()) {
    let id = slugify(entry.id ?? basename(entry.file)) || `variante-${k + 1}`;
    while (usedIds.has(id)) id = `${id}-${k + 1}`;
    usedIds.add(id);
    const raw = await readTrack(entry, id, 'variant');
    if (!raw) continue;
    const warnings: string[] = [];
    let points = raw.points;
    let breaks = raw.breaks;
    let departure: TmbVariant['departure'] = null;
    let rejoin: TmbVariant['rejoin'] = null;
    let mainSection: TmbVariant['mainSection'] = null;
    let attachable = false;
    if (main) {
      const o = orientVariant(main, raw.points);
      if (o.reversed) {
        points = o.points;
        breaks = breaks.map((b) => points.length - b).reverse();
      }
      warnings.push(...o.warnings);
      attachable = o.attachable;
      departure = { lat: o.start.point.lat, lon: o.start.point.lon, distOnMain: o.start.distOnMain, snapDistance: o.start.snapDistance, name: entry.departureName ?? null };
      rejoin = { lat: o.end.point.lat, lon: o.end.point.lon, distOnMain: o.end.distOnMain, snapDistance: o.end.snapDistance, name: entry.rejoinName ?? null };
      if (o.start.distOnMain < o.end.distOnMain) {
        const section = sliceByDistance(main.points, main.cum, o.start.distOnMain, o.end.distOnMain);
        mainSection = computeStatistics(section);
      }
    } else {
      warnings.push('Tracé principal absent : jonctions non calculées.');
    }
    const track = indexTrack({ ...raw, points, breaks, name: entry.name ?? raw.name });
    const stats = computeStatistics(track.points, track.cum);
    const difficulty = entry.difficulty
      ? configuredDifficulty(entry.difficulty)
      : estimateDifficulty(stats, maxSustainedGradient(track.points, track.cum));
    const variant: TmbVariant = {
      id,
      name: track.name,
      description: entry.description ?? null,
      source: entry.source ?? null,
      references: entry.references ?? [],
      stats,
      bbox: bbox(track.points),
      file: `tracks/${id}.json`,
      gpxFile: `gpx/${id}.gpx`,
      warnings: [...warnings, ...gapWarnings(track.points), ...elevationWarnings(stats.elevationCoverage)],
      color: entry.color ?? VARIANT_COLORS[catalog.variants.length % VARIANT_COLORS.length],
      difficulty,
      departure,
      rejoin,
      mainSection,
      deltaDistance: mainSection ? stats.distance - mainSection.distance : null,
      deltaAscent: mainSection && mainSection.elevationCoverage > 0.8 && stats.elevationCoverage > 0.8 ? stats.ascent - mainSection.ascent : null,
      attachable,
    };
    catalog.variants.push(variant);
    await writeTrack(track, entry);
    const delta = variant.deltaDistance === null ? '' : `, ${variant.deltaDistance >= 0 ? '+' : ''}${(variant.deltaDistance / 1000).toFixed(1)} km vs TMB`;
    log(`✓ variante « ${variant.name} » : ${(stats.distance / 1000).toFixed(1)} km${delta}, difficulté ${difficulty.label}${attachable ? '' : ' (non greffable)'}`);
    variant.warnings.forEach((w) => log(`  ⚠ ${w}`));
  }
  catalog.variants.sort((a, b) => (a.departure?.distOnMain ?? Infinity) - (b.departure?.distOnMain ?? Infinity));
  await writeFile(join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 1));
  log(`catalogue écrit : ${catalog.main ? 1 : 0} tracé principal, ${catalog.variants.length} variante(s)`);
}

main().catch((e) => {
  console.error('[catalogue] échec :', e instanceof Error ? e.message : e);
  process.exit(1);
});
