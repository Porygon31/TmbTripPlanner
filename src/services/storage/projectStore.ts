import { del, get, set } from 'idb-keyval';
import type { Route, Track } from '../../core/types';

/** Projet sauvegardé localement (IndexedDB) : aucun compte, rien n'est envoyé sur un serveur. */
export interface StoredProject {
  version: 1;
  route: Route;
  /** Traces importées par l'utilisateur (nécessaires pour rouvrir l'itinéraire). */
  imports: Track[];
  savedAt: string;
}

export interface SavedEntry {
  id: string;
  name: string;
  savedAt: string;
  project: StoredProject;
}

const CURRENT = 'project:current';
const LAST = 'project:last';
const SAVES = 'project:saves';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export function makeProject(route: Route, imports: Track[]): StoredProject {
  return { version: 1, route, imports, savedAt: new Date().toISOString() };
}

function isProject(v: unknown): v is StoredProject {
  return !!v && typeof v === 'object' && (v as StoredProject).version === 1 && !!(v as StoredProject).route;
}

export const projectStore = {
  /** Sauvegarde automatique de l'itinéraire en cours. */
  saveCurrent: (p: StoredProject) => safe(() => set(CURRENT, p), undefined),
  loadCurrent: () => safe(async () => {
    const v = await get(CURRENT);
    return isProject(v) ? v : null;
  }, null),
  /** Dernier parcours mis de côté (avant « Nouveau parcours » ou à chaque « Sauvegarder »). */
  saveLast: (p: StoredProject) => safe(() => set(LAST, p), undefined),
  loadLast: () => safe(async () => {
    const v = await get(LAST);
    return isProject(v) ? v : null;
  }, null),
  listSaves: () => safe(async () => ((await get(SAVES)) as SavedEntry[] | undefined) ?? [], [] as SavedEntry[]),
  async addSave(name: string, p: StoredProject): Promise<SavedEntry[]> {
    const saves = await projectStore.listSaves();
    const entry: SavedEntry = { id: `${Date.now()}`, name, savedAt: p.savedAt, project: p };
    const next = [entry, ...saves].slice(0, 30);
    await safe(() => set(SAVES, next), undefined);
    return next;
  },
  async deleteSave(id: string): Promise<SavedEntry[]> {
    const next = (await projectStore.listSaves()).filter((s) => s.id !== id);
    await safe(() => set(SAVES, next), undefined);
    return next;
  },
  clearCurrent: () => safe(() => del(CURRENT), undefined),
};

/** Préférences légères (localStorage, protégé contre les navigateurs qui le bloquent). */
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`tmb:${key}`);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(`tmb:${key}`) === '1';
  } catch {
    return false;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`tmb:${key}`, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // ignore
  }
}
