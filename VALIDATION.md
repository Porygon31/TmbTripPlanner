# Validation de TMB Atelier

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
