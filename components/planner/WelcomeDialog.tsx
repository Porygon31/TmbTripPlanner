"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Map, Mountain, Route, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WELCOME_SEEN = "tmb-atelier:welcome-seen:v1";

function rememberWelcome() {
  try { localStorage.setItem(WELCOME_SEEN, "1"); } catch { /* The map remains usable when browser storage is blocked. */ }
}

export default function WelcomeDialog({ ready, onStartTutorial }: {
  ready: boolean;
  onStartTutorial: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [requestedTutorial, setRequestedTutorial] = useState(false);
  const handledRequest = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tutoriel") === "1") {
      // Consume the help page's link once, after the catalogue and draft are ready.
      url.searchParams.delete("tutoriel");
      window.history.replaceState(window.history.state, "", url);
      rememberWelcome();
      setRequestedTutorial(true);
      return;
    }
    try { setOpen(localStorage.getItem(WELCOME_SEEN) !== "1"); }
    catch { setOpen(true); }
  }, []);

  useEffect(() => {
    if (!requestedTutorial || !ready || handledRequest.current) return;
    handledRequest.current = true;
    setRequestedTutorial(false);
    void onStartTutorial();
  }, [requestedTutorial, ready, onStartTutorial]);

  const dismiss = () => { rememberWelcome(); setOpen(false); };

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
