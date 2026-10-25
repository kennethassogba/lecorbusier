# Construire dans Paris

Recherche et décisions, 25 octobre 2026. Périmètre : sélection d'un lieu, dessin, volume, architecture, génération et consultation. Les 20 monuments et les adresses libres suivent le même parcours.

## Ce que la recherche change

| Source | Observation | Décision pour Corbs |
| --- | --- | --- |
| [Apple, Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) | Un panneau non modal peut agir sur le contenu derrière lui. La poignée annonce les positions disponibles. Empiler les panneaux brouille le retour. | Une seule surface persistante pour lieu, atelier et résultat. La carte reste manipulable. Poignée, boutons et clavier donnent accès aux mêmes positions. |
| [NN/g, Direct manipulation](https://www.nngroup.com/articles/direct-manipulation/) | L'objet doit rester visible, les actions produire un effet immédiat et être réversibles. Le geste seul peut pénaliser l'accessibilité et les valeurs précises. | Le volume réagit aux réglages sans appel réseau. Dessin par points, poignées déplaçables, annulation et hauteur numérique en complément du curseur. |
| [Autodesk, Basic buildings](https://www.autodesk.com/learn/ondemand/tutorial/basic-buildings-in-forma) | Le périmètre précède la hauteur dans la création d'un volume sur carte. | Entrée avec une emprise modifiable, puis hauteur et style. Le mode plan isole le tracé du geste d'orbite. |
| [Autodesk, 3D Sketch](https://blogs.autodesk.com/forma/2026/04/21/how-to-create-a-3d-sketch-building-in-forma-site-design/) | Un volume de base peut être affiné avant de définir ses étages. | Des formes de départ évitent une carte vide. Le joueur peut ensuite dessiner sa propre forme. Les planchers, façades et équipements suivent cette géométrie. |
| [Linear, Design refresh](https://linear.app/now/behind-the-latest-design-refresh) | Les contrôles secondaires peuvent perdre du poids visuel au bénéfice du travail en cours. | Regrouper les commandes de carte, retirer recherche et filtres pendant l'édition, conserver une action principale par étape. |
| [MapLibre, custom render input](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomRenderMethodInput/) | Une couche personnalisée partage la projection de la carte. | Construire des maillages Three.js en mètres, ancrés aux coordonnées du projet, avec profondeur commune aux bâtiments de Paris. |
| [OpenAI, Image generation](https://developers.openai.com/api/docs/guides/image-generation) | L'édition accepte plusieurs images de référence. | Envoyer la photo du lieu et la vue de la maquette, ainsi que les dimensions et le contour. La maquette reste la géométrie éditable ; l'image est une interprétation photographique guidée par ces références. |

## Parcours retenu

1. Choisir le monument, l'adresse ou le point. Ouvrir l'atelier au même endroit.
2. Voir immédiatement un volume en mètres. Modifier sa hauteur, choisir une emprise de départ ou tracer les angles en vue de dessus. Corriger les sommets, déplacer le volume, annuler.
3. Changer de style sur la même maquette : toiture, rythme des façades, structure, baies et refroidissement restent visibles. Tourner autour avec la carte ou les boutons.
4. Nommer et générer. Conserver le dessin et une capture de référence avec la proposition. Aucune modification de géométrie pendant la soumission.
5. Consulter l'image ou revenir à la maquette dans Paris. Remixer reprend les dimensions. Les anciennes créations restent des images ; leur remix ouvre un nouveau volume et ne prétend pas reconstruire leur géométrie.

## Choix visuels

Carte claire, surfaces blanches, texte noir et accent bleu. Pas d'ombre de tranche ni de perspective sur les cartes de photos. La profondeur appartient au bâtiment et à sa position dans Paris. Les couleurs de rendu restent neutres. Le monument existant reste visible comme contexte, sans déclarer les emprises proposées constructibles.

Les animations de panneau suivent le déplacement, puis se posent sans rebond. La transition de contenu est courte ; les réglages répétés répondent immédiatement. Le mouvement réduit conserve l'état sans trajet de caméra.

## Vérification prévue

- Géométrie : unités, surfaces, polygones concaves, auto-intersections, limites de Paris, hauteur et distance au lieu ; 20 monuments et 10 styles.
- Persistance : brouillon, proposition, publication, remix, confidentialité des références et compatibilité des anciens liens.
- Génération : deux références et dimensions effectivement transmises ; un essai réel privé après les tests avec fournisseur simulé.
- Interface : tactile simulé, souris, clavier, 320/390/788/1440 px, mouvement réduit, FR/EN, retour navigateur et conservation hors ligne.
- Rendu : screenshots après chargement de la carte, rotation, hauteur, tracé et visibilité des équipements.
- Limite de validation : l'émulation ne prouve pas le comportement d'un iPhone physique ni la sensation du geste sur cet appareil.
