import { Popup } from 'react-leaflet';
import { trackStatistics } from '../../state/selectors';
import { MAIN_ID, useApp } from '../../state/store';
import { StatsGrid } from '../panels/StatsGrid';

/** Fiche affichée au clic sur un tracé (TMB, variante, import). */
export function TrackPopup() {
  const sel = useApp((s) => s.selectedTrack);
  const stats = useApp((s) => (sel ? trackStatistics(s, sel.id) : null));
  const name = useApp((s) => (sel ? s.trackName(sel.id) : undefined));
  const status = useApp((s) => (sel ? s.trackStatus[sel.id] : undefined));
  const isVariant = useApp((s) => !!sel && !!s.catalog?.variants.some((v) => v.id === sel.id));
  if (!sel || !stats) return null;
  const s = useApp.getState();
  return (
    <Popup position={[sel.at.lat, sel.at.lon]} eventHandlers={{ remove: () => useApp.getState().selectTrack(null) }} maxWidth={320}>
      <div className="track-popup" data-testid="track-popup">
        <strong>{name}</strong>
        <StatsGrid stats={stats} compact />
        {status === 'elevation' && <p className="muted small">Altitudes en cours de récupération…</p>}
        <div className="row gap-s wrap">
          <button type="button" className="btn btn-small" onClick={() => s.setProfileTarget(sel.id)}>
            Profil
          </button>
          {sel.id === MAIN_ID && (
            <button type="button" className="btn btn-small btn-primary" onClick={() => void s.startFromMain()}>
              Partir de ce tracé
            </button>
          )}
          {isVariant && (
            <button type="button" className="btn btn-small btn-primary" onClick={() => void s.addTrackToRoute(sel.id)}>
              Ajouter à mon itinéraire
            </button>
          )}
        </div>
      </div>
    </Popup>
  );
}
