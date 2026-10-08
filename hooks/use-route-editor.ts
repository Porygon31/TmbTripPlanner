"use client";
import { useCallback, useRef, useState } from "react";
import { EditCoordinator, recalculate, routedSource } from "@/lib/tmb/editor";
import {
  composeTmb,
  integrateVariant,
  newRoute,
  removeVariant,
  splitSegment,
  variantPieces,
} from "@/lib/tmb/catalog";
import { distance, nearestIndex, uid } from "@/lib/tmb/geo";
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
  const commit = useCallback((next: Route, record = true) => {
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
        await coordinator.current.run(operation, commit);
      } catch (e) {
        if (
          version === actionVersion.current &&
          (e as Error).name !== "AbortError"
        )
          setError((e as Error).message);
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
    (p: RoutePoint) => {
      const r = current.current;
      const w = { ...p, id: uid(), name: `Point ${r.waypoints.length + 1}` };
      if (!r.waypoints.length) {
        replace({ ...r, waypoints: [w] });
        return;
      }
      return change([...r.waypoints, w]);
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
      return perform(async (signal) => {
        let points = v.points;
        const last = r.waypoints.at(-1);
        if (last && distance(last, points.at(-1)!) < distance(last, points[0]))
          points = [...points].reverse();
        const entry = { ...points[0], id: uid(), name: `${v.name} · entrée` };
        const segments = [...r.segments],
          waypoints = [...r.waypoints];
        let from = last;
        if (last && distance(last, entry) > 0.5) {
          const connector = await routingProvider.route(last, entry, signal);
          segments.push({
            id: uid(),
            points: connector,
            from: last.id,
            to: entry.id,
            source: routedSource,
          });
          waypoints.push(entry);
          from = entry;
        } else if (!last) {
          waypoints.push(entry);
          from = entry;
        }
        for (const piece of variantPieces(v, points[0])) {
          const exit = {
            ...piece.points.at(-1)!,
            id: uid(),
            name: `${v.name} · ${piece.source.kind === "routing" ? "raccord" : "sortie"}`,
          };
          segments.push({
            id: uid(),
            points: piece.points,
            from: from!.id,
            to: exit.id,
            source: piece.source,
            variantId: v.id,
          });
          waypoints.push(exit);
          from = exit;
        }
        return {
          ...r,
          segments,
          waypoints,
          variantIds: [...r.variantIds, v.id],
          updatedAt: new Date().toISOString(),
        };
      });
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
    variant,
    undo,
    redo,
    canUndo: !!history.length,
    canRedo: !!future.length,
    classic: (c: Catalog) => replace(composeTmb(c, [])),
    fresh: () => replace(newRoute()),
  };
}
