# Vérification de la construction en volume

25 octobre 2026. Parcours vérifié : lieu, volume, architecture, signature, génération, image et retour à la maquette.

- `npm run build` : TypeScript et compilation réussis. Le moteur Three.js est séparé du chargement initial et inclus dans le cache PWA.
- `npm test` : 19 tests réussis. Ils couvrent les 20 monuments et 10 styles, les unités, les contours concaves et invalides, les hauteurs extrêmes, la confidentialité, la persistance et la publication. Le fournisseur OpenAI est simulé dans ces tests.
- Pipeline : le test de runtime compare les octets des deux références envoyées au modèle. La maquette est la première image, la photo réelle la seconde. La géométrie enregistrée est identique à celle renvoyée par l'API.
- Navigateur : ouverture de l'atelier pour les 20 monuments. Contour libre, déplacement de sommets au clavier, hauteur numérique et annulation vérifiés.
- Tactile simulé : le panneau se déplace pendant le geste, avant son relâchement. Le passage du lieu à l'atelier conserve le même panneau DOM.
- Affichage : 320, 390, 788 et 1440 px, sans débordement horizontal. Contrôles français et anglais vérifiés.
- Accessibilité : axe ne signale aucune violation dans l'étape Volume. L'injection de l'outil a nécessité de contourner la CSP dans le navigateur de test uniquement ; la CSP de l'application reste active.
- Hors ligne : rechargement de la PWA installée dans le navigateur de test, réouverture du Louvre, maquette visible et hauteur modifiée puis enregistrée sans connexion. Le cache ne couvre que les zones de carte déjà consultées ; la génération nécessite une connexion.
- Génération réelle : une création privée de la gare de Lyon a été produite sur le déploiement public. Le premier essai changeait le cadrage ; après priorité explicite à la maquette, le deuxième conserve la vue aérienne, le volume, la toiture et le rythme de façade. La gare est identifiable. Les essais n'ont pas été publiés dans le classement.

Limites : aucune mesure sur un téléphone physique. Une image générée peut encore varier dans ses détails ; la géométrie 3D enregistrée reste la référence éditable. Les placements sont des propositions créatives, pas une étude de constructibilité. La génération locale a échoué sur l'accès à la photo dans le workflow de développement ; le parcours réel a été validé sur le Worker déployé.
