# Validation de TMB Atelier

## Contrôle complet du 10 octobre 2026

- 20 tests automatiques réussis ; TypeScript et ESLint sans erreur après correction de sept erreurs de lint (liens internes du manuel et initialisation de l’accueil). L’accueil utilise un instantané compatible avec le rendu serveur et conserve son état en mémoire si le stockage est indisponible. Le marqueur temporaire de prévisualisation a été retiré des métadonnées.
- Intégrité des fichiers : 29 JSON et 17 scripts JS/MJS valides ; empreintes des six GPX source conformes au catalogue. La clé ORS configurée est absente des fichiers client compilés. Le `.gitignore` exclut les secrets, caches et exports ; le cache TypeScript n’est plus suivi.
- API réelles, via le serveur local : routage `foot-hiking` près des Houches (123 points avec altitude, 2,228 km) et enrichissement altimétrique de deux points (HTTP 200). Le déplacement d’un repère dans le navigateur recalcule le trajet (115 points), puis Annuler restitue les 123 points d’origine.
- Navigateur ordinateur : fonds Relief et Classique chargés, combinaison de Tricot et du Col des Fours, profil synchronisé avec un marqueur sur la carte, sauvegarde puis nouveau parcours et restauration identique.
- Export navigateur puis import par le sélecteur de fichiers : 16 889 points, 11 segments et 164,461 km conservés, avec les mêmes statistiques. Le fichier téléchargé passe le schéma officiel GPX 1.1 ; un aller-retour supplémentaire compare exactement chaque coordonnée, altitude, ordre et séparation de segment.
- Accueil de première visite : fermeture et rechargement sans réapparition. Tutoriel : intégration de Tricot à l’étape 8 et restauration exacte du parcours personnel en quittant. Lancement depuis le manuel avec `?tutoriel=1` après restauration du brouillon ; la fenêtre d’accueil reste masquée et la sortie rend les 22 repères et 11 segments importés.
- Format 390 × 844 : carte, légende, profil tactile et manuel sans débordement horizontal. Ajout de l’Auberge de Bionnassay depuis sa fiche, conservation de son nom et de ses coordonnées, bouton désactivé pour éviter l’ajout consécutif du même lieu. Brouillon retrouvé après rechargement.
- Aucun avertissement ou erreur console relevé durant ces parcours navigateur. Captures locales : `outputs/full-audit-desktop.png` et `outputs/full-audit-mobile.png`.

Ces contrôles couvrent les scénarios indiqués, sans garantir tous les appareils et toutes les données possibles. Les quotas, pannes et réponses tardives sont vérifiés par les tests simulés ; les services cartographiques et OpenRouteService restent des dépendances externes. Les autorisations de géolocalisation n’ont pas été demandées pendant cet audit.

## Validation initiale

Vérifications réalisées le 8 octobre 2026 dans le projet local, avant publication.

- MVP validé avant les fonctions secondaires : 13 tests initiaux, contrôle du classique, ajout de Tricot, export navigateur et réimport.
- Version complète : 20 tests automatiques réussis, contrôle TypeScript et ESLint sans erreur. Export validé avec le schéma officiel GPX 1.1 de Topografix.
- Appels OpenRouteService réels : routage de randonnée (123 points sur un trajet test près des Houches), altimétrie, enrichissement des six traces et deux raccords du catalogue. Les erreurs et quotas sont testés avec un fournisseur simulé.
- Navigateur, ordinateur : carte, basemap, variantes, clics de création sur sentiers, déplacement réel d’un repère, insertion, coordonnées, réorganisation, annuler/rétablir, étape, sauvegarde explicite, nouveau parcours, restauration et rechargement du brouillon.
- Navigateur, 390 × 844 : panneau rétractable, absence de débordement horizontal, profil tactile synchronisé avec la carte et crédits cartographiques visibles.
- Import via Worker du GPX exporté : 168,1 km, 17 878 points et 10 segments, utilisable comme base. Les tests de réimport comparent exactement coordonnées, altitudes, ordre et limites des segments.
- Analyse dans un Worker confirmée ; l’export conserve les coordonnées complètes. Les couches de refuges ont été contrôlées visuellement ; l’extrait contient 128 POI nommés.
- Les six outils WebMCP ont été exercés : état, classique, parcours libre, ajout de point, variante et export. Les coordonnées hors zone et variantes inconnues sont rejetées. Les statistiques signalent une analyse en cours plutôt que de renvoyer des valeurs d’un ancien parcours.

Captures locales de contrôle : `outputs/desktop-validation.jpg` et `outputs/mobile-validation.jpg` (non publiées). La publication est confirmée séparément par le statut natif Sites `succeeded` et son URL de production.

Les limites d’exploitation et les procédures de configuration, actualisation des données et maintenance sont décrites dans [MAINTENANCE.md](MAINTENANCE.md).

## Mise à jour : lieux et tutoriel interactif

- TypeScript et les 20 tests automatiques passent après les changements d’édition et de stockage.
- Bouton « Ajouter au parcours » vérifié dans la fiche d’un refuge : premier point sur mobile, puis ajout après deux points sur ordinateur. Nom et coordonnées conservés ; ajout consécutif du même lieu désactivé.
- Calculs OpenRouteService réels dans le navigateur : parcours de 1,3 km aux Houches, puis prolongement jusqu’à l’Auberge de Bionnassay (8,4 km au total, deux segments et 479 points).
- Guide de 15 chapitres parcouru sur ordinateur : création libre, POI, classique, comparaison et intégration de Tricot, insertion, déplacement, fin d’étape, profil et sauvegarde simulée. Le déplacement a modifié exactement deux segments, les neuf autres conservant leur identité ; annulation vérifiée.
- Sortie par Terminer ou Échap : points, identifiants de segments et variantes d’origine restitués à l’identique. L’historique personnel Annuler / Rétablir est conservé.
- Rechargement pendant le tutoriel : brouillon personnel restauré. La sauvegarde explicite antérieure reste identique après une sauvegarde simulée dans le guide, puis Nouveau parcours et Restaurer.
- Format 390 × 844 : aucun débordement horizontal, guide et navigation lisibles, fiche POI accessible avec repli de la légende, profil tactile synchronisé et validation de la manipulation. Le cadrage tient compte de la taille réelle de la carte et du panneau inférieur.

Captures : `outputs/poi-add-validation.jpg`, `outputs/tutorial-desktop-validation.jpg` et `outputs/tutorial-mobile-validation.jpg`.

## Clarification du tutoriel

- Étape 8 : trois consignes numérotées précisent le bouton à cliquer, la portion classique remplacée et le résultat visible. Le message de réussite nomme le Col de Tricot et indique l’action suivante.
- Étape GPX : le repère vise uniquement Exporter GPX. Bordure de 5 px avec pulsation d’opacité, bouton animé entre 100 % et 106 %, et nom en gras dans la consigne. Les animations sont désactivées par `prefers-reduced-motion` tout en conservant le cadre.
- TypeScript validé. Navigateur : intégration et message de réussite, animations actives, retrait du repère au changement de chapitre et à la sortie ; contrôles et texte accessibles sans débordement à 390 × 844.
- Captures : `outputs/tutorial-export-highlight.jpg` et `outputs/tutorial-export-highlight-mobile.jpg`.

## Accueil de première visite et manuel

- Fenêtre centrée au premier affichage de la carte, avec choix du tutoriel, exploration libre et lien vers le guide. Le titre nomme correctement la boîte de dialogue et reçoit le focus ; les contrôles restent accessibles sur petit écran grâce au défilement interne.
- Navigateur : lancement du tutoriel depuis l’accueil, retour au parcours personnel de onze points, rechargement sans réafficher l’accueil ; démarrage depuis le lien du manuel après chargement du brouillon, puis restauration du parcours.
- Aide ouverte dans un autre onglet depuis la barre de la carte. Douze chapitres, navigation par ancres sans titre masqué sous l’en-tête, questions fréquentes dépliables et lien vers le tutoriel vérifiés.
- Contrôles visuels sur ordinateur, à 390 × 844 et accueil à 320 × 640. Pas de débordement horizontal ; les quatre commandes de la barre restent accessibles.
- Captures locales : `outputs/welcome-desktop-validation.jpg`, `outputs/help-desktop-validation.jpg` et `outputs/welcome-mobile-validation.jpg`.
