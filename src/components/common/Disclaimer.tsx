import { useState } from 'react';
import { EMERGENCY_NUMBER, officialLinksProvider } from '../../services/conditions/conditions';
import { readFlag, writePref } from '../../services/storage/projectStore';
import { Icon } from '../../ui/Icon';

const KEY = 'disclaimer-v1';

const SAFETY_POINTS = [
  'Les conditions météorologiques peuvent modifier fortement la difficulté d’un passage.',
  'Certains cols et passages peuvent rester enneigés, parfois jusqu’en été.',
  'Des sentiers peuvent être temporairement fermés (éboulement, travaux, troupeaux…).',
  'Vérifiez les conditions locales (offices de tourisme, gardiens de refuge, sources officielles) avant votre départ.',
];

/** Avertissement affiché à la première visite, puis consultable à tout moment. */
export function Disclaimer() {
  const [open, setOpen] = useState(() => !readFlag(KEY));
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title" data-testid="disclaimer">
        <h2 id="disclaimer-title">
          <Icon name="alert" /> Avant de préparer votre itinéraire
        </h2>
        <p>
          Cet outil aide à <strong>préparer</strong> un itinéraire. Il ne garantit jamais qu’un itinéraire est praticable : les tracés et calculs sont indicatifs.
        </p>
        <ul>
          {SAFETY_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="small">
          Sources utiles :{' '}
          {officialLinksProvider.links.slice(0, 2).map((l, i) => (
            <span key={l.url}>
              {i > 0 && ' · '}
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            </span>
          ))}
          . Urgence : <strong>{EMERGENCY_NUMBER}</strong>.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-large"
          autoFocus
          onClick={() => {
            writePref(KEY, '1');
            setOpen(false);
          }}
          data-testid="disclaimer-accept"
        >
          J’ai compris
        </button>
      </div>
    </div>
  );
}

export function SafetyNote() {
  return (
    <p className="safety-note" role="note">
      <Icon name="alert" size={14} /> Itinéraires indicatifs, jamais garantis praticables : météo, neige et fermetures peuvent tout changer. Vérifiez les conditions locales avant de partir.
    </p>
  );
}
