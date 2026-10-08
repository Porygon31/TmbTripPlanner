import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { createPoiProvider, POI_LABELS, type Poi, type PoiKind } from '../../services/pois/pois';
import { useApp } from '../../state/store';

const provider = createPoiProvider(import.meta.env.BASE_URL);
let cache: Promise<Poi[]> | null = null;

const STYLE: Record<PoiKind, { color: string; radius: number; minZoom: number }> = {
  hut: { color: '#b45309', radius: 6, minZoom: 11 },
  pass: { color: '#0f766e', radius: 5, minZoom: 12 },
  peak: { color: '#57534e', radius: 4, minZoom: 12 },
  village: { color: '#334155', radius: 5, minZoom: 10 },
  hamlet: { color: '#64748b', radius: 3, minZoom: 14 },
};

/** Charge les POI une seule fois par session. */
function loadPois(): Promise<Poi[]> {
  cache ??= provider.load().catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}

export function PoiLayer() {
  const show = useApp((s) => s.showPois);
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());
  const [pois, setPois] = useState<Poi[]>([]);
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => setBounds(map.getBounds()),
  });
  useEffect(() => {
    if (!show) return;
    let alive = true;
    loadPois()
      .then((p) => alive && setPois(p))
      .catch(() => alive && useApp.getState().toast('info', 'Points d’intérêt indisponibles (service Overpass injoignable).'));
    return () => {
      alive = false;
    };
  }, [show]);
  const visible = useMemo(() => {
    if (!show) return [];
    const padded = bounds.pad(0.2);
    return pois.filter((p) => {
      const st = STYLE[p.kind];
      if (zoom < st.minZoom) {
        // Les plus hauts sommets restent visibles à petite échelle.
        if (!(p.kind === 'peak' && (p.ele ?? 0) >= 3800 && zoom >= 10)) return false;
      }
      return padded.contains([p.lat, p.lon]);
    });
  }, [pois, zoom, bounds, show]);
  return (
    <>
      {visible.map((p) => {
        const st = STYLE[p.kind];
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={st.radius}
            pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: st.color, fillOpacity: 0.95 }}
            bubblingMouseEvents
          >
            <Tooltip direction="top" offset={[0, -4]}>
              {POI_LABELS[p.kind]} · {p.name}
              {p.ele !== null ? ` (${Math.round(p.ele)} m)` : ''}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
