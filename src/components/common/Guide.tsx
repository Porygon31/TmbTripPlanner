import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createHistory } from '../../core/route/history';
import { emptyRoute } from '../../core/route/operations';
import { makeProject, projectStore, readFlag, writePref } from '../../services/storage/projectStore';
import { MAIN_ID, useApp, type AppState, type PanelId } from '../../state/store';
import { Icon } from '../../ui/Icon';

// Le guide et le tutoriel partagent leurs explications pour rester cohérents.
const CHAPTERS: { title: string; text: string; task: string; target: string; panel?: PanelId }[] = [
  { title: 'Apprendre en pratiquant', text: 'Essayez les commandes dans un parcours temporaire. Votre parcours et son historique seront restaurés en quittant le tutoriel. Même si vous fermez cette page, votre brouillon personnel reste conservé.', task: 'Suivez les étapes ou choisissez un chapitre dans la liste.', target: '.map-wrap' },
  { title: 'Explorer la carte', text: 'Faites glisser la carte pour vous déplacer. Zoomez avec + / −, la molette ou deux doigts. Classique permet de choisir un autre fond. La cible demande votre position et le carré ouvre le plein écran.', task: 'Zoomez autour des Houches, le départ du TMB classique.', target: '[data-tour="map-tools"]' },
  { title: 'Créer un parcours libre', text: 'Dans Explorer, le bouton Créer un parcours libre ouvre Mon parcours. Tracer ajoute des points ; Explorer permet de parcourir la carte sans modifier votre itinéraire.', task: 'Cliquez sur Tracer au-dessus de la carte.', target: '[data-tour="map"]' },
  { title: 'Tracer sur les sentiers', text: 'Le premier clic place votre départ, les suivants ajoutent les points de passage. Le trajet orange suit les sentiers grâce au moteur de randonnée. Attendez la fin du calcul. En cas d’erreur, réessayez depuis la liste des points.', task: 'Placez deux points proches sur des chemins autour des Houches.', target: '.map-wrap' },
  { title: 'Ajouter un lieu', text: 'La légende en bas à droite affiche les refuges, hôtels, cols, sommets et villages. Cliquez sur un symbole pour ouvrir sa fiche, puis sur Ajouter au parcours. Les hébergements disposent d’un lien vers leur site lorsqu’il est renseigné.', task: 'Activez Refuges et ajoutez un refuge depuis sa fiche.', target: '.poi-legend' },
  { title: 'Partir du TMB classique', text: 'Personnaliser ce tour prépare une copie de la boucle classique, dans le sens antihoraire depuis Les Houches. Vous pouvez ensuite remplacer certaines portions par des variantes.', task: 'Cliquez sur Personnaliser ce tour dans la fiche du classique.', target: '[data-tour="classic"]', panel: 'variants' },
  { title: 'Comparer une variante', text: 'Chaque fiche indique sa distance, son dénivelé, sa difficulté et son écart avec la portion classique remplacée. Voir la trace affiche cette variante dans sa couleur sans modifier votre parcours. Détails et sources donne accès au profil et au zoom.', task: 'Affichez la trace du Col de Tricot.', target: '[data-tour="variant"]', panel: 'variants' },
  { title: 'Intégrer la variante', text: 'Dans la fiche du Col de Tricot, cliquez sur + Intégrer. La variante remplace seulement la portion classique entre ses deux raccordements ; le reste du tour est conservé. Le tracé orange et ses statistiques se mettent à jour. Le bouton Intégrée permet de retirer la variante. Si deux variantes se chevauchent, retirez d’abord celle que vous ne souhaitez pas garder.', task: 'Intégrez le Col de Tricot, puis passez à la suite pour modifier son tracé.', target: '[data-tour="variant"]', panel: 'variants' },
  { title: 'Insérer un point', text: 'Activez Tracer, zoomez sur la portion à modifier et cliquez directement sur la ligne orange. Un repère apparaît à cet endroit en conservant la géométrie du sentier.', task: 'Créez un repère sur la variante intégrée.', target: '.map-wrap' },
  { title: 'Modifier une variante', text: 'Faites glisser ce repère vers un sentier voisin. Au relâchement, seuls les deux tronçons voisins sont recalculés. Les autres portions conservent leurs points. Annuler et Rétablir permettent de comparer vos essais.', task: 'Déplacez un repère et attendez le nouveau tracé.', target: '.map-wrap' },
  { title: 'Organiser les journées', text: 'Dans Mon parcours, le drapeau d’un point intermédiaire marque une fin d’étape. Le tableau des journées affiche les distances, dénivelés et temps indicatifs. Vous pouvez renommer, supprimer ou réordonner les points.', task: 'Marquez une fin d’étape avec le drapeau d’un point.', target: '[data-testid="waypoint-list"]', panel: 'route' },
  { title: 'Lire le relief', text: 'Survolez ou touchez le graphique pour repérer ce lieu sur la carte. Le survol du tracé fonctionne aussi dans l’autre sens. Le menu du profil permet de comparer votre parcours, le classique et les variantes chargées.', task: 'Explorez le profil altimétrique.', target: '.profile-panel', panel: 'route' },
  { title: 'Sauvegarder et retrouver', text: 'Le brouillon est enregistré automatiquement sur cet appareil. Sauvegarder conserve également une copie nommée. Nouveau parcours met de côté le précédent ; Restaurer le dernier parcours le rappelle. Pendant cet exercice, la sauvegarde est simulée pour protéger vos données.', task: 'Cliquez sur Sauvegarder dans Mon parcours.', target: '[data-tour="save"]', panel: 'route' },
  { title: 'Importer et exporter un GPX', text: 'Exporter GPX, en haut à droite, télécharge votre parcours avec ses coordonnées complètes, ses altitudes et ses étapes. Sur téléphone, ce bouton apparaît sous la forme d’une flèche de téléchargement. Importer, juste à côté, affiche le bilan d’un fichier GPX avant de l’utiliser comme base.', task: 'Vous pouvez exporter votre parcours d’essai avec le bouton encadré en orange.', target: '[data-tour="export"]' },
  { title: 'Prêt à préparer votre tour', text: 'Vous savez créer votre parcours, comparer les variantes, ajouter des lieux, organiser les journées et exporter un GPX. Avant de partir, vérifiez météo, neige, fermetures et conditions locales auprès des acteurs du massif.', task: 'Terminer restaure votre parcours personnel. Vous pouvez relancer ce tutoriel à tout moment.', target: '.map-wrap' },
];

type Snapshot = Pick<AppState, 'history' | 'imports' | 'visible' | 'profileTarget' | 'panel' | 'sheet' | 'mode' | 'selectedTrack'>;

export function Guide() {
  const [welcome, setWelcome] = useState(() => !readFlag('disclaimer-v1'));
  const [help, setHelp] = useState(false);
  const [step, setStep] = useState(0);
  const [starting, setStarting] = useState(false);
  const active = useApp((s) => s.tutorialActive);
  const ready = useApp((s) => s.restored && !!s.catalog);
  const snapshot = useRef<Snapshot | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const chapter = CHAPTERS[step];

  const dismiss = () => { writePref('disclaimer-v1', '1'); setWelcome(false); };
  const start = async () => {
    if (!ready || starting) return;
    setStarting(true);
    const s = useApp.getState();
    await projectStore.saveCurrent(makeProject(s.history.present, s.imports.map((i) => s.tracks[i.id]).filter(Boolean)));
    snapshot.current = { history: s.history, imports: s.imports, visible: s.visible, profileTarget: s.profileTarget, panel: s.panel, sheet: s.sheet, mode: s.mode, selectedTrack: s.selectedTrack };
    useApp.setState({ tutorialActive: true, history: createHistory(emptyRoute('Mon parcours d’essai')), imports: [], panel: 'variants', mode: 'view', sheet: 'peek', selectedTrack: null });
    setStep(0); setHelp(false); dismiss(); setStarting(false);
  };
  const close = () => {
    if (snapshot.current) useApp.setState({ ...snapshot.current, tutorialActive: false });
    snapshot.current = null;
    document.getElementById('open-tutorial')?.focus();
  };
  const changeStep = (next: number) => {
    setStep(next);
    const s = useApp.getState();
    const ch = CHAPTERS[next];
    if (ch.panel) s.setPanel(ch.panel);
    else s.setSheet('peek');
    if ([2, 3, 8, 9].includes(next)) s.setMode('edit');
    if (next === 6) s.focusTrack(MAIN_ID);
  };

  useEffect(() => {
    const el = dialog.current;
    if ((welcome || help) && el && !el.open) el.showModal();
    else if (!welcome && !help) el?.close();
  }, [welcome, help]);
  useEffect(() => {
    if (!active) return;
    const app = document.querySelector<HTMLElement>('.app')!;
    const panel = app.querySelector<HTMLElement>('.tutorial-panel')!;
    // La place réservée suit le texte réellement affiché, notamment sur téléphone.
    const observer = new ResizeObserver(() => app.style.setProperty('--tutorial-height', `${panel.getBoundingClientRect().height}px`));
    observer.observe(panel);
    return () => { observer.disconnect(); app.style.removeProperty('--tutorial-height'); };
  }, [active]);
  useEffect(() => {
    if (!active) return;
    let target: Element | null = null;
    const highlight = () => {
      const found = document.querySelector(chapter.target);
      if (found === target) return;
      target?.classList.remove('tutorial-highlight');
      target = found;
      target?.classList.add('tutorial-highlight');
      if (target?.closest('.panel-scroll')) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    highlight();
    const observer = new MutationObserver(highlight);
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
    return () => { observer.disconnect(); target?.classList.remove('tutorial-highlight'); };
  }, [active, chapter]);

  return <>
    <button className="btn" onClick={() => setHelp(true)} aria-label="Aide"><Icon name="info" size={16} /><span>Aide</span></button>
    <button className="btn" id="open-tutorial" onClick={() => void start()} disabled={!ready || active || starting} aria-label="Tutoriel"><Icon name="book" size={16} /><span>Tutoriel</span></button>
    <dialog ref={dialog} className={`guide-dialog ${help ? 'help-dialog' : ''}`} onCancel={() => { setHelp(false); dismiss(); }} aria-labelledby="guide-title">
      <button className="icon-btn dialog-close" onClick={() => { setHelp(false); dismiss(); }} aria-label="Fermer l’aide"><Icon name="close" /></button>
      <span className="welcome-emblem"><Icon name="mountain" size={30} /></span>
      <span className="eyebrow">VOTRE AVENTURE COMMENCE ICI</span>
      <h2 id="guide-title">{help ? 'Le guide de TMB Atelier' : 'Bienvenue dans TMB Atelier'}</h2>
      {help ? <><p>Retrouvez ici toutes les étapes pour préparer votre tour.</p><nav className="help-index">{CHAPTERS.slice(1, -1).map((c, i) => <a key={c.title} href={`#help-${i}`} onClick={(e) => { e.preventDefault(); document.getElementById(`help-${i}`)?.scrollIntoView({ block: 'start' }); }}>{c.title}</a>)}</nav>{CHAPTERS.slice(1, -1).map((c, i) => <section id={`help-${i}`} key={c.title}><h3>{i + 1}. {c.title}</h3><p>{c.text}</p></section>)}<p>Les fonctions de sauvegarde utilisent le navigateur de cet appareil. Les données ne sont pas transférées entre le site Sites et le site GitHub : utilisez un export puis un import GPX pour emporter un parcours.</p></> : <><p>Prenez la carte en main avec notre tutoriel interactif. Il vous guide pas à pas pour préparer votre Tour du Mont-Blanc.</p><ul className="welcome-topics"><li><Icon name="map" /> Explorer la carte et les lieux utiles</li><li><Icon name="route" /> Créer un parcours et modifier une variante</li><li><Icon name="book" /> Organiser vos étapes, sauvegarder et exporter</li></ul><p className="welcome-reassurance">Vous vous entraînez sur un parcours d’essai. Votre parcours personnel est préservé.</p></>}
      <div className="welcome-actions"><button className="btn btn-primary" disabled={!ready || active || starting} onClick={() => void start()}><Icon name="book" /> Découvrir le tutoriel</button><button className="btn" data-testid="disclaimer-accept" onClick={() => { setHelp(false); dismiss(); }}>Explorer librement</button></div>
      {!help && <button className="btn btn-text full-width" onClick={() => setHelp(true)}>Vous préférez lire ? Ouvrir le guide d’utilisation ↗</button>}
      <p className="small muted">En montagne, vérifiez météo, neige et fermetures auprès des acteurs locaux. Cet outil ne remplace pas une préparation sur le terrain.</p>
    </dialog>
    {active && createPortal(<section className="tutorial-panel" aria-label="Tutoriel interactif">
      <div className="tutorial-progress"><span className="eyebrow"><Icon name="book" size={16} /> PARCOURS D’ESSAI</span><label htmlFor="tutorial-chapter">Étape {step + 1} sur {CHAPTERS.length}</label><select id="tutorial-chapter" aria-label="Étape du tutoriel" value={step} onChange={(e) => changeStep(+e.target.value)}>{CHAPTERS.map((c, i) => <option key={c.title} value={i}>{i + 1}. {c.title}</option>)}</select><progress value={step + 1} max={CHAPTERS.length} /></div>
      <div className="tutorial-copy" aria-live="polite"><h2>{chapter.title}</h2><p>{chapter.text}</p><p className="tutorial-task">{chapter.task}</p></div>
      <div className="tutorial-navigation"><button className="btn btn-text" onClick={close}><Icon name="close" size={14} /> Quitter</button><div><button className="btn" disabled={step === 0} onClick={() => changeStep(step - 1)}>Précédent</button><button className="btn btn-primary" onClick={() => step === CHAPTERS.length - 1 ? close() : changeStep(step + 1)}>{step === CHAPTERS.length - 1 ? 'Terminer' : 'Suivant'}</button></div></div>
    </section>, document.querySelector('.app')!)}
  </>;
}
