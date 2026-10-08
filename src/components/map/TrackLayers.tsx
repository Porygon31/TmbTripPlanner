import L, { type LeafletMouseEvent } from 'leaflet';
import { memo, useMemo, useRef } from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
import { nearestPointIndex } from '../../core/geo/projection';
import type { IndexedTrack } from '../../core/route/tracks';
import { hoverBus } from '../../state/hoverBus';
import { effectiveTarget } from '../../state/selectors';
import { MAIN_ID, useApp } from '../../state/store';
import { displayLine } from './displayCache';

export const TMB_COLOR = '#dc2626';

interface TrackLineProps {
  track: IndexedTrack;
  color: string;
  label: string;
  weight: number;
  emphasized: boolean;
}

/** Une trace du catalogue ou importée : liseré blanc + trait coloré, nom au survol. */
const TrackLine = memo(function TrackLine({ track, color, label, weight, emphasized }: TrackLineProps) {
  const positions = useMemo(() => displayLine(track.points), [track.points]);
  const last = useRef<{ lat: number; lng: number } | null>(null);
  const frame = useRef(0);
  const handlers = useMemo(
    () => ({
      click(e: LeafletMouseEvent) {
        const s = useApp.getState();
        if (s.mode !== 'view') return; // en création, le clic ajoute un point (propagé à la carte)
        L.DomEvent.stopPropagation(e);
        s.selectTrack({ id: track.id, at: { lat: e.latlng.lat, lon: e.latlng.lng } });
      },
      mousemove(e: LeafletMouseEvent) {
        if (effectiveTarget(useApp.getState()) !== track.id) return;
        last.current = e.latlng;
        if (frame.current) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          if (!last.current) return;
          const index = nearestPointIndex(track.points, { lat: last.current.lat, lon: last.current.lng });
          hoverBus.emit({ source: 'map', target: track.id, index });
        });
      },
      mouseout() {
        if (effectiveTarget(useApp.getState()) === track.id) hoverBus.emit({ source: 'map', target: track.id, index: null });
      },
    }),
    [track],
  );
  return (
    <>
      <Polyline positions={positions} pathOptions={{ color: '#ffffff', weight: weight + 3, opacity: 0.9 }} interactive={false} />
      <Polyline
        positions={positions}
        pathOptions={{ color, weight, opacity: emphasized ? 1 : 0.85, lineCap: 'round', lineJoin: 'round' }}
        eventHandlers={handlers}
      >
        <Tooltip sticky direction="top" offset={[0, -6]}>
          {label}
        </Tooltip>
      </Polyline>
    </>
  );
});

export function TrackLayers() {
  const catalog = useApp((s) => s.catalog);
  const tracks = useApp((s) => s.tracks);
  const visible = useApp((s) => s.visible);
  const imports = useApp((s) => s.imports);
  const profileTarget = useApp(effectiveTarget);
  const items: { id: string; color: string; label: string; weight: number }[] = [];
  if (catalog?.main && visible[MAIN_ID]) items.push({ id: MAIN_ID, color: TMB_COLOR, label: catalog.main.name, weight: 4 });
  for (const v of catalog?.variants ?? []) if (visible[v.id]) items.push({ id: v.id, color: v.color, label: v.name, weight: 4 });
  for (const i of imports) if (visible[i.id]) items.push({ id: i.id, color: i.color, label: `${i.name} (import)`, weight: 4 });
  return (
    <>
      {items.map((it) =>
        tracks[it.id] ? (
          <TrackLine
            key={it.id}
            track={tracks[it.id]}
            color={it.color}
            label={it.label}
            weight={profileTarget === it.id ? it.weight + 1 : it.weight}
            emphasized={profileTarget === it.id}
          />
        ) : null,
      )}
    </>
  );
}
