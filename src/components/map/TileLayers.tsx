import { useEffect, useMemo, useRef } from 'react';
import { TileLayer } from 'react-leaflet';
import { BASEMAPS, OVERLAYS } from '../../services/map/basemaps';
import { useApp } from '../../state/store';

const FALLBACK_BASEMAP = 'osm';
/** Nombre d'échecs consécutifs (sans aucune tuile chargée) avant de basculer sur le fond de secours. */
const MAX_FAILURES = 12;

export function TileLayers() {
  const basemapId = useApp((s) => s.basemap);
  const overlays = useApp((s) => s.overlays);
  const base = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0];
  const health = useRef({ loaded: 0, failed: 0 });

  useEffect(() => {
    health.current = { loaded: 0, failed: 0 };
  }, [base.id]);

  // Si un serveur de tuiles est indisponible, on bascule sur la carte classique plutôt que d'afficher une carte vide.
  const handlers = useMemo(
    () => ({
      tileload() {
        health.current.loaded++;
      },
      tileerror() {
        const h = health.current;
        h.failed++;
        if (h.loaded === 0 && h.failed === MAX_FAILURES && base.id !== FALLBACK_BASEMAP) {
          const s = useApp.getState();
          s.setBasemap(FALLBACK_BASEMAP);
          s.toast('info', `Fond « ${base.label} » indisponible pour le moment : affichage de la carte classique (changeable via le bouton calques).`);
        }
      },
    }),
    [base.id, base.label],
  );

  return (
    <>
      <TileLayer
        key={base.id}
        url={base.url}
        attribution={base.attribution}
        maxNativeZoom={base.maxNativeZoom}
        maxZoom={19}
        subdomains={base.subdomains ?? 'abc'}
        eventHandlers={handlers}
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
