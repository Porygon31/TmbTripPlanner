"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
type Actions = {
  state: () => unknown;
  classic: () => unknown;
  fresh: () => unknown;
  add: (lat: number, lon: number) => unknown;
  variant: (id: string) => unknown;
  export: () => unknown;
};
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: unknown) => unknown;
};
export function useWebMCP(actions: Actions) {
  const ref = useRef(actions);
  useLayoutEffect(() => {
    ref.current = actions;
  }, [actions]);
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    const empty = {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
    const wrap =
      (fn: (v: Record<string, unknown>) => unknown, keys: string[] = []) =>
      async (input: unknown) => {
        if (
          !input ||
          typeof input !== "object" ||
          Array.isArray(input) ||
          Object.keys(input).some((k) => !keys.includes(k))
        )
          throw Error("Paramètres invalides.");
        await fn(input as Record<string, unknown>);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return ref.current.state();
      };
    const tools: Tool[] = [
      {
        name: "get_tmb_state",
        description:
          "Lire le parcours visible, ses points, variantes, segments et erreurs.",
        inputSchema: empty,
        annotations: { readOnlyHint: true },
        execute: () => ref.current.state(),
      },
      {
        name: "start_tmb_classic",
        description:
          "Initialiser une copie du classique. Le parcours actuel reste accessible par Annuler.",
        inputSchema: empty,
        execute: wrap(() => ref.current.classic()),
      },
      {
        name: "start_free_route",
        description:
          "Commencer un parcours libre vide. Le parcours actuel reste accessible par Annuler.",
        inputSchema: empty,
        execute: wrap(() => ref.current.fresh()),
      },
      {
        name: "add_tmb_waypoint",
        description:
          "Ajouter un point au parcours visible et calculer le segment pédestre nécessaire. Les coordonnées sont envoyées à OpenRouteService.",
        inputSchema: {
          type: "object",
          properties: {
            lat: { type: "number", minimum: 45.2, maximum: 46.5 },
            lon: { type: "number", minimum: 6.1, maximum: 7.8 },
          },
          required: ["lat", "lon"],
          additionalProperties: false,
        },
        execute: wrap(
          (v) => {
            if (
              typeof v.lat !== "number" ||
              typeof v.lon !== "number" ||
              v.lat < 45.2 ||
              v.lat > 46.5 ||
              v.lon < 6.1 ||
              v.lon > 7.8
            )
              throw Error("Point hors du massif.");
            return ref.current.add(v.lat, v.lon);
          },
          ["lat", "lon"],
        ),
      },
      {
        name: "toggle_tmb_variant",
        description:
          "Intégrer ou retirer une variante du catalogue. Un chevauchement ouvre le choix visible sans remplacer automatiquement.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              enum: ["9678267", "9678296", "9678375", "9678380", "9678437"],
            },
          },
          required: ["id"],
          additionalProperties: false,
        },
        execute: wrap(
          (v) => {
            if (
              typeof v.id !== "string" ||
              !["9678267", "9678296", "9678375", "9678380", "9678437"].includes(
                v.id,
              )
            )
              throw Error("Variante inconnue.");
            return ref.current.variant(v.id);
          },
          ["id"],
        ),
      },
      {
        name: "download_tmb_gpx",
        description:
          "Télécharger le parcours visible en GPX 1.1 dans le navigateur.",
        inputSchema: empty,
        execute: wrap(() => ref.current.export()),
      },
    ];
    for (const tool of tools)
      try {
        void Promise.resolve(
          ctx.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, []);
}
