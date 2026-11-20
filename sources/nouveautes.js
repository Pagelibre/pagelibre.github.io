/* Nouveautés de chaque version (la plus récente en premier).
   Affichées une fois à la première ouverture d'une nouvelle version, et dans Fichier › Aide.
   Le numéro de version (VERSION_NOM) vient de depot/package.json : le changer à chaque publication. */
const NOUVEAUTES = [
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
