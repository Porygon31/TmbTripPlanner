"use client";
import {
  MapContainer,
  TileLayer,
  Polyline,
  useMapEvents,
  useMap,
  Marker,
  Popup,
  Tooltip,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { POI_CATEGORIES, PoiSymbol, TMB_START_POI_ID } from "./poi-categories";
import { Plus, Check, LoaderCircle, ExternalLink } from "lucide-react";
import { samePoint } from "@/lib/tmb/geo";
import { routeStops } from "@/lib/tmb/loop";
import { lodgingWebsite } from "@/lib/tmb/poi-websites.js";
import { useEffect, useMemo, useState, useRef, type ComponentProps, type CSSProperties } from "react";
import type { Catalog, MapProvider, Route, RoutePoint, PointOfInterest } from "@/lib/tmb/types";
export const providers: MapProvider[] = [
  {
    id: "topo",
    label: "Relief · OpenTopoMap",
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    maxZoom: 17,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · SRTM | <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  },
  {
    id: "osm",
    label: "Classique · OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
];
const coords = (points: RoutePoint[]) =>
  points.map((p) => [p.lat, p.lon] as [number, number]);
const poiIcons = Object.fromEntries(POI_CATEGORIES.filter(category => category.id !== "start").map(category => [category.id, L.divIcon({
  className: `poi-map-icon poi-map-icon-${category.id}`,
  html: renderToStaticMarkup(<PoiSymbol category={category} />),
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -15],
})]));
function PoiPopup({ children }: Pick<ComponentProps<typeof Popup>, "children">) {
  const map = useMap();
  const [compact, setCompact] = useState(() => map.getSize().x <= 700);
  const events = useMemo(() => ({ resize: () => setCompact(map.getSize().x <= 700) }), [map]);
  useMapEvents(events);
  return <Popup className="poi-popup" minWidth={230} maxWidth={280}
    autoPanPaddingTopLeft={[16, 112]} autoPanPaddingBottomRight={[16, compact ? 215 : 90]}>
    {children}
  </Popup>;
}
function HouchesMarker({ name, children, ...props }: Omit<ComponentProps<typeof Marker>, "icon"> & { name: string }) {
  const map = useMap();
  const [compact, setCompact] = useState(() => map.getSize().x <= 700);
  const [zoom, setZoom] = useState(() => map.getZoom());
  // Keep listeners attached while the route's effect fits the map to its bounds.
  const mapEvents = useMemo(() => ({
    resize: () => setCompact(map.getSize().x <= 700),
    zoomend: () => setZoom(map.getZoom()),
  }), [map]);
  useMapEvents(mapEvents);
  // Full size nearby (zoom 12+), half size on distant views (zoom 8 and below).
  const scale = 0.5 + Math.max(0, Math.min(4, zoom - 8)) / 8;
  const sizeStyle = { "--tmb-start-scale": scale } as CSSProperties;
  const icon = useMemo(() => L.divIcon({
    className: "poi-map-icon poi-map-icon-start",
    html: renderToStaticMarkup(<div style={{ "--tmb-start-scale": scale } as CSSProperties}>
      <PoiSymbol category={POI_CATEGORIES[0]} />
    </div>),
    iconSize: [46 * scale, 58 * scale],
    iconAnchor: [23 * scale, 58 * scale],
    popupAnchor: [0, -55 * scale],
  }), [scale]);
  return (
    <Marker {...props} icon={icon}>
      <Tooltip key={`${compact}-${scale}`} direction={compact ? "bottom" : "left"}
        offset={compact ? [0, 16 * scale] : [-30 * scale, -20 * scale]} permanent opacity={1} className="tmb-start-label">
        <div className="tmb-start-content" style={sizeStyle}>
          <strong>{name}</strong><span>Départ du TMB classique</span>
        </div>
      </Tooltip>
      {children}
    </Marker>
  );
}
function Events({
  onPoint,
  fit,
  route,
  fitPoints,
}: {
  onPoint: (p: RoutePoint) => void;
  fit: number;
  route: Route | null;
  fitPoints?: RoutePoint[];
}) {
  const lastFit = useRef(0);
  const map = useMapEvents({
    click: (e) => onPoint({ lat: e.latlng.lat, lon: e.latlng.lng }),
  });
  useEffect(() => {
    if (!fit || fit === lastFit.current) return;
    lastFit.current = fit;
    map.invalidateSize({ pan: false });
    const p = fitPoints ? coords(fitPoints) : route?.segments.flatMap((s) => coords(s.points));
    if (p?.length) {
      const mobile = map.getContainer().clientWidth <= 700;
      map.fitBounds(L.latLngBounds(p), mobile
        ? { paddingTopLeft: [35, 105], paddingBottomRight: [35, 145], maxZoom: 14, animate: false }
        : { padding: [45, 45], maxZoom: 14, animate: false });
    }
  }, [fit, fitPoints, map, route]);
  useEffect(() => {
    const r = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    r.observe(map.getContainer());
    return () => r.disconnect();
  }, [map]);
  return null;
}
function Location({
  tick,
  onError,
}: {
  tick: number;
  onError: (message: string) => void;
}) {
  const map = useMapEvents({
    locationerror: (e) => onError(e.message),
    locationfound: (e) => {
      map.flyTo(e.latlng, 14);
      L.circleMarker(e.latlng, { radius: 7, color: "#397fb5" })
        .addTo(map)
        .bindPopup("Votre position")
        .openPopup();
    },
  });
  useEffect(() => {
    if (tick)
      map.locate({ setView: false, maxZoom: 14, enableHighAccuracy: true });
  }, [tick, map]);
  return null;
}
export default function MapView({
  catalog,
  visible,
  route,
  selectedWaypointId,
  onSelectWaypoint = () => {},
  base = "osm",
  onPoint = () => {},
  onAddPoi,
  onPoiOpen,
  addingPoi = false,
  onMove = () => {},
  hover,
  onHover = () => {},
  fit = 0,
  fitPoints,
  editing = false,
  locate = 0,
  onError = () => {},
  display = {},
  layers = [],
}: {
  catalog: Catalog | null;
  visible: string[];
  route: Route | null;
  selectedWaypointId?: string | null;
  onSelectWaypoint?: (id: string) => void;
  base?: string;
  onPoint?: (p: RoutePoint) => void;
  onAddPoi?: (poi: PointOfInterest) => void | Promise<void>;
  onPoiOpen?: () => void;
  addingPoi?: boolean;
  onMove?: (id: string, p: RoutePoint) => void;
  hover?: RoutePoint | null;
  onHover?: (p: RoutePoint) => void;
  fit?: number;
  fitPoints?: RoutePoint[];
  editing?: boolean;
  locate?: number;
  onError?: (message: string) => void;
  display?: Record<string, RoutePoint[]>;
  layers?: string[];
}) {
  const provider = providers.find((p) => p.id === base) ?? providers.find(p => p.id === "osm")!;
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const stops = route ? routeStops(route) : [];
  const selectedStop = stops.find((w) => w.id === selectedWaypointId);
  const selectedMarker = useRef<L.Marker | null>(null);
  useEffect(() => {
    const marker = selectedMarker.current;
    const popup = marker?.getPopup();
    const mapElement = marker?.getElement()?.closest(".map");
    const sidebar = mapElement?.closest(".workspace")?.querySelector(".sidebar");
    if (!marker || !popup || !mapElement) return;
    // Leave room for the mobile editor and the enlarged marker below its popup.
    const keepVisible = () => {
      const mapBounds = mapElement.getBoundingClientRect();
      const panelBounds = sidebar?.getBoundingClientRect();
      const coveredHeight = panelBounds && panelBounds.left < mapBounds.right && panelBounds.right > mapBounds.left
        ? Math.max(0, mapBounds.bottom - panelBounds.top) : 0;
      popup.options.autoPanPaddingTopLeft = L.point(60, 112);
      popup.options.autoPanPaddingBottomRight = L.point(24, coveredHeight + 80);
      if (marker.isPopupOpen()) popup.update();
    };
    keepVisible();
    marker.openPopup();
    const observer = new ResizeObserver(keepVisible);
    observer.observe(mapElement);
    if (sidebar) observer.observe(sidebar);
    return () => { observer.disconnect(); marker.closePopup(); };
  }, [selectedStop?.id, selectedStop?.lat, selectedStop?.lon]);
  const lastWaypoint = stops.at(-1);
  useEffect(() => {
    fetch("/data/pois.json")
      .then((r) => r.json())
      .then((data) => setPois((data as { points: PointOfInterest[] }).points))
      .catch(() => {});
  }, []);
  const lines = useMemo(
    () =>
      route?.segments.map((s) => ({
        id: s.id,
        coords: coords(display[s.id] ?? s.points),
      })) ?? [],
    [route?.segments, display],
  );
  return (
    <MapContainer
      center={[45.88, 6.92]}
      zoom={10}
      scrollWheelZoom
      className="map"
      zoomControl={true}
    >
      <TileLayer
        key={base}
        url={provider.url}
        attribution={provider.attribution}
        maxZoom={provider.maxZoom}
      />
      <Events onPoint={onPoint} fit={fit} route={route} fitPoints={fitPoints} />
      <Location tick={locate} onError={onError} />
      {catalog?.main.segments.map((s, i) => (
        <Polyline
          key={"main" + i}
          positions={coords(s)}
          pathOptions={{
            color: "#355d66",
            weight: 3,
            opacity: 0.65,
            dashArray: "5 5",
          }}
        />
      ))}
      {catalog?.variants
        .filter((v) => visible.includes(v.id))
        .map((v) => (
          <Polyline
            key={v.id}
            positions={coords(v.points)}
            pathOptions={{ color: v.color, weight: 5, opacity: 0.85 }}
          >
            <Popup>
              <b>{v.name}</b>
              <p>{v.description}</p>
            </Popup>
          </Polyline>
        ))}
      {lines.map((s) => (
        <Polyline
          key={s.id}
          positions={s.coords}
          pathOptions={{ color: "#e15c32", weight: 5, opacity: 0.95 }}
          eventHandlers={{
            mousemove: (e) => onHover({ lat: e.latlng.lat, lon: e.latlng.lng }),
          }}
        />
      ))}
      {pois
        .filter((p) => layers.includes(p.id === TMB_START_POI_ID ? "start" : p.type))
        .map((p) => {
          const isStart = p.id === TMB_START_POI_ID;
          const category = POI_CATEGORIES.find(c => c.id === (isStart ? "start" : p.type));
          if (!category) return null;
          const alreadyLast = !!lastWaypoint && samePoint(lastWaypoint, p);
          const website = lodgingWebsite(p.type, { website: p.website });
          const markerProps = {
            position: [p.lat, p.lon] as [number, number],
            title: `${category.singular} · ${p.name}`,
            alt: `${category.singular} · ${p.name}`,
            zIndexOffset: isStart ? 500 : -100,
            bubblingMouseEvents: false,
            eventHandlers: { popupopen: () => onPoiOpen?.() },
          };
          const popup = <PoiPopup>
              <strong>{p.name}</strong>
              <p>
                {category.singular} {p.ele === undefined ? "" : `· ${p.ele} m`}
              </p>
              {website && (
                <a className="poi-website" href={website} target="_blank" rel="noopener noreferrer"
                  aria-label={`Site de l’hébergement : ${p.name} (nouvel onglet)`}>
                  <ExternalLink size={15} aria-hidden="true" /> Site de l’hébergement
                </a>
              )}
              <a href={p.url} target="_blank" rel="noreferrer">
                Source OpenStreetMap
              </a>
              {onAddPoi && (
                <button
                  type="button"
                  className="poi-add-button"
                  disabled={addingPoi || alreadyLast}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onAddPoi(p);
                  }}
                >
                  {alreadyLast ? <Check size={16} /> : addingPoi ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
                  {alreadyLast ? "Déjà en fin de parcours" : addingPoi ? "Calcul en cours…" : "Ajouter au parcours"}
                </button>
              )}
            </PoiPopup>;
          return isStart ?
            <HouchesMarker key={p.id} {...markerProps} name={p.name}>{popup}</HouchesMarker> :
            <Marker key={p.id} {...markerProps} icon={poiIcons[category.id]}>
              <Tooltip direction="top" offset={[0, -13]}>{p.name}</Tooltip>
              {popup}
            </Marker>;
        })}
      {stops.map((w, i) => (
        <Marker
          key={`${w.id}-${w.lat}-${w.lon}`}
          ref={w.id === selectedWaypointId ? selectedMarker : undefined}
          position={[w.lat, w.lon]}
          draggable={editing}
          zIndexOffset={w.id === selectedWaypointId ? 2000 : i === 0 && route?.roundTrip ? 1000 : 0}
          title={`${i === 0 ? route?.roundTrip ? "Départ et arrivée" : "Départ" : `Point ${i + 1}`} · ${w.name}`}
          alt={`${i === 0 && route?.roundTrip ? "Départ et arrivée" : `Point ${i + 1}`} · ${w.name}`}
          icon={L.divIcon({
            className: `waypoint-icon${i === 0 && route?.roundTrip ? " round-trip-marker" : ""}${w.id === selectedWaypointId ? " is-selected" : ""}`,
            html: `<span>${i === 0 && route?.roundTrip ? "D/A" : i + 1}</span>`,
            iconSize: w.id === selectedWaypointId ? [42, 42] : i === 0 && route?.roundTrip ? [34, 34] : [26, 26],
            iconAnchor: w.id === selectedWaypointId ? [21, 21] : i === 0 && route?.roundTrip ? [17, 17] : [13, 13],
            popupAnchor: [0, w.id === selectedWaypointId ? -24 : -15],
          })}
          eventHandlers={{
            click: () => onSelectWaypoint(w.id),
            dragend: (e) => {
              const p = e.target.getLatLng();
              onMove(w.id, { lat: p.lat, lon: p.lng });
              e.target.setLatLng([w.lat, w.lon]);
            },
          }}
        >
          <Popup>
            <strong>{w.name}</strong>
            {i === 0 && route?.roundTrip && <p>Départ et arrivée du tour. Déplacez ce repère pour modifier les deux ensemble.</p>}
          </Popup>
        </Marker>
      ))}
      {hover && (
        <CircleMarker
          center={[hover.lat, hover.lon]}
          radius={7}
          pathOptions={{
            color: "white",
            weight: 3,
            fillColor: "#193f47",
            fillOpacity: 1,
          }}
        />
      )}
    </MapContainer>
  );
}
