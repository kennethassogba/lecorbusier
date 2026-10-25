# Vérification de la construction en volume

25 octobre 2026. Parcours vérifié : lieu, volume, architecture, signature, génération, image et retour à la maquette.

- `npm run build` : TypeScript et compilation réussis. Le moteur Three.js est séparé du chargement initial et inclus dans le cache PWA.
- `npm test` : 20 tests réussis. Ils couvrent les 20 monuments et 10 styles, les unités, les contours concaves et invalides, les hauteurs extrêmes, la confidentialité, la persistance et la publication. Le fournisseur OpenAI est simulé dans ces tests.
- Pipeline : le test de runtime compare les octets des deux références envoyées au modèle. La maquette est la première image, la photo réelle la seconde. La géométrie enregistrée est identique à celle renvoyée par l'API.
- Adresses : la recherche IGN est filtrée sur Paris avant le classement des résultats, afin que les rues homonymes de banlieue ne masquent pas une adresse parisienne.
- Navigateur : ouverture de l'atelier pour les 20 monuments. Contour libre, déplacement de sommets au clavier, hauteur numérique et annulation vérifiés.
- Tactile simulé : le panneau se déplace pendant le geste, avant son relâchement. Le passage du lieu à l'atelier conserve le même panneau DOM.
- Affichage : 320, 390, 788 et 1440 px, sans débordement horizontal. Contrôles français et anglais vérifiés.
- Accessibilité : axe ne signale aucune violation dans l'étape Volume. L'injection de l'outil a nécessité de contourner la CSP dans le navigateur de test uniquement ; la CSP de l'application reste active.
- Hors ligne : rechargement de la PWA installée dans le navigateur de test, réouverture du Louvre, maquette visible et hauteur modifiée puis enregistrée sans connexion. Le cache ne couvre que les zones de carte déjà consultées ; la génération nécessite une connexion.
- Génération réelle : une création privée de la gare de Lyon a été produite sur le déploiement public. Le premier essai changeait le cadrage ; après priorité explicite à la maquette, le deuxième conserve la vue aérienne, le volume, la toiture et le rythme de façade. La gare est identifiable. Les essais n'ont pas été publiés dans le classement.

Limites : aucune mesure sur un téléphone physique. Une image générée peut encore varier dans ses détails ; la géométrie 3D enregistrée reste la référence éditable. Les placements sont des propositions créatives, pas une étude de constructibilité. La génération locale a échoué sur l'accès à la photo dans le workflow de développement ; le parcours réel a été validé sur le Worker déployé.

## Carte commune, couleurs et accueil

25 octobre 2026, complément.

- Les volumes publiés ont une couche Three.js commune, indépendante des filtres et de la fiche ouverte. Les maillages sont conservés pendant les votes et les actualisations ; la géométrie modifiée ou supprimée est libérée.
- Six palettes sont enregistrées dans le design. Le serveur valide leur identifiant. La référence visuelle et les instructions de génération conservent les couleurs des matériaux, avec une balance des blancs neutre.
- `npm test` : 22 tests réussis. Le nouveau test de scène couvre plusieurs positions géographiques, la réutilisation des maillages, la confidentialité, les modifications et leur destruction. Le test de génération/publication vérifie la palette et les deux images envoyées à OpenAI, avec un fournisseur simulé.
- Navigateur local : six volumes affichés ensemble ; un septième ajouté par une notification WebSocket simulée. Les filtres et la fermeture d'une fiche conservent les volumes. Un brouillon privé injecté dans la réponse de test reste exclu de la scène. Aucun de ces exemples de test n'a été publié.
- Sélection directe d'un maillage, choix de couleur au clavier, persistance du brouillon et boutons de 44 px vérifiés. Aucun débordement à 320, 390, 788 et 1440 px. Axe ne signale aucune violation dans l'étape Architecture. CSP contournée uniquement dans le navigateur de test pour charger axe, puis rétablie.
- Accueil : nouvelle session, rechargement après fermeture, lien de création et action Choisir un lieu vérifiés. L'état est enregistré à la fermeture dans sessionStorage, au lieu du marqueur localStorage permanent. Les liens partagés chargent leur création derrière le dialogue.
- `npm audit --omit=dev` : aucune vulnérabilité signalée.

Référence pour la durée des sessions : [MDN, sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage). Les anciens exemples qui ne possèdent pas de volume enregistré conservent leur repère photo. Pas de test sur téléphone physique, ni de nouvelle génération OpenAI facturée pour cette modification.
