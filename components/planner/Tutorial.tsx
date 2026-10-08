"use client";
import { useEffect } from "react";
import { Check, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TUTORIAL_STEPS = [
  { id: "welcome", title: "Apprendre en pratiquant", target: "map", surface: "map", text: "Essayez les vraies commandes dans un parcours temporaire. Votre parcours et son historique seront restaurés en quittant le tutoriel, même si vous vous arrêtez avant la fin.", task: "Suivez les étapes ou choisissez un chapitre dans la liste." },
  { id: "map", title: "Explorer la carte", target: "map-tools", surface: "map", text: "Déplacez la carte en la faisant glisser. Zoomez avec + / −, la molette ou deux doigts. Le menu Relief / Classique change le fond ; la cible demande votre position et le carré ouvre le plein écran.", task: "Essayez de changer le fond et de zoomer autour des Houches." },
  { id: "free", title: "Commencer un parcours libre", target: "free-start", surface: "explore", text: "Explorer réunit le classique et ses variantes. Pour choisir chaque point vous-même, partez d’un parcours libre.", task: "Cliquez sur « Créer un parcours libre » dans la zone surlignée.", required: true },
  { id: "points", title: "Tracer sur les sentiers", target: "map", surface: "map", text: "Le mode Tracer est activé. Un clic place le départ, puis les suivants ajoutent des passages. Le trajet suit les sentiers grâce à OpenRouteService ; une erreur conserve le dernier parcours valide.", task: "Placez deux points proches sur des chemins aux Houches et attendez le tracé orange.", required: true },
  { id: "poi", title: "Passer par un lieu précis", target: "poi", surface: "map", text: "Chaque catégorie possède son symbole et peut être masquée. Les refuges sont affichés pour cet essai : cliquez sur l’un d’eux puis sur « Ajouter au parcours » dans sa fiche. Son nom est repris automatiquement.", task: "Ajoutez un refuge à la suite de votre parcours d’essai.", required: true },
  { id: "classic", title: "Partir du TMB classique", target: "classic-start", surface: "explore", text: "Autre méthode : partez d’une copie du TMB classique, dans le sens antihoraire depuis Les Houches. Ici, cela remplace seulement le parcours d’essai.", task: "Cliquez sur « Personnaliser ce tour ».", required: true },
  { id: "preview", title: "Comparer une variante", target: "variant", surface: "explore", text: "La fiche indique distance, dénivelé, cotation et différence avec le classique remplacé. « Voir la trace » permet de comparer les lignes sans modifier le parcours.", task: "Affichez la trace du Col de Tricot.", required: true },
  { id: "variant", title: "Intégrer la variante", target: "variant", surface: "explore", text: "« Intégrer » remplace uniquement la portion classique entre les raccordements. Plusieurs variantes peuvent coexister ; un chevauchement demande laquelle conserver. « Intégrée » permet de la retirer avant modification.", task: "Intégrez le Col de Tricot à votre tour d’essai.", required: true },
  { id: "insert", title: "Créer un repère sur la variante", target: "map", surface: "map", text: "Pour modifier un endroit précis, utilisez Insérer puis cliquez sur la ligne orange. L’insertion conserve la géométrie d’origine. La carte est centrée sur Tricot et le mode Insérer est prêt.", task: "Cliquez au milieu du tracé orange pour créer un repère de passage.", required: true },
  { id: "move", title: "Modifier une variante", target: "map", surface: "map", text: "Faites glisser le repère vers un sentier voisin : seuls ses tronçons adjacents sont recalculés au relâchement. Mon parcours permet aussi de modifier les coordonnées, puis d’Annuler ou Rétablir les changements.", task: "Déplacez un repère et attendez le nouveau tracé sur les sentiers.", required: true },
  { id: "stage", title: "Organiser les journées", target: "waypoints", surface: "route", text: "Le drapeau termine une étape. Les statistiques journalières et le temps indicatif apparaissent sous les points. Cliquez sur le nom d’un point pour le renommer ou le réordonner ; la corbeille le supprime.", task: "Marquez une fin d’étape avec le drapeau d’un point.", required: true },
  { id: "profile", title: "Lire le relief", target: "profile", surface: "profile", text: "Survolez ou touchez le profil pour retrouver cet endroit sur la carte. Le survol du tracé fonctionne aussi dans l’autre sens. D+ et D− sont filtrés ; les altitudes absentes sont signalées.", task: "Touchez ou survolez le graphique d’altitude.", required: true },
  { id: "save", title: "Sauvegarder et retrouver", target: "save", surface: "route", text: "Le brouillon est normalement sauvegardé automatiquement sur cet appareil. Sauvegarder conserve aussi une copie explicite ; Restaurer le dernier parcours la rappelle après un nouveau départ.", task: "Cliquez sur Sauvegarder : pendant le tutoriel, cette action est simulée pour protéger votre sauvegarde.", required: true },
  { id: "gpx", title: "Importer et exporter un GPX", target: "gpx", surface: "map", text: "Importer accepte un GPX puis affiche son bilan avant « Utiliser cette trace ». Exporter GPX télécharge les coordonnées complètes, altitudes et segments. Vous pouvez exporter cet essai si vous le souhaitez.", task: "Les fichiers importés restent dans votre navigateur. Les fonds et calculs sur sentiers nécessitent Internet." },
  { id: "finish", title: "Vous êtes prêt à préparer votre tour", target: "map", surface: "map", text: "Vous savez partir d’une page blanche ou du classique, combiner et ajuster les variantes, ajouter des lieux, organiser les étapes et conserver un GPX. Vérifiez toujours les conditions locales avant le départ.", task: "Terminer restaure votre parcours personnel. Relancez le tutoriel à tout moment depuis la barre du haut." },
] as const;
export type TutorialStepId = (typeof TUTORIAL_STEPS)[number]["id"];

export default function Tutorial({ step, complete, busy, onChange, onClose }: {
  step: number; complete: boolean; busy: boolean;
  onChange: (step: number) => void; onClose: () => void;
}) {
  const current = TUTORIAL_STEPS[step];
  const required = "required" in current && current.required;
  useEffect(() => {
    let target: Element | null = null;
    const highlight = () => {
      const found = document.querySelector(`[data-tour="${current.target}"]`);
      if (!found || found === target) return;
      target?.classList.remove("tutorial-highlight");
      target = found;
      target.classList.add("tutorial-highlight");
      if (target.closest(".catalog-scroll")) target.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    highlight();
    const observer = new MutationObserver(highlight);
    observer.observe(document.querySelector(".workspace")!, { childList: true, subtree: true });
    document.getElementById("tutorial-title")?.focus({ preventScroll: true });
    return () => { observer.disconnect(); target?.classList.remove("tutorial-highlight"); };
  }, [current.target, current.id]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  return (
    <section className="tutorial-panel" aria-label="Tutoriel interactif">
      <div className="tutorial-progress">
        <span><BookOpen size={17} /> PARCOURS D’ESSAI</span>
        <label htmlFor="tutorial-chapter">Étape {step + 1} sur {TUTORIAL_STEPS.length}</label>
        <select id="tutorial-chapter" aria-label="Étape du tutoriel" value={step} disabled={busy} onChange={event => onChange(+event.target.value)}>
          {TUTORIAL_STEPS.map((item, index) => <option key={item.id} value={index}>{index + 1}. {item.title}</option>)}
        </select>
        <progress max={TUTORIAL_STEPS.length} value={step + 1} aria-label="Progression du tutoriel" />
      </div>
      <div className="tutorial-copy" aria-live="polite">
        <h2 id="tutorial-title" tabIndex={-1}>{current.title}</h2>
        <p>{current.text}</p>
        <p className={complete && required ? "tutorial-task complete" : "tutorial-task"}>
          {complete && required ? <><Check size={17} /> Manipulation réussie. Vous pouvez continuer.</> : current.task}
        </p>
      </div>
      <div className="tutorial-navigation">
        <button className="tutorial-close" onClick={onClose} aria-label="Quitter le tutoriel et restaurer mon parcours"><X size={17} /> Quitter</button>
        <div>
          <Button variant="outline" disabled={step === 0 || busy} onClick={() => onChange(step - 1)}>Précédent</Button>
          <Button disabled={busy || (required && !complete)} onClick={() => step === TUTORIAL_STEPS.length - 1 ? onClose() : onChange(step + 1)}>{step === TUTORIAL_STEPS.length - 1 ? "Terminer" : "Suivant"}</Button>
        </div>
        {required && !complete && <button className="tutorial-skip" disabled={busy} onClick={() => onChange(step + 1)}>Passer cette étape</button>}
      </div>
    </section>
  );
}
