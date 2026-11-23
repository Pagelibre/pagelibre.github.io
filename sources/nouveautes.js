/* Nouveautés de chaque version (la plus récente en premier).
   Affichées une fois à la première ouverture d'une nouvelle version, et dans Fichier › Aide.
   Le numéro de version (VERSION_NOM) vient de depot/package.json : le changer à chaque publication. */
const NOUVEAUTES = [
  {
    version: '1.1.3', date: '23/11/2026',
    points: [
      'Nouveau : remplissage à motif (hachures, trames, quadrillages…) pour les formes, les zones de texte et les cellules : Format › Motif.',
      'Correction : les hachures (motifs) ne disparaissent plus à l’enregistrement.',
      'Césure : le bouton agit aussi sur les tableaux. Exposant et Indice : retirent aussi ceux des fichiers .pub.',
      'Tabulations : les réglages partent de la valeur du document. Copier-coller d’un document à l’autre : les images suivent.'
    ]
  },
  {
    version: '1.1.2', date: '23/11/2026',
    points: [
      'Volet Pages : les aperçus ne sont plus rognés à droite.',
      'Fichiers .pub : diagrammes circulaires, hachures, ombres, groupes tournés et fonds d’image repris.',
      'Fichiers .pub : tabulations, coupure des mots, interligne de Times New Roman, exposants et gras conformes à l’original ; le texte ne chevauche plus les tableaux.',
      'Fichiers .pub : tableaux à la bonne hauteur, avec l’alignement vertical et les marges de chaque cellule.',
      'Équations : lettres grecques et grandes parenthèses correctes.'
    ]
  },
  {
    version: '1.1.1', date: '23/11/2026',
    points: [
      'Fichiers .pub : les traits horizontaux et verticaux s\'affichent (pointillés à compléter, axes, graduations, moustaches).',
      'Équations des fiches .pub : proportions respectées, nombres complets, symboles Σ, σ, × lisibles sur tous les ordinateurs.',
      'Fichiers .pub : petites capitales, indices (xᵢ, nᵢ) et exposants repris.',
      '« Page entière » montre toute la page : le bas n\'est plus coupé.'
    ]
  },
  {
    version: '1.1.0', date: '21/11/2026',
    points: [
      'Sécurité : un document reçu de quelqu\'un est nettoyé à l\'ouverture (aucun code ne peut s\'y cacher), et la page n\'exécute que le code de PageLibre.',
      'Polices libres intégrées aux mêmes mesures que Calibri, Cambria, Arial et Times New Roman : une fiche s\'affiche pareil sur tous les ordinateurs, et dans les PDF.',
      'Images allégées à l\'insertion ; Image › Compresser les images réduit tout le document.',
      'Nouveaux modèles (QCM, consignes de sécurité, déroulé de séance, planning) et « Mes modèles » : enregistrez vos propres fiches comme modèles.',
      'Tablette : défilement au doigt, zoom à deux doigts, poignées plus grandes au toucher.',
      'Accessibilité : texte de remplacement des images, navigation au clavier (Tab, F6), vérificateur d\'accessibilité.',
      'Pages d\'un PDF ou image en fond de page, pour écrire par-dessus un document existant.',
      'Aide intégrée (F1) et liens pour signaler un problème ou proposer une idée.'
    ]
  },
  {
    version: '1.0.0', date: '20/11/2026',
    points: ['Première version publique : mise en page complète dans le navigateur, application installable et hors connexion, ouverture des fichiers .pub, format ouvert .pagelibre, export PDF, PNG et page web.']
  }
];
