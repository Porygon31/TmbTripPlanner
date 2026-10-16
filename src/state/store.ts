import { create } from 'zustand';
import { haversine } from '../core/geo/distance';
import { projectOnPolyline } from '../core/geo/projection';
import { computeStatistics } from '../core/elevation/stats';
import { gpxFileName } from '../core/gpx/generate';
import { gpxToTrack, parseGpxString, type ParsedGpxWaypoint } from '../core/gpx/parse';
import { routeToGpx, STAGE_END_TYPE } from '../core/gpx/exportRoute';
import { appendTrack, ComposeError, isBasedOnMain, removeVariant, routeFromMain, spliceVariant } from '../core/route/compose';
import { buildRouteGeometry } from '../core/route/geometry';
import { commit, createHistory, patchAll, redo, undo, type History } from '../core/route/history';
import { createId } from '../core/route/ids';
import * as ops from '../core/route/operations';
import { indexTrack, type IndexedTrack } from '../core/route/tracks';
import type { Catalog, LatLon, Route, RouteSegment, RouteStatistics, Track, TrackFile } from '../core/types';
import { fillMissingElevations } from '../services/elevation/elevation';
import { DEFAULT_BASEMAP } from '../services/map/basemaps';
import { DEFAULT_ROUTING_SETTINGS, type RoutingSettings } from '../services/routing/types';
import { nearestPoi } from '../services/pois/pois';
import { makeProject, projectStore, readPref, writePref, type StoredProject } from '../services/storage/projectStore';

export type Mode = 'view' | 'edit';
export type PanelId = 'route' | 'variants' | 'import' | 'project';
export type SheetState = 'peek' | 'half' | 'full';
export const MAIN_ID = 'tmb';
export const ROUTE_TARGET = 'route';
const DATA_BASE = `${import.meta.env.BASE_URL}data/`;
const IMPORT_COLORS = ['#7c3aed', '#0891b2', '#be123c', '#4d7c0f', '#c2410c'];

export interface ImportInfo {
  id: string;
  fileName: string;
  name: string;
  pointCount: number;
  color: string;
  elevationFilled: boolean;
  waypoints: ParsedGpxWaypoint[];
}

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'error';
  text: string;
}

export type Bounds = [[number, number], [number, number]];

interface UiPrefs {
  basemap: string;
  overlays: Record<string, boolean>;
  showPois: boolean;
}

const prefs = readPref<UiPrefs>('ui', { basemap: DEFAULT_BASEMAP, overlays: { trails: false, hillshade: false }, showPois: true });

export interface AppState {
  catalog: Catalog | null;
  catalogError: string | null;
  tracks: Record<string, IndexedTrack>;
  trackStatus: Record<string, 'loading' | 'elevation' | 'error'>;
  /** Statistiques recalculées après chargement (ex. altitude complétée). */
  trackStats: Record<string, RouteStatistics>;
  imports: ImportInfo[];
  visible: Record<string, boolean>;
  basemap: string;
  overlays: Record<string, boolean>;
  showPois: boolean;
  selectedTrack: { id: string; at: LatLon } | null;
  profileTarget: string;
  mode: Mode;
  panel: PanelId;
  /** Panneau inférieur (mobile). */
  sheet: SheetState;
  history: History<Route>;
  settings: RoutingSettings;
  toasts: Toast[];
  fitRequest: { bounds: Bounds; nonce: number } | null;
  restored: boolean;
  /** Les exercices du tutoriel ne remplacent jamais le brouillon personnel. */
  tutorialActive: boolean;

  // Données
  loadCatalog(): Promise<void>;
  ensureTrack(id: string): Promise<IndexedTrack | null>;
  toggleVisible(id: string, value?: boolean): void;
  focusTrack(id: string): void;
  selectTrack(sel: { id: string; at: LatLon } | null): void;
  setProfileTarget(id: string): void;

  // Carte et interface
  setBasemap(id: string): void;
  toggleOverlay(id: string): void;
  togglePois(): void;
  setMode(mode: Mode): void;
  setPanel(panel: PanelId): void;
  setSheet(sheet: SheetState): void;
  toast(kind: Toast['kind'], text: string): void;
  dismissToast(id: string): void;
  fitBounds(bounds: Bounds): void;

  // Itinéraire
  edit(fn: (route: Route) => Route): void;
  addPoint(p: LatLon): void;
  movePoint(index: number, p: LatLon): void;
  insertOnSegment(segmentIndex: number, p: LatLon): number;
  removePoint(index: number): void;
  reorderPoint(from: number, to: number): void;
  toggleStageEnd(index: number): void;
  renamePoint(index: number, name: string): void;
  renameRoute(name: string): void;
  retrySegment(index: number): void;
  setSegmentStraight(index: number): void;
  reverse(): void;
  undo(): void;
  redo(): void;
  clearRoute(): void;
  startFromMain(): Promise<void>;
  addTrackToRoute(trackId: string): Promise<void>;
  removeVariantFromRoute(variantId: string): void;
  useTrackAsBase(trackId: string): Promise<void>;
  applyRoutingResult(segmentId: string, patch: Partial<RouteSegment>): void;

  // Fichiers et projet
  importGpx(file: File): Promise<void>;
  removeImport(id: string): void;
  exportGpx(perStage: boolean): void;
  newProject(): Promise<void>;
  saveProject(name?: string): Promise<void>;
  restoreLast(): Promise<boolean>;
  loadProject(p: StoredProject): void;
  restoreSession(): Promise<void>;
  setSettings(patch: Partial<RoutingSettings>): void;
  trackName(id: string): string | undefined;
}

const toTrack = (f: TrackFile, name: string, kind: Track['kind']): Track => ({
  id: f.id,
  name,
  kind,
  points: f.points.map(([lat, lon, ele]) => ({ lat, lon, ele })),
  breaks: f.breaks ?? [],
});

export const useApp = create<AppState>()((set, get) => {
  const lookup = (id: string) => get().tracks[id];

  const toast = (kind: Toast['kind'], text: string) => {
    const id = createId('toast');
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 8000 : 4500);
  };

  const commitRoute = (next: Route) => {
    set((s) => ({ history: commit(s.history, next) }));
  };

  const tryCompose = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      if (e instanceof ComposeError) toast('error', e.message);
      else {
        console.error(e);
        toast('error', 'Opération impossible : ' + (e as Error).message);
      }
    }
  };

  const fillElevation = async (id: string) => {
    const track = get().tracks[id];
    if (!track) return;
    const coverage = track.points.filter((p) => p.ele !== null).length / Math.max(1, track.points.length);
    if (coverage >= 0.5) return;
    set((s) => ({ trackStatus: { ...s.trackStatus, [id]: 'elevation' } }));
    try {
      const points = await fillMissingElevations(track.points);
      const filled = indexTrack({ ...track, points });
      set((s) => ({
        tracks: { ...s.tracks, [id]: filled },
        trackStats: { ...s.trackStats, [id]: computeStatistics(filled.points, filled.cum) },
        imports: s.imports.map((i) => (i.id === id ? { ...i, elevationFilled: true } : i)),
      }));
    } catch {
      toast('info', `Altitudes indisponibles pour « ${track.name} » (pas de connexion au service d’altitude).`);
    } finally {
      set((s) => {
        const trackStatus = { ...s.trackStatus };
        delete trackStatus[id];
        return { trackStatus };
      });
    }
  };

  const trackInfo = (id: string) => {
    const c = get().catalog;
    if (!c) return undefined;
    if (c.main?.id === id) return c.main;
    return c.variants.find((v) => v.id === id);
  };

  return {
    catalog: null,
    catalogError: null,
    tracks: {},
    trackStatus: {},
    trackStats: {},
    imports: [],
    visible: { [MAIN_ID]: true },
    basemap: prefs.basemap,
    overlays: prefs.overlays,
    showPois: prefs.showPois,
    selectedTrack: null,
    profileTarget: ROUTE_TARGET,
    mode: 'view',
    panel: 'variants',
    sheet: 'peek',
    history: createHistory(ops.emptyRoute()),
    settings: readPref<RoutingSettings>('routing', DEFAULT_ROUTING_SETTINGS),
    toasts: [],
    fitRequest: null,
    restored: false,
    tutorialActive: false,

    async loadCatalog() {
      try {
        const res = await fetch(`${DATA_BASE}catalog.json`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const catalog = (await res.json()) as Catalog;
        set({ catalog, catalogError: null });
        if (catalog.main) await get().ensureTrack(catalog.main.id);
      } catch (e) {
        set({ catalogError: `Catalogue indisponible (${(e as Error).message}).` });
      }
    },

    async ensureTrack(id) {
      const existing = get().tracks[id];
      if (existing) return existing;
      const info = trackInfo(id);
      if (!info) return null;
      if (get().trackStatus[id] === 'loading') {
        // Attente du chargement en cours.
        return new Promise((resolve) => {
          const unsub = useApp.subscribe((s) => {
            if (s.tracks[id] || s.trackStatus[id] === 'error') {
              unsub();
              resolve(s.tracks[id] ?? null);
            }
          });
        });
      }
      set((s) => ({ trackStatus: { ...s.trackStatus, [id]: 'loading' } }));
      try {
        const res = await fetch(`${DATA_BASE}${info.file}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const file = (await res.json()) as TrackFile;
        const track = indexTrack(toTrack(file, info.name, id === MAIN_ID ? 'tmb' : 'variant'));
        set((s) => {
          const trackStatus = { ...s.trackStatus };
          delete trackStatus[id];
          return { tracks: { ...s.tracks, [id]: track }, trackStatus };
        });
        void fillElevation(id);
        return track;
      } catch (e) {
        set((s) => ({ trackStatus: { ...s.trackStatus, [id]: 'error' } }));
        toast('error', `Impossible de charger « ${info.name} » (${(e as Error).message}).`);
        return null;
      }
    },

    toggleVisible(id, value) {
      const next = value ?? !get().visible[id];
      set((s) => ({ visible: { ...s.visible, [id]: next } }));
      if (next) void get().ensureTrack(id);
    },

    focusTrack(id) {
      const info = trackInfo(id);
      const t = get().tracks[id];
      let bb: [number, number, number, number] | undefined = info?.bbox;
      if (!bb && t) {
        const lats = t.points.map((p) => p.lat);
        const lons = t.points.map((p) => p.lon);
        bb = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
      }
      if (bb) get().fitBounds([[bb[1], bb[0]], [bb[3], bb[2]]]);
    },

    selectTrack(sel) {
      set({ selectedTrack: sel });
    },

    setProfileTarget(id) {
      set({ profileTarget: id });
      if (id !== ROUTE_TARGET) void get().ensureTrack(id);
    },

    setBasemap(id) {
      set({ basemap: id });
      writePref('ui', { basemap: id, overlays: get().overlays, showPois: get().showPois });
    },
    toggleOverlay(id) {
      const overlays = { ...get().overlays, [id]: !get().overlays[id] };
      set({ overlays });
      writePref('ui', { basemap: get().basemap, overlays, showPois: get().showPois });
    },
    togglePois() {
      const showPois = !get().showPois;
      set({ showPois });
      writePref('ui', { basemap: get().basemap, overlays: get().overlays, showPois });
    },
    setMode(mode) {
      set({ mode, selectedTrack: null });
      if (mode === 'edit') set({ panel: 'route', profileTarget: ROUTE_TARGET });
    },
    setPanel(panel) {
      set((s) => ({ panel, sheet: s.sheet === 'peek' ? 'half' : s.sheet }));
    },
    setSheet(sheet) {
      set({ sheet });
    },
    toast,
    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
    fitBounds(bounds) {
      set({ fitRequest: { bounds, nonce: Date.now() } });
    },

    edit(fn) {
      const current = get().history.present;
      const next = fn(current);
      if (next !== current) commitRoute(next);
    },
    addPoint(p) {
      get().edit((r) => ops.appendWaypoint(r, p));
      set({ profileTarget: ROUTE_TARGET });
    },
    movePoint(index, p) {
      get().edit((r) => ops.moveWaypoint(r, index, p));
    },
    insertOnSegment(segmentIndex, p) {
      const { route, waypointIndex } = ops.splitSegmentAt(get().history.present, segmentIndex, p);
      commitRoute(route);
      return waypointIndex;
    },
    removePoint(index) {
      get().edit((r) => ops.removeWaypoint(r, index));
    },
    reorderPoint(from, to) {
      get().edit((r) => ops.reorderWaypoint(r, from, to));
    },
    toggleStageEnd(index) {
      get().edit((r) => {
        const w = r.waypoints[index];
        if (!w) return r;
        const stageEnd = !w.stageEnd;
        // Nom proposé : refuge, village ou col le plus proche (si les POI sont chargés).
        const name = stageEnd && !w.name ? nearestPoi(w)?.name : undefined;
        return ops.updateWaypoint(r, index, name ? { stageEnd, name } : { stageEnd });
      });
    },
    renamePoint(index, name) {
      get().edit((r) => ops.updateWaypoint(r, index, { name: name.trim() || undefined }));
    },
    renameRoute(name) {
      const r = get().history.present;
      if (name.trim() && name !== r.name) commitRoute({ ...r, name: name.trim() });
    },
    retrySegment(index) {
      get().edit((r) => ops.retrySegment(r, index));
    },
    setSegmentStraight(index) {
      get().edit((r) => ops.setStraight(r, index));
    },
    reverse() {
      get().edit((r) => ops.reverseRoute(r));
    },
    undo() {
      set((s) => ({ history: undo(s.history) }));
    },
    redo() {
      set((s) => ({ history: redo(s.history) }));
    },
    clearRoute() {
      const r = get().history.present;
      if (r.waypoints.length === 0) return;
      commitRoute({ ...ops.emptyRoute(r.name), id: r.id });
    },

    async startFromMain() {
      const main = await get().ensureTrack(MAIN_ID);
      if (!main) {
        toast('error', 'Tracé principal du TMB indisponible (voir data/README.md).');
        return;
      }
      commitRoute(routeFromMain(main, 'Mon Tour du Mont-Blanc'));
      set((s) => ({ profileTarget: ROUTE_TARGET, panel: 'route', visible: { ...s.visible, [MAIN_ID]: true } }));
      get().focusTrack(MAIN_ID);
      toast('success', 'Le classique est prêt. Choisissez vos variantes dans Explorer.');
    },

    async addTrackToRoute(trackId) {
      const catalog = get().catalog;
      const variant = catalog?.variants.find((v) => v.id === trackId);
      const track = await get().ensureTrack(trackId);
      if (!track && !get().tracks[trackId]) return;
      const name = get().trackName(trackId) ?? trackId;
      let route = get().history.present;
      tryCompose(() => {
        if (variant && variant.attachable && variant.departure && variant.rejoin && catalog?.main) {
          const main = get().tracks[MAIN_ID];
          if (route.waypoints.length === 0 && main) route = routeFromMain(main, 'Mon Tour du Mont-Blanc');
          if (main && isBasedOnMain(route, MAIN_ID)) {
            const res = spliceVariant(
              route,
              lookup,
              MAIN_ID,
              { id: trackId, name, startOnMain: variant.departure.distOnMain, endOnMain: variant.rejoin.distOnMain },
              (id) => get().trackName(id),
            );
            commitRoute(res.route);
            if (res.droppedStageEnds > 0) toast('info', `${res.droppedStageEnds} fin(s) d’étape située(s) sur le tronçon remplacé ont été retirées.`);
            toast('success', `« ${name} » intégrée à votre TMB.`);
            set({ profileTarget: ROUTE_TARGET });
            return;
          }
        }
        commitRoute(appendTrack(route, lookup, trackId, name));
        toast('success', `« ${name} » ajoutée à la fin de l’itinéraire.`);
        set({ profileTarget: ROUTE_TARGET });
      });
    },

    removeVariantFromRoute(variantId) {
      tryCompose(() => {
        const r = get().history.present;
        if (!isBasedOnMain(r, MAIN_ID)) throw new ComposeError('Retrait automatique possible uniquement sur un itinéraire construit à partir du TMB.');
        commitRoute(removeVariant(r, lookup, MAIN_ID, variantId));
        toast('success', 'Variante retirée : tronçon classique restauré.');
      });
    },

    async useTrackAsBase(trackId) {
      const track = get().tracks[trackId] ?? (await get().ensureTrack(trackId));
      if (!track) return;
      const name = get().trackName(trackId) ?? 'Itinéraire';
      let route = ops.routeFromTrack(trackId, lookup, name, 5000);
      // Restaure les fins d'étape d'un GPX exporté par l'application.
      const info = get().imports.find((i) => i.id === trackId);
      for (const w of info?.waypoints.filter((x) => x.type === STAGE_END_TYPE) ?? []) {
        const near = route.waypoints.findIndex((wp) => haversine(wp, w) < 30);
        if (near > 0 && near < route.waypoints.length - 1) {
          route = ops.updateWaypoint(route, near, { stageEnd: true, name: w.name ?? undefined });
          continue;
        }
        const g = buildRouteGeometry(route);
        const proj = projectOnPolyline(g.points, g.cum, w);
        if (!proj || proj.offset > 50) continue;
        const seg = g.segmentRanges.findIndex(([a, b]) => proj.index >= a && proj.index < b);
        if (seg < 0) continue;
        const res = ops.splitSegmentAt(route, seg, w, 'user', { stageEnd: true, name: w.name ?? undefined });
        route = res.route;
      }
      commitRoute(route);
      set({ profileTarget: ROUTE_TARGET, panel: 'route' });
      toast('success', `« ${name} » sert de base à votre itinéraire : déplacez ou ajoutez des points pour le modifier.`);
    },

    applyRoutingResult(segmentId, patch) {
      set((s) => ({ history: patchAll(s.history, (r) => (r.segments.some((x) => x.id === segmentId && x.status === 'pending') ? ops.applySegmentResult(r, segmentId, patch) : r)) }));
    },

    async importGpx(file) {
      if (!/\.gpx$/i.test(file.name)) {
        toast('error', 'Seuls les fichiers .gpx sont acceptés.');
        return;
      }
      try {
        const text = await file.text();
        const parsed = parseGpxString(text);
        const id = createId('import');
        const track = indexTrack(gpxToTrack(parsed, id, 'import', file.name.replace(/\.gpx$/i, '')));
        const color = IMPORT_COLORS[get().imports.length % IMPORT_COLORS.length];
        const info: ImportInfo = {
          id,
          fileName: file.name,
          name: track.name,
          pointCount: track.points.length,
          color,
          elevationFilled: false,
          waypoints: parsed.waypoints,
        };
        set((s) => ({
          tracks: { ...s.tracks, [id]: track },
          trackStats: { ...s.trackStats, [id]: computeStatistics(track.points, track.cum) },
          imports: [...s.imports, info],
          visible: { ...s.visible, [id]: true },
          profileTarget: id,
          panel: 'import',
        }));
        get().focusTrack(id);
        void fillElevation(id);
      } catch (e) {
        toast('error', `Import impossible : ${(e as Error).message}`);
      }
    },

    removeImport(id) {
      const used = get().history.present.segments.some((s) => s.trackRef?.trackId === id);
      if (used) {
        toast('error', 'Cette trace est utilisée par votre itinéraire.');
        return;
      }
      set((s) => {
        const tracks = { ...s.tracks };
        delete tracks[id];
        return { tracks, imports: s.imports.filter((i) => i.id !== id), profileTarget: s.profileTarget === id ? ROUTE_TARGET : s.profileTarget };
      });
    },

    exportGpx(perStage) {
      const route = get().history.present;
      const attributions = new Set<string>();
      for (const seg of route.segments) {
        if (seg.mode === 'routed' && seg.provider) attributions.add(`itinéraire calculé par ${seg.provider}, données © contributeurs OpenStreetMap (ODbL)`);
        if (seg.trackRef) {
          const src = trackInfo(seg.trackRef.trackId)?.source;
          if (src) attributions.add(`${src.label}${src.license ? ` (${src.license})` : ''}`);
          const imp = get().imports.find((i) => i.id === seg.trackRef!.trackId);
          if (imp) attributions.add(`GPX importé « ${imp.fileName} »`);
        }
      }
      try {
        const xml = routeToGpx(route, { perStage, attributions: [...attributions] });
        const blob = new Blob([xml], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = gpxFileName(route.name);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast('success', `GPX exporté : ${a.download}`);
      } catch (e) {
        toast('error', (e as Error).message);
      }
    },

    async newProject() {
      const r = get().history.present;
      if (r.waypoints.length > 0 && !get().tutorialActive) await projectStore.saveLast(makeProject(r, get().imports.map((i) => get().tracks[i.id]).filter(Boolean)));
      set({ history: createHistory(ops.emptyRoute()), profileTarget: ROUTE_TARGET, mode: 'edit', panel: 'route' });
      toast('info', 'Nouveau parcours. L’ancien est récupérable via « Restaurer le dernier parcours ».');
    },

    async saveProject(name) {
      if (get().tutorialActive) { toast('success', 'Sauvegarde d’essai réussie. Votre sauvegarde personnelle est préservée.'); return; }
      const r = get().history.present;
      const p = makeProject(r, get().imports.map((i) => get().tracks[i.id]).filter(Boolean));
      await projectStore.saveCurrent(p);
      await projectStore.saveLast(p);
      await projectStore.addSave(name || r.name, p);
      toast('success', 'Parcours sauvegardé dans ce navigateur.');
    },

    async restoreLast() {
      if (get().tutorialActive) { toast('info', 'Quittez le tutoriel pour retrouver vos parcours personnels.'); return false; }
      const p = await projectStore.loadLast();
      if (!p) {
        toast('info', 'Aucun parcours précédent à restaurer.');
        return false;
      }
      get().loadProject(p);
      toast('success', `Parcours « ${p.route.name} » restauré.`);
      return true;
    },

    loadProject(p) {
      const tracks = { ...get().tracks };
      const trackStats = { ...get().trackStats };
      const imports: ImportInfo[] = [...get().imports];
      for (const t of p.imports) {
        if (tracks[t.id]) continue;
        const it = indexTrack(t);
        tracks[t.id] = it;
        trackStats[t.id] = computeStatistics(it.points, it.cum);
        imports.push({
          id: t.id,
          fileName: `${t.name}.gpx`,
          name: t.name,
          pointCount: t.points.length,
          color: IMPORT_COLORS[imports.length % IMPORT_COLORS.length],
          elevationFilled: false,
          waypoints: [],
        });
      }
      set((s) => ({ tracks, trackStats, imports, history: commit(s.history, p.route), profileTarget: ROUTE_TARGET }));
    },

    async restoreSession() {
      const p = await projectStore.loadCurrent();
      if (p && p.route.waypoints.length > 0) {
        get().loadProject(p);
        set((s) => ({ history: createHistory(s.history.present) }));
      }
      set({ restored: true });
    },

    setSettings(patch) {
      const settings = { ...get().settings, ...patch };
      set({ settings });
      writePref('routing', settings);
    },

    trackName(id) {
      return trackInfo(id)?.name ?? get().imports.find((i) => i.id === id)?.name ?? get().tracks[id]?.name;
    },
  };
});

export const selectRoute = (s: AppState) => s.history.present;
