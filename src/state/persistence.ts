import { makeProject, projectStore } from '../services/storage/projectStore';
import { useApp } from './store';

/**
 * Sauvegarde automatique de l'itinéraire en cours (IndexedDB), au plus une fois par seconde :
 * fermer puis rouvrir le site ne fait rien perdre.
 */
export function startAutosave(delay = 1000): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    timer = null;
    const s = useApp.getState();
    if (s.tutorialActive) return;
    const imports = s.imports.map((i) => s.tracks[i.id]).filter(Boolean);
    void projectStore.saveCurrent(makeProject(s.history.present, imports));
  };
  const unsub = useApp.subscribe((s, prev) => {
    if (!s.restored || s.tutorialActive) return;
    if (s.history.present === prev.history.present && s.imports === prev.imports) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, delay);
  });
  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      save();
    }
  };
  window.addEventListener('pagehide', flush);
  return () => {
    unsub();
    window.removeEventListener('pagehide', flush);
  };
}
