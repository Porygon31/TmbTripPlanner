const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const km = (m: number) => `${nf1.format(m / 1000)} km`;
export const meters = (m: number | null) => (m === null || !Number.isFinite(m) ? '—' : `${nf0.format(Math.round(m))} m`);
export const count = (n: number) => nf0.format(n);

export function signedKm(m: number | null): string {
  if (m === null) return '—';
  const v = m / 1000;
  if (Math.abs(v) < 0.05) return '± 0,0 km';
  return `${v > 0 ? '+' : '−'} ${nf1.format(Math.abs(v))} km`;
}

export function signedMeters(m: number | null): string {
  if (m === null) return '—';
  if (Math.abs(m) < 1) return '± 0 m';
  return `${m > 0 ? '+' : '−'} ${nf0.format(Math.abs(Math.round(m)))} m`;
}

export function duration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—';
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const min = total % 60;
  return h === 0 ? `${min} min` : `${h} h ${String(min).padStart(2, '0')}`;
}

/** Abscisse sur le TMB, pour nommer une jonction sans nom. */
export const kmOnTmb = (m: number) => `km ${nf1.format(m / 1000)} du TMB`;
