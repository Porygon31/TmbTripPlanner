import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { createPoiProvider, POI_LABELS, type Poi, type PoiKind } from '../../services/pois/pois';
import { readPref, writePref } from '../../services/storage/projectStore';
import { useApp } from '../../state/store';
import { Icon, type IconName } from '../../ui/Icon';

const provider = createPoiProvider(import.meta.env.BASE_URL);
let cache: Promise<Poi[]> | null = null;
const CATEGORIES: { kind: PoiKind; label: string; color: string; icon: IconName }[] = [
  { kind: 'hut', label: 'Refuges', color: '#a34d21', icon: 'hut' },
  { kind: 'hotel', label: 'Hôtels', color: '#ac800c', icon: 'hotel' },
  { kind: 'pass', label: 'Cols', color: '#00817d', icon: 'pass' },
  { kind: 'peak', label: 'Sommets', color: '#7850ac', icon: 'mountain' },
  { kind: 'village', label: 'Villages', color: '#256abd', icon: 'village' },
  { kind: 'viewpoint', label: 'Points de vue', color: '#b22970', icon: 'binoculars' },
];
const DEFAULT_LAYERS = { start: true, hut: false, hotel: false, pass: false, peak: false, village: false, viewpoint: false, hamlet: false };

function symbol(icon: IconName, color: string) {
  return <span className="poi-symbol" style={{ background: color }}><Icon name={icon} size={15} /></span>;
}
const icons = new Map<string, L.DivIcon>();
function markerIcon(icon: IconName, color: string, size = 26) {
  const key = icon + '-' + size;
  if (!icons.has(key)) icons.set(key, L.divIcon({ className: 'poi-map-icon' + (icon === 'flag' ? ' poi-start-icon' : ''), html: renderToStaticMarkup(symbol(icon, color)), iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] }));
  return icons.get(key)!;
}
function websiteFor(p: Poi) {
  if (!['hut', 'hotel'].includes(p.kind) || !p.website) return null;
  try { const url = new URL(p.website); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function PoiPopup({ poi }: { poi: Poi }) {
  const route = useApp((s) => s.history.present);
  const added = route.waypoints.some((w) => Math.abs(w.lat - poi.lat) < .00001 && Math.abs(w.lon - poi.lon) < .00001);
  const website = websiteFor(poi);
  const map = useMap();
  return <Popup className="poi-popup" maxWidth={280} autoPanPaddingTopLeft={[20, 110]} autoPanPaddingBottomRight={[20, 150]}>
    <strong>{poi.name}</strong><p>{POI_LABELS[poi.kind]}{poi.ele !== null ? ' · ' + Math.round(poi.ele) + ' m' : ''}</p>
    {website && <a className="poi-website" href={website} target="_blank" rel="noopener noreferrer"><Icon name="link" size={14} /> Site de l’hébergement ↗</a>}
    <a href={poi.url ?? 'https://www.openstreetmap.org/' + poi.id} target="_blank" rel="noopener noreferrer">Source OpenStreetMap</a>
    <button className="btn btn-primary full-width poi-add" disabled={added} onClick={() => { const s = useApp.getState(); s.addPoint(poi); s.renamePoint(useApp.getState().history.present.waypoints.length - 1, poi.name); s.setPanel('route'); map.closePopup(); }}><Icon name={added ? 'check' : 'plus'} size={16} />{added ? 'Ajouté au parcours' : 'Ajouter au parcours'}</button>
  </Popup>;
}

export function PoiLayer() {
  const show = useApp((s) => s.showPois);
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());
  const [pois, setPois] = useState<Poi[]>([]);
  const [layers, setLayers] = useState(() => readPref('poi-layers', DEFAULT_LAYERS));
  const [expanded, setExpanded] = useState(() => !matchMedia('(max-width: 767px)').matches);
  const ref = useRef<HTMLElement>(null);
  useMapEvents({ zoomend: () => setZoom(map.getZoom()), moveend: () => setBounds(map.getBounds()) });
  useEffect(() => {
    if (ref.current) { L.DomEvent.disableClickPropagation(ref.current); L.DomEvent.disableScrollPropagation(ref.current); }
    let alive = true;
    cache ??= provider.load().catch((e) => { cache = null; throw e; });
    void cache.then((p) => { if (alive) setPois(p); }).catch(() => { if (alive) useApp.getState().toast('info', 'Points d’intérêt indisponibles.'); });
    return () => { alive = false; };
  }, []);
  const toggle = (kind: keyof typeof DEFAULT_LAYERS) => {
    const next = { ...layers, [kind]: show ? !layers[kind] : true };
    setLayers(next); writePref('poi-layers', next);
    if (!show) useApp.getState().togglePois();
  };
  const start = pois.find((p) => p.name === 'Les Houches');
  const visible = useMemo(() => show ? pois.filter((p) => p.name !== 'Les Houches' && layers[p.kind === 'hamlet' ? 'village' : p.kind] && bounds.pad(.1).contains([p.lat, p.lon])) : [], [pois, bounds, show, layers]);
  // Le repère reste lisible sans occuper tout le massif aux faibles zooms.
  const startSize = zoom <= 9 ? 26 : zoom <= 11 ? 32 : 42;
  const labelRight = start ? map.latLngToContainerPoint([start.lat, start.lon]).x < 180 : false;
  return <>
    {show && layers.start && start && <Marker position={[start.lat, start.lon]} icon={markerIcon('flag', '#b45125', startSize)} title="Les Houches — départ du TMB" zIndexOffset={500} bubblingMouseEvents={false}>
      {zoom >= 9 && <Tooltip key={String(labelRight)} permanent direction={labelRight ? 'right' : 'left'} offset={[(labelRight ? 1 : -1) * (startSize / 2 + 5), 0]} className={'tmb-start-label' + (zoom < 11 ? ' compact' : '')}><strong>Les Houches</strong>{zoom >= 10 && <span>Départ du TMB classique</span>}</Tooltip>}
      <PoiPopup poi={start} />
    </Marker>}
    {visible.map((p) => { const c = CATEGORIES.find((x) => x.kind === (p.kind === 'hamlet' ? 'village' : p.kind)); return c ? <Marker key={p.id} position={[p.lat, p.lon]} icon={markerIcon(c.icon, c.color)} title={p.name} bubblingMouseEvents={false}><PoiPopup poi={p} /></Marker> : null; })}
    <section className="poi-legend" ref={ref} aria-label="Légende des points d’intérêt"><button className="poi-legend-heading" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="poi-legend-layers"><Icon name="layers" size={16} /><span>Points d’intérêt</span><Icon name={expanded ? 'down' : 'up'} size={14} /></button>
      <div id="poi-legend-layers" hidden={!expanded}><div className="poi-legend-items">
        <label className="poi-legend-item poi-legend-start">{symbol('flag', '#b45125')}<span>Les Houches<small>Départ du TMB</small></span><input type="checkbox" checked={show && layers.start} onChange={() => toggle('start')} aria-label="Les Houches" /></label>
        {CATEGORIES.map((c) => <label className="poi-legend-item" key={c.kind}>{symbol(c.icon, c.color)}<span>{c.label}</span><input type="checkbox" checked={show && layers[c.kind]} onChange={() => toggle(c.kind)} aria-label={c.label} /></label>)}
      </div><p>Extrait OSM non exhaustif</p></div>
    </section>
  </>;
}
