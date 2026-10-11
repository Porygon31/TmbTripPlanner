"use client";
import {
  MapContainer,
  TileLayer,
  Polyline,
  useMapEvents,
  Marker,
  Popup,
  Tooltip,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { POI_CATEGORIES, PoiSymbol } from "./poi-categories";
import { Plus, Check, LoaderCircle } from "lucide-react";
import { samePoint } from "@/lib/tmb/geo";
import { routeStops } from "@/lib/tmb/loop";
import { useEffect, useMemo, useState, useRef } from "react";
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
const poiIcons = Object.fromEntries(POI_CATEGORIES.map(category => [category.id, L.divIcon({
  className: `poi-map-icon poi-map-icon-${category.id}`,
  html: renderToStaticMarkup(<PoiSymbol category={category} />),
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -15],
})]));
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
  base = "topo",
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
  const provider = providers.find((p) => p.id === base) ?? providers[0];
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const stops = route ? routeStops(route) : [];
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
        .filter((p) => layers.includes(p.type))
        .map((p) => {
          const category = POI_CATEGORIES.find(c => c.id === p.type);
          if (!category) return null;
          const alreadyLast = !!lastWaypoint && samePoint(lastWaypoint, p);
          return <Marker
            key={p.id}
            position={[p.lat, p.lon]}
            icon={poiIcons[p.type]}
            title={`${category.singular} · ${p.name}`}
            alt={`${category.singular} · ${p.name}`}
            zIndexOffset={-100}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => onPoiOpen?.() }}
          >
            <Tooltip direction="top" offset={[0, -13]}>{p.name}</Tooltip>
            <Popup className="poi-popup" minWidth={230} maxWidth={280} autoPanPaddingTopLeft={[16, 112]} autoPanPaddingBottomRight={[16, 90]}>
              <strong>{p.name}</strong>
              <p>
                {category.singular} {p.ele === undefined ? "" : `· ${p.ele} m`}
              </p>
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
            </Popup>
          </Marker>;
        })}
      {stops.map((w, i) => (
        <Marker
          key={`${w.id}-${w.lat}-${w.lon}`}
          position={[w.lat, w.lon]}
          draggable={editing}
          zIndexOffset={i === 0 && route?.roundTrip ? 1000 : 0}
          title={`${i === 0 ? route?.roundTrip ? "Départ et arrivée" : "Départ" : `Point ${i + 1}`} · ${w.name}`}
          alt={`${i === 0 && route?.roundTrip ? "Départ et arrivée" : `Point ${i + 1}`} · ${w.name}`}
          icon={L.divIcon({
            className: `waypoint-icon${i === 0 && route?.roundTrip ? " round-trip-marker" : ""}`,
            html: `<span>${i === 0 && route?.roundTrip ? "D/A" : i + 1}</span>`,
            iconSize: i === 0 && route?.roundTrip ? [34, 34] : [26, 26],
            iconAnchor: i === 0 && route?.roundTrip ? [17, 17] : [13, 13],
          })}
          eventHandlers={{
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
