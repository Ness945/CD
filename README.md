# Calculateur SPRINT & GMT

Outil de poste pour le calcul des ajustements NST : centrage, longueur de fil
(SPRINT) et mise en angle (GMT). Page unique, utilisable sur téléphone, **sans
réseau**, et installable sur l'écran d'accueil.

👉 **[Ouvrir le calculateur](https://ness945.github.io/CD/)**

## Utilisation

1. Saisir les valeurs **attendues** et **mesurées** des deux côtés.
2. Lire les ajustements à reporter sur l'IHM.
3. Déplier « Détail du calcul » pour voir le raisonnement et la prévision finale.

Les saisies, le thème, l'onglet et le mode NST sont conservés d'une session à
l'autre. Le bouton « Réinitialiser les champs » remet les valeurs par défaut.

### SPRINT

Le centrage se déduit de l'écart côté **Coupe** ; la longueur de fil se calcule
ensuite sur le côté **Frein**, une fois le centrage appliqué.

Le sélecteur **NST1 / NST2** inverse les rôles des deux côtés :

| Mode | Côté A | Côté B |
| ---- | ------ | ------ |
| NST1 | Frein  | Coupe  |
| NST2 | Coupe  | Frein  |

### GMT

La **mise en angle** corrige la longueur totale : elle agit symétriquement sur
les deux côtés, par pas d'une demi-dent. Le **centrage** répartit ensuite entre
les côtés sans changer cette somme.

Un déficit symétrique ne se rattrape donc pas au centrage : déplacer de la
matière vers A la retire d'autant à B. Le centrage se calcule sur le
*déséquilibre* entre les côtés, pas sur le résidu d'un seul côté.

## Paramètres métier

Ils sont regroupés dans `PARAMS`, en haut de [`assets/calc.js`](assets/calc.js).

| Paramètre | Valeur | Signification |
| --------- | ------ | ------------- |
| `TOLERANCE` | 0,5 mm | En deçà, la pose est conforme : aucun ajustement proposé |
| `SPRINT.IHM_PAR_MM_CENTRAGE` | 0,2 | 1 mm de décalage = 0,2 unité IHM |
| `SPRINT.IHM_PAR_MM_LONGUEUR` | 1,5 | 1 mm de longueur = 1,5 unité IHM |
| `SPRINT.PAS_CENTRAGE` | 0,1 | Pas saisissable sur l'IHM |
| `SPRINT.PAS_LONGUEUR` | 0,25 mm | Pas saisissable sur l'IHM |
| `GMT.MM_PAR_DENT` | 2,78 mm | Longueur totale ajoutée par dent complète |
| `GMT.IHM_PAR_MM_CENTRAGE` | 5 | 1 mm vers A = +5 unités IHM |

Modifier une de ces valeurs suffit à adapter l'outil ; **relancer les tests
ensuite**, plusieurs d'entre eux portent sur ces constantes.

## Tests

36 tests couvrent la logique de calcul : tolérance, inversion NST1/NST2,
arrondi au pas machine, rejet des saisies vides, et vérification que chaque
correction proposée rapproche bien de la cible.

Trois d'entre eux balaient l'espace des mesures (2 401 combinaisons par mode)
et vérifient qu'**aucune prévision ne sort de la tolérance de 0,5 mm**. C'est
cette propriété qui a révélé l'erreur de centrage GMT : l'ancienne formule
sortait de la tolérance dans 27 % des cas, avec un pire écart de 0,77 mm.

- **Dans l'application** : section « 🧪 Tests intégrés » → *Exécuter*.
  Ils portent sur des valeurs en mémoire et ne touchent pas aux saisies.
- **En ligne de commande** : `node assets/tests.js` (code de sortie non nul en
  cas d'échec, utilisable en intégration continue).

## Structure

```
index.html                 Interface (la seule page servie)
assets/calc.js             Logique de calcul — fonctions pures, sans DOM
assets/tests.js            Tests, exécutables en navigateur et sous Node
assets/app.css             Styles, écrits pour cet outil (sans framework)
assets/readout.woff2       Chiffres de l'afficheur — police réduite, 1,5 Ko
sw.js                      Service worker — fonctionnement hors ligne
manifest.webmanifest       Installation sur l'écran d'accueil
3X8.html                   Planning 3x8 (outil distinct)
archive/                   Versions antérieures, conservées pour référence
```

`assets/calc.js` ne lit ni n'écrit dans le DOM. C'est ce qui permet de tester
les formules sans navigateur, et de les réutiliser ailleurs.

## Développement

Aucune compilation, aucune dépendance à installer. Pour travailler en local :

```bash
python3 -m http.server 8000
```

puis ouvrir <http://127.0.0.1:8000>. Un serveur est nécessaire : le service
worker ne s'enregistre pas depuis un `file://`.

### Parti pris de l'interface

L'outil se lit à une main, debout, au poste. L'afficheur est donc placé
**au-dessus** des champs, comme sur une calculatrice : on y revient à chaque
saisie, il ne doit jamais demander de défiler. Les quatre mesures tiennent
dans une grille 2 × 2 plutôt qu'en colonne, ce qui divise par deux la hauteur
occupée.

Tailwind a été retiré : `assets/app.css` est écrit pour cet outil. Les deux
pièges à connaître :

- **Spécificité.** `.btn:hover` (0,2,0) l'emporte sur une classe d'état
  (0,1,0). Tout état visuel qui doit survivre au survol s'écrit avec son
  propre `:hover`.
- **Contraste.** Le panneau de l'afficheur est noir dans les deux thèmes, et
  les signaux y ont des teintes éclaircies propres. Viser 4,5:1 minimum sur la
  ligne de consigne, qui est la plus lue.

Les chiffres de l'afficheur utilisent DejaVu Sans Condensed Bold réduit aux
caractères employés (1,5 Ko). Pour le régénérer après ajout d'un caractère :

```bash
python3 -m fontTools.subset /chemin/DejaVuSansCondensed-Bold.ttf \
  --text="0123456789+-−.,/ " --flavor=woff2 --layout-features='' \
  --output-file=assets/readout.woff2
```

### Après modification du service worker ou des ressources

Incrémenter `VERSION` dans [`sw.js`](sw.js), sinon les anciens fichiers
resteront servis depuis le cache des appareils.
