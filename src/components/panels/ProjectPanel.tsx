import { useEffect, useState } from 'react';
import { EMERGENCY_NUMBER, officialLinksProvider } from '../../services/conditions/conditions';
import { BASEMAPS, OVERLAYS } from '../../services/map/basemaps';
import { ROUTING_PROVIDERS } from '../../services/routing/registry';
import type { RoutingProviderId } from '../../services/routing/types';
import { projectStore, type SavedEntry } from '../../services/storage/projectStore';
import { useApp } from '../../state/store';
import { Icon } from '../../ui/Icon';

function SavedList() {
  const [saves, setSaves] = useState<SavedEntry[]>([]);
  const route = useApp((s) => s.history.present);
  useEffect(() => {
    void projectStore.listSaves().then(setSaves);
  }, [route]);
  if (saves.length === 0) return <p className="muted small">Aucune sauvegarde nommée pour l’instant.</p>;
  return (
    <ul className="saves">
      {saves.map((e) => (
        <li key={e.id}>
          <div>
            <strong>{e.name}</strong>
            <div className="muted small">{new Date(e.savedAt).toLocaleString('fr-FR')}</div>
          </div>
          <div className="row gap-s">
            <button type="button" className="btn btn-small" onClick={() => useApp.getState().loadProject(e.project)}>
              Ouvrir
            </button>
            <button type="button" className="icon-btn danger" aria-label={`Supprimer la sauvegarde ${e.name}`} onClick={() => void projectStore.deleteSave(e.id).then(setSaves)}>
              <Icon name="trash" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RoutingSettingsForm() {
  const settings = useApp((s) => s.settings);
  const s = useApp.getState();
  const current = ROUTING_PROVIDERS.find((p) => p.id === settings.providerId);
  return (
    <div className="settings">
      <div className="field">
        <label htmlFor="provider">Moteur de calcul d’itinéraire</label>
        <select id="provider" value={settings.providerId} onChange={(e) => s.setSettings({ providerId: e.target.value as RoutingProviderId })}>
          {ROUTING_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {current && <p className="muted small">{current.help}</p>}
      </div>
      {settings.providerId === 'brouter' && (
        <>
          <div className="field">
            <label htmlFor="brouter-url">Adresse du serveur BRouter</label>
            <input id="brouter-url" defaultValue={settings.brouterUrl} onBlur={(e) => s.setSettings({ brouterUrl: e.target.value.trim() || 'https://brouter.de/brouter' })} />
          </div>
          <div className="field">
            <label htmlFor="brouter-profile">Profil BRouter</label>
            <input id="brouter-profile" defaultValue={settings.brouterProfile} onBlur={(e) => s.setSettings({ brouterProfile: e.target.value.trim() || 'hiking-mountain' })} />
          </div>
        </>
      )}
      {settings.providerId === 'graphhopper' && (
        <div className="field">
          <label htmlFor="gh-key">Clé GraphHopper</label>
          <input id="gh-key" type="password" autoComplete="off" defaultValue={settings.graphhopperKey} onBlur={(e) => s.setSettings({ graphhopperKey: e.target.value.trim() })} />
        </div>
      )}
      {settings.providerId === 'openrouteservice' && (
        <div className="field">
          <label htmlFor="ors-key">Clé openrouteservice</label>
          <input id="ors-key" type="password" autoComplete="off" defaultValue={settings.orsKey} onBlur={(e) => s.setSettings({ orsKey: e.target.value.trim() })} />
        </div>
      )}
      <p className="muted small">Les clés restent dans ce navigateur (localStorage) et ne sont envoyées qu’au service concerné.</p>
    </div>
  );
}

export function ProjectPanel() {
  const catalog = useApp((s) => s.catalog);
  const route = useApp((s) => s.history.present);
  const s = useApp.getState();
  const [name, setName] = useState('');
  const sources = [catalog?.main, ...(catalog?.variants ?? [])].filter((x) => x?.source);
  return (
    <div className="panel" data-testid="project-panel">
      <h3>Mon parcours</h3>
      <p className="muted small">Tout est enregistré automatiquement dans ce navigateur : vous pouvez fermer puis rouvrir le site sans rien perdre.</p>
      <div className="row gap-s wrap">
        <input className="grow" placeholder={route.name} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom de la sauvegarde" />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            void s.saveProject(name || route.name);
            setName('');
          }}
          data-testid="save-project"
        >
          <Icon name="save" /> Sauvegarder
        </button>
      </div>
      <div className="row gap-s wrap">
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (route.waypoints.length === 0 || confirm('Commencer un nouveau parcours ? L’actuel restera récupérable via « Restaurer le dernier parcours ».')) void s.newProject();
          }}
          data-testid="new-project"
        >
          <Icon name="plus" /> Nouveau parcours
        </button>
        <button type="button" className="btn" onClick={() => void s.restoreLast()} data-testid="restore-last">
          <Icon name="refresh" /> Restaurer le dernier parcours
        </button>
      </div>
      <h3>Sauvegardes</h3>
      <SavedList />

      <h3>Réglages</h3>
      <RoutingSettingsForm />

      <h3>Sécurité et conditions</h3>
      <p className="small">
        Aucun itinéraire n’est garanti praticable. Avant de partir, renseignez-vous auprès des sources officielles. En cas d’urgence : <strong>{EMERGENCY_NUMBER}</strong>.
      </p>
      <ul className="links small">
        {officialLinksProvider.links.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noreferrer">
              {l.label}
            </a>
            <div className="muted">{l.description}</div>
          </li>
        ))}
      </ul>

      <h3>Sources et licences</h3>
      <ul className="small links">
        {sources.map((x) => (
          <li key={x!.id}>
            {x!.name} : {x!.source!.url ? <a href={x!.source!.url} target="_blank" rel="noreferrer">{x!.source!.label}</a> : x!.source!.label}
            {x!.source!.license ? ` (${x!.source!.license})` : ''}
          </li>
        ))}
        {sources.length === 0 && <li className="muted">Sources des GPX : à renseigner dans data/catalog.config.json.</li>}
        <li>Fonds de carte : {BASEMAPS.map((b) => b.label).join(', ')} ; calques : {OVERLAYS.map((o) => o.label).join(', ')} (attributions en bas de la carte).</li>
        <li>Calcul d’itinéraire : BRouter (brouter.de) par défaut, données © contributeurs OpenStreetMap (ODbL).</li>
        <li>Altitudes complémentaires : Open-Meteo (Copernicus GLO-90). Points d’intérêt : OpenStreetMap via Overpass.</li>
      </ul>
    </div>
  );
}
