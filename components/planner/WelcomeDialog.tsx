"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { ArrowRight, BookOpen, Map, Mountain, Route, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WELCOME_SEEN = "tmb-atelier:welcome-seen:v1";
const WELCOME_CHANGED = "tmb-welcome-changed";
let welcomeSeenInSession = false;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("popstate", callback);
  window.addEventListener(WELCOME_CHANGED, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener(WELCOME_CHANGED, callback);
  };
}

function getEntrySnapshot() {
  if (new URL(window.location.href).searchParams.get("tutoriel") === "1") return "tutorial";
  if (welcomeSeenInSession) return "seen";
  try { return localStorage.getItem(WELCOME_SEEN) === "1" ? "seen" : "welcome"; }
  catch { return "welcome"; }
}

// Keep the server HTML and the first hydration render identical.
const getServerSnapshot = () => "pending" as const;

function rememberWelcome() {
  welcomeSeenInSession = true;
  try { localStorage.setItem(WELCOME_SEEN, "1"); } catch { /* The map remains usable when browser storage is blocked. */ }
  window.dispatchEvent(new Event(WELCOME_CHANGED));
}

export default function WelcomeDialog({ ready, onStartTutorial }: {
  ready: boolean;
  onStartTutorial: () => Promise<void>;
}) {
  const entry = useSyncExternalStore(subscribe, getEntrySnapshot, getServerSnapshot);
  const open = entry === "welcome";
  const handledRequest = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (entry !== "tutorial" || !ready || handledRequest.current) return;
    handledRequest.current = true;
    // Consume the help page's link once, after the catalogue and draft are ready.
    const url = new URL(window.location.href);
    url.searchParams.delete("tutoriel");
    window.history.replaceState(window.history.state, "", url);
    rememberWelcome();
    void onStartTutorial();
  }, [entry, ready, onStartTutorial]);

  const dismiss = rememberWelcome;

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) dismiss(); }}>
      <DialogContent className="welcome-dialog" onOpenAutoFocus={event => {
        event.preventDefault();
        title.current?.focus();
      }} onCloseAutoFocus={event => {
        event.preventDefault();
        document.getElementById("open-tutorial")?.focus();
      }}>
        <div className="welcome-emblem" aria-hidden="true"><Mountain size={30} /></div>
        <DialogHeader>
          <span className="eyebrow">VOTRE AVENTURE COMMENCE ICI</span>
          <DialogTitle ref={title} tabIndex={-1}>Bienvenue dans TMB Atelier</DialogTitle>
          <DialogDescription>
            Prenez la carte en main avec notre tutoriel interactif. Il vous guide pas à pas pour préparer votre Tour du Mont-Blanc.
          </DialogDescription>
        </DialogHeader>
        <ul className="welcome-topics">
          <li><Map aria-hidden="true" /><span>Explorer la carte et les lieux utiles</span></li>
          <li><Route aria-hidden="true" /><span>Créer un parcours et modifier une variante</span></li>
          <li><BookOpen aria-hidden="true" /><span>Organiser vos étapes, sauvegarder et exporter</span></li>
        </ul>
        <p className="welcome-reassurance"><ShieldCheck size={18} aria-hidden="true" /> Vous vous entraînez sur un parcours d’essai. Votre parcours personnel est préservé.</p>
        <div className="welcome-actions">
          <Button disabled={!ready} onClick={() => { dismiss(); void onStartTutorial(); }}>
            <BookOpen /> Découvrir le tutoriel <ArrowRight />
          </Button>
          <Button variant="outline" onClick={dismiss}>Explorer librement</Button>
        </div>
        <p className="welcome-footer">
          Vous préférez lire ? <a href="/aide" target="_blank" rel="noopener noreferrer" onClick={dismiss}>Ouvrir le guide d’utilisation <span className="sr-only">(nouvel onglet)</span>↗</a>
          <span>Retrouvez ensuite Tutoriel et Aide en haut de la carte.</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
