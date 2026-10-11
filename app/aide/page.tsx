import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Download, Map, Mountain, Route, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { POI_CATEGORIES, PoiSymbol } from "@/components/planner/poi-categories";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Aide et guide d’utilisation — TMB Atelier",
  description: "Le manuel de TMB Atelier : explorer la carte, créer un parcours, intégrer et modifier une variante, préparer ses étapes et exporter un GPX.",
};

const chapters = [
  ["demarrer", "Prendre ses repères"],
  ["carte", "Utiliser la carte"],
  ["parcours", "Créer son parcours"],
  ["lieux", "Ajouter un lieu"],
  ["variantes", "Combiner les variantes"],
  ["modifier", "Modifier le tracé"],
  ["etapes", "Organiser les étapes"],
  ["profil", "Lire les statistiques et le relief"],
  ["sauvegarde", "Sauvegarder et retrouver"],
  ["gpx", "Importer et exporter un GPX"],
  ["questions", "Résoudre un problème"],
  ["terrain", "Avant de partir"],
] as const;

function Chapter({ index, children }: { index: number; children: ReactNode }) {
  const [id, title] = chapters[index];
  return <section id={id} className="help-chapter" aria-labelledby={`${id}-title`}>
    <div className="help-chapter-heading"><span>{String(index + 1).padStart(2, "0")}</span><h2 id={`${id}-title`}>{title}</h2></div>
    {children}
  </section>;
}

export default function HelpPage() {
  return (
    <div className="help-page">
      <a className="help-skip" href="#guide">Aller au guide</a>
      <header className="topbar help-topbar">
        <Link className="brand" href="/" aria-label="TMB Atelier — retour à la carte">
          <span className="brand-icon"><Mountain size={25} /></span>
          <span>TMB <strong>Atelier</strong><small>LE TOUR COMMENCE ICI</small></span>
        </Link>
        <span className="help-header-label">CENTRE D’AIDE</span>
        <Button asChild variant="outline"><Link href="/"><ArrowLeft /> Retour à la carte</Link></Button>
      </header>
      <div className="help-layout">
        <aside className="help-sidebar">
          <nav aria-label="Sommaire du guide">
            <p className="eyebrow">DANS CE GUIDE</p>
            <ol>{chapters.map(([id, title], index) => <li key={id}><a href={`#${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{title}</a></li>)}</ol>
          </nav>
          <div className="help-practice">
            <BookOpen size={22} aria-hidden="true" />
            <strong>Envie d’essayer ?</strong>
            <p>Apprenez avec les vraies commandes, sur un parcours d’essai.</p>
            <Link href="/?tutoriel=1">Lancer le tutoriel <ArrowRight size={15} /></Link>
          </div>
        </aside>
        <main id="guide" className="help-main">
          <div className="help-hero">
            <p className="eyebrow">LE MANUEL DE VOTRE TOUR</p>
            <h1>Un guide, du premier clic<br />au premier pas.</h1>
            <p>Retrouvez ici toutes les explications du tutoriel, à votre rythme. Choisissez un sujet dans le sommaire ou suivez le guide pour construire votre parcours de A à Z.</p>
            <div className="help-hero-actions">
              <Button asChild><Link href="/?tutoriel=1"><BookOpen /> Lancer le tutoriel interactif</Link></Button>
              <a href="#parcours">Créer mon premier parcours <ArrowRight size={16} /></a>
            </div>
          </div>

          <Chapter index={0}>
            <p>TMB Atelier vous permet de préparer un itinéraire autour du Mont-Blanc, sans compte. Vous pouvez partir du TMB classique, dessiner votre propre parcours ou reprendre un fichier GPX.</p>
            <dl className="help-definitions">
              <div><dt>Explorer</dt><dd>Le catalogue du TMB classique et de ses cinq variantes. Afficher une trace permet de la comparer ; l’intégrer modifie votre parcours.</dd></div>
              <div><dt>Mon parcours</dt><dd>Votre itinéraire en cours : points de passage, distance, dénivelé, journées et sauvegardes.</dd></div>
              <div><dt>Tutoriel</dt><dd>Une visite guidée en 15 étapes. Choisissez un chapitre, suivez les indications, puis utilisez Suivant. Vous pouvez passer une étape ou quitter à tout moment.</dd></div>
            </dl>
            <p className="help-note"><ShieldCheck size={19} /> Le tutoriel utilise un parcours d’essai. À la sortie, votre parcours personnel et son historique sont restaurés ; la sauvegarde de l’essai est simulée.</p>
            <p><strong>Sur téléphone :</strong> ouvrez le panneau inférieur avec sa poignée pour accéder au catalogue ou aux points. Réduisez-le pour profiter de la carte. Les commandes de la barre du haut sont représentées par des icônes : aide, livre du tutoriel, import et export.</p>
          </Chapter>

          <Chapter index={1}>
            <ul>
              <li><strong>Se déplacer :</strong> faites glisser la carte avec la souris ou le doigt.</li>
              <li><strong>Zoomer :</strong> utilisez + / −, la molette ou deux doigts sur téléphone.</li>
              <li><strong>Changer de fond :</strong> choisissez Relief pour la carte topographique, ou Classique pour le fond OpenStreetMap.</li>
              <li><strong>Se situer :</strong> le bouton cible demande votre position, avec l’autorisation du navigateur. Le carré ouvre le plein écran lorsque le navigateur le permet.</li>
              <li><strong>Explorer ou tracer :</strong> Explorer sert à consulter la carte ; Tracer permet d’ajouter des points au parcours.</li>
            </ul>
            <p>La légende distingue le TMB classique et <strong>votre parcours en orange</strong>. Les variantes affichées ont chacune une couleur. Le bouton de recentrage dans Mon parcours permet de retrouver tout votre itinéraire.</p>
          </Chapter>

          <Chapter index={2}>
            <div className="help-options">
              <div><Mountain size={22} /><h3>Partir du classique</h3><p>Dans Explorer, cliquez sur <strong>Personnaliser ce tour</strong>. Une copie du TMB classique est créée, au départ des Houches dans le sens antihoraire. Ajoutez ensuite les variantes de votre choix.</p></div>
              <div><Route size={22} /><h3>Partir d’une page blanche</h3><p>Dans Explorer, cliquez sur <strong>Créer un parcours libre</strong>. Placez votre départ sur la carte, puis ajoutez vos points de passage. Attendez le tracé orange entre deux points avant de continuer.</p></div>
            </div>
            <p>Les liaisons sont calculées sur les sentiers avec OpenRouteService. Commencez par des points proches, dans le massif du Mont-Blanc. Si un calcul échoue, un message l’indique et le dernier parcours valide est conservé.</p>
            <p><strong>Un point de passage</strong> est un repère que vous pouvez déplacer. Les nombreux <strong>points de trace</strong>, visibles dans les statistiques, décrivent tous les virages du chemin entre vos repères.</p>
            <h3>Revenir au point de départ</h3>
            <p>Dans <strong>Mon parcours</strong>, cochez <strong>Départ et arrivée</strong> sous le premier point. Le dernier passage est alors relié au départ par les sentiers. Cette option est déjà activée sur le TMB classique. Avec un seul point, le retour est calculé dès que vous ajoutez un passage.</p>
            <p>Le repère <strong>D/A</strong> représente les deux extrémités : le déplacer met à jour le départ et l’arrivée ensemble. Les nouveaux points, lieux ou variantes ajoutés à un parcours libre se placent avant le retour. La distance, les étapes et le GPX incluent ce dernier tronçon.</p>
            <p>Décocher l’option retire le dernier tronçon de retour. <strong>Annuler</strong> permet de le retrouver. Sur une trace importée ne comportant que le départ et l’arrivée, insérez d’abord un point de passage pour pouvoir déplacer le départ.</p>
            <p>Créer un nouveau parcours remplace le brouillon affiché. Pensez à <a href="#sauvegarde">sauvegarder ou exporter</a> le précédent si vous souhaitez le conserver.</p>
          </Chapter>

          <Chapter index={3}>
            <p>Ouvrez <strong>Points d’intérêt</strong> en bas à droite de la carte. Cochez les catégories à afficher ; chaque catégorie possède sa couleur et son symbole.</p>
            <ul className="help-poi-list">{POI_CATEGORIES.map(category => <li key={category.id}><PoiSymbol category={category} />{category.label}</li>)}</ul>
            <ol>
              <li>Cliquez sur le symbole du lieu sur la carte.</li>
              <li>Dans sa fiche, cliquez sur <strong>Ajouter au parcours</strong>.</li>
              <li>Le lieu devient un point de passage nommé, ajouté à la fin de votre parcours. Une liaison pédestre est calculée depuis le dernier point ; sur un parcours vide, il devient le départ.</li>
            </ol>
            <p>Pour faire passer une portion existante près de ce lieu, utilisez plutôt <a href="#modifier">Insérer puis déplacer un point</a>. Les lieux proviennent d’un extrait OpenStreetMap non exhaustif ; certaines catégories peuvent être vides dans la zone affichée.</p>
          </Chapter>

          <Chapter index={4}>
            <p>Le catalogue propose le Col de Tricot, le Col des Fours, la Tête Bernarda, la Fenêtre d’Arpette et la variante des Grands.</p>
            <ol>
              <li>Dans Explorer, choisissez <strong>Voir la trace</strong> pour comparer une variante avec le classique. Vous pouvez en afficher plusieurs simultanément.</li>
              <li>Lisez sa distance, son dénivelé et sa difficulté. La différence de distance compare la variante à la portion classique qu’elle remplace.</li>
              <li>Cliquez sur <strong>+ Intégrer</strong>. Sur un tour classique personnalisé, seule la portion entre les deux raccordements est remplacée. Le reste du tour est conservé.</li>
              <li>Retrouvez le résultat dans Mon parcours : la ligne orange, la distance et le profil sont mis à jour.</li>
            </ol>
            <div className="help-example"><span>EXEMPLE · COL DE TRICOT</span><p>Personnalisez le classique, puis intégrez le Col de Tricot. Votre tour passe désormais par Tricot entre le col de Voza et les Contamines. Vous pouvez ensuite ajouter un repère sur cette portion pour l’ajuster.</p></div>
            <p>Deux variantes compatibles peuvent coexister. Si elles remplacent une même portion, une fenêtre vous demande laquelle conserver. Une variante intégrée ne s’ajoute pas deux fois. Le bouton <strong>Intégrée</strong> permet de la retirer tant que la portion n’a pas été personnalisée.</p>
            <p><strong>Sur un parcours libre :</strong> la variante s’ajoute à la suite, avec un raccord pédestre jusqu’à son entrée. Elle ne remplace pas une portion de votre parcours libre.</p>
          </Chapter>

          <Chapter index={5}>
            <h3>Modifier une variante, pas à pas</h3>
            <ol>
              <li>Intégrez la variante à votre parcours, puis ouvrez Mon parcours.</li>
              <li>Choisissez <strong>Insérer</strong> et cliquez sur la ligne orange à l’endroit à modifier. Un nouveau repère apparaît ; à ce stade, la trace conserve son chemin initial.</li>
              <li>Faites glisser ce repère vers le sentier souhaité, puis relâchez-le. Seuls les tronçons adjacents sont recalculés.</li>
              <li>Vérifiez le chemin obtenu, la distance et le profil. Utilisez <strong>Annuler</strong> si le résultat ne vous convient pas.</li>
            </ol>
            <p>La portion déplacée devient personnalisée. Les autres portions gardent leur géométrie. Pour revenir en arrière après une modification, utilisez Annuler plutôt que de réintégrer la même variante.</p>
            <h3>Gérer les points de passage</h3>
            <ul>
              <li><strong>Ajouter</strong> crée un point à la fin ; <strong>Insérer</strong> en ajoute au milieu d’un segment existant.</li>
              <li>Cliquez sur le nom d’un point dans Mon parcours pour le renommer, modifier ses coordonnées ou changer son ordre avec les flèches. Validez les nouvelles coordonnées avec <strong>Déplacer ce point</strong>.</li>
              <li>La <strong>corbeille</strong> supprime un point. Les liaisons concernées sont recalculées si nécessaire.</li>
              <li><strong>Annuler / Rétablir</strong> parcourent les modifications de la session.</li>
            </ul>
          </Chapter>

          <Chapter index={6}>
            <ol>
              <li>Dans Mon parcours, repérez le point où vous souhaitez terminer une journée.</li>
              <li>Cliquez sur son <strong>drapeau</strong>. Cliquez à nouveau pour enlever cette fin d’étape.</li>
              <li>Consultez Vos étapes sous la liste : distance, D+, D− et durée indicative de chaque journée. La dernière arrivée termine automatiquement le parcours.</li>
            </ol>
            <p>La durée est estimée par <strong>distance en km / 4 + D+ en mètres / 600</strong>, en heures, hors pauses. Adaptez-la à votre rythme, au terrain et aux conditions. Un point placé sur un refuge ne constitue pas une réservation.</p>
          </Chapter>

          <Chapter index={7}>
            <p>Les statistiques affichent la distance, les dénivelés positif et négatif (D+ et D−), les altitudes extrêmes et le nombre de points de trace. Elles évoluent avec votre parcours.</p>
            <ul>
              <li>Sur ordinateur, le profil se trouve sous la carte. Sur téléphone, ouvrez-le avec le bouton <strong>Profil d’altitude</strong>.</li>
              <li>Survolez ou touchez le profil : un marqueur indique le même endroit sur la carte. Survoler le tracé permet aussi de retrouver son altitude dans le profil.</li>
              <li>Le dénivelé est filtré avec un seuil de variation de 5 mètres pour atténuer le bruit. Les ruptures entre segments ne sont pas reliées.</li>
              <li>Les altitudes manquantes ou partielles sont signalées. <strong>Compléter les altitudes</strong>, lorsqu’il est proposé dans Mon parcours, permet de demander les valeurs manquantes au service d’altimétrie.</li>
            </ul>
            <p>Les altitudes complétées sont issues d’un modèle de terrain. Une cotation SAC n’est affichée que si la source la renseigne ; « non renseignée » ne signifie pas que le passage est facile.</p>
          </Chapter>

          <Chapter index={8}>
            <dl className="help-definitions">
              <div><dt>Brouillon automatique</dt><dd>Votre travail est enregistré dans ce navigateur, sur cet appareil, puis restauré à la prochaine ouverture.</dd></div>
              <div><dt>Sauvegarder</dt><dd>Conserve une copie explicite du parcours actuel. Une nouvelle sauvegarde remplace cette copie.</dd></div>
              <div><dt>Nouveau parcours</dt><dd>Commence un brouillon vide. La dernière sauvegarde explicite reste disponible.</dd></div>
              <div><dt>Restaurer le dernier parcours</dt><dd>Remplace le brouillon affiché par votre dernière sauvegarde explicite.</dd></div>
            </dl>
            <p>Les sauvegardes ne sont pas synchronisées entre vos appareils. Effacer les données du navigateur peut les supprimer. <strong>Exportez un GPX</strong> pour garder un fichier ou transférer le parcours ailleurs. L’historique Annuler / Rétablir appartient à la session en cours.</p>
          </Chapter>

          <Chapter index={9}>
            <h3><Upload size={19} /> Reprendre une trace existante</h3>
            <ol>
              <li>Cliquez sur <strong>Importer</strong> en haut à droite et choisissez un fichier GPX.</li>
              <li>Vérifiez le bilan affiché avant de choisir <strong>Utiliser cette trace</strong>. Annuler laisse votre parcours actuel en place.</li>
              <li>La trace devient votre base de travail, avec ses coordonnées, altitudes disponibles et segments séparés.</li>
            </ol>
            <p>Les fichiers GPX 1.0 et 1.1 contenant des traces ou routes sont acceptés, jusqu’à <strong>10 Mo et 100 000 points</strong>. Les fichiers vides ou invalides sont refusés. Le fichier importé reste dans votre navigateur.</p>
            <h3><Download size={19} /> Télécharger votre parcours</h3>
            <p>Cliquez sur <strong>Exporter GPX</strong> en haut à droite. Sur téléphone, ce bouton est représenté par une flèche de téléchargement, sans texte. Il devient disponible dès que votre parcours contient un segment.</p>
            <p>Le fichier GPX 1.1 contient le nom du parcours, les coordonnées complètes dans l’ordre, les altitudes disponibles, les segments et l’attribution des sources. Les ruptures de trace sont conservées. Le fichier est enregistré par votre navigateur, généralement dans Téléchargements.</p>
          </Chapter>

          <Chapter index={10}>
            <details><summary>Le tracé ne se calcule pas, ou le service est momentanément indisponible.</summary><p>Vérifiez votre connexion. Essayez un point plus proche, placé sur un chemin du massif. Si le message indique une limite du service, attendez avant de réessayer. Le dernier parcours valide reste affiché ; aucune ligne droite ne remplace un calcul échoué.</p></details>
            <details><summary>Je ne retrouve pas mon parcours sauvegardé.</summary><p>Utilisez le même appareil et le même navigateur. Restaurer le dernier parcours rappelle la copie créée par Sauvegarder. Si le stockage a été effacé ou si vous changez d’appareil, importez votre GPX exporté.</p></details>
            <details><summary>Mon GPX ne s’importe pas ou le profil est incomplet.</summary><p>Vérifiez que le fichier contient une trace ou une route, ne dépasse pas 10 Mo ni 100 000 points et est au format GPX 1.0 ou 1.1. Certains GPX n’ont pas d’altitudes : utilisez Compléter les altitudes si proposé. Des segments discontinus restent séparés.</p></details>
            <details><summary>Une variante est déjà intégrée ou ne peut plus être retirée.</summary><p>Une même variante ne peut pas être ajoutée deux fois. Si vous avez déplacé ses points, utilisez Annuler pour revenir avant la personnalisation. En cas de chevauchement avec une autre variante, choisissez celle à conserver dans la fenêtre proposée.</p></details>
            <details><summary>Comment revoir le tutoriel ?</summary><p>Le message de bienvenue ne s’affiche qu’à la première visite dans ce navigateur, tant que ses données sont conservées. Le bouton Tutoriel, représenté par un livre sur téléphone, reste disponible en haut de la carte. Vous pouvez aussi <Link href="/?tutoriel=1">le lancer depuis cette page</Link>.</p></details>
          </Chapter>

          <Chapter index={11}>
            <p>La référence est le <strong>TMB classique — données OpenStreetMap</strong>. Consultez les sources depuis l’icône d’information des fiches. Les données sont attribuées aux contributeurs OpenStreetMap, sous licence ODbL ; elles ne constituent pas une certification du parcours.</p>
            <p>Vérifiez la météo, la neige, les fermetures et l’état des sentiers auprès des acteurs locaux avant de partir. Le site ne fournit pas de suivi en temps réel de ces conditions et ne remplace pas une préparation sur le terrain.</p>
            <p>Une connexion Internet est nécessaire pour charger les fonds de carte et calculer les itinéraires. Cette version ne télécharge pas de cartes pour une utilisation hors connexion.</p>
          </Chapter>
          <footer className="help-footer"><a href="#guide">Revenir en haut ↑</a><Button asChild><Link href="/"><Map /> Ouvrir la carte</Link></Button></footer>
        </main>
      </div>
    </div>
  );
}
