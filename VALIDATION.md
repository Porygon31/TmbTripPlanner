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
