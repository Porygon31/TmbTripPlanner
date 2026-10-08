"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { loadProject, saveProject } from "@/lib/tmb/storage";
import type { Route } from "@/lib/tmb/types";
export function useProjectStorage(
  route: Route,
  replace: (r: Route, record?: boolean) => void,
  onNotice: (s: string) => void,
  paused = false,
) {
  const [ready, setReady] = useState(false),
    [status, setStatus] = useState("Chargement du brouillon…");
  const latest = useRef(route),
    initial = useRef(route.id);
  useLayoutEffect(() => {
    latest.current = route;
  }, [route]);
  useEffect(() => {
    let cancelled = false;
    loadProject("draft")
      .then((saved) => {
        if (cancelled) return;
        if (saved && latest.current.id === initial.current) {
          replace(saved, false);
          onNotice("Votre brouillon a été restauré sur cet appareil.");
        }
        setReady(true);
        setStatus("Brouillon local");
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true);
          setStatus("Stockage indisponible dans ce navigateur");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [replace, onNotice]);
  useEffect(() => {
    if (!ready || paused) return;
    const save = () =>
      saveProject("draft", latest.current)
        .then(() => setStatus("Brouillon enregistré sur cet appareil"))
        .catch(() =>
          setStatus(
            "Sauvegarde impossible : espace local insuffisant ou stockage bloqué",
          ),
        );
    const timer = setTimeout(() => void save(), 400);
    const visibility = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [route, ready, paused]);
  return {
    ready,
    status: paused ? "Parcours d’essai · brouillon personnel préservé" : status,
    flushDraft: () => saveProject("draft", latest.current),
    save: async () => {
      if (paused) {
        onNotice("Sauvegarde simulée : votre parcours personnel reste intact.");
        return;
      }
      try {
        await saveProject("saved", latest.current);
        onNotice("Parcours sauvegardé sur cet appareil.");
      } catch {
        onNotice(
          "Impossible de sauvegarder. Exportez le GPX pour conserver votre parcours.",
        );
      }
    },
    restore: async () => {
      if (paused) {
        onNotice("Quittez le tutoriel pour retrouver votre parcours personnel.");
        return;
      }
      try {
        const saved = await loadProject("saved");
        if (saved) {
          replace(saved);
          onNotice("Dernière sauvegarde restaurée.");
        } else onNotice("Aucune sauvegarde explicite sur cet appareil.");
      } catch {
        onNotice("Le stockage local est indisponible.");
      }
    },
  };
}
