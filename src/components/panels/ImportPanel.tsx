import { useRef, useState } from 'react';
import { trackStatistics } from '../../state/selectors';
import { useApp, type ImportInfo } from '../../state/store';
import { count } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { StatsGrid } from './StatsGrid';

function ImportCard({ info }: { info: ImportInfo }) {
  const stats = useApp((s) => trackStatistics(s, info.id));
  const visible = useApp((s) => !!s.visible[info.id]);
  const status = useApp((s) => s.trackStatus[info.id]);
  const s = useApp.getState();
  return (
    <article className="card" data-testid="import-card">
      <header className="card-header">
        <span className="swatch" style={{ background: info.color }} aria-hidden />
        <h3>{info.name}</h3>
      </header>
      <p className="small">
        <Icon name="file" size={14} /> <span data-testid="import-filename">{info.fileName}</span> · <span data-testid="import-points">{count(info.pointCount)} points</span>
        {info.elevationFilled && <span className="muted"> · altitudes complétées (MNT 90 m)</span>}
        {status === 'elevation' && <span className="muted"> · récupération des altitudes…</span>}
      </p>
      {stats && <StatsGrid stats={stats} compact />}
      <div className="row gap-s wrap">
        <button type="button" className={`btn btn-small ${visible ? 'btn-active' : ''}`} onClick={() => s.toggleVisible(info.id)} aria-pressed={visible}>
          <Icon name={visible ? 'eye' : 'eyeOff'} size={16} /> {visible ? 'Affichée' : 'Afficher'}
        </button>
        <button type="button" className="btn btn-small" onClick={() => s.focusTrack(info.id)}>
          <Icon name="zoom" size={16} /> Zoomer
        </button>
        <button type="button" className="btn btn-small" onClick={() => s.setProfileTarget(info.id)}>
          <Icon name="chart" size={16} /> Profil
        </button>
      </div>
      <div className="row gap-s wrap">
        <button type="button" className="btn btn-small btn-primary" onClick={() => void s.useTrackAsBase(info.id)} data-testid="use-as-base">
          <Icon name="route" size={16} /> Utiliser comme base
        </button>
        <button type="button" className="btn btn-small" onClick={() => void s.addTrackToRoute(info.id)}>
          <Icon name="plus" size={16} /> Ajouter à mon itinéraire
        </button>
        <button type="button" className="btn btn-small btn-danger" onClick={() => s.removeImport(info.id)}>
          <Icon name="trash" size={16} /> Retirer
        </button>
      </div>
    </article>
  );
}

export function ImportPanel() {
  const imports = useApp((s) => s.imports);
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const importFiles = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) await useApp.getState().importGpx(f);
  };
  return (
    <div className="panel" data-testid="import-panel">
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void importFiles(e.dataTransfer.files);
        }}
      >
        <button type="button" className="btn btn-primary btn-large" onClick={() => input.current?.click()}>
          <Icon name="upload" /> Importer un GPX
        </button>
        <p className="muted small">ou glissez-déposez un fichier .gpx ici. Le fichier reste dans votre navigateur.</p>
        <input
          ref={input}
          type="file"
          accept=".gpx,application/gpx+xml"
          multiple
          hidden
          data-testid="gpx-input"
          onChange={(e) => {
            void importFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {imports.length === 0 ? (
        <p className="muted">Aucun fichier importé.</p>
      ) : (
        imports.map((i) => <ImportCard key={i.id} info={i} />)
      )}
    </div>
  );
}
