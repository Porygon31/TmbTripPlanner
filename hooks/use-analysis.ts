"use client";
import { useEffect, useRef, useState } from "react";
import { statistics, profile } from "@/lib/tmb/geo";
import AnalysisWorker from "../workers/route.worker?worker";
import { dailyStatistics } from "@/lib/tmb/stages";
import type {
  Route,
  RoutePoint,
  RouteStatistics,
  ElevationPoint,
} from "@/lib/tmb/types";
export type Analysis = {
  engine?: 'worker'|'fallback';
  stats: RouteStatistics;
  segmentStats: Record<string, RouteStatistics>;
  profile: ElevationPoint[];
  display: Record<string, RoutePoint[]>;
  days: { name: string; stats: RouteStatistics }[];
};
export function useAnalysis(route: Route) {
  const [result, setResult] = useState<Analysis & { forRoute?: Route }>({
    stats: statistics([]),
    segmentStats: {},
    profile: [],
    display: {},
    days: [],
  });
  const worker = useRef<Worker | null>(null),
    revision = useRef(0);
  useEffect(() => {
    try {
      worker.current = new AnalysisWorker();
    } catch {
      worker.current = null;
    }
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, []);
  useEffect(() => {
    const id = ++revision.current;
    const fallback = () =>
      setResult({
        forRoute: route,
        stats: statistics(route.segments),
        segmentStats: Object.fromEntries(route.segments.map(s => [s.id, statistics([s])])),
        profile: profile(route.segments),
        display: {},
        days: dailyStatistics(route),
        engine:'fallback',
      });
    if (!worker.current) {
      fallback();
      return;
    }
    worker.current.onmessage = (
      e: MessageEvent<Analysis & { id: number; error?: string }>,
    ) => {
      if (e.data.id !== revision.current) return;
      if (e.data.error) {
        fallback();
        return;
      }
      setResult({...e.data,engine:'worker',forRoute:route});
    };
    worker.current.onerror = fallback;
    worker.current.postMessage({ id, route });
  }, [route]);
  return { ...result, pending: result.forRoute !== route };
}
