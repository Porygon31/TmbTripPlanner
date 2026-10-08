import type { RouteStatistics } from '../../core/types';
import { count, duration, km, meters } from '../../ui/format';

export function StatsGrid({ stats, compact = false, showPoints = false }: { stats: RouteStatistics; compact?: boolean; showPoints?: boolean }) {
  const noEle = stats.elevationCoverage === 0;
  const items: [string, string, string][] = [
    ['Distance', km(stats.distance), 'distance'],
    ['D+', noEle ? '—' : meters(stats.ascent), 'ascent'],
    ['D−', noEle ? '—' : meters(stats.descent), 'descent'],
    ['Alt. min', meters(stats.minEle), 'min'],
    ['Alt. max', meters(stats.maxEle), 'max'],
    ['Temps*', duration(stats.durationHours), 'time'],
  ];
  if (showPoints) items.push(['Points', count(stats.pointCount), 'points']);
  return (
    <dl className={`stats-grid ${compact ? 'compact' : ''}`}>
      {items.map(([label, value, key]) => (
        <div key={key} className="stat" data-stat={key}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const TIME_NOTE = '* Temps de marche indicatif (norme DIN 33466 : 4 km/h, 300 m/h en montée, 500 m/h en descente), hors pauses.';
