# Le Corbusier

[Ouvrir l'app](https://keff.uk/lecorbusier/)

Un jeu satirique d'architecture collective. Choisir un vrai lieu de Paris, y imaginer un data center, signer les plans et publier sur la carte commune. Sans compte.

## Ce qui est livré

- 20 lieux de Paris avec photographies réelles, coordonnées et crédits Wikimedia.
- 10 styles architecturaux et instructions libres.
- Brief architectural et légende par `gpt-5.4-mini`, image par `gpt-image-2.5-sunburst` à partir de la photo originale.
- Génération persistante dans Cloudflare Workflows, reprise dans « Mes plans ».
- Carte partagée, notifications WebSocket, votes réversibles et palmarès.
- Liens publics avec métadonnées sociales, comparaison avant/après et export PNG/story.
- PWA installable. L'interface et les photos consultées fonctionnent hors ligne ; génération, carte en ligne et publication nécessitent le réseau.

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

La carte utilise [OpenStreetMap](https://www.openstreetmap.org/copyright), via Leaflet. Les tuiles sont chargées uniquement pour la vue affichée, sans téléchargement de carte hors ligne. Le service de tuiles communautaire est fourni sans garantie de disponibilité ; pour une audience importante, utiliser un fournisseur adapté.

Documentation technique : [OpenAI Images](https://developers.openai.com/api/docs/guides/image-generation), [Cloudflare Workflows](https://developers.cloudflare.com/workflows/build/workers-api/), [Cloudflare CLI](https://developers.cloudflare.com/cf/projects/).
