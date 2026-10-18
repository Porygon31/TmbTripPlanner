"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Mountain,
  ArrowUpRight,
  Map,
  Route as RouteIcon,
  Download,
  Upload,
  Layers,
  Plus,
  LocateFixed,
  Maximize,
  Focus,
  MousePointer2,
  MapPin,
  Trash2,
  Info,
  X,
  LoaderCircle,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
  Save,
  RotateCcw,
  Flag,
  ChevronUp,
  ChevronDown,
  Eye,
  Check,
  BookOpen,
  CircleHelp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouteEditor } from "@/hooks/use-route-editor";
import { conflicts, composeTmb, integrateVariant, splitSegment } from "@/lib/tmb/catalog";
import { downloadGpx, parseGpx } from "@/lib/tmb/gpx";
import { km, meters, statistics, samePoint } from "@/lib/tmb/geo";
import { routeStops } from "@/lib/tmb/loop";
import type {
  Catalog,
  Route,
  RoutePoint,
  TmbVariant,
  Provenance,
  PointOfInterest,
} from "@/lib/tmb/types";
import Profile from "./Profile";
import { useAnalysis } from "@/hooks/use-analysis";
import { useProjectStorage } from "@/hooks/use-project-storage";
import { useWebMCP } from "@/hooks/use-webmcp";
import { routingProvider } from "@/lib/tmb/routing";
import { uid } from "@/lib/tmb/geo";
import PoiLegend from "./PoiLegend";
import Tutorial, { TUTORIAL_STEPS } from "./Tutorial";
import WelcomeDialog from "./WelcomeDialog";
import RouteStatisticsPanel, { Stats } from "./RouteStatistics";
import GpxWorker from "@/workers/gpx.worker?worker";
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">Chargement de la carte du Mont-Blanc…</div>
  ),
});
export const SECONDARY = true;
export default function Planner() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [visible, setVisible] = useState<string[]>([]),
    [base, setBase] = useState("osm"),
    [tab, setTab] = useState("explore"),
    [mode, setMode] = useState<"view" | "add" | "insert">("view"),
    [fit, setFit] = useState(0),
    [hover, setHover] = useState<RoutePoint | null>(null),
    [imported, setImported] = useState<Route | null>(null),
    [source, setSource] = useState<Provenance | null>(null),
    [overlap, setOverlap] = useState<TmbVariant | null>(null),
    [panel, setPanel] = useState<"normal" | "expanded" | "collapsed">("normal"),
    [selected, setSelected] = useState<string | null>(null),
    [lat, setLat] = useState(""),
    [lon, setLon] = useState(""),
    [notice, setNotice] = useState(""),
    [locate, setLocate] = useState(0);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [tutorialEvents, setTutorialEvents] = useState<string[]>([]);
  const [tutorialBaseline, setTutorialBaseline] = useState(0);
  const [tutorialFocus, setTutorialFocus] = useState<RoutePoint[] | undefined>();
  const [startingTutorial, setStartingTutorial] = useState(false);
  const tutorialActive = tutorialStep !== null;
  const tutorialUi = useRef<{ tab: string; mode: typeof mode; panel: typeof panel; base: string; visible: string[]; layers: string[]; poiExpanded: boolean; mobileProfile: boolean } | null>(null);
  const editor = useRouteEditor();
  const { route, busy, error, setError: reportError } = editor;
  const stops = routeStops(route);
  const file = useRef<HTMLInputElement>(null);
  const mapWrap = useRef<HTMLDivElement>(null);
  const analysis = useAnalysis(route);
  const stat = analysis.stats;
  const storage = useProjectStorage(route, editor.replace, setNotice, tutorialActive);
  const [layers, setLayers] = useState<string[]>(["start"]),
    [poiExpanded, setPoiExpanded] = useState(true),
    [mobileProfile, setMobileProfile] = useState(false),
    [enriching, setEnriching] = useState(false);
  const routeRef = useRef(route);
  useLayoutEffect(() => {
    routeRef.current = route;
  }, [route]);
  const enrichController = useRef<AbortController | null>(null);
  useEffect(() => {
    enrichController.current?.abort();
  }, [route]);
  const mainStats = useMemo(
    () =>
      catalog
        ? statistics(catalog.main.segments.map((points) => ({ points })))
        : null,
    [catalog],
  );
  useEffect(() => {
    let cancelled = false;
    fetch("/data/catalog.json")
      .then((r) => {
        if (!r.ok) throw Error("Catalogue indisponible.");
        return r.json();
      })
      .then((c) => {
        if (!cancelled) setCatalog(c as Catalog);
      })
      .catch((e) => reportError(e.message));
    return () => {
      cancelled = true;
    };
  }, [reportError]);
  const markTutorial = (event: string) => {
    if (tutorialActive) setTutorialEvents(events => events.includes(event) ? events : [...events, event]);
  };
  const prepareTutorialStep = (index: number) => {
    if (!catalog || busy) return;
    const step = TUTORIAL_STEPS[index];
    let trial = routeRef.current;
    const tricot = catalog.variants.find(v => v.id === "9678267")!;
    // Chapter navigation prepares only the isolated practice route.
    if (index >= 6 && index <= 12 && trial.mode !== "tmb") trial = composeTmb(catalog, []);
    if ((step.id === "insert" || step.id === "move") && !trial.variantIds.includes(tricot.id)) trial = integrateVariant(trial, tricot);
    if (step.id === "move" && trial.segments.filter(s => s.variantId === tricot.id).length <= (tricot.pieces?.length ?? 1)) {
      const segment = trial.segments.find(s => s.variantId === tricot.id && s.points.length > 2);
      if (segment) trial = splitSegment(trial, segment.id, Math.floor(segment.points.length / 2));
    }
    if (trial !== routeRef.current) editor.replace(trial);
    setTutorialBaseline(trial.waypoints.length);
    setTutorialStep(index);
    setTab(step.surface === "explore" ? "explore" : "route");
    setPanel(step.surface === "route" || step.surface === "explore" ? "expanded" : "collapsed");
    setMode(step.id === "insert" ? "insert" : step.id === "points" || step.id === "poi" ? "add" : "view");
    setPoiExpanded(step.id === "poi");
    setMobileProfile(step.id === "profile");
    setHover(null);
    setSelected(null);
    setNotice("");
    reportError("");
    if (step.id === "poi") setLayers(["start", "refuge"]);
    else setLayers(["start"]);
    if (["preview", "variant", "insert", "move"].includes(step.id)) setTutorialFocus(tricot.points);
    else if (step.id === "poi") setTutorialFocus([{ lat: 45.892, lon: 6.81 }, { lat: 45.855, lon: 6.755 }]);
    else if (index <= 3) setTutorialFocus([{ lat: 45.894, lon: 6.807 }, { lat: 45.880, lon: 6.777 }]);
    else setTutorialFocus(undefined);
    setFit(value => value + 1);
  };
  const startTutorial = async () => {
    if (tutorialActive || startingTutorial || !catalog || busy || enriching || !storage.ready) return;
    setStartingTutorial(true);
    try {
      await storage.flushDraft();
      tutorialUi.current = { tab, mode, panel, base, visible, layers, poiExpanded, mobileProfile };
      editor.beginPractice();
      setTutorialEvents([]);
      setVisible([]);
      setBase("osm");
      prepareTutorialStep(0);
    } catch {
      reportError("Le brouillon ne peut pas être protégé dans ce navigateur. Libérez le stockage local pour lancer le tutoriel.");
    } finally { setStartingTutorial(false); }
  };
  const closeTutorial = () => {
    enrichController.current?.abort();
    editor.endPractice();
    setTutorialStep(null);
    setTutorialFocus(undefined);
    setImported(null);
    setSource(null);
    setOverlap(null);
    setHover(null);
    setSelected(null);
    const ui = tutorialUi.current;
    if (ui) {
      setTab(ui.tab); setMode(ui.mode); setPanel(ui.panel); setBase(ui.base);
      setVisible(ui.visible); setLayers(ui.layers); setPoiExpanded(ui.poiExpanded); setMobileProfile(ui.mobileProfile);
    }
    tutorialUi.current = null;
    setFit(value => value + 1);
    setNotice("Tutoriel terminé. Votre parcours personnel a été restauré.");
    requestAnimationFrame(() => document.getElementById("open-tutorial")?.focus());
  };
  const tutorialId = tutorialStep === null ? null : TUTORIAL_STEPS[tutorialStep].id;
  const tutorialComplete = tutorialId === "free" ? tutorialEvents.includes("free")
    : tutorialId === "points" ? route.waypoints.length >= 2 && route.segments.length > 0
    : tutorialId === "poi" ? tutorialEvents.includes("poi")
    : tutorialId === "classic" ? route.mode === "tmb"
    : tutorialId === "preview" ? visible.includes("9678267")
    : tutorialId === "variant" ? route.variantIds.includes("9678267")
    : tutorialId === "insert" ? route.waypoints.length > tutorialBaseline
    : tutorialId === "move" ? tutorialEvents.includes("move")
    : tutorialId === "stage" ? stops.some(w => w.stageEnd)
    : tutorialId === "profile" ? hover !== null
    : tutorialId === "save" ? tutorialEvents.includes("save") : true;
  const toggleVisible = (id: string) =>
    setVisible((x) =>
      x.includes(id) ? x.filter((i) => i !== id) : [...x, id],
    );
  const addVariant = (v: TmbVariant) => {
    if (!catalog) return;
    const overlaps =
      route.mode === "tmb" ? conflicts(catalog, route.variantIds, v) : [];
    if (overlaps.length && !route.variantIds.includes(v.id)) {
      setOverlap(v);
      return;
    }
    const result = editor.variant(v, catalog);
    setVisible((x) => [...new Set([...x, v.id])]);
    setTab("route");
    return result;
  };
  const importFile = async (f: File) => {
    try {
      if (f.size > 10 * 1024 * 1024) throw Error("Le fichier dépasse 10 Mo.");
      const text = await f.text();
      const result = await new Promise<Route>((resolve, reject) => {
        const worker = new GpxWorker();
        worker.onmessage = (e) => {
          worker.terminate();
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.route);
        };
        worker.onerror = () => {
          worker.terminate();
          try {
            resolve(parseGpx(text, f.name));
          } catch (e) {
            reject(e);
          }
        };
        worker.postMessage({ text, name: f.name });
      });
      setImported(result);
    } catch (e) {
      editor.setError((e as Error).message);
    }
    if (file.current) file.current.value = "";
  };
  const selectWaypoint = (id: string) => {
    const w = route.waypoints.find((p) => p.id === id)!;
    setSelected(selected === id ? null : id);
    setNotice("");
    setPoiExpanded(false);
    setLat(String(w.lat));
    setLon(String(w.lon));
  };
  const startClassic = () => {
    if (!catalog) return;
    editor.classic(catalog);
    setTab("route");
    setFit((x) => x + 1);
    setMode("view");
    setNotice("Le classique est prêt. Choisissez vos variantes dans Explorer.");
  };
  const startFree = () => {
    editor.fresh();
    setTab("route");
    setMode("add");
    markTutorial("free");
    setNotice(
      "Cliquez sur la carte pour placer votre départ, puis vos points de passage.",
    );
  };
  const mapClick = (p: RoutePoint) => {
    if (busy || enriching) return;
    if (mode === "add") editor.add(p);
    if (mode === "insert") editor.insert(p);
  };
  const addPoi = async (poi: PointOfInterest) => {
    const last = routeStops(routeRef.current).at(-1);
    if (busy || enriching || (last && samePoint(last, poi))) return;
    setTab("route");
    setMode("add");
    setNotice("");
    const added = await editor.add(
      { lat: poi.lat, lon: poi.lon, ...(poi.ele === undefined ? {} : { ele: poi.ele }) },
      poi.name,
    );
    if (added) {
      setNotice(`${poi.name} ajouté au parcours.`);
      markTutorial("poi");
    }
  };
  const moveWaypoint = async (id: string, point: RoutePoint) => {
    if (await editor.move(id, point)) markTutorial("move");
  };
  const reorder = (index: number, offset: number) => {
    const points = [...route.waypoints];
    [points[index], points[index + offset]] = [
      points[index + offset],
      points[index],
    ];
    void editor.change(points);
  };
  const enrich = async () => {
    const original = route;
    const controller = new AbortController();
    enrichController.current = controller;
    setEnriching(true);
    try {
      const segments = [];
      for (const segment of original.segments) {
        const missing = segment.points.filter((p) => p.ele === undefined);
        const enriched = new globalThis.Map<RoutePoint, number>();
        for (let i = 0; i < missing.length; i += 1999) {
          const batch = missing.slice(i, i + 1999);
          const result = await routingProvider.elevation(
            batch.length === 1 ? [batch[0], batch[0]] : batch,
            controller.signal,
          );
          batch.forEach((p, j) => {
            if (result[j].ele !== undefined) enriched.set(p, result[j].ele!);
          });
        }
        segments.push(
          missing.length
            ? {
                ...segment,
                id: uid(),
                points: segment.points.map((p) =>
                  p.ele === undefined ? { ...p, ele: enriched.get(p) } : p,
                ),
                source: {
                  ...segment.source,
                  elevation: "Modèle de terrain OpenRouteService",
                },
              }
            : segment,
        );
      }
      if (routeRef.current !== original || controller.signal.aborted) return;
      editor.replace({ ...original, segments });
      setNotice("Altitudes manquantes complétées par le modèle de terrain.");
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        editor.setError((e as Error).message);
    } finally {
      setEnriching(false);
    }
  };
  useWebMCP({
    state: () => ({
      name: route.name,
      mode: route.mode,
      roundTrip: route.roundTrip ?? null,
      waypoints: route.waypoints,
      variantIds: route.variantIds,
      segments: route.segments.map((s) => ({
        id: s.id,
        pointCount: s.points.length,
        source: s.source.label,
      })),
      statistics: analysis.pending ? null : stat,
      analysisPending: analysis.pending,
      error,
      busy,
    }),
    classic: () => {
      if (!catalog) throw Error("Catalogue en cours de chargement.");
      startClassic();
    },
    fresh: startFree,
    add: (lat, lon) => {
      setTab("route");
      setMode("add");
      return editor.add({ lat, lon });
    },
    variant: (id) => {
      const v = catalog?.variants.find((v) => v.id === id);
      if (!v) throw Error("Variante indisponible.");
      return addVariant(v);
    },
    export: () => {
      if (!route.segments.length) throw Error("Le parcours est vide.");
      downloadGpx(route);
    },
  });
  return (
    <main className={`app-shell ${tutorialActive ? "tutorial-active" : ""}`} data-analysis-engine={analysis.engine}>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Mountain size={25} />
          </span>
          <span>
            TMB <strong>Atelier</strong>
            <small>LE TOUR COMMENCE ICI</small>
          </span>
        </Link>
        <div className="top-caption">
          France <span>·</span> Italie <span>·</span> Suisse
        </div>
        <div className="header-actions">
          <Button asChild variant="outline">
            <a href="/aide" target="_blank" rel="noopener noreferrer" aria-label="Aide (nouvel onglet)" title="Guide d’utilisation — nouvel onglet"><CircleHelp /> Aide</a>
          </Button>
          <Button id="open-tutorial" variant="outline" onClick={() => void startTutorial()} disabled={tutorialActive || startingTutorial || !catalog || !storage.ready || busy || enriching} aria-label="Ouvrir le tutoriel" title="Tutoriel interactif">
            <BookOpen /> Tutoriel
          </Button>
          <Button
            variant="outline"
            onClick={() => file.current?.click()}
            title="Importer un GPX"
          >
            <Upload />
            Importer
          </Button>
          <Button
            onClick={() => downloadGpx(route)}
            disabled={!route.segments.length || busy}
            title="Exporter GPX"
            aria-label="Exporter GPX"
            data-tour="gpx"
          >
            <Download />
            Exporter GPX
          </Button>
        </div>
        <input
          ref={file}
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
          }}
        />
      </header>
      <WelcomeDialog ready={!tutorialActive && !startingTutorial && !!catalog && storage.ready && !busy && !enriching} onStartTutorial={startTutorial} />
      <div className="workspace">
        <aside className={`sidebar ${panel}`}>
          <button
            className="mobile-handle"
            aria-label={
              panel === "expanded"
                ? "Réduire le panneau"
                : "Agrandir le panneau"
            }
            onClick={() =>
              { setPanel(panel === "expanded" ? "collapsed" : "expanded"); setPoiExpanded(false); }
            }
          />
          <div className="sidebar-intro">
            <span className="eyebrow">VOTRE PROCHAINE AVENTURE</span>
            <h1>
              Un tour.
              <br />
              Mille façons de le vivre.
            </h1>
            <p>
              Composez votre itinéraire autour du Mont-Blanc, un sentier à la
              fois.
            </p>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="panel-tabs">
              <TabsTrigger value="explore">
                <Layers size={16} />
                Explorer
              </TabsTrigger>
              <TabsTrigger value="route">
                <RouteIcon size={16} />
                Mon parcours
                {route.segments.length > 0 && (
                  <span className="tab-count">{stops.length}</span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="catalog-scroll">
            {tab === "explore" ? (
              <>
                <div className="section-heading">
                  <h2>Le grand classique</h2>
                  <span>01 ITINÉRAIRE</span>
                </div>
                <article className="classic-card">
                  <div className="route-card-top">
                    <span className="route-dot" />
                    <span>FR · IT · CH</span>
                    <Mountain size={20} />
                  </div>
                  <h3>Tour du Mont-Blanc</h3>
                  <p>La boucle de référence, au départ des Houches.</p>
                  <div className="card-stats">
                    <strong>
                      {mainStats ? km(mainStats.distance) : "—"}{" "}
                      <small>km</small>
                    </strong>
                    <span>Sens antihoraire</span>
                  </div>
                  <Button
                    className="w-full"
                    data-tour="classic-start"
                    onClick={startClassic}
                    disabled={!catalog || busy}
                  >
                    Personnaliser ce tour <ArrowUpRight />
                  </Button>
                  <button
                    className="source-label"
                    onClick={() => catalog && setSource(catalog.main.source)}
                  >
                    TMB classique — données OpenStreetMap <Info size={11} />
                  </button>
                </article>
                <div className="section-heading">
                  <h2>Changez de perspective</h2>
                  <span>5 VARIANTES</span>
                </div>
                {catalog?.variants.map((v) => (
                  <article className="variant-card" key={v.id} data-tour={v.id === "9678267" ? "variant" : undefined}>
                    <div className="variant-title">
                      <span
                        className="route-dot"
                        style={{ background: v.color }}
                      />
                      <strong>{v.name}</strong>
                      <button
                        title={`Source ${v.name}`}
                        aria-label={`Source ${v.name}`}
                        onClick={() => setSource(v.source)}
                      >
                        <Info size={14} />
                      </button>
                    </div>
                    <p>{v.description}</p>
                    <div className="variant-meta">
                      <b>
                        {km(v.statistics.distance)} km{" "}
                        <span>· ↗ {meters(v.statistics.ascent)} m</span>
                      </b>
                      <span>{v.difficulty}</span>
                    </div>
                    <div className="variant-delta">
                      {v.delta >= 0 ? "+" : ""}
                      {km(v.delta)} km par rapport au classique remplacé
                    </div>
                    <div className="variant-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleVisible(v.id)}
                        aria-pressed={visible.includes(v.id)}
                      >
                        <Eye size={14} />
                        {visible.includes(v.id) ? "Masquer" : "Voir la trace"}
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          route.variantIds.includes(v.id)
                            ? "secondary"
                            : "outline"
                        }
                        disabled={busy}
                        onClick={() => addVariant(v)}
                      >
                        {route.variantIds.includes(v.id) ? <Check /> : <Plus />}
                        {route.variantIds.includes(v.id)
                          ? "Intégrée"
                          : "Intégrer"}
                      </Button>
                    </div>
                  </article>
                ))}
                <Button
                  variant="outline"
                  className="w-full mt-5"
                  data-tour="free-start"
                  onClick={startFree}
                >
                  <Plus />
                  Créer un parcours libre
                </Button>
              </>
            ) : (
              <>
                <div className="section-heading">
                  <h2>
                    {route.mode === "tmb"
                      ? "Votre Tour du Mont-Blanc"
                      : route.mode === "import"
                        ? "Trace importée"
                        : "Votre parcours libre"}
                  </h2>
                  <span>{route.segments.length} SEGMENTS</span>
                </div>
                <label className="field-label" htmlFor="route-name">
                  Nom du parcours
                </label>
                <input
                  id="route-name"
                  className="route-name"
                  maxLength={120}
                  value={route.name}
                  onChange={(e) =>
                    editor.replace({ ...route, name: e.target.value }, false)
                  }
                />
                <RouteStatisticsPanel key={route.id} route={route} analysis={analysis} />
                <div className="history-tools">
                  <span>{storage.status}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Annuler"
                    disabled={!editor.canUndo || busy}
                    onClick={editor.undo}
                  >
                    <Undo2 />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Rétablir"
                    disabled={!editor.canRedo || busy}
                    onClick={editor.redo}
                  >
                    <Redo2 />
                  </Button>
                </div>
                <div className="edit-tools">
                  <Button
                    variant={mode === "add" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMode(mode === "add" ? "view" : "add")}
                  >
                    <MapPin />
                    Ajouter
                  </Button>
                  <Button
                    variant={mode === "insert" ? "default" : "outline"}
                    size="sm"
                    disabled={!route.segments.length}
                    onClick={() =>
                      setMode(mode === "insert" ? "view" : "insert")
                    }
                  >
                    <Plus />
                    Insérer
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    title="Recentrer le parcours"
                    onClick={() => setFit((x) => x + 1)}
                  >
                    <Focus />
                  </Button>
                </div>
                <p className="edit-hint">
                  {mode === "add"
                    ? "Cliquez sur la carte pour ajouter un point."
                    : "Cliquez sur Insérer puis sur le tracé pour créer un point."}{" "}
                  Déplacez les repères pour ajuster les sentiers.
                </p>
                {mode === "add" && (
                  <details className="coordinate-entry">
                    <summary>Ajouter par coordonnées</summary>
                    <div className="coordinate-editor">
                      <label>
                        Latitude
                        <input
                          aria-label="Latitude à ajouter"
                          type="number"
                          step="0.0001"
                          value={lat}
                          onChange={(e) => setLat(e.target.value)}
                        />
                      </label>
                      <label>
                        Longitude
                        <input
                          aria-label="Longitude à ajouter"
                          type="number"
                          step="0.0001"
                          value={lon}
                          onChange={(e) => setLon(e.target.value)}
                        />
                      </label>
                      <Button
                        size="sm"
                        disabled={
                          busy ||
                          !lat ||
                          !lon ||
                          !Number.isFinite(+lat) ||
                          !Number.isFinite(+lon)
                        }
                        onClick={() => editor.add({ lat: +lat, lon: +lon })}
                      >
                        Ajouter ce point
                      </Button>
                    </div>
                  </details>
                )}
                <ol className="waypoints" data-tour="waypoints">
                  {route.waypoints.map((w, i) => w.id === route.roundTrip?.arrivalId ? (
                    <li key={w.id} className="waypoint-row linked-arrival">
                      <span className="waypoint-number"><RotateCcw size={13} /></span>
                      <div className="waypoint-name">
                        <strong>Arrivée · retour au départ</strong>
                        <small>{w.name} · liée au point 1</small>
                      </div>
                    </li>
                  ) : (
                    <li key={w.id}>
                      <div className="waypoint-row">
                        <span className="waypoint-number">{i + 1}</span>
                        <button
                          className="waypoint-name"
                          aria-pressed={selected === w.id}
                          onClick={() => selectWaypoint(w.id)}
                        >
                          <strong>{w.name}</strong>
                          {i === 0 && <span className="waypoint-role">{route.roundTrip ? "Départ et arrivée" : "Départ"}</span>}
                          <small>
                            {w.lat.toFixed(4)}° N · {w.lon.toFixed(4)}° E
                          </small>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={w.stageEnd ? "stage-active" : ""}
                          aria-label={"Fin d’étape au point " + (i + 1)}
                          title="Fin d’étape"
                          disabled={busy || enriching}
                          onClick={() =>
                            editor.replace({
                              ...route,
                              waypoints: route.waypoints.map((p) =>
                                p.id === w.id
                                  ? { ...p, stageEnd: !p.stageEnd }
                                  : p,
                              ),
                            })
                          }
                        >
                          <Flag size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={"Supprimer le point " + (i + 1)}
                          disabled={busy}
                          onClick={() =>
                            void editor.change(
                              route.waypoints.filter((p) => p.id !== w.id),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      {i === 0 && <div className={`round-trip-option ${route.roundTrip ? "is-active" : ""}`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!route.roundTrip}
                            disabled={busy || enriching}
                            aria-describedby="round-trip-description"
                            onChange={async (event) => {
                              const enabled = event.target.checked;
                              setNotice("");
                              if (await editor.roundTrip(enabled)) setNotice(enabled
                                ? "Le départ est aussi l’arrivée. Les points ajoutés se placent avant le retour."
                                : "Le retour au départ a été retiré. Vous pouvez revenir en arrière avec Annuler.");
                            }}
                          />
                          <span>Départ et arrivée</span>
                          <RotateCcw size={15} aria-hidden="true" />
                        </label>
                        <p id="round-trip-description">{route.roundTrip
                          ? stops.length < 2 && !route.segments.length
                            ? "Ajoutez un point de passage : le retour ici sera calculé sur les sentiers."
                            : "Le tour revient ici. Déplacer ce point déplace aussi l’arrivée. Décocher retire le dernier tronçon de retour."
                          : "Cochez pour terminer le tour à ce premier point, avec un retour par les sentiers."}</p>
                      </div>}
                      {selected === w.id && (
                        <div className="coordinate-editor">
                          <label className="waypoint-name-field">
                            Nom
                            <input
                              aria-label="Nom du point"
                              value={w.name}
                              maxLength={80}
                              onChange={(e) =>
                                editor.replace(
                                  {
                                    ...route,
                                    waypoints: route.waypoints.map((p) =>
                                      p.id === w.id
                                        ? { ...p, name: e.target.value }
                                        : p,
                                    ),
                                  },
                                  false,
                                )
                              }
                            />
                          </label>
                          <div className="waypoint-order">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy || i === 0}
                              aria-label="Monter le point"
                              onClick={() => reorder(i, -1)}
                            >
                              <ArrowUp />
                              Monter
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                busy || i === stops.length - 1
                              }
                              aria-label="Descendre le point"
                              onClick={() => reorder(i, 1)}
                            >
                              <ArrowDown />
                              Descendre
                            </Button>
                          </div>
                          <label>
                            Latitude
                            <input
                              aria-label="Latitude du point"
                              type="number"
                              step="0.00001"
                              value={lat}
                              onChange={(e) => setLat(e.target.value)}
                            />
                          </label>
                          <label>
                            Longitude
                            <input
                              aria-label="Longitude du point"
                              type="number"
                              step="0.00001"
                              value={lon}
                              onChange={(e) => setLon(e.target.value)}
                            />
                          </label>
                          <Button
                            size="sm"
                            disabled={
                              busy ||
                              !lat ||
                              !lon ||
                              !Number.isFinite(+lat) ||
                              !Number.isFinite(+lon)
                            }
                            onClick={() =>
                              moveWaypoint(w.id, { lat: +lat, lon: +lon })
                            }
                          >
                            Déplacer ce point
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                {!route.waypoints.length && (
                  <div className="empty-route">
                    <MapPin size={27} />
                    <h3>Votre premier pas</h3>
                    <p>
                      Placez votre départ sur la carte, ou partez de la boucle
                      classique.
                    </p>
                    <Button
                      variant="outline"
                      onClick={startClassic}
                      disabled={!catalog}
                    >
                      Utiliser le classique
                    </Button>
                  </div>
                )}
                {analysis.days.length > 0 && (
                  <div className="stages">
                    <div className="section-heading">
                      <h2>Vos étapes</h2>
                      <span>{analysis.days.length} JOUR(S)</span>
                    </div>
                    <p>Marquez une arrivée avec le drapeau d’un point.</p>
                    {analysis.days.map((day, i) => (
                      <div className="day-row" key={i}>
                        <span>J{i + 1}</span>
                        <div>
                          <strong>{day.name}</strong>
                          <small>
                            {km(day.stats.distance)} km · ↗{" "}
                            {meters(day.stats.ascent)} m · ↘{" "}
                            {meters(day.stats.descent)} m
                          </small>
                        </div>
                        <b>
                          {day.stats.elevationCoverage === 1
                            ? new Intl.NumberFormat("fr-FR", {
                                maximumFractionDigits: 1,
                              }).format(day.stats.hours) + " h"
                            : "—"}
                        </b>
                      </div>
                    ))}
                    <small>
                      Marche indicative : distance / 4 + D+ / 600, hors pauses.
                      À adapter à vos capacités.
                    </small>
                  </div>
                )}
                {stat.pointCount > 0 && stat.elevationCoverage < 1 && (
                  <Button
                    variant="outline"
                    className="w-full mt-3"
                    disabled={enriching || busy}
                    onClick={() => void enrich()}
                  >
                    {enriching ? (
                      <LoaderCircle className="spin" />
                    ) : (
                      <Mountain />
                    )}
                    Compléter les altitudes
                  </Button>
                )}
                <div className="route-actions">
                  <Button data-tour="save" onClick={() => { void storage.save(); markTutorial("save"); }} disabled={busy}>
                    <Save />
                    Sauvegarder
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void storage.restore()}
                    disabled={busy}
                  >
                    <RotateCcw />
                    Restaurer le dernier parcours
                  </Button>
                  <Button variant="outline" onClick={startFree} disabled={busy}>
                    <Plus />
                    Nouveau parcours
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTab("explore");
                      setMode("view");
                    }}
                  >
                    <Layers />
                    Choisir les variantes
                  </Button>
                </div>
                <div className="source-summary">
                  {[...new Set(route.segments.map((s) => s.source.label))].map(
                    (s) => (
                      <span key={s}>{s}</span>
                    ),
                  )}
                </div>
              </>
            )}
            <div className="safety-note">
              <Mountain size={18} />
              <p>
                En montagne, les conditions changent. Vérifiez météo, neige,
                fermetures et état des sentiers auprès des acteurs locaux. Ce
                parcours ne remplace pas une préparation sur le terrain.
              </p>
            </div>
            <div className="credits">
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                © OpenStreetMap · ODbL
              </a>
              <span>Routage : OpenRouteService</span>
              <button
                onClick={() =>
                  setSource({
                    kind: "osm",
                    label: "Sources, licence et confidentialité",
                    license:
                      "Données © OpenStreetMap contributors, ODbL 1.0. Toute base dérivée doit respecter les obligations de partage à l’identique et d’attribution. Les GPX originaux et leurs empreintes sont disponibles dans le catalogue. Les coordonnées nécessaires au routage et à l’altimétrie sont transmises à OpenRouteService. Vos fichiers GPX et parcours restent dans votre navigateur. Les fonds de carte sont chargés auprès de leurs fournisseurs.",
                    url: "https://www.openstreetmap.org/copyright",
                  })
                }
              >
                Sources et confidentialité
              </button>
            </div>
          </div>
        </aside>
        <section
          className={
            "map-workspace " + (mobileProfile ? "has-mobile-profile" : "")
          }
        >
          <div
            className={`map-wrap ${mode !== "view" ? "drawing" : ""}${stops.some((w) => w.id === selected) ? " has-selected-waypoint" : ""}`}
            data-tour="map"
            ref={mapWrap}
          >
            <MapView
              catalog={catalog}
              visible={visible}
              route={route}
              selectedWaypointId={selected}
              onSelectWaypoint={(id) => { if (id !== selected) selectWaypoint(id); }}
              base={base}
              onPoint={mapClick}
              onAddPoi={addPoi}
              onPoiOpen={() => {
                setPoiExpanded(false);
                setNotice("");
                if (window.matchMedia("(max-width: 700px)").matches) {
                  setPanel("collapsed");
                  setMobileProfile(false);
                }
              }}
              addingPoi={busy || enriching}
              onMove={moveWaypoint}
              hover={hover}
              onHover={setHover}
              fit={fit}
              fitPoints={tutorialFocus}
              editing={!busy && !enriching}
              display={analysis.display}
              layers={layers}
              locate={locate}
              onError={editor.setError}
            />
            <div className="map-caption">
              <span className="live-dot" />
              Massif du Mont-Blanc
              <span className="map-caption-secondary">45°50′ N · 6°52′ E</span>
            </div>
            <div className="map-tools" data-tour="map-tools">
              <label>
                <Map size={16} />
                <select
                  aria-label="Fond de carte"
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                >
                  <option value="osm">Classique</option>
                  <option value="topo">Relief</option>
                </select>
              </label>
              <button
                title="Me localiser"
                aria-label="Me localiser"
                onClick={() => setLocate((x) => x + 1)}
              >
                <LocateFixed size={17} />
              </button>
              <button
                title="Plein écran"
                aria-label="Plein écran"
                onClick={() => {
                  if (document.fullscreenElement)
                    void document.exitFullscreen();
                  else
                    void mapWrap.current
                      ?.requestFullscreen()
                      .catch(() =>
                        editor.setError(
                          "Le plein écran n’est pas disponible dans ce navigateur.",
                        ),
                      );
                }}
              >
                <Maximize size={17} />
              </button>
            </div>
            <div className="map-mode-bar">
              <button
                className={mode === "view" ? "active" : ""}
                onClick={() => setMode("view")}
                aria-label="Explorer la carte"
              >
                <MousePointer2 size={15} />
                Explorer
              </button>
              <button
                className={mode === "add" ? "active" : ""}
                onClick={() => {
                  setMode("add");
                  setTab("route");
                }}
              >
                <MapPin size={15} />
                Tracer
              </button>
              {busy && (
                <span>
                  <LoaderCircle className="spin" size={14} />
                  Calcul sur les sentiers…
                </span>
              )}
            </div>
            {(error || notice) && (
              <div
                className={`map-notice ${error ? "error" : ""}`}
                role={error ? "alert" : "status"}
              >
                <span>{error || notice}</span>
                <button
                  aria-label="Fermer le message"
                  onClick={() => {
                    editor.setError("");
                    setNotice("");
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <div className="map-legend">
              <span className="legend-line" />
              TMB classique
              <span className="legend-line orange" />
              Votre parcours
            </div>
            <PoiLegend
              layers={layers}
              expanded={poiExpanded}
              onToggle={() => {
                setPoiExpanded(!poiExpanded);
                if (!poiExpanded && panel === "expanded") setPanel("collapsed");
              }}
              onChange={(id, checked) => setLayers(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id))}
            />
          </div>
          <button
            className="mobile-profile-toggle"
            onClick={() => {
              setMobileProfile((x) => !x);
              setPanel("collapsed");
            }}
          >
            {mobileProfile ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronUp size={14} />
            )}
            Profil d’altitude
          </button>
          <div
            data-tour="profile"
            className={
              "profile-panel " + (mobileProfile ? "mobile-visible" : "")
            }
          >
            <Profile
              route={route}
              hover={hover}
              onHover={setHover}
              data={analysis.profile}
            />
          </div>
        </section>
      </div>
      {tutorialStep !== null && <Tutorial step={tutorialStep} complete={tutorialComplete} busy={busy || enriching} onChange={prepareTutorialStep} onClose={closeTutorial} />}
      <Dialog
        open={!!imported}
        onOpenChange={(open) => {
          if (!open) setImported(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer une trace GPX</DialogTitle>
            <DialogDescription>
              {imported?.name} · {imported?.segments.length} segment(s)
              conservé(s)
            </DialogDescription>
          </DialogHeader>
          {imported && (
            <>
              <Stats value={statistics(imported.segments)} />
              <p className="dialog-note">
                Les coordonnées, altitudes disponibles et ruptures sont
                conservées. Ce fichier reste sur cet appareil.
              </p>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImported(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (imported) {
                  editor.replace(imported);
                  setImported(null);
                  setTab("route");
                  setFit((x) => x + 1);
                  setMode("view");
                  setNotice(
                    "Trace importée. Chaque segment conserve sa géométrie.",
                  );
                }
              }}
            >
              Utiliser cette trace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!source}
        onOpenChange={(open) => {
          if (!open) setSource(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{source?.label}</DialogTitle>
            <DialogDescription>Données et provenance</DialogDescription>
          </DialogHeader>
          <div className="source-detail">
            {source?.relationId && (
              <p>
                Relation OSM {source.relationId} · version {source.version}
                <br />
                Extraction : {source.extractedAt?.slice(0, 10)}
              </p>
            )}
            <p>{source?.license}</p>
            {source?.elevation && (
              <p>
                Altitudes : {source.elevation}. Ce sont des valeurs de modèle de
                terrain.
              </p>
            )}
            {source?.url && (
              <a href={source.url} target="_blank" rel="noreferrer">
                Consulter la source ↗
              </a>
            )}
            {source?.relationId && (
              <a href={`/data/sources/${source.relationId}.gpx`} download>
                Télécharger le GPX original
              </a>
            )}
            {source?.sha256 && (
              <p className="checksum">SHA-256 : {source.sha256}</p>
            )}
            <p>
              Les cotations SAC proviennent uniquement des portions OSM
              renseignées ; elles ne certifient pas l’ensemble du parcours.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!overlap}
        onOpenChange={(open) => {
          if (!open) setOverlap(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ces variantes se chevauchent</DialogTitle>
            <DialogDescription>
              {overlap?.name} remplace une portion déjà modifiée par{" "}
              {overlap && catalog
                ? conflicts(catalog, route.variantIds, overlap)
                    .map((v) => v.name)
                    .join(", ")
                : ""}
              . Choisissez la variante à conserver.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverlap(null)}>
              Conserver l’actuelle
            </Button>
            <Button
              onClick={() => {
                if (overlap && catalog) {
                  editor.variant(
                    overlap,
                    catalog,
                    conflicts(catalog, route.variantIds, overlap).map(
                      (v) => v.id,
                    ),
                  );
                  setOverlap(null);
                }
              }}
            >
              Conserver {overlap?.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
