import { useEffect, useRef } from 'react';
import { Disclaimer, SafetyNote } from './components/common/Disclaimer';
import { Toasts } from './components/common/Toasts';
import { MapView } from './components/map/MapView';
import { ImportPanel } from './components/panels/ImportPanel';
import { ProjectPanel } from './components/panels/ProjectPanel';
import { RoutePanel } from './components/panels/RoutePanel';
import { VariantsPanel } from './components/panels/VariantsPanel';
import { ProfilePanel } from './components/profile/ProfilePanel';
import { routeStatistics } from './core/route/stats';
import { startAutosave } from './state/persistence';
import { startSegmentResolver } from './state/segmentResolver';
import { useApp, type PanelId, type SheetState } from './state/store';
import { duration, km, meters } from './ui/format';
import { Icon, type IconName } from './ui/Icon';
import { MOBILE_QUERY, useMediaQuery } from './ui/useMediaQuery';

const TABS: { id: PanelId; label: string; icon: IconName }[] = [
  { id: 'route', label: 'Itinéraire', icon: 'route' },
  { id: 'variants', label: 'Variantes', icon: 'mountain' },
  { id: 'import', label: 'Import', icon: 'upload' },
  { id: 'project', label: 'Projet', icon: 'folder' },
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
        </button>
      ))}
    </nav>
  );
}

function PanelBody({ mobile }: { mobile: boolean }) {
  const panel = useApp((s) => s.panel);
  return (
    <div className="panel-scroll">
      {mobile && panel === 'route' && <ProfilePanel embedded />}
      {panel === 'route' && <RoutePanel />}
      {panel === 'variants' && <VariantsPanel />}
      {panel === 'import' && <ImportPanel />}
      {panel === 'project' && <ProjectPanel />}
      <SafetyNote />
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
  useEffect(startOnce, []);
  useKeyboardShortcuts();
  return (
    <div className={`app ${mobile ? 'is-mobile' : 'is-desktop'}`}>
      <Disclaimer />
      <aside className={`sidebar sheet-${sheet}`} aria-label="Itinéraire, variantes et projet">
        {mobile && <SheetHandle />}
        <header className="brand">
          <div className="brand-title">
            <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden>
              <path d="M6 50 L24 20 L32 32 L40 16 L58 50 Z" fill="currentColor" />
            </svg>
            <h1>TMB Trip Planner</h1>
          </div>
          <RouteSummary />
        </header>
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
