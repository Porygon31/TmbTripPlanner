import type { CatalogTrackInfo, DataSource, Reference, TmbVariant } from '../../core/types';
import { trackStatistics } from '../../state/selectors';
import { MAIN_ID, useApp } from '../../state/store';
import { km, kmOnTmb, meters, signedKm, signedMeters } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { TMB_COLOR } from '../map/TrackLayers';
import { StatsGrid } from './StatsGrid';

function SourceLine({ source, references }: { source: DataSource | null; references: Reference[] }) {
  return (
    <div className="source small">
      <span className="muted">Source du GPX : </span>
      {source ? (
        <>
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>
          ) : (
            source.label
          )}
          {source.license && (
            <>
              {' · '}
              {source.licenseUrl ? (
                <a href={source.licenseUrl} target="_blank" rel="noreferrer">
                  {source.license}
                </a>
              ) : (
                source.license
              )}
            </>
          )}
          {source.retrieved && <span className="muted"> · récupéré le {source.retrieved}</span>}
        </>
      ) : (
        <span className="muted">non renseignée (voir data/catalog.config.json)</span>
      )}
      {references.length > 0 && (
        <div>
          <span className="muted">En savoir plus : </span>
          {references.map((r, i) => (
            <span key={r.url}>
              {i > 0 && ' · '}
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.label}
              </a>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="warnings small">
      {warnings.map((w) => (
        <li key={w}>
          <Icon name="alert" size={14} /> {w}
        </li>
      ))}
    </ul>
  );
}

function TrackActions({ id, secondary = false }: { id: string; secondary?: boolean }) {
  const visible = useApp((s) => !!s.visible[id]);
  const loading = useApp((s) => s.trackStatus[id]);
  const s = useApp.getState();
  return (
    <>
      {!secondary && <button type="button" className="btn btn-small btn-text" onClick={() => s.toggleVisible(id)} aria-pressed={visible} data-testid={`show-${id}`}>
        <Icon name="eye" size={16} /> {visible ? 'Masquer' : 'Voir la trace'}
      </button>}
      {secondary && <>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => {
          s.toggleVisible(id, true);
          s.focusTrack(id);
        }}
      >
        <Icon name="zoom" size={16} /> Zoomer
      </button>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => {
          s.toggleVisible(id, true);
          s.setProfileTarget(id);
        }}
      >
        <Icon name="chart" size={16} /> Profil
      </button>
      {loading === 'loading' && <span className="muted small">chargement…</span>}
      {loading === 'elevation' && <span className="muted small">altitudes…</span>}
      </>}
    </>
  );
}

function MainCard({ main }: { main: CatalogTrackInfo }) {
  const stats = useApp((s) => trackStatistics(s, MAIN_ID)) ?? main.stats;
  return (
    <article className="classic-card" data-testid="main-card" data-tour="classic">
      <div className="route-card-top"><span className="route-dot" style={{ background: TMB_COLOR }} /> FR · IT · CH <Icon name="mountain" size={20} /></div>
      <h3>Tour du Mont-Blanc</h3>
      <p>La boucle de référence, au départ des Houches.</p>
      <div className="card-stats"><strong>{(stats.distance / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<small> km</small></strong><span>Sens antihoraire</span></div>
      <button type="button" className="btn btn-primary full-width" data-testid="classic-start" onClick={() => void useApp.getState().startFromMain()}>Personnaliser ce tour <span aria-hidden>↗</span></button>
      <details className="track-details"><summary>TMB classique — données OpenStreetMap <Icon name="info" size={12} /></summary><p>{main.name}</p><StatsGrid stats={stats} compact /><div className="row wrap"><TrackActions id={MAIN_ID} /><TrackActions id={MAIN_ID} secondary /></div><SourceLine source={main.source} references={main.references ?? []} /><Warnings warnings={main.warnings} /></details>
    </article>
  );
}

function VariantCard({ v }: { v: TmbVariant }) {
  const stats = useApp((s) => trackStatistics(s, v.id)) ?? v.stats;
  const included = useApp((s) => s.history.present.segments.some((x) => x.trackRef?.trackId === v.id));
  const basedOnMain = useApp((s) => s.history.present.segments.some((x) => x.trackRef?.trackId === MAIN_ID));
  const s = useApp.getState();
  const dep = v.departure ? (v.departure.name ?? kmOnTmb(v.departure.distOnMain)) : null;
  const rej = v.rejoin ? (v.rejoin.name ?? kmOnTmb(v.rejoin.distOnMain)) : null;
  return (
    <article className={`variant-card ${included ? 'card-included' : ''}`} data-testid={`variant-${v.id}`} data-tour="variant">
      <header className="card-header">
        <span className="route-dot" style={{ background: v.color }} aria-hidden />
        <h3>{v.name}</h3>
      </header>
      <p className={`desc ${v.description ? '' : 'muted'}`}>{v.description ?? 'Description non renseignée.'}</p>
      <div className="variant-meta"><span><b>{km(stats.distance)}</b> · ↗ {meters(stats.ascent)}</span><span title={v.difficulty.criteria.join('\n')}>{v.difficulty.label}{v.difficulty.origin === 'estimated' ? ' · estimée' : ''}</span></div>
      <div className="variant-delta"><span data-testid="delta-distance">{signedKm(v.deltaDistance)}</span> par rapport au classique remplacé</div>
      <div className="variant-actions">
        <TrackActions id={v.id} />
        {included && basedOnMain ? <button className="btn btn-small btn-active" onClick={() => s.removeVariantFromRoute(v.id)} title="Retirer la variante et restaurer la portion classique"><Icon name="check" size={14} /> Intégrée</button> : <button className="btn btn-small" onClick={() => void s.addTrackToRoute(v.id)} disabled={included} data-testid={`add-${v.id}`}><Icon name={included ? 'check' : 'plus'} size={14} />{included ? 'Intégrée' : 'Intégrer'}</button>}
      </div>
      <details className="variant-details"><summary><Icon name="info" size={12} /> Détails et sources</summary>
      {v.description && <p>{v.description}</p>}
      <dl className="facts">
        <div>
          <dt>Écart vs TMB classique</dt>
          <dd>{signedKm(v.deltaDistance)}</dd>
        </div>
        <div>
          <dt>Dénivelé (D+ / D−)</dt>
          <dd>
            {stats.elevationCoverage > 0 ? `${meters(stats.ascent)} / ${meters(stats.descent)}` : '—'}
            {v.deltaAscent !== null && <span className="muted"> ({signedMeters(v.deltaAscent)} D+)</span>}
          </dd>
        </div>
        <div>
          <dt>Altitude max</dt>
          <dd>{meters(stats.maxEle)}</dd>
        </div>
        <div>
          <dt>Difficulté</dt>
          <dd title={v.difficulty.criteria.join('\n')}>
            {v.difficulty.label}
            {v.difficulty.origin === 'estimated' && <span className="muted small"> (estimation auto.)</span>}
          </dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{(stats.distance / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km</dd>
        </div>
        {dep && rej && (
          <div className="span-2">
            <dt>Quitte le TMB → le rejoint</dt>
            <dd>
              {dep} → {rej}
            </dd>
          </div>
        )}
      </dl>
      {v.difficulty.origin === 'estimated' && v.difficulty.criteria.length > 0 && (
        <details className="small">
          <summary>Critères de l’estimation</summary>
          <ul>
            {v.difficulty.criteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="muted">Estimation calculée sur la trace (altitude, pente, dénivelé). Elle ne tient compte ni de l’exposition, ni du terrain, ni de la météo.</p>
        </details>
      )}
      <div className="row gap-s wrap">
        <TrackActions id={v.id} secondary />
      </div>
      <SourceLine source={v.source} references={v.references ?? []} />
      <Warnings warnings={v.warnings} />
      </details>
    </article>
  );
}

export function VariantsPanel() {
  const catalog = useApp((s) => s.catalog);
  const error = useApp((s) => s.catalogError);
  if (error) return <p className="warn">{error}</p>;
  if (!catalog) return <p className="muted">Chargement du catalogue…</p>;
  return (
    <div className="panel" data-testid="variants-panel">
      {catalog.main ? (
        <><div className="section-heading"><h2>Le grand classique</h2><span>01 ITINÉRAIRE</span></div><MainCard main={catalog.main} /></>
      ) : (
        <div className="empty">
          <p>
            <strong>Aucun tracé du TMB n’est encore installé.</strong>
          </p>
          <p>
            Déposez le GPX officiel dans <code>data/gpx/tmb-principal.gpx</code> et les variantes dans <code>data/gpx/variantes/</code>, puis relancez{' '}
            <code>npm run build</code>. La procédure et les sources recommandées (OpenStreetMap, licence ODbL) sont décrites dans <code>data/README.md</code>.
          </p>
          <p className="muted">En attendant, vous pouvez créer un itinéraire sur la carte ou importer votre propre GPX.</p>
        </div>
      )}
      {catalog.variants.length > 0 && (
        <>
          <div className="section-heading"><h2>Changez de perspective</h2><span>{catalog.variants.length} VARIANTES</span></div>
          {catalog.variants.map((v) => (
            <VariantCard key={v.id} v={v} />
          ))}
        </>
      )}
      {catalog.warnings.length > 0 && <Warnings warnings={catalog.warnings} />}
      <button className="btn full-width" onClick={() => { const s = useApp.getState(); if (!s.history.present.waypoints.length || s.tutorialActive || confirm('Commencer un parcours libre ? Le précédent restera récupérable.')) void s.newProject(); }}><Icon name="plus" size={16} /> Créer un parcours libre</button>
    </div>
  );
}
