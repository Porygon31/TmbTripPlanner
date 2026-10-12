# TMB Atelier

Préparer son Tour du Mont-Blanc : fond Classique par défaut et Relief au choix, cinq variantes OSM, parcours pédestres OpenRouteService, points déplaçables, hôtels et refuges, statistiques entre points, profil altimétrique, GPX, sauvegardes locales et étapes.

**Guide de configuration, sources, tests et maintenance : [MAINTENANCE.md](./MAINTENANCE.md).**

## Utilisation

1. Dans **Explorer**, choisir **Personnaliser ce tour**, puis intégrer les variantes souhaitées. **Voir la trace** permet de comparer plusieurs variantes avant de les intégrer.
2. Pour dessiner librement, choisir **Créer un parcours libre** ou **Nouveau parcours**, puis cliquer sur **Tracer** et sur la carte. Les points sont reliés par les sentiers calculés ; une panne conserve le parcours valide.
3. Dans **Mon parcours**, déplacer un repère, insérer un point sur la trace, supprimer un point ou ouvrir sa ligne pour changer ses coordonnées et son ordre. Le drapeau définit une fin d’étape.
4. **Importer** accepte des GPX 1.0 et 1.1 jusqu’à 10 Mo et 100 000 points. Les segments séparés et les altitudes présentes sont conservés. **Exporter GPX** télécharge les données complètes en GPX 1.1.
5. Le brouillon se sauvegarde automatiquement sur l’appareil. **Sauvegarder** conserve une version explicite ; **Restaurer le dernier parcours** la recharge. **Annuler / Rétablir** permet de revenir sur les modifications de la session.

Sur mobile, agrandir ou réduire le panneau avec sa poignée. Le bouton **Profil d’altitude** ouvre le profil au-dessus du panneau réduit. Toucher le profil positionne le repère correspondant sur la carte.

Dans **Mon parcours**, **Entre deux points** permet de choisir les bornes d’une portion pour afficher sa distance, ses D+/D−, ses altitudes et sa durée indicative. **Parcours entier** rappelle le bilan global. La borne **Arrivée · retour au départ** inclut le dernier tronçon d’une boucle. Le profil et l’export GPX conservent le parcours entier.

Le bouton **Tutoriel** dans la barre du haut ouvre un guide interactif de 15 chapitres : carte, parcours libre, lieux, classique, variantes, insertion et déplacement, étapes, profil, sauvegarde et GPX. Les commandes agissent sur un parcours d’essai isolé ; quitter ou terminer restitue le parcours et son historique. Pendant l’essai, la sauvegarde est simulée et le brouillon personnel reste protégé, y compris au rechargement. Les chapitres peuvent être choisis directement ou passés.

À la première visite de la carte, une fenêtre centrée propose de découvrir le tutoriel ou d’explorer librement. Son acquittement est conservé dans `localStorage` avec la clé `tmb-atelier:welcome-seen:v1`. Le bouton **Aide** ouvre `/aide` dans un nouvel onglet pour garder la carte accessible : manuel statique en douze chapitres, sommaire, exemple de modification de Tricot et questions fréquentes. Le lien `/?tutoriel=1` lance le tutoriel après le chargement du catalogue et du brouillon, puis retire ce paramètre de l’URL.

Dans la légende en bas à droite de la carte, activer une catégorie puis cliquer sur un lieu et **Ajouter au parcours**. Le lieu devient un point nommé, relié au dernier point par un calcul pédestre. Un échec conserve le parcours valide ; un lieu déjà en dernière position ne peut pas être ajouté deux fois de suite. La légende se replie à l’ouverture de la fiche pour la laisser accessible sur mobile.

Les tracés OSM ne sont pas une certification institutionnelle. Vérifier localement météo, neige, fermetures et praticabilité avant de partir.
