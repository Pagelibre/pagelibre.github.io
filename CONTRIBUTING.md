# Contribuer à PageLibre

Merci de votre intérêt ! PageLibre est un logiciel libre (GPL v3 ou ultérieure) : toute contribution est la bienvenue.

## Sans écrire de code

- **Signaler un problème** ou **proposer une idée** : [ouvrir un ticket](../../issues/new/choose).
- **Partager un modèle** de fiche : ticket « Proposer un modèle », avec le fichier `.pagelibre`.
- Ce qui est écrit dans un ticket est **public** : n'y mettez aucune donnée personnelle (noms d'élèves, photos de personnes, coordonnées).

## Avec du code

- Le code est dans `sources/` : du JavaScript sans dépendance ni étape de compilation. `node build.js` assemble le site dans `docs/` et le fichier unique `dist/PageLibre.html`.
- Les tests de bout en bout se lancent avec `node tests/tout.js` (Microsoft Edge et Node.js 22 ou plus récent). Les tests qui ont besoin d'une vraie fiche `.pub` se lancent avec `--pub "fiche.pub"`.
- À chaque envoi sur `main`, GitHub lance les tests ; le site n'est mis en ligne que s'ils passent.
- Règles du projet :
  - **rien ne quitte l'appareil** : pas de serveur, pas de statistiques, pas de chargement depuis Internet (la règle de sécurité CSP de la page l'interdit) ;
  - un document ouvert peut venir de n'importe qui : tout contenu passe par `assainirFiche` (`sources/securite.js`) ;
  - l'interface est en français, simple, proche d'un logiciel de PAO classique ;
  - une nouvelle fonction vient avec son test dans `tests/`.
- Pour une nouvelle version : changer `version` dans `package.json` et ajouter ses nouveautés en tête de `sources/nouveautes.js` (affichées dans l'application et reprises dans `CHANGELOG.md`).

## Licence des contributions

En proposant du code, un modèle ou une image, vous acceptez qu'ils soient diffusés sous la licence de PageLibre (GNU GPL version 3 ou ultérieure).
