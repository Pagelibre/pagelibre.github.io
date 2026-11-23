# PageLibre

**Logiciel libre et gratuit de mise en page, dans le navigateur.**
Affiches, fiches, brochures, attestations… avec un ruban, des pages, des cadres de texte et d'image, comme dans un logiciel de PAO classique. Il s'installe comme une application, fonctionne hors connexion, et **vos documents restent sur votre ordinateur**.

👉 **Utiliser PageLibre : https://pagelibre.github.io/**

![PageLibre : édition d'une fiche](captures/editeur.png)

## Ce que fait PageLibre

- **Mise en page libre** : zones de texte, images (rognage à la souris, corrections), formes, traits et flèches, tableaux (fusion, bordures, diagonales), WordArt, groupes, pages maîtres, numéros de page.
- **Texte soigné** : styles liés, puces et numérotation automatique, lettrines, colonnes, taquets de tabulation (gauche, centré, droite, décimal), césure française, espacement des caractères, cadres chaînés (le texte continue d'un cadre à l'autre), habillage autour des images (carré ou serré).
- **Mise en page précise** : règles, guides magnétiques, grille de mise en page, lignes de base, alignement et répartition, affichage deux pages.
- **Effets** : ombres, lueur, reflet, biseau, profondeur et rotation 3D, dégradés, transparence ; jeux de couleurs et de polices.
- **Modèles prêts à l'emploi** : fiche de TP, fiche d'évaluation, fiche de procédure, QCM, consignes de sécurité, déroulé de séance, planning, affiche A3, attestation ; et **vos propres modèles** (Fichier › Nouveau › Mes modèles).
- **Pareil partout** : polices libres intégrées aux mêmes mesures que Calibri, Cambria, Arial et Times New Roman (Carlito, Caladea, Arimo, Tinos) ; la mise en page ne dépend pas des polices installées sur l'ordinateur.
- **Léger** : les images sont allégées à l'insertion ; « Compresser les images » réduit tout le document pour un mail ou un ENT.
- **Pages d'un PDF en fond** : pour écrire par-dessus un document existant ou scanné.
- **Tablette** : défilement au doigt, zoom à deux doigts, poignées plus grandes au toucher.
- **Accessible** : texte de remplacement des images, navigation au clavier (Tab, F6), vérificateur d'accessibilité, aide intégrée (F1).
- **Anciens fichiers .pub** : PageLibre ouvre les fichiers .pub (versions 2003 à 2019) pour continuer à les modifier — y compris les images vectorielles EMF/WMF qu'ils contiennent. Le fichier d'origine n'est jamais modifié.

![Modèles](captures/modeles.png)

## Installer l'application

1. Ouvrez **https://pagelibre.github.io/** dans **Microsoft Edge** ou **Google Chrome**.
2. Cliquez sur le bouton jaune **« Installer l'application »** (en haut à droite), ou sur l'icône d'installation dans la barre d'adresse.
3. PageLibre apparaît dans le menu Démarrer, s'ouvre dans sa propre fenêtre et **fonctionne sans Internet**. L'ouverture des fichiers `.pagelibre` et `.pub` par double-clic est prévue (Windows peut demander une autorisation), mais n'a pas encore été vérifiée sur plusieurs postes.

Les mises à jour arrivent toutes seules : un message « Nouvelle version disponible » propose de recharger.
**Navigateurs testés** : Microsoft Edge uniquement à ce jour. Chrome repose sur le même moteur ; Firefox et Safari n'ont pas été testés, et Firefox ne propose pas d'installer l'application sur ordinateur.

## Fichiers

| Format | Usage |
|---|---|
| `.pagelibre` | format natif, ouvert (JSON) : pages, styles, images intégrées |
| `.html` | page web autonome : un seul fichier, s'ouvre d'un double-clic et reste modifiable |
| `.png` | export d'une page ou de toutes les pages en images |
| PDF | par l'impression du navigateur (« Enregistrer au format PDF ») ; traits de coupe et fond perdu possibles |
| `.pub` | ouverture seulement (pas d'enregistrement dans ce format) |

## Confidentialité

Aucune donnée n'est collectée : pas de compte, pas de cookies, pas de statistiques, pas de publicité. Tout reste sur votre appareil.
Un document reçu de quelqu'un est nettoyé à l'ouverture (seul le contenu mis en forme est gardé) et la page n'exécute que le code de PageLibre (règle de sécurité CSP). Voir [la page Confidentialité](https://pagelibre.github.io/confidentialite.html).

## Développement

- `sources/` : le code (JavaScript sans dépendance, sans étape de compilation).
- `node build.js` : assemble le site dans `docs/` (publié par GitHub Pages) et l'application en un seul fichier `dist/PageLibre.html`.
- `tests/` : tests de bout en bout dans Edge sans fenêtre : `node tests/tout.js`. Ils tournent sur GitHub à chaque envoi ; le site n'est mis en ligne que s'ils passent.
- Composants intégrés : polices Carlito, Caladea, Arimo, Tinos (SIL OFL 1.1, `sources/polices/LICENCE.txt`) ; pdf.js de Mozilla 4.10.38 (Apache 2.0, `sources/vendor/pdfjs/`), chargé seulement pour importer un PDF.
- Contribuer : voir [CONTRIBUTING.md](CONTRIBUTING.md). Nouveautés de chaque version : [CHANGELOG.md](CHANGELOG.md).

## Signaler un problème, proposer une idée

[Ouvrir un ticket](../../issues/new/choose) : problème, idée ou modèle à partager. Ce qui est écrit dans un ticket est public : n'y mettez aucune donnée personnelle.

## Licence

PageLibre est un logiciel libre distribué sous licence **GNU GPL version 3 ou ultérieure** : voir [LICENSE](LICENSE).
Vous pouvez l'utiliser, l'étudier, le modifier et le redistribuer ; toute version modifiée diffusée doit rester libre.

---

PageLibre n'est pas affilié à Microsoft. Microsoft et Publisher sont des marques de Microsoft Corporation, citées uniquement pour indiquer la compatibilité des fichiers .pub.
