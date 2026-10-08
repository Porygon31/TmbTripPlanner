import { TileLayer } from 'react-leaflet';
import { BASEMAPS, OVERLAYS } from '../../services/map/basemaps';
import { useApp } from '../../state/store';

export function TileLayers() {
  const basemapId = useApp((s) => s.basemap);
  const overlays = useApp((s) => s.overlays);
  const base = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0];
  return (
    <>
      <TileLayer
        key={base.id}
        url={base.url}
        attribution={base.attribution}
        maxNativeZoom={base.maxNativeZoom}
        maxZoom={19}
        subdomains={base.subdomains ?? 'abc'}
        crossOrigin
      />
      {OVERLAYS.filter((o) => overlays[o.id]).map((o) => (
        <TileLayer
          key={o.id}
          url={o.url}
          attribution={o.attribution}
          maxNativeZoom={o.maxNativeZoom}
          maxZoom={19}
          opacity={o.opacity ?? 1}
          zIndex={10}
        />
      ))}
    </>
  );
}
