import { useEffect, useRef } from 'react';
import { SafetyNote } from './components/common/Disclaimer';
import { Guide } from './components/common/Guide';
import { Toasts } from './components/common/Toasts';
import { MapView } from './components/map/MapView';
import { ImportPanel } from './components/panels/ImportPanel';
import { ProjectPanel } from './components/panels/ProjectPanel';
import { RoutePanel } from './components/panels/RoutePanel';
import { VariantsPanel } from './components/panels/VariantsPanel';
import { ProfilePanel } from './components/profile/ProfilePanel';
import { routeStatistics } from './core/route/stats';
import { buildRouteGeometry } from './core/route/geometry';
import { startAutosave } from './state/persistence';
import { startSegmentResolver } from './state/segmentResolver';
import { useApp, type PanelId, type SheetState } from './state/store';
import { duration, km, meters } from './ui/format';
import { Icon, type IconName } from './ui/Icon';
import { MOBILE_QUERY, useMediaQuery } from './ui/useMediaQuery';

const TABS: { id: PanelId; label: string; icon: IconName }[] = [
  { id: 'variants', label: 'Explorer', icon: 'layers' },
  { id: 'route', label: 'Mon parcours', icon: 'route' },
];

let started = false;
function startOnce() {
  if (started) return;
  started = true;
  const s = useApp.getState();
  startSegmentResolver();
  startAutosave();
  void s.restoreSession();
  void s.loadCatalog();
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      const mod = e.ctrlKey || e.metaKey;
      const s = useApp.getState();
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        s.redo();
      } else if (e.key === 'Escape' && s.mode === 'edit') {
        s.setMode('view');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function RouteSummary() {
  const route = useApp((s) => s.history.present);
  if (route.waypoints.length < 2) return <span className="muted small">Aucun itinéraire</span>;
  const st = routeStatistics(route);
  return (
    <span className="summary small" data-testid="route-summary">
      {km(st.distance)} · D+ {meters(st.ascent)} · {duration(st.durationHours)}
    </span>
  );
}

function Tabs() {
  const panel = useApp((s) => s.panel);
  const count = useApp((s) => s.history.present.waypoints.length);
  return (
    <nav className="tabs" role="tablist" aria-label="Panneaux">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={panel === t.id}
          className={`tab ${panel === t.id ? 'active' : ''}`}
          onClick={() => useApp.getState().setPanel(t.id)}
          data-testid={`tab-${t.id}`}
        >
          <Icon name={t.icon} />
          <span>{t.label}</span>
          {t.id === 'route' && count > 0 && <small className="tab-count">{count}</small>}
        </button>
      ))}
    </nav>
  );
}

function PanelBody({ mobile }: { mobile: boolean }) {
  const panel = useApp((s) => s.panel);
  return (
    <div className="panel-scroll" key={panel}>
      {(panel === 'import' || panel === 'project') && <button className="btn btn-text panel-back" onClick={() => useApp.getState().setPanel('route')}>← Mon parcours</button>}
      {mobile && panel === 'route' && <ProfilePanel embedded />}
      {panel === 'route' && <RoutePanel />}
      {panel === 'variants' && <VariantsPanel />}
      {panel === 'import' && <ImportPanel />}
      {panel === 'project' && <ProjectPanel />}
      <SafetyNote />
      <footer className="sidebar-footer"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap · ODbL</a><span>Routage : BRouter · Altitudes : sources GPX / modèle de terrain</span><button className="btn btn-text" data-testid="tab-project" onClick={() => useApp.getState().setPanel('project')}><Icon name="folder" size={14} /> Sauvegardes et réglages</button></footer>
    </div>
  );
}

const NEXT_SHEET: Record<SheetState, SheetState> = { peek: 'half', half: 'full', full: 'peek' };

function SheetHandle() {
  const sheet = useApp((s) => s.sheet);
  const startY = useRef<number | null>(null);
  const s = useApp.getState();
  return (
    <button
      type="button"
      className="sheet-handle"
      aria-label={sheet === 'peek' ? 'Ouvrir le panneau' : sheet === 'full' ? 'Réduire le panneau' : 'Agrandir le panneau'}
      onClick={() => s.setSheet(NEXT_SHEET[sheet])}
      onPointerDown={(e) => {
        startY.current = e.clientY;
      }}
      onPointerUp={(e) => {
        if (startY.current === null) return;
        const dy = e.clientY - startY.current;
        startY.current = null;
        if (Math.abs(dy) < 25) return;
        e.preventDefault();
        if (dy < 0) s.setSheet(sheet === 'peek' ? 'half' : 'full');
        else s.setSheet(sheet === 'full' ? 'half' : 'peek');
      }}
      data-testid="sheet-handle"
    >
      <span />
    </button>
  );
}

export default function App() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const sheet = useApp((s) => s.sheet);
  const route = useApp((s) => s.history.present);
  const tutorial = useApp((s) => s.tutorialActive);
  useEffect(startOnce, []);
  useKeyboardShortcuts();
  return (
    <div className={`app ${mobile ? 'is-mobile' : 'is-desktop'} ${tutorial ? 'tutorial-active' : ''}`}>
      <header className="topbar">
        <a className="atelier-brand" href="#" onClick={(e) => { e.preventDefault(); useApp.getState().setPanel('variants'); }} aria-label="TMB Atelier, explorer le catalogue"><span className="brand-icon"><Icon name="mountain" size={30} /></span><span>TMB <strong>Atelier</strong><small>LE TOUR COMMENCE ICI</small></span></a>
        <div className="top-caption">France <span>·</span> Italie <span>·</span> Suisse</div>
        <div className="header-actions">
          <Guide />
          <button className="btn" data-testid="tab-import" onClick={() => useApp.getState().setPanel('import')} aria-label="Importer un GPX"><Icon name="upload" size={16} /><span>Importer</span></button>
          <button className="btn btn-primary" data-tour="export" data-testid="header-export" onClick={() => useApp.getState().exportGpx(false)} disabled={route.waypoints.length < 2 || !buildRouteGeometry(route).complete} aria-label="Exporter GPX"><Icon name="download" size={16} /><span>Exporter GPX</span></button>
        </div>
      </header>
      <aside className={`sidebar sheet-${sheet}`} aria-label="Itinéraire, variantes et projet">
        {mobile && <SheetHandle />}
        <div className="sidebar-intro"><span className="eyebrow">VOTRE PROCHAINE AVENTURE</span><h1>Un tour.<br />Mille façons de le vivre.</h1><p>Composez votre itinéraire autour du Mont-Blanc, un sentier à la fois.</p></div>
        {mobile && <div className="mobile-summary"><RouteSummary /></div>}
        <Tabs />
        <PanelBody mobile={mobile} />
      </aside>
      <main className="main">
        <div className="map-wrap">
          <MapView />
        </div>
        {!mobile && <ProfilePanel />}
      </main>
      <Toasts />
    </div>
  );
}
