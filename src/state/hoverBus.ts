/**
 * Canal de survol carte ↔ profil, volontairement hors de React :
 * le survol déclenche jusqu'à 60 événements/s, qui ne doivent pas re-rendre l'interface.
 */
export interface HoverEvent {
  source: 'map' | 'profile';
  /** Cible du profil (`route` ou identifiant de trace). */
  target: string;
  /** Indice du point survolé dans la géométrie de la cible, ou `null` pour effacer. */
  index: number | null;
  /** Intervalle de distance à mettre en évidence (m), ex. le segment survolé. */
  band?: [number, number] | null;
}

type Listener = (e: HoverEvent) => void;
const listeners = new Set<Listener>();
let frame = 0;
let pending: HoverEvent | null = null;

export const hoverBus = {
  /** Publie au plus une fois par image (requestAnimationFrame). */
  emit(e: HoverEvent) {
    pending = e;
    if (frame) return;
    const flush = () => {
      frame = 0;
      const ev = pending;
      pending = null;
      if (ev) listeners.forEach((l) => l(ev));
    };
    frame = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(flush) : (setTimeout(flush, 16) as unknown as number);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
