import { useMemo, useState } from 'react';
import { buildRouteGeometry } from '../../core/route/geometry';
import { routeStatistics, stageStatistics, waypointLabel } from '../../core/route/stats';
import type { Route } from '../../core/types';
import { MAIN_ID, useApp } from '../../state/store';
import { duration, km, meters } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { StatsGrid, TIME_NOTE } from './StatsGrid';

function WaypointList({ route }: { route: Route }) {
  const s = useApp.getState();
  const n = route.waypoints.length;
  return (
    <ol className="wp-list" data-testid="waypoint-list">
      {route.waypoints.map((w, i) => {
        const seg = route.segments[i];
        return (
          <li key={w.id} className={`wp-item ${w.role !== 'user' ? 'wp-auto' : ''}`}>
            <div className="wp-row">
              <span className={`wp-badge ${i === 0 ? 'start' : i === n - 1 ? 'end' : w.stageEnd ? 'stage' : ''}`}>{i === 0 ? 'D' : i === n - 1 ? 'A' : i + 1}</span>
              <input
                key={`${w.id}-${w.name ?? ''}`}
                className="wp-name"
                defaultValue={w.name ?? ''}
                placeholder={waypointLabel(route, i)}
                aria-label={`Nom du point ${i + 1}`}
                onBlur={(e) => e.target.value !== (w.name ?? '') && s.renamePoint(i, e.target.value)}
              />
              <div className="wp-actions">
                {i > 0 && i < n - 1 && (
                  <button
                    type="button"
                    className={`icon-btn ${w.stageEnd ? 'on' : ''}`}
                    onClick={() => s.toggleStageEnd(i)}
                    title={w.stageEnd ? 'Retirer la fin d’étape' : 'Marquer comme fin d’étape'}
                    aria-label={w.stageEnd ? 'Retirer la fin d’étape' : 'Marquer comme fin d’étape'}
                    aria-pressed={!!w.stageEnd}
                  >
                    <Icon name="flag" />
                  </button>
                )}
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => s.reorderPoint(i, i - 1)} aria-label="Monter">
                  <Icon name="up" />
                </button>
                <button type="button" className="icon-btn" disabled={i === n - 1} onClick={() => s.reorderPoint(i, i + 1)} aria-label="Descendre">
                  <Icon name="down" />
                </button>
                <button type="button" className="icon-btn danger" onClick={() => s.removePoint(i)} aria-label={`Supprimer le point ${i + 1}`}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
            {seg && seg.status === 'error' && (
              <div className="seg-error" role="alert">
                <Icon name="alert" size={16} /> {seg.error}
                <div className="row gap-s">
                  <button type="button" className="btn btn-small" onClick={() => s.retrySegment(i)}>
                    Réessayer
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => s.setSegmentStraight(i)} title="Hors sentier : à vos risques">
                    Relier en ligne droite
                  </button>
                </div>
              </div>
            )}
            {seg && seg.status === 'pending' && <div className="seg-pending">Calcul de l’itinéraire…</div>}
            {seg && seg.mode === 'straight' && seg.status === 'ok' && (
              <div className="seg-note">{seg.gap ? 'Trou dans la trace d’origine (ligne droite)' : seg.connectorFor ? 'Raccord court en ligne droite' : 'Ligne droite (hors sentier)'}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Stages({ route }: { route: Route }) {
  const stages = useMemo(() => stageStatistics(route), [route]);
  if (stages.length < 2) {
    return <p className="muted small">Pour découper en journées, marquez des points comme « fin d’étape » (icône drapeau), ou touchez le tracé pour insérer un point puis marquez-le.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="stages" data-testid="stages-table">
        <thead>
          <tr>
            <th>Jour</th>
            <th>Trajet</th>
            <th>Dist.</th>
            <th>D+</th>
            <th>D−</th>
            <th>Alt. max</th>
            <th>Temps*</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((st) => (
            <tr key={st.index}>
              <td>J{st.index + 1}</td>
              <td className="stage-name">
                {st.fromName} → {st.toName}
              </td>
              <td>{km(st.distance)}</td>
              <td>{meters(st.ascent)}</td>
              <td>{meters(st.descent)}</td>
              <td>{meters(st.maxEle)}</td>
              <td>{duration(st.durationHours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoutePanel() {
  const route = useApp((s) => s.history.present);
  const mode = useApp((s) => s.mode);
  const hasMain = useApp((s) => !!s.catalog?.main);
  const canUndo = useApp((s) => s.history.past.length > 0);
  const canRedo = useApp((s) => s.history.future.length > 0);
  const [perStage, setPerStage] = useState(false);
  const s = useApp.getState();
  const stats = routeStatistics(route);
  const geometry = buildRouteGeometry(route);
  const pending = route.segments.filter((x) => x.status === 'pending').length;
  const errors = route.segments.filter((x) => x.status === 'error').length;
  const hasStages = route.waypoints.some((w, i) => w.stageEnd && i > 0 && i < route.waypoints.length - 1);
  const basedOnMain = route.segments.some((x) => x.trackRef?.trackId === MAIN_ID);

  return (
    <div className="panel" data-testid="route-panel">
      <div className="section-heading"><h2>{basedOnMain ? 'Votre Tour du Mont-Blanc' : 'Votre parcours libre'}</h2><span>{route.segments.length} SEGMENTS</span></div>
      <div className="field">
        <label htmlFor="route-name">Nom du parcours</label>
        <input id="route-name" key={route.id + route.name} defaultValue={route.name} onBlur={(e) => s.renameRoute(e.target.value)} />
      </div>

      <div className="row gap-s wrap">
        <button type="button" className={`btn ${mode === 'edit' ? 'btn-active' : 'btn-primary'}`} onClick={() => s.setMode(mode === 'edit' ? 'view' : 'edit')}>
          <Icon name={mode === 'edit' ? 'check' : 'pencil'} />
          {mode === 'edit' ? 'Terminer l’édition' : 'Créer mon itinéraire'}
        </button>
        {hasMain && !basedOnMain && (
          <button type="button" className="btn" onClick={() => void s.startFromMain()} data-testid="start-from-main">
            <Icon name="mountain" /> Partir du TMB classique
          </button>
        )}
      </div>

      {route.waypoints.length === 0 ? (
        <div className="empty">
          <p>
            <strong>Votre itinéraire est vide.</strong>
          </p>
          {canUndo && <button className="btn btn-small" onClick={() => s.undo()}><Icon name="undo" size={16} /> Annuler</button>}
          <ul>
            <li>« Créer mon itinéraire », puis touchez la carte : chaque point est relié au précédent en suivant les sentiers.</li>
            {hasMain && <li>« Partir du TMB classique » puis ajoutez des variantes depuis Explorer.</li>}
            <li>Ou importez un GPX avec Importer, en haut à droite, et utilisez-le comme base.</li>
          </ul>
        </div>
      ) : (
        <>
          <StatsGrid stats={stats} showPoints />
          {(pending > 0 || errors > 0) && (
            <p className={errors ? 'warn small' : 'muted small'} role="status" data-testid="route-status">
              {pending > 0 && `${pending} tronçon(s) en cours de calcul. `}
              {errors > 0 && `${errors} tronçon(s) en erreur : voir la liste des points.`}
            </p>
          )}
          <div className="row gap-s wrap">
            <button type="button" className="btn btn-small" onClick={() => s.undo()} disabled={!canUndo}>
              <Icon name="undo" size={16} /> Annuler
            </button>
            <button type="button" className="btn btn-small" onClick={() => s.redo()} disabled={!canRedo}>
              <Icon name="redo" size={16} /> Rétablir
            </button>
            <button type="button" className="btn btn-small" onClick={() => s.reverse()}>
              <Icon name="swap" size={16} /> Inverser le sens
            </button>
            <button
              type="button"
              className="btn btn-small btn-danger"
              onClick={() => {
                if (confirm('Effacer entièrement le parcours ? (Annuler reste possible)')) s.clearRoute();
              }}
            >
              <Icon name="trash" size={16} /> Effacer
            </button>
          </div>

          <details className="export-options"><summary>Options d’export GPX</summary><div className="export-box">
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={() => s.exportGpx(perStage)}
              disabled={route.waypoints.length < 2 || !geometry.complete}
              data-testid="export-gpx"
            >
              <Icon name="download" /> Exporter mon itinéraire (GPX)
            </button>
            {hasStages && (
              <label className="check small">
                <input type="checkbox" checked={perStage} onChange={(e) => setPerStage(e.target.checked)} /> Un tracé par étape
              </label>
            )}
            {!geometry.complete && <p className="muted small">L’export sera disponible une fois tous les tronçons calculés.</p>}
          </div>

          </details>

          <h3>Points ({route.waypoints.length})</h3>
          <WaypointList route={route} />
          <h3>Vos étapes</h3>
          <Stages route={route} />
          <p className="muted small">{TIME_NOTE}</p>
        </>
      )}
      <div className="route-actions" data-tour="save"><button className="btn btn-primary" onClick={() => void s.saveProject()}><Icon name="save" size={16} /> Sauvegarder</button><button className="btn" onClick={() => void s.restoreLast()}><Icon name="refresh" size={16} /> Restaurer le dernier parcours</button><button className="btn" onClick={() => { if (!route.waypoints.length || confirm('Commencer un nouveau parcours ? Le précédent restera récupérable.')) void s.newProject(); }}><Icon name="plus" size={16} /> Nouveau parcours</button><button className="btn btn-text" onClick={() => s.setPanel('variants')}><Icon name="layers" size={16} /> Choisir les variantes</button></div>
    </div>
  );
}
