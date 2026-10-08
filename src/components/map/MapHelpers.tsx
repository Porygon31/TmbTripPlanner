import L from 'leaflet';
import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { hoverBus } from '../../state/hoverBus';
import { effectiveTarget, targetGeometry } from '../../state/selectors';
import { useApp } from '../../state/store';

/** Clic sur la carte : en mode création, ajoute un point en fin d'itinéraire. */
export function MapClickHandler() {
  useMapEvents({
    click(e) {
      const s = useApp.getState();
      if (s.mode === 'edit') s.addPoint({ lat: e.latlng.lat, lon: e.latlng.lng });
      else if (s.selectedTrack) s.selectTrack(null);
    },
  });
  return null;
}

/** Recentre la carte sur demande (zoom sur une variante, un import…). */
export function FitBoundsHandler() {
  const map = useMap();
  const req = useApp((s) => s.fitRequest);
  useEffect(() => {
    if (req) map.fitBounds(req.bounds, { padding: [40, 40], maxZoom: 15 });
  }, [req, map]);
  return null;
}

/** Point mis en évidence sur la carte quand on survole le profil (et inversement). */
export function HoverMarker() {
  const map = useMap();
  useEffect(() => {
    const marker = L.circleMarker([0, 0], {
      radius: 7,
      color: '#ffffff',
      weight: 3,
      fillColor: '#111827',
      fillOpacity: 1,
      interactive: false,
      pane: 'markerPane',
    });
    let shown = false;
    const unsub = hoverBus.subscribe((e) => {
      const s = useApp.getState();
      if (e.target !== effectiveTarget(s) || e.index === null) {
        if (shown) marker.remove();
        shown = false;
        return;
      }
      const g = targetGeometry(s, e.target);
      const p = g?.points[e.index];
      if (!p) return;
      marker.setLatLng([p.lat, p.lon]);
      if (!shown) marker.addTo(map);
      shown = true;
    });
    return () => {
      unsub();
      marker.remove();
    };
  }, [map]);
  return null;
}

/** Recalcule la taille de la carte quand son conteneur change (panneau replié, profil…). */
export function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const obs = new ResizeObserver(() => map.invalidateSize({ debounceMoveend: true }));
    obs.observe(el);
    return () => obs.disconnect();
  }, [map]);
  return null;
}

/** Expose la carte et l'état pour le débogage et les tests automatisés (`window.__tmb`). */
export function DebugHandle() {
  const map = useMap();
  useEffect(() => {
    (window as unknown as { __tmb: unknown }).__tmb = { map, store: useApp };
  }, [map]);
  return null;
}
