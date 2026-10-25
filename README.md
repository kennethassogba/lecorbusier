# Le Corbusier

[Ouvrir l'app](https://keff.uk/lecorbusier/)

Un jeu satirique d'architecture collective. Choisir un vrai lieu de Paris, y imaginer un data center, signer les plans et publier sur la carte commune. Sans compte.

## Ce qui est livré

- Placement libre dans Paris : toucher la carte, viser son centre ou chercher une adresse / un lieu. Le géocodage utilise la Géoplateforme IGN ; les points libres partent de la vraie vue aérienne BD ORTHO, avec le site sélectionné au centre.
- 20 suggestions de lieux de Paris avec photographies réelles, coordonnées et crédits Wikimedia.
- 10 styles architecturaux et instructions libres.
- Brief architectural et légende par `gpt-5.4-mini`, image par `gpt-image-2.5-sunburst` à partir de la photo originale.
- Génération persistante dans Cloudflare Workflows, reprise dans « Mes plans ».
- Carte partagée, notifications WebSocket, votes réversibles et palmarès.
- Liens publics avec métadonnées sociales, comparaison avant/après et export PNG/story.
- PWA installable : mode autonome, raccourcis système, badge des créations prêtes sur les plateformes compatibles, partage système des liens et images. L'interface, les photos consultées, les dix dernières images publiques et les tuiles récemment visitées restent disponibles hors ligne ; génération, nouveaux quartiers et publication nécessitent le réseau.

Aucun quota applicatif de créations. Les capacités et limites des fournisseurs continuent de s'appliquer. Un identifiant anonyme HttpOnly retrouve les plans et votes dans le même navigateur. Effacer les cookies fait perdre cet accès. Un vote par création et navigateur, sans garantie d'unicité humaine.

Les images sont spéculatives. Elles ne constituent ni une étude technique ni une autorisation d'urbanisme. L'app n'est affiliée ni à la Fondation Le Corbusier ni à la Ville de Paris.

## Développement

Node.js 24.22 ou supérieur, npm.

```sh
npm ci
cp .dev.vars.example .dev.vars
# Configurer OPENAI_API_KEY dans ce fichier local ignoré.
npx cf d1 migrations apply 0458a2ad-9007-4a48-8bc6-f55f15e33928 --local --persist-to .cloudflare/state
npm run dev
```

Ouvrir `http://127.0.0.1:5196/lecorbusier/`. Pour un autre compte Cloudflare, remplacer le compte, la zone et la base dans `cloudflare.config.ts`.

```sh
npm run build
npm test
```

Le test de runtime nécessite le bundle construit : il couvre brouillons, accès aux images, publication, notification WebSocket, votes idempotents, métadonnées et refus des requêtes d'une autre origine. Aucun appel OpenAI dans les tests automatisés.

## Publication

```sh
npx cf auth login
npx cf d1 migrations apply 0458a2ad-9007-4a48-8bc6-f55f15e33928
npm run build
npm test
npx cf deploy --prebuilt --secrets-file .dev.vars
```

La route `keff.uk/lecorbusier*` appartient au Worker `lecorbusier-keff`. Le site principal reste servi par son Worker existant. `scripts/cf-auth.mjs` est un utilitaire local qui peut reprendre la session Wrangler du propriétaire sans écrire ni afficher son jeton ; les autres contributeurs utilisent `cf auth login`.

Les données, votes et images JPEG découpées sont conservés dans D1. Le stockage R2 n'est pas activé sur le compte de déploiement ; ce lancement utilise donc D1 sans dépendre d'une activation supplémentaire. Pour une forte volumétrie d'images, déplacer les fichiers vers un stockage objet. Les URL publiques des créations restent stables.

Le canal WebSocket est un relais de notifications uniquement. Les données durables résident dans D1. Le client se resynchronise à la reconnexion et par requêtes périodiques. Les jobs utilisent des identifiants idempotents et ne relancent pas automatiquement les appels OpenAI facturés après erreur.

## Sources et licences

Le code est sous [licence MIT](LICENSE). Les photographies gardent leurs licences propres, notamment CC BY et CC BY-SA ; elles ne sont pas couvertes par la licence du code. Voir [le catalogue et les crédits](data/places.json) et [les notes de cadrage](data/README.md). Les images modifiées doivent conserver l'attribution et les conditions applicables de leur photographie source. L'export fournit les crédits avec l'image.

La carte vectorielle utilise MapLibre GL JS et les tuiles OpenFreeMap, à partir des données OpenStreetMap/OpenMapTiles. Le style Positron est adapté dans `public/paris-map.json` : palette neutre et bleue, noms français, volumes des bâtiments. Les constructions de plus de 80 mètres restent en plan pour éviter de transformer les monuments ouverts comme la tour Eiffel en blocs opaques. Les tuiles visitées sont mises en cache au fil de la navigation, sans préchargement géographique (80 réponses de 512 Kio au maximum, moins de 40 Mio).

Documentation technique : [OpenAI Images](https://developers.openai.com/api/docs/guides/image-generation), [Cloudflare Workflows](https://developers.cloudflare.com/workflows/build/workers-api/), [Cloudflare CLI](https://developers.cloudflare.com/cf/projects/).

## Interface mobile

La carte reste montée pendant le parcours. Les panneaux se réduisent depuis leur poignée (glissement ou bouton), les formulaires tiennent au-dessus du clavier, et les déplacements respectent la préférence de mouvement réduit. Le bouton retour du navigateur restaure les panneaux et ferme les dialogues.

Le partage prépare le PNG avant le geste pour conserver l'activation requise par Web Share. Sur les navigateurs sans partage natif, la feuille propose le lien, WhatsApp, X et un enregistrement explicite. Les exports gardent le crédit et la source photographique dans l'image. L'installation iOS passe par le menu de partage du navigateur. Les fonctions système dépendent de la plateforme ; aucun envoi de notification push en arrière-plan n'est promis.

`npm run build` génère un service worker versionné d'après les fichiers émis. Le cache initial comprend le moteur de carte et son worker ; les API et images privées restent exclues. Dix images publiques au maximum sont conservées hors ligne (2 Mio maximum par image).

## Exemples

`data/examples.json` contient les briefs de 16 créations de démonstration. `node scripts/examples.mjs generate` passe par le même workflow que les joueurs et enregistre les résultats privés dans `output/examples/`. Après inspection visuelle, attribuer `is_demo=1` et `demo_votes` aux seuls exemples concernés, puis exécuter `node scripts/examples.mjs publish`. Les identifiants de requête sont conservés pour ne pas facturer deux fois le même démarrage.

Les votes réels restent dans `votes`. Les scores de démonstration sont séparés dans `demo_votes` et signalés par « démo » à côté du score, sur les cartes et dans la création. Ils ne représentent pas une fréquentation réelle. Les noms des builders figurent dans le classement.

La limite géographique provient du [contour officiel de Paris](https://geo.api.gouv.fr/communes/75056?fields=nom,contour&format=geojson&geometry=contour), bois de Boulogne et de Vincennes inclus. Les références aériennes utilisent [BD ORTHO](https://geoservices.ign.fr/bdortho), sous licence ouverte Etalab, et le [géocodage IGN](https://ignf.github.io/cartes.gouv.fr-documentation/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/). Une vue aérienne reste aérienne dans l'image générée : aucune fausse photographie de rue n'est substituée à l'adresse choisie.
