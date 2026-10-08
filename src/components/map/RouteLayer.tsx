import L, { type LeafletEvent, type LeafletMouseEvent, type Marker as LMarker } from 'leaflet';
import { memo, useMemo, useRef } from 'react';
import { Marker, Polyline, Popup, Tooltip } from 'react-leaflet';
import { nearestPointIndex } from '../../core/geo/projection';
import { buildRouteGeometry, segmentDisplayPoints } from '../../core/route/geometry';
import { moveWaypoint, splitSegmentAt } from '../../core/route/operations';
import { waypointLabel } from '../../core/route/stats';
import type { RouteSegment, Waypoint } from '../../core/types';
import { hoverBus } from '../../state/hoverBus';
import { effectiveTarget } from '../../state/selectors';
import { ROUTE_TARGET, useApp } from '../../state/store';
import { displayLine } from './displayCache';

export const ROUTE_COLOR = '#2563eb';
const ERROR_COLOR = '#b91c1c';

const iconCache = new Map<string, L.DivIcon>();
function waypointIcon(kind: string, label: string, editable: boolean): L.DivIcon {
  const key = `${kind}|${label}|${editable}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const small = kind === 'junction' || kind === 'base';
    const size = small ? 14 : 26;
    icon = L.divIcon({
      className: `wp-marker wp-${kind}${editable ? ' wp-editable' : ''}`,
      html: small ? '<span class="wp-dot"></span>' : `<span class="wp-dot">${label}</span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

const handleIcon = L.divIcon({ className: 'wp-marker wp-handle', html: '<span class="wp-dot"></span>', iconSize: [14, 14], iconAnchor: [7, 7] });

function segmentStyle(seg: RouteSegment): L.PathOptions {
  if (seg.status === 'error') return { color: ERROR_COLOR, weight: 4, dashArray: '4 6', opacity: 0.9 };
  if (seg.status === 'pending') return { color: ROUTE_COLOR, weight: 4, dashArray: '4 8', opacity: 0.55 };
  if (seg.mode === 'straight') return { color: ROUTE_COLOR, weight: 4, dashArray: '8 8', opacity: 0.9 };
  // dashArray explicite : Leaflet conserve sinon le pointillé de l'état « en calcul ».
  return { color: ROUTE_COLOR, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round', dashArray: undefined };
}

const SegmentLine = memo(function SegmentLine({ seg, index, from, to }: { seg: RouteSegment; index: number; from: Waypoint; to: Waypoint }) {
  const positions = useMemo(() => displayLine(segmentDisplayPoints(seg, from, to)), [seg, from, to]);
  const last = useRef<L.LatLng | null>(null);
  const frame = useRef(0);
  const handlers = useMemo(
    () => ({
      click(e: LeafletMouseEvent) {
        const s = useApp.getState();
        if (s.mode !== 'edit') return;
        L.DomEvent.stopPropagation(e);
        s.insertOnSegment(index, { lat: e.latlng.lat, lon: e.latlng.lng });
      },
      mousemove(e: LeafletMouseEvent) {
        if (effectiveTarget(useApp.getState()) !== ROUTE_TARGET) return;
        last.current = e.latlng;
        if (frame.current) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          const route = useApp.getState().history.present;
          if (!last.current || route.segments[index] !== seg) return;
          const g = buildRouteGeometry(route);
          const [a, b] = g.segmentRanges[index] ?? [0, g.points.length - 1];
          const local = nearestPointIndex(g.points.slice(a, b + 1), { lat: last.current.lat, lon: last.current.lng });
          hoverBus.emit({ source: 'map', target: ROUTE_TARGET, index: a + local, band: [g.cum[a], g.cum[b]] });
        });
      },
      mouseout() {
        hoverBus.emit({ source: 'map', target: ROUTE_TARGET, index: null, band: null });
      },
    }),
    [seg, index],
  );
  return (
    <>
      <Polyline positions={positions} pathOptions={{ color: '#ffffff', weight: 9, opacity: seg.status === 'ok' ? 0.85 : 0.4 }} interactive={false} />
      <Polyline positions={positions} pathOptions={segmentStyle(seg)} eventHandlers={handlers}>
        {seg.status === 'error' && (
          <Tooltip sticky direction="top">
            {seg.error ?? 'Calcul impossible'}
          </Tooltip>
        )}
      </Polyline>
    </>
  );
});

function WaypointMarker({ wp, index, total, editable }: { wp: Waypoint; index: number; total: number; editable: boolean }) {
  const route = useApp((s) => s.history.present);
  const isStart = index === 0;
  const isEnd = index === total - 1;
  const kind = isStart ? 'start' : isEnd ? 'end' : wp.stageEnd ? 'stage' : wp.role === 'user' ? 'user' : wp.role;
  const label = isStart ? 'D' : isEnd ? 'A' : wp.stageEnd ? '◆' : String(index + 1);
  const ref = useRef<LMarker>(null);
  const handlers = useMemo(
    () => ({
      dragend(e: LeafletEvent) {
        const ll = (e.target as LMarker).getLatLng();
        useApp.getState().movePoint(index, { lat: ll.lat, lon: ll.lng });
      },
    }),
    [index],
  );
  return (
    <Marker ref={ref} position={[wp.lat, wp.lon]} icon={waypointIcon(kind, label, editable)} draggable={editable} eventHandlers={handlers}>
      <Popup>
        <div className="wp-popup" data-testid="waypoint-popup">
          <strong>{waypointLabel(route, index)}</strong>
          {editable && (
            <div className="wp-popup-actions">
              {!isStart && !isEnd && (
                <button type="button" className="btn btn-small" onClick={() => useApp.getState().toggleStageEnd(index)}>
                  {wp.stageEnd ? 'Retirer la fin d’étape' : 'Fin d’étape'}
                </button>
              )}
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => {
                  ref.current?.closePopup();
                  useApp.getState().removePoint(index);
                }}
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

function MidHandle({ seg, index }: { seg: RouteSegment; index: number }) {
  const mid = seg.points[Math.floor(seg.points.length / 2)];
  const handlers = useMemo(
    () => ({
      dragend(e: LeafletEvent) {
        const ll = (e.target as LMarker).getLatLng();
        useApp.getState().edit((r) => {
          const i = r.segments.indexOf(seg);
          if (i < 0) return r;
          const split = splitSegmentAt(r, i, mid);
          return moveWaypoint(split.route, split.waypointIndex, { lat: ll.lat, lon: ll.lng });
        });
      },
    }),
    [seg, mid],
  );
  if (!mid) return null;
  return <Marker position={[mid.lat, mid.lon]} icon={handleIcon} draggable eventHandlers={handlers} title={`Glisser pour ajouter un point (tronçon ${index + 1})`} />;
}

export function RouteLayer() {
  const route = useApp((s) => s.history.present);
  const editable = useApp((s) => s.mode === 'edit');
  return (
    <>
      {route.segments.map((seg, i) => (
        <SegmentLine key={seg.id} seg={seg} index={i} from={route.waypoints[i]} to={route.waypoints[i + 1]} />
      ))}
      {editable &&
        route.segments.map((seg, i) =>
          seg.status === 'ok' && seg.mode !== 'track' && seg.points.length > 2 ? <MidHandle key={`h-${seg.id}`} seg={seg} index={i} /> : null,
        )}
      {route.waypoints.map((wp, i) => (
        <WaypointMarker key={wp.id} wp={wp} index={i} total={route.waypoints.length} editable={editable} />
      ))}
    </>
  );
}
