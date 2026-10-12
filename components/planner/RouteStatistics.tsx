"use client";
import { useMemo, useState } from "react";
import { km, meters } from "@/lib/tmb/geo";
import { combineSegmentStatistics, selectRouteSection } from "@/lib/tmb/sections";
import type { Route, RouteStatistics, Waypoint } from "@/lib/tmb/types";
import type { Analysis } from "@/hooks/use-analysis";

export function Stats({ value }: { value: RouteStatistics }) {
  const values = [
    [km(value.distance), "km", "Distance"],
    [value.elevationCoverage ? meters(value.ascent) : "—", "m", "Dénivelé +"],
    [value.elevationCoverage ? meters(value.descent) : "—", "m", "Dénivelé −"],
    [value.minElevation === null ? "—" : meters(value.minElevation), "m", "Altitude min."],
    [value.maxElevation === null ? "—" : meters(value.maxElevation), "m", "Altitude max."],
    [meters(value.pointCount), "", "Points de trace"],
  ];
  return <div className="stats-grid">{values.map(([value, unit, label]) =>
    <div key={label}><strong>{value}{unit && <small> {unit}</small>}</strong><span>{label}</span></div>
  )}</div>;
}

export default function RouteStatisticsPanel({ route, analysis }: {
  route: Route;
  analysis: Analysis & { pending: boolean };
}) {
  const [selection, setSelection] = useState<{ from: string; to: string } | null>(null);
  const section = useMemo(() => selection ? selectRouteSection(route, selection.from, selection.to) : null, [route, selection]);
  const value = useMemo(() => section ? combineSegmentStatistics(section, analysis.segmentStats) : analysis.stats, [section, analysis.segmentStats, analysis.stats]);
  const fromIds = new Set(route.segments.map(s => s.from));
  const toIds = new Set(route.segments.map(s => s.to));
  const starts = route.waypoints.filter(w => fromIds.has(w.id));
  const startIndex = section ? route.waypoints.findIndex(w => w.id === selection?.from) : -1;
  const ends = route.waypoints.filter((w, i) => i > startIndex && toIds.has(w.id));
  const label = (w: Waypoint) => w.id === route.roundTrip?.arrivalId
    ? "Arrivée · retour au départ"
    : `${route.waypoints.indexOf(w) + 1}. ${w.name}`;
  const chooseStart = (from: string) => {
    const index = route.waypoints.findIndex(w => w.id === from);
    const to = selection && selectRouteSection(route, from, selection.to)
      ? selection.to
      : route.waypoints.find((w, i) => i > index && toIds.has(w.id))?.id;
    if (to) setSelection({ from, to });
  };
  const pending = analysis.pending || value === null;
  return <section className="route-statistics" aria-label="Statistiques du parcours" aria-busy={pending}>
    <div className="stats-scope" role="group" aria-label="Portée des statistiques">
      <button type="button" aria-pressed={!section} onClick={() => setSelection(null)}>Parcours entier</button>
      <button type="button" aria-pressed={!!section} disabled={!route.segments.length} onClick={() => {
        const first = route.segments[0];
        if (!section && first) setSelection({ from: first.from, to: first.to });
      }}>Entre deux points</button>
    </div>
    {section && selection && <div className="stats-range">
      <label>De<select aria-label="Point de début" value={selection.from} onChange={e => chooseStart(e.target.value)}>
        {starts.map(w => <option key={w.id} value={w.id}>{label(w)}</option>)}
      </select></label>
      <label>À<select aria-label="Point de fin" value={selection.to} onChange={e => setSelection({ ...selection, to: e.target.value })}>
        {ends.map(w => <option key={w.id} value={w.id}>{label(w)}</option>)}
      </select></label>
      <p>{section.length} tronçon{section.length > 1 ? "s" : ""} · dans le sens du parcours</p>
    </div>}
    {selection && !section && <p className="stats-note">Les points sélectionnés ont changé. Le bilan du parcours entier est affiché ; choisissez une nouvelle portion.</p>}
    <div aria-live="polite" aria-atomic="true">
      {pending ? <p className="stats-note" role="status">Calcul des statistiques…</p> : <>
        <Stats value={value!} />
        {!!value!.pointCount && <div className="stats-walking">
          <span>Marche indicative{section ? " sur cette portion" : ""}</span>
          <strong>{value!.elevationCoverage === 1 ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value!.hours)} h` : "—"}</strong>
          <small>{value!.elevationCoverage === 1 ? "Distance / 4 + D+ / 600, hors pauses." : "Altitudes complètes nécessaires pour estimer la durée."}</small>
        </div>}
        {value!.pointCount > 0 && value!.elevationCoverage < 1 && <div className="inline-warning">
          Altitudes {value!.elevationCoverage === 0 ? "absentes" : `partielles (${Math.round(value!.elevationCoverage * 100)} %)`} : D+ et D− {value!.elevationCoverage === 0 ? "indisponibles" : "incomplets"}.
        </div>}
        {value!.gaps > 0 && <div className="inline-warning">{value!.gaps} rupture(s) de trace conservée(s). Les distances entre segments séparés ne sont pas comptées.</div>}
      </>}
    </div>
    {section && <p className="stats-note">Le profil sous la carte présente le parcours entier.</p>}
  </section>;
}
