import L from 'leaflet';
import { useMemo } from 'react';
import { MapContainer, ScaleControl, ZoomControl } from 'react-leaflet';
import { MASSIF_CENTER, MASSIF_ZOOM } from '../../services/map/basemaps';
import { useApp } from '../../state/store';
import { MapControls } from './MapControls';
import { DebugHandle, FitBoundsHandler, HoverMarker, MapClickHandler, ResizeHandler } from './MapHelpers';
import { PoiLayer } from './PoiLayer';
import { RouteLayer } from './RouteLayer';
import { TileLayers } from './TileLayers';
import { TrackLayers } from './TrackLayers';
import { TrackPopup } from './TrackPopup';

export function MapView() {
  const mode = useApp((s) => s.mode);
  // Rendu canvas (fluide avec des milliers de points) et tolérance de clic adaptée au tactile.
  const renderer = useMemo(() => L.canvas({ tolerance: 8 }), []);
  return (
    <MapContainer
      center={MASSIF_CENTER}
      zoom={MASSIF_ZOOM}
      minZoom={7}
      maxZoom={19}
      zoomControl={false}
      preferCanvas
      renderer={renderer}
      className={`map ${mode === 'edit' ? 'map-edit' : ''}`}
      attributionControl
      worldCopyJump={false}
    >
      <TileLayers />
      <TrackLayers />
      <PoiLayer />
      <RouteLayer />
      <TrackPopup />
      <HoverMarker />
      <MapClickHandler />
      <FitBoundsHandler />
      <ResizeHandler />
      <DebugHandle />
      <ZoomControl position="bottomright" zoomInTitle="Zoomer" zoomOutTitle="Dézoomer" />
      <ScaleControl position="bottomleft" imperial={false} />
      <MapControls />
    </MapContainer>
  );
}
