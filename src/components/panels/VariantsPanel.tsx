import type { CatalogTrackInfo, DataSource, Reference, TmbVariant } from '../../core/types';
import { trackStatistics } from '../../state/selectors';
import { MAIN_ID, useApp } from '../../state/store';
import { kmOnTmb, meters, signedKm, signedMeters } from '../../ui/format';
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

function TrackActions({ id }: { id: string }) {
  const visible = useApp((s) => !!s.visible[id]);
  const loading = useApp((s) => s.trackStatus[id]);
  const s = useApp.getState();
  return (
    <>
      <button type="button" className={`btn btn-small ${visible ? 'btn-active' : ''}`} onClick={() => s.toggleVisible(id)} aria-pressed={visible} data-testid={`show-${id}`}>
        <Icon name={visible ? 'eye' : 'eyeOff'} size={16} /> {visible ? 'Affichée' : 'Afficher sur la carte'}
      </button>
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
    </>
  );
}

function MainCard({ main }: { main: CatalogTrackInfo }) {
  const stats = useApp((s) => trackStatistics(s, MAIN_ID)) ?? main.stats;
  return (
    <article className="card" data-testid="main-card">
      <header className="card-header">
        <span className="swatch" style={{ background: TMB_COLOR }} aria-hidden />
        <h3>{main.name}</h3>
      </header>
      {main.description && <p className="desc">{main.description}</p>}
      <StatsGrid stats={stats} compact />
      <div className="row gap-s wrap">
        <TrackActions id={MAIN_ID} />
        <button type="button" className="btn btn-small btn-primary" onClick={() => void useApp.getState().startFromMain()}>
          <Icon name="route" size={16} /> Partir de ce tracé
        </button>
      </div>
      <SourceLine source={main.source} references={main.references ?? []} />
      <Warnings warnings={main.warnings} />
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
    <article className={`card ${included ? 'card-included' : ''}`} data-testid={`variant-${v.id}`}>
      <header className="card-header">
        <span className="swatch" style={{ background: v.color }} aria-hidden />
        <h3>{v.name}</h3>
        {included && <span className="tag">Dans mon itinéraire</span>}
      </header>
      <p className={`desc ${v.description ? '' : 'muted'}`}>{v.description ?? 'Description non renseignée.'}</p>
      <dl className="facts">
        <div>
          <dt>Écart vs TMB classique</dt>
          <dd data-testid="delta-distance">{signedKm(v.deltaDistance)}</dd>
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
        <TrackActions id={v.id} />
        {included && basedOnMain ? (
          <button type="button" className="btn btn-small btn-danger" onClick={() => s.removeVariantFromRoute(v.id)}>
            <Icon name="minus" size={16} /> Retirer de mon itinéraire
          </button>
        ) : (
          <button type="button" className="btn btn-small btn-primary" onClick={() => void s.addTrackToRoute(v.id)} disabled={included} data-testid={`add-${v.id}`}>
            <Icon name="plus" size={16} /> Ajouter à mon itinéraire
          </button>
        )}
      </div>
      <SourceLine source={v.source} references={v.references ?? []} />
      <Warnings warnings={v.warnings} />
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
        <MainCard main={catalog.main} />
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
          <h2 className="section-title">Variantes ({catalog.variants.length})</h2>
          <p className="muted small">
            Triées dans le sens du TMB. « Ajouter à mon itinéraire » remplace le tronçon classique correspondant (sans doublon ni trou).
          </p>
          {catalog.variants.map((v) => (
            <VariantCard key={v.id} v={v} />
          ))}
        </>
      )}
      {catalog.warnings.length > 0 && <Warnings warnings={catalog.warnings} />}
    </div>
  );
}
