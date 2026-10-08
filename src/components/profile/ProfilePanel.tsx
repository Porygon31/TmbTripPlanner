import { useMemo, useState } from 'react';
import { computeStatistics } from '../../core/elevation/stats';
import { routeStatistics } from '../../core/route/stats';
import { effectiveTarget, targetGeometry } from '../../state/selectors';
import { MAIN_ID, ROUTE_TARGET, useApp } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { StatsGrid } from '../panels/StatsGrid';
import { ROUTE_COLOR } from '../map/RouteLayer';
import { TMB_COLOR } from '../map/TrackLayers';
import { ElevationProfile } from './ElevationProfile';

export function ProfilePanel({ embedded = false }: { embedded?: boolean }) {
  const route = useApp((s) => s.history.present);
  const tracks = useApp((s) => s.tracks);
  const catalog = useApp((s) => s.catalog);
  const imports = useApp((s) => s.imports);
  const [open, setOpen] = useState(true);

  // Si l'itinéraire est vide, on montre le TMB (s'il est chargé).
  const effective = useApp(effectiveTarget);
  const geometry = useMemo(
    () => targetGeometry(useApp.getState(), effective),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effective, route.segments, route.waypoints, tracks],
  );
  const stats = useMemo(() => {
    if (effective === ROUTE_TARGET) return route.waypoints.length >= 2 ? routeStatistics(route) : null;
    return geometry ? computeStatistics(geometry.points, geometry.cum) : null;
  }, [effective, route, geometry]);

  const color =
    effective === ROUTE_TARGET
      ? ROUTE_COLOR
      : effective === MAIN_ID
        ? TMB_COLOR
        : (catalog?.variants.find((v) => v.id === effective)?.color ?? imports.find((i) => i.id === effective)?.color ?? ROUTE_COLOR);
  const name = effective === ROUTE_TARGET ? route.name : (useApp.getState().trackName(effective) ?? '');

  const options: { id: string; label: string }[] = [{ id: ROUTE_TARGET, label: `Mon itinéraire` }];
  if (tracks[MAIN_ID]) options.push({ id: MAIN_ID, label: catalog?.main?.name ?? 'TMB' });
  for (const v of catalog?.variants ?? []) if (tracks[v.id]) options.push({ id: v.id, label: v.name });
  for (const i of imports) options.push({ id: i.id, label: `${i.name} (import)` });

  return (
    <section className={`profile-panel ${open ? '' : 'collapsed'} ${embedded ? 'embedded' : ''}`} aria-label="Profil altimétrique">
      <header className="profile-header">
        <div className="profile-title">
          <Icon name="chart" />
          <label className="sr-only" htmlFor="profile-target">
            Profil affiché
          </label>
          <select
            id="profile-target"
            value={effective}
            onChange={(e) => useApp.getState().setProfileTarget(e.target.value)}
            className="select-inline"
            data-testid="profile-target"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {stats && <StatsGrid stats={stats} compact />}
        {!embedded && (
          <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Replier le profil' : 'Déplier le profil'}>
            <Icon name={open ? 'down' : 'up'} />
          </button>
        )}
      </header>
      {open && (
        <div className="profile-body">
          {geometry && geometry.points.length > 1 ? (
            geometry.points.some((p) => p.ele !== null) ? (
              <ElevationProfile key={effective} target={effective} geometry={geometry} color={color} />
            ) : (
              <p className="profile-empty">« {name} » : pas d’altitude disponible pour ce tracé.</p>
            )
          ) : (
            <p className="profile-empty">
              Le profil altimétrique apparaîtra ici dès que votre itinéraire comptera deux points. Activez « Créer mon itinéraire » puis touchez la carte.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
