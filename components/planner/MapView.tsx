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
import { useEffect, useMemo, useState, useRef } from "react";
import type { Catalog, MapProvider, Route, RoutePoint } from "@/lib/tmb/types";
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
}: {
  onPoint: (p: RoutePoint) => void;
  fit: number;
  route: Route | null;
}) {
  const lastFit = useRef(0);
  const map = useMapEvents({
    click: (e) => onPoint({ lat: e.latlng.lat, lon: e.latlng.lng }),
  });
  useEffect(() => {
    if (!fit || fit === lastFit.current) return;
    lastFit.current = fit;
    const p = route?.segments.flatMap((s) => coords(s.points));
    if (p?.length)
      map.fitBounds(L.latLngBounds(p), { padding: [45, 45], maxZoom: 14 });
  }, [fit, map, route]);
  useEffect(() => {
    const r = new ResizeObserver(() => map.invalidateSize());
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
type Poi = RoutePoint & { id: string; name: string; type: string; url: string };
export default function MapView({
  catalog,
  visible,
  route,
  base = "topo",
  onPoint = () => {},
  onMove = () => {},
  hover,
  onHover = () => {},
  fit = 0,
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
  onMove?: (id: string, p: RoutePoint) => void;
  hover?: RoutePoint | null;
  onHover?: (p: RoutePoint) => void;
  fit?: number;
  editing?: boolean;
  locate?: number;
  onError?: (message: string) => void;
  display?: Record<string, RoutePoint[]>;
  layers?: string[];
}) {
  const provider = providers.find((p) => p.id === base) ?? providers[0];
  const [pois, setPois] = useState<Poi[]>([]);
  useEffect(() => {
    fetch("/data/pois.json")
      .then((r) => r.json())
      .then((data) => setPois((data as { points: Poi[] }).points))
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
      <Events onPoint={onPoint} fit={fit} route={route} />
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
          return <Marker
            key={p.id}
            position={[p.lat, p.lon]}
            icon={poiIcons[p.type]}
            title={`${category.singular} · ${p.name}`}
            alt={`${category.singular} · ${p.name}`}
            zIndexOffset={-100}
            bubblingMouseEvents={false}
          >
            <Tooltip direction="top" offset={[0, -13]}>{p.name}</Tooltip>
            <Popup>
              <strong>{p.name}</strong>
              <p>
                {category.singular} {p.ele === undefined ? "" : `· ${p.ele} m`}
              </p>
              <a href={p.url} target="_blank" rel="noreferrer">
                Source OpenStreetMap
              </a>
            </Popup>
          </Marker>;
        })}
      {route?.waypoints.map((w, i) => (
        <Marker
          key={`${w.id}-${w.lat}-${w.lon}`}
          position={[w.lat, w.lon]}
          draggable={editing}
          icon={L.divIcon({
            className: "waypoint-icon",
            html: `<span>${i + 1}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          })}
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng();
              onMove(w.id, { lat: p.lat, lon: p.lng });
              e.target.setLatLng([w.lat, w.lon]);
            },
          }}
        >
          <Popup>{w.name}</Popup>
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
