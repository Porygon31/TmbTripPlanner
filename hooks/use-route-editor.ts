"use client";
import { useCallback, useRef, useState } from "react";
import { appendVariant, EditCoordinator, recalculate, setRoundTrip } from "@/lib/tmb/editor";
import { linkedWaypoints, routeStops } from "@/lib/tmb/loop";
import {
  composeTmb,
  integrateVariant,
  newRoute,
  removeVariant,
  splitSegment,
} from "@/lib/tmb/catalog";
import { nearestIndex, uid } from "@/lib/tmb/geo";
import { routingProvider } from "@/lib/tmb/routing";
import type {
  Catalog,
  Route,
  RoutePoint,
  TmbVariant,
  Waypoint,
} from "@/lib/tmb/types";
export function useRouteEditor() {
  const [route, setRoute] = useState<Route>(newRoute);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Route[]>([]);
  const [future, setFuture] = useState<Route[]>([]);
  const current = useRef(route);
  const coordinator = useRef(new EditCoordinator());
  const actionVersion = useRef(0);
  const practiceBackup = useRef<{ route: Route; history: Route[]; future: Route[] } | null>(null);
  const commit = useCallback((next: Route, record = true) => {
    if (next.roundTrip) next = { ...next, waypoints: linkedWaypoints(next, next.waypoints) };
    const previous = current.current;
    if (record) {
      setHistory((h) => [...h.slice(-24), previous]);
      setFuture([]);
    }
    current.current = next;
    setRoute(next);
    setError("");
  }, []);
  const cancel = useCallback(() => {
    coordinator.current.cancel();
    actionVersion.current++;
    setBusy(false);
  }, []);
  const replace = useCallback(
    (next: Route, record = true) => {
      cancel();
      commit(next, record);
    },
    [cancel, commit],
  );
  const perform = useCallback(
    async (operation: (signal: AbortSignal) => Promise<Route>) => {
      const version = ++actionVersion.current;
      setBusy(true);
      setError("");
      try {
        return await coordinator.current.run(operation, commit);
      } catch (e) {
        if (
          version === actionVersion.current &&
          (e as Error).name !== "AbortError"
        )
          setError((e as Error).message);
        return false;
      } finally {
        if (version === actionVersion.current) setBusy(false);
      }
    },
    [commit],
  );
  const change = useCallback(
    (waypoints: Waypoint[]) =>
      perform((signal) =>
        recalculate(current.current, waypoints, routingProvider, signal),
      ),
    [perform],
  );
  const move = useCallback(
    (id: string, p: RoutePoint) =>
      change(
        current.current.waypoints.map((w) =>
          w.id === id ? { ...w, ...p, ele: undefined } : w,
        ),
      ),
    [change],
  );
  const add = useCallback(
    (p: RoutePoint, name?: string) => {
      const r = current.current;
      const stops = routeStops(r);
      const w = { ...p, id: uid(), name: name?.trim().slice(0, 120) || `Point ${stops.length + 1}` };
      if (!r.waypoints.length) {
        replace({ ...r, waypoints: [w] });
        return true;
      }
      return change([...stops, w]);
    },
    [change, replace],
  );
  const insert = useCallback(
    (p: RoutePoint) => {
      const r = current.current;
      let best = { segment: "", index: 0, d: Infinity };
      r.segments.forEach((s) => {
        const n = nearestIndex(s.points, p);
        if (n.distance < best.d)
          best = { segment: s.id, index: n.index, d: n.distance };
      });
      if (!best.segment || best.d > 250) {
        setError("Cliquez sur le tracé pour insérer un point.");
        return;
      }
      replace(splitSegment(r, best.segment, best.index));
    },
    [replace],
  );
  const variant = useCallback(
    (v: TmbVariant, catalog: Catalog, replaceConflicts: string[] = []) => {
      const r = current.current;
      if (r.variantIds.includes(v.id)) {
        if (r.mode !== "tmb") {
          setError("Cette variante est déjà intégrée au parcours.");
          return;
        }
        try {
          replace(removeVariant(r, v, catalog));
        } catch (e) {
          setError((e as Error).message);
        }
        return;
      }
      if (r.mode === "tmb") {
        try {
          let updated = r;
          for (const id of replaceConflicts) {
            const old = catalog.variants.find((x) => x.id === id)!;
            updated = removeVariant(updated, old, catalog);
          }
          replace(integrateVariant(updated, v));
        } catch (e) {
          setError((e as Error).message);
        }
        return;
      }
      return perform(signal => appendVariant(r, v, routingProvider, signal));
    },
    [perform, replace],
  );
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    cancel();
    setHistory((h) => h.slice(0, -1));
    const old = current.current;
    setFuture((f) => [old, ...f]);
    commit(previous, false);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    cancel();
    setFuture((f) => f.slice(1));
    const old = current.current;
    setHistory((h) => [...h, old]);
    commit(next, false);
  };
  return {
    route,
    busy,
    error,
    setError,
    replace,
    move,
    add,
    insert,
    change,
    roundTrip: (enabled: boolean) => perform(signal => setRoundTrip(current.current, enabled, routingProvider, signal)),
    variant,
    undo,
    redo,
    canUndo: !!history.length,
    canRedo: !!future.length,
    classic: (c: Catalog) => replace(composeTmb(c, [])),
    fresh: () => replace(newRoute()),
    beginPractice: () => {
      if (practiceBackup.current) return;
      practiceBackup.current = { route: current.current, history, future };
      cancel();
      commit({ ...newRoute(), name: "Parcours d’essai · Tutoriel" }, false);
      setHistory([]);
      setFuture([]);
    },
    endPractice: () => {
      const saved = practiceBackup.current;
      if (!saved) return;
      cancel();
      commit(saved.route, false);
      setHistory(saved.history);
      setFuture(saved.future);
      practiceBackup.current = null;
    },
  };
}
