let counter = 0;

/** Identifiant unique (suffisant pour un usage local, sans dépendance à crypto). */
export function createId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
