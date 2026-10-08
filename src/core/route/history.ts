/**
 * Historique annuler/rétablir par instantanés immuables.
 * Les instantanés partagent leurs tableaux de points : le coût mémoire reste faible.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { past, present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [next, ...future] = h.future;
  return { past: [...h.past, h.present], present: next, future };
}

/** Applique une transformation à tous les instantanés (ex. résultat de routage arrivé en différé). */
export function patchAll<T>(h: History<T>, fn: (value: T) => T): History<T> {
  return { past: h.past.map(fn), present: fn(h.present), future: h.future.map(fn) };
}
