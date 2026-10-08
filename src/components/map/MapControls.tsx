import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import { BASEMAPS, OVERLAYS } from '../../services/map/basemaps';
import { MAIN_ID, useApp } from '../../state/store';
import { Icon } from '../../ui/Icon';

/** Empêche les clics sur les boutons de traverser jusqu'à la carte. */
function useIsolated<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);
  return ref;
}

function LayersMenu({ onClose }: { onClose: () => void }) {
  const basemap = useApp((s) => s.basemap);
  const overlays = useApp((s) => s.overlays);
  const showPois = useApp((s) => s.showPois);
  const tmbVisible = useApp((s) => !!s.visible[MAIN_ID]);
  const hasMain = useApp((s) => !!s.catalog?.main);
  const s = useApp.getState();
  return (
    <div className="layers-menu" role="dialog" aria-label="Fonds de carte et calques">
      <div className="row space-between">
        <strong>Fond de carte</strong>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
          <Icon name="close" />
        </button>
      </div>
      {BASEMAPS.map((b) => (
        <label key={b.id} className="check">
          <input type="radio" name="basemap" checked={basemap === b.id} onChange={() => s.setBasemap(b.id)} />
          {b.label}
          {b.coverage && <span className="muted small"> · {b.coverage}</span>}
        </label>
      ))}
      <strong>Calques</strong>
      {OVERLAYS.map((o) => (
        <label key={o.id} className="check">
          <input type="checkbox" checked={!!overlays[o.id]} onChange={() => s.toggleOverlay(o.id)} />
          {o.label}
        </label>
      ))}
      <label className="check">
        <input type="checkbox" checked={showPois} onChange={() => s.togglePois()} />
        Refuges, cols, sommets, villages
      </label>
      {hasMain && (
        <label className="check">
          <input type="checkbox" checked={tmbVisible} onChange={() => s.toggleVisible(MAIN_ID)} data-testid="toggle-tmb" />
          Tracé officiel du TMB
        </label>
      )}
    </div>
  );
}

export function MapControls() {
  const map = useMap();
  const mode = useApp((s) => s.mode);
  const canUndo = useApp((s) => s.history.past.length > 0);
  const canRedo = useApp((s) => s.history.future.length > 0);
  const [menu, setMenu] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const topLeft = useIsolated<HTMLDivElement>();
  const topRight = useIsolated<HTMLDivElement>();
  const locLayer = useRef<L.LayerGroup | null>(null);
  const fsSupported = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const found = (e: L.LocationEvent) => {
      locLayer.current?.remove();
      locLayer.current = L.layerGroup([
        L.circle(e.latlng, { radius: e.accuracy, color: '#2563eb', weight: 1, fillOpacity: 0.1, interactive: false }),
        L.circleMarker(e.latlng, { radius: 7, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, interactive: false }),
      ]).addTo(map);
    };
    const error = () => useApp.getState().toast('error', 'Position indisponible (autorisation refusée ou signal absent).');
    map.on('locationfound', found);
    map.on('locationerror', error);
    return () => {
      map.off('locationfound', found);
      map.off('locationerror', error);
    };
  }, [map]);

  const s = useApp.getState();
  return (
    <>
      <div className="map-controls top-left" ref={topLeft}>
        <button
          type="button"
          className={`btn btn-map ${mode === 'edit' ? 'btn-active' : 'btn-primary'}`}
          onClick={() => s.setMode(mode === 'edit' ? 'view' : 'edit')}
          data-testid="toggle-edit"
        >
          <Icon name={mode === 'edit' ? 'check' : 'pencil'} />
          {mode === 'edit' ? 'Terminer' : 'Créer mon itinéraire'}
        </button>
        {mode === 'edit' && (
          <div className="btn-group">
            <button type="button" className="btn btn-map icon-only" onClick={() => s.undo()} disabled={!canUndo} title="Annuler (Ctrl+Z)" aria-label="Annuler">
              <Icon name="undo" />
            </button>
            <button type="button" className="btn btn-map icon-only" onClick={() => s.redo()} disabled={!canRedo} title="Rétablir (Ctrl+Y)" aria-label="Rétablir">
              <Icon name="redo" />
            </button>
          </div>
        )}
      </div>
      <div className="map-controls top-right" ref={topRight}>
        <button type="button" className="btn btn-map icon-only" onClick={() => setMenu((m) => !m)} aria-label="Fonds de carte et calques" title="Fonds de carte et calques" data-testid="layers-button">
          <Icon name="layers" />
        </button>
        {fsSupported && (
          <button
            type="button"
            className="btn btn-map icon-only"
            aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.getElementById('root')?.requestFullscreen())}
          >
            <Icon name="fullscreen" />
          </button>
        )}
        <button type="button" className="btn btn-map icon-only" aria-label="Me localiser" title="Me localiser" onClick={() => map.locate({ setView: true, maxZoom: 15 })}>
          <Icon name="locate" />
        </button>
        {menu && <LayersMenu onClose={() => setMenu(false)} />}
      </div>
      {mode === 'edit' && (
        <div className="edit-hint" role="status">
          <span className="hint-long">Touchez la carte pour ajouter un point · glissez un point pour le déplacer · touchez le tracé pour insérer un point</span>
          <span className="hint-short">Touchez la carte pour ajouter un point</span>
        </div>
      )}
    </>
  );
}
