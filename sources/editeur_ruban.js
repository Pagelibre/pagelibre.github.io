/* =====================================================================
   Éditeur : ruban, menus, boîtes de dialogue
   ===================================================================== */
const ic = n => (ICONES[n] || '');
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function grand(cmd, icone, lib, opt = {}) {
  return `<button class="btn grand" ${opt.menu ? `data-menu="${opt.menu}"` : `data-cmd="${cmd}"`} ${opt.val != null ? `data-val="${esc(opt.val)}"` : ''} title="${esc(opt.titre || lib)}" ${opt.etat ? `data-etat="${opt.etat}"` : ''}>${ic(icone)}<span class="lib">${lib}${opt.menu ? ' <span class="fl">▾</span>' : ''}</span></button>`;
}
function petit(cmd, icone, lib, opt = {}) {
  return `<button class="btn" ${opt.menu ? `data-menu="${opt.menu}"` : `data-cmd="${cmd}"`} ${opt.val != null ? `data-val="${esc(opt.val)}"` : ''} title="${esc(opt.titre || lib || '')}" ${opt.etat ? `data-etat="${opt.etat}"` : ''}>${ic(icone)}${lib ? `<span>${lib}</span>` : ''}${opt.menu ? '<span class="fl">▾</span>' : ''}</button>`;
}
function lettre(cmd, l, cls, titre) {
  return `<button class="btn lettre ${cls}" data-cmd="${cmd}" data-etat="${cmd}" title="${esc(titre)}">${l}</button>`;
}
function groupe(nom, corps) { return `<div class="groupe"><div class="groupe-corps">${corps}</div><div class="groupe-nom">${nom}</div></div>`; }
const col = (...x) => `<div class="col">${x.join('')}</div>`;
const lig = (...x) => `<div class="ligne">${x.join('')}</div>`;
const champ = (id, titre, etiq, ic_) => `<div class="ligne"><span class="etiq">${ic_ ? ic(ic_) : ''} ${etiq}</span><input id="${id}" class="champ champ-num" title="${esc(titre)}" data-champ="${id}"></div>`;

function construireRuban() {
  const tailles = TAILLES.map(t => `<option value="${String(t).replace('.', ',')}">${String(t).replace('.', ',')}</option>`).join('');
  const P = {
    accueil:
      groupe('Presse-papiers', grand('coller', 'coller', 'Coller', { titre: 'Coller (Ctrl+V)' }) + col(petit('couper', 'couper', 'Couper', { titre: 'Couper (Ctrl+X)' }), petit('copier', 'copier', 'Copier', { titre: 'Copier (Ctrl+C)' }), petit('pinceau', 'pinceau', 'Reproduire la mise en forme', { etat: 'pinceau', titre: 'Pinceau : copie la mise en forme puis cliquez sur la cible' }))) +
      groupe('Police', col(
        lig(`<select id="c-police" class="champ" style="width:150px" title="Police">${POLICES.map(p => `<option value="${p}" style="font-family:'${p}'">${p}</option>`).join('')}</select>`,
          `<input id="c-taille" class="champ" style="width:46px" list="l-tailles" title="Taille de police"><datalist id="l-tailles">${tailles}</datalist>`,
          petit('agrandir', 'agrandir', '', { titre: 'Augmenter la taille de police' }), petit('reduire', 'reduire', '', { titre: 'Réduire la taille de police' })),
        lig(lettre('gras', 'G', '', 'Gras (Ctrl+B)'), lettre('italique', 'I', 'i', 'Italique (Ctrl+I)'), lettre('souligne', 'S', 'u', 'Souligné (Ctrl+U)'), lettre('petitesCapitales', 'Aᴀ', '', 'Petites capitales'),
          petit('exposant', 'exposant', '', { titre: 'Exposant' }), petit('indice', 'indice', '', { titre: 'Indice' }),
          `<button class="btn couleur" data-menu="couleurTexte" title="Couleur de police">${ic('couleurTexte')}<span class="barre-couleur" id="barre-couleur-texte" style="background:#c00000"></span></button>`,
          petit('effacer', 'effacerFormat', '', { titre: 'Effacer la mise en forme' }), petit('', 'espacement', '', { menu: 'espacement', titre: 'Espacement des caractères' })))) +
      groupe('Paragraphe', col(
        lig(petit('', 'puces', '', { menu: 'puces', titre: 'Puces et numéros' }), petit('retraitMoins', 'retraitMoins', '', { titre: 'Diminuer le retrait' }), petit('retraitPlus', 'retraitPlus', '', { titre: 'Augmenter le retrait' }), petit('', 'interligne', '', { menu: 'interligne', titre: 'Interligne' }), petit('', 'lettrine', '', { menu: 'lettrine', titre: 'Lettrine' })),
        lig(petit('aligner', 'gauche', '', { val: 'left', etat: 'aligner:left', titre: 'Aligner à gauche' }), petit('aligner', 'centre', '', { val: 'center', etat: 'aligner:center', titre: 'Centrer' }),
          petit('aligner', 'droite', '', { val: 'right', etat: 'aligner:right', titre: 'Aligner à droite' }), petit('aligner', 'justifie', '', { val: 'justify', etat: 'aligner:justify', titre: 'Justifier' }),
          petit('paragraphe', '', 'Paragraphe…', { titre: 'Retraits et espacements' })))) +
      groupe('Styles', grand('', 'styles', 'Styles', { menu: 'styles', titre: 'Styles de texte (Titre 1, Normal…)' })) +
      groupe('Objets', grand('dessinTexte', 'zoneTexte', 'Zone de texte', { titre: 'Dessiner une zone de texte' }) + grand('insererImage', 'image', 'Images') + grand('', 'formes', 'Formes', { menu: 'formes' }) + grand('', 'tableau', 'Tableau', { menu: 'tableau' })) +
      groupe('Organiser', col(petit('', 'premierPlan16', 'Premier plan', { menu: 'premierPlan' }), petit('', 'arrierePlan16', 'Arrière-plan', { menu: 'arrierePlan' }), petit('', 'aligner', 'Aligner', { menu: 'aligner' })) +
        col(petit('grouper', 'grouper', 'Grouper', { titre: 'Grouper (Ctrl+G)' }), petit('dissocier', 'dissocier', 'Dissocier', { titre: 'Dissocier (Ctrl+Maj+G)' }), petit('', 'rotation', 'Faire pivoter', { menu: 'rotation' }))) +
      groupe('Modification', col(petit('toutSelectionner', 'toutSelect', 'Sélectionner tout', { titre: 'Ctrl+A' }), petit('supprimer', 'supprimer', 'Supprimer', { titre: 'Suppr' }), petit('police', '', 'Police…')) +
        col(petit('rechercher', 'rechercher', 'Rechercher', { titre: 'Ctrl+F' }), petit('remplacer', 'remplacer', 'Remplacer', { titre: 'Ctrl+H' }))),
    insertion:
      groupe('Pages', grand('', 'page', 'Page', { menu: 'page' }) + grand('', 'numeroPage', 'Numéro de page', { menu: 'numeros' })) +
      groupe('Tableaux', grand('', 'tableau', 'Tableau', { menu: 'tableau' })) +
      groupe('Blocs de construction', grand('', 'blocs', 'Blocs', { menu: 'blocs', titre: 'Bandeau, encadré, calendrier, cartouche…' })) +
      groupe('Illustrations', grand('insererImage', 'image', 'Images', { titre: 'Insérer une image depuis un fichier' }) + grand('', 'formes', 'Formes', { menu: 'formes' }) +
        grand('importerPDF', 'pdf', 'Pages d\'un PDF', { titre: 'Chaque page d\'un PDF devient le fond d\'une page, pour écrire par-dessus' })) +
      groupe('Texte', grand('dessinTexte', 'zoneTexte', 'Zone de texte') + grand('wordart', 'wordart', 'WordArt') + grand('', 'symbole', 'Symbole', { menu: 'symboles' }) + grand('lien', 'lien', 'Lien', { titre: 'Lien hypertexte (Ctrl+K)' })),
    creation:
      groupe('Mise en page', grand('', 'marges', 'Marges', { menu: 'marges' }) + grand('', 'orientation', 'Orientation', { menu: 'orientation' }) + grand('', 'taillePage', 'Taille', { menu: 'taillePage' })) +
      groupe('Pages maîtres', grand('', 'pageMaitre', 'Pages maîtres', { menu: 'maitres' })) +
      groupe('Jeux', grand('', 'jeuCouleurs', 'Couleurs', { menu: 'jeuCouleurs', titre: 'Jeu de couleurs de la fiche' }) + grand('', 'jeuPolices', 'Polices', { menu: 'jeuPolices', titre: 'Jeu de polices (titres et texte)' })) +
      groupe('Arrière-plan', grand('', 'couleurPage', 'Couleur de page', { menu: 'couleurPage' }) + grand('', 'fondPage', 'Image de fond', { menu: 'fondPage', titre: 'Image ou page de PDF en fond de page (document scanné…)' })) +
      groupe('Disposition', grand('reperes', 'reperes', 'Repères de marge', { etat: 'opt:reperes' }) + grand('', 'guides', 'Guides', { menu: 'guides', titre: 'Guides de règle (vous pouvez aussi les tirer depuis les règles)' }) + grand('titreFiche', 'page', 'Titre de la fiche')),
    affichage:
      groupe('Afficher', col(
        `<label class="btn"><input type="checkbox" data-opt="regles"> Règles</label>`,
        `<label class="btn"><input type="checkbox" data-opt="reperes"> Repères de marge</label>`,
        `<label class="btn"><input type="checkbox" data-opt="limites"> Limites des cadres</label>`) +
        col(`<label class="btn"><input type="checkbox" data-opt="volet"> Volet Pages</label>`,
          `<label class="btn"><input type="checkbox" data-opt="magnetisme"> Magnétisme</label>`,
          `<label class="btn"><input type="checkbox" data-opt="deuxPages"> Deux pages côte à côte</label>`) +
        col(`<label class="btn" title="L'avocat du bandeau bleu"><input type="checkbox" data-opt="mascotte"> Mascotte</label>`, `<label class="btn" title="Sans cocher : Ctrl+molette pour zoomer, molette seule pour défiler (comme en PAO)"><input type="checkbox" data-opt="zoomMolette"> Zoom avec la molette seule</label>`)) +
      groupe('Zoom', grand('zoomPage', 'pageEntiere', 'Page entière') + grand('zoomLargeur', 'largeurPage', 'Largeur de page') + grand('zoom100', 'zoom100', '100 %') +
        col(petit('zoomPlus', '', '＋ Zoom avant'), petit('zoomMoins', '', '－ Zoom arrière'))) +
      groupe('Vérifier', grand('verifierAccessibilite', 'accessibilite', 'Accessibilité', { titre: 'Vérifier l\'accessibilité : images non décrites, textes trop petits ou peu contrastés' }) +
        grand('aide', 'aide', 'Aide', { titre: 'Aide (F1)' })),
    format:
      groupe('Styles de forme', grand('', 'remplissage', 'Remplissage', { menu: 'remplissage' }) + grand('', 'contour', 'Contour', { menu: 'contour' }) + grand('', 'effets', 'Effets', { menu: 'effets', titre: 'Ombre, lueur, transparence' }) + col(petit('degrade', 'remplissage', 'Dégradé…'), petit('motif', 'motif', 'Motif…', { titre: 'Remplissage à motif : hachures, trames, quadrillages…' }))) +
      `<div class="groupe g-texte">${'<div class="groupe-corps">' + col(petit('', 'gauche', 'Alignement vertical', { menu: 'vertical' }), petit('', 'marges', 'Marges du texte', { menu: 'margesTexte' }), petit('sensTexte', 'rotation', 'Sens du texte', { titre: 'Texte vertical' })) +
        col(petit('', 'ajuster', 'Ajuster le texte', { menu: 'ajuster' }), petit('', 'colonnes', 'Colonnes', { menu: 'colonnes' }), petit('taquets', 'tabulations', 'Taquets…', { titre: 'Taquets de tabulation' })) +
        col(petit('creerLien', 'lienCadre', 'Créer un lien', { titre: 'Faire continuer le texte dans une autre zone de texte' }), petit('romprelien', 'romprelien', 'Rompre le lien'), petit('', 'lettrine', 'Lettrine', { menu: 'lettrine' })) +
        col(petit('cesure', 'cesure', 'Césure', { etat: 'cesure', titre: 'Couper les mots en fin de ligne' }), petit('calage', 'lignesBase', 'Caler sur les lignes de base', { etat: 'calage', titre: 'Aligner les lignes de texte sur les repères de ligne de base' })) + '</div><div class="groupe-nom">Zone de texte</div>'}</div>` +
      groupe('Organiser', col(petit('', 'premierPlan16', 'Premier plan', { menu: 'premierPlan' }), petit('', 'arrierePlan16', 'Arrière-plan', { menu: 'arrierePlan' }), petit('', 'aligner', 'Aligner', { menu: 'aligner' })) +
        col(petit('retournerH', 'retournerH', 'Retourner horiz.'), petit('retournerV', 'retournerV', 'Retourner vert.'), petit('', 'rotation', 'Faire pivoter', { menu: 'rotation' })) +
        col(petit('', 'habillage', 'Habillage du texte', { menu: 'habillage' }), petit('grouper', 'grouper', 'Grouper'), petit('dissocier', 'dissocier', 'Dissocier'))) +
      groupe('Taille et position', col(champ('c-h', 'Hauteur (cm)', 'Hauteur'), champ('c-w', 'Largeur (cm)', 'Largeur'), champ('c-rot', 'Rotation (degrés)', 'Rotation')) + col(champ('c-x', 'Position horizontale (cm)', 'Horiz.'), champ('c-y', 'Position verticale (cm)', 'Vert.'))),
    image:
      groupe('Ajuster', grand('', 'corrections', 'Corrections', { menu: 'corrections', titre: 'Luminosité, contraste, niveaux de gris…' }) + grand('changerImage', 'changerImageG', 'Changer l\'image') +
        grand('rogner', 'rognerG', 'Rogner', { etat: 'rogner', titre: 'Rogner à la souris (poignées noires)' }) + col(petit('rognerValeurs', 'rogner', 'Rogner (valeurs)…'), petit('proportions', 'tailleOrigine', 'Proportions d\'origine'), petit('sansRognage', '', 'Annuler le rognage')) +
        grand('compresserImages', 'compresser', 'Compresser', { titre: 'Compresser les images du document (plus léger à envoyer)' })) +
      groupe('Accessibilité', grand('texteRemplacement', 'texteAlt', 'Texte de remplacement', { titre: 'Décrire l\'image pour les lecteurs d\'écran et les PDF accessibles' })) +
      groupe('Styles d\'image', grand('', 'contour', 'Bordure', { menu: 'contour' }) + grand('', 'effets', 'Effets', { menu: 'effets' })) +
      groupe('Organiser', col(petit('', 'premierPlan16', 'Premier plan', { menu: 'premierPlan' }), petit('', 'arrierePlan16', 'Arrière-plan', { menu: 'arrierePlan' }), petit('', 'habillage', 'Habillage du texte', { menu: 'habillage' })) + col(petit('retournerH', 'retournerH', 'Retourner horiz.'), petit('retournerV', 'retournerV', 'Retourner vert.'), petit('', 'rotation', 'Faire pivoter', { menu: 'rotation' }))) +
      groupe('Taille', col(champ('c-h', 'Hauteur (cm)', 'Hauteur'), champ('c-w', 'Largeur (cm)', 'Largeur'), champ('c-rot', 'Rotation (degrés)', 'Rotation')) + col(champ('c-x', 'Position horizontale (cm)', 'Horiz.'), champ('c-y', 'Position verticale (cm)', 'Vert.'))),
    tableau:
      groupe('Styles', grand('', 'tableau', 'Styles de tableau', { menu: 'stylesTableau' })) +
      groupe('Lignes et colonnes', col(petit('insLigne', 'insLigneAvant', 'Insérer au-dessus', { val: 'avant' }), petit('insLigne', 'insLigneApres', 'Insérer en dessous', { val: 'apres' }), petit('supLigne', 'supLigne', 'Supprimer la ligne')) +
        col(petit('insColonne', 'insColAvant', 'Insérer à gauche', { val: 'avant' }), petit('insColonne', 'insColApres', 'Insérer à droite', { val: 'apres' }), petit('supColonne', 'supCol', 'Supprimer la colonne'))) +
      groupe('Fusion', col(petit('fusionner', 'fusionner', 'Fusionner les cellules', { titre: 'Choisir les cellules avec Maj+clic' }), petit('fractionner', 'fractionner', 'Fractionner'))) +
      groupe('Cellules', grand('', 'remplissage', 'Remplissage', { menu: 'fondCellule' }) + grand('', 'bordures', 'Bordures', { menu: 'bordures' }) +
        col(petit('', 'gauche', 'Alignement vertical', { menu: 'verticalCellule' }), petit('sensCellule', 'rotation', 'Texte vertical'), petit('', 'contour', 'Style de bordure', { menu: 'styleBord' })) +
        col(petit('', 'diagonale', 'Diagonale', { menu: 'diagonale', titre: 'Couper la cellule en diagonale' }), petit('motifCellules', 'motif', 'Motif…', { titre: 'Remplissage à motif des cellules (hachures…)' }), petit('cesure', 'cesure', 'Césure', { etat: 'cesure', titre: 'Couper les mots en fin de ligne dans le tableau' }))) +
      groupe('Taille', col(champ('c-hl', 'Hauteur de la ligne (cm)', 'Ligne'), champ('c-lc', 'Largeur de la colonne (cm)', 'Colonne'), lig(petit('repartirLignes', '', 'Répartir lignes'))) + col(champ('c-x', 'Position horizontale (cm)', 'Horiz.'), champ('c-y', 'Position verticale (cm)', 'Vert.'), lig(petit('repartirColonnes', '', 'Répartir colonnes'))))
  };
  P.maitre =
    groupe('Page maître', grand('maitreNouvelle', 'page', 'Nouvelle page maître') + grand('maitreDupliquer', 'dupliquerG', 'Dupliquer') + col(petit('maitreRenommer', '', 'Renommer…'), petit('maitreSupprimer', 'supprimer', 'Supprimer'))) +
    groupe('Insérer', grand('', 'numeroPage', 'Numéro de page', { menu: 'numeros' }) + grand('dessinTexte', 'zoneTexte', 'Zone de texte') + grand('insererImage', 'image', 'Images')) +
    groupe('Fermer', grand('fermerMaitre', 'fermer', 'Fermer le mode Page maître'));
  const r = $('#ruban');
  r.innerHTML = Object.entries(P).map(([k, v]) => `<div class="panneau" data-panneau="${k}">${v}</div>`).join('');
  $$('[data-icone]').forEach(b => { b.innerHTML = ic(b.dataset.icone) || b.innerHTML; });
  // empêcher les boutons de voler le focus du texte en cours de saisie
  r.addEventListener('mousedown', ev => { if (ev.target.closest('button')) ev.preventDefault(); });
  $('#barre-titre').addEventListener('mousedown', ev => { if (ev.target.closest('button')) ev.preventDefault(); });
  r.addEventListener('click', surClicRuban);
  r.addEventListener('change', surChangeRuban);
  r.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('input.champ')) { ev.preventDefault(); surChangeRuban(ev); ev.target.blur(); } });
  r.addEventListener('focusin', ev => { if (ev.target.matches('select,input')) memoriserSelectionTexte(); });
  $$('[data-opt]').forEach(c => { c.checked = !!E.options[c.dataset.opt]; });
  activerOnglet('accueil');
  if (typeof accessibiliser === 'function') accessibiliser();
}

function surClicRuban(ev) {
  const b = ev.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.menu) { ouvrirMenuNomme(b.dataset.menu, b); return; }
  if (b.dataset.cmd) commande(b.dataset.cmd, b.dataset.val);
}
function surChangeRuban(ev) {
  const t = ev.target;
  if (t.dataset.opt) { E.options[t.dataset.opt] = t.checked; appliquerOptions(); return; }
  if (t.id === 'c-police') { restaurerSelectionTexte(); cmdTexte('police', t.value); return; }
  if (t.id === 'c-taille') { const v = parseFloat(String(t.value).replace(',', '.')); if (v > 0) { restaurerSelectionTexte(); cmdTexte('taille', v); } return; }
  if (t.dataset.champ) champTaillePosition(t.dataset.champ, t.value);
}

function activerOnglet(nom) {
  if (nom === 'fichier') { ouvrirCoulisses('infos'); return; }
  $$('.onglet').forEach(o => { o.classList.toggle('actif', o.dataset.onglet === nom); o.setAttribute('aria-selected', o.dataset.onglet === nom ? 'true' : 'false'); });
  $$('.panneau').forEach(p => p.classList.toggle('actif', p.dataset.panneau === nom));
  E.onglet = nom;
  majRuban();
}

const ONGLETS_CONTEXTE = {
  maitre: { lib: 'Page maître', groupe: 'Mode page maître' },
  format: { lib: 'Format', groupe: 'Outils de dessin' },
  image: { lib: 'Format', groupe: 'Outils Image' },
  tableau: { lib: 'Disposition', groupe: 'Outils de tableau' }
};
function ongletsContexte() {
  const s = selection();
  const l = E.modeMaitre ? ['maitre'] : [];
  if (s.length === 1 && s[0].type === 'tableau') l.push('tableau');
  else if (s.length && s.every(o => o.type === 'image')) l.push('image');
  else if (s.length) l.push('format');
  return l;
}

function majRuban() {
  if (!E.fiche || !$('#ruban').firstChild) return;
  const ctx = ongletsContexte();
  const zone = $('#onglets-contexte');
  const actuels = $$('.onglet', zone).map(o => o.dataset.onglet).join();
  if (actuels !== ctx.join()) {
    zone.innerHTML = ctx.map(k => `<button class="onglet" data-onglet="${k}" data-groupe="${ONGLETS_CONTEXTE[k].groupe}" title="${ONGLETS_CONTEXTE[k].groupe}">${ONGLETS_CONTEXTE[k].lib}</button>`).join('');
    if (ONGLETS_CONTEXTE[E.onglet] && !ctx.includes(E.onglet)) { activerOnglet('accueil'); return; }
    $$('.onglet', zone).forEach(o => o.classList.toggle('actif', o.dataset.onglet === E.onglet));
  }
  const s = selection();
  const texte = E.edition || s.some(o => o.type === 'texte' || o.type === 'tableau');
  const d = (cmd, off) => $$(`[data-cmd="${cmd}"]`).forEach(b => { b.disabled = off; });
  for (const c of ['gras', 'italique', 'souligne', 'exposant', 'indice', 'effacer', 'agrandir', 'reduire', 'aligner', 'retraitPlus', 'retraitMoins', 'paragraphe', 'police']) d(c, !texte);
  $$('[data-menu="couleurTexte"],[data-menu="puces"],[data-menu="interligne"]').forEach(b => { b.disabled = !texte; });
  $('#c-police').disabled = !texte; $('#c-taille').disabled = !texte;
  for (const c of ['couper', 'copier', 'dupliquer', 'supprimer', 'retournerH', 'retournerV']) d(c, !s.length);
  d('grouper', s.length < 2 || groupeEntier(s));
  d('dissocier', !s.some(o => o.groupe));
  $$('[data-menu="premierPlan"],[data-menu="arrierePlan"],[data-menu="rotation"],[data-menu="aligner"]').forEach(b => { b.disabled = !s.length; });
  const gt = $('.g-texte');
  if (gt) gt.style.display = s.length === 1 && s[0].type === 'texte' ? '' : 'none';
  $$('[data-etat="opt:reperes"]').forEach(b => b.classList.toggle('on', E.options.reperes));
  $$('[data-etat="rogner"]').forEach(b => b.classList.toggle('on', !!E.rognage));
  $$('[data-etat="pinceau"]').forEach(b => b.classList.toggle('on', !!E.pinceau));
  $$('[data-etat="cesure"]').forEach(b => b.classList.toggle('on', s.some(o => o.cesure)));
  $$('[data-etat="calage"]').forEach(b => b.classList.toggle('on', s.some(o => o.surLignesBase)));
  const t1 = s.length === 1 && s[0].type === 'texte' ? s[0] : null;
  d('creerLien', !t1 || !!t1.suivant);
  d('romprelien', !t1 || !t1.suivant);
  d('pinceau', !s.length);
  d('rogner', !s.some(o => o.type === 'image'));
  d('lien', !E.edition);
  majChampsTaille();
  if (texte) majEtatTexte();
  majTitre();
}

function majChampsTaille() {
  const s = selection();
  const b = s.length === 1 ? s[0] : s.length ? boiteEnglobante(s) : null;
  const val = (id, v) => $$(`#ruban [data-champ="${id}"]`).forEach(c => { if (document.activeElement !== c) c.value = v; c.disabled = v === ''; });
  val('c-h', b ? cm(b.h) : ''); val('c-w', b ? cm(b.w) : '');
  val('c-x', b ? cm(b.x) : ''); val('c-y', b ? cm(b.y) : '');
  val('c-rot', s.length === 1 ? String(arrondi(s[0].rot || 0, 1)).replace('.', ',') + '°' : '');
  const t = tableauEdite();
  if (t) {
    const ref = celluleReference(t);
    val('c-hl', ref ? cm(t.tableau.lignes[ref.l]) : '');
    val('c-lc', ref ? cm(t.tableau.cols[ref.c]) : '');
  }
}
function champTaillePosition(id, v) {
  const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) { majChampsTaille(); return; }
  if (id === 'c-hl') { dimensionLigneColonne('ligne', n * 10); return; }
  if (id === 'c-lc') { dimensionLigneColonne('colonne', n * 10); return; }
  const s = selection();
  if (!s.length) return;
  avant();
  if (id === 'c-rot') {
    for (const o of s) { const r = ((n % 360) + 360) % 360; if (r) o.rot = r; else delete o.rot; redessinerObjet(o); }
  } else if (s.length === 1) {
    const o = s[0], ancien = copie(o);
    const mmv = n * 10;
    if (id === 'c-h' && mmv > 0) o.h = arrondi(mmv);
    if (id === 'c-w' && mmv > 0) o.w = arrondi(mmv);
    if (id === 'c-x') o.x = arrondi(mmv);
    if (id === 'c-y') o.y = arrondi(mmv);
    echelleInterne(o, ancien);
    redessinerObjet(o);
  } else {
    const b = boiteEnglobante(s), mmv = n * 10;
    const kx = id === 'c-w' && mmv > 0 ? mmv / b.w : 1, ky = id === 'c-h' && mmv > 0 ? mmv / b.h : 1;
    const dx = id === 'c-x' ? mmv - b.x : 0, dy = id === 'c-y' ? mmv - b.y : 0;
    for (const o of s) {
      const ancien = copie(o);
      o.x = arrondi(b.x + (o.x - b.x) * kx + dx); o.y = arrondi(b.y + (o.y - b.y) * ky + dy);
      o.w = arrondi(o.w * kx); o.h = arrondi(o.h * ky);
      echelleInterne(o, ancien);
      redessinerObjet(o);
    }
  }
  apres();
}

function appliquerOptions() {
  const app = $('#app');
  app.classList.toggle('sans-reperes', !E.options.reperes);
  app.classList.toggle('limites', E.options.limites);
  $('#zone').classList.toggle('sans-regles', !E.options.regles);
  $('#corps').classList.toggle('sans-volet', !E.options.volet);
  masquerOuAfficherMascotte();
  $$('[data-opt]').forEach(c => { c.checked = !!E.options[c.dataset.opt]; });
  try { localStorage.setItem('pagelibre-options', JSON.stringify(E.options)); } catch (e) { /* stockage indisponible */ }
  majScene();
  majSelectionUI();
  majRuban();
}

/* ---------------- commandes ---------------- */
const COMMANDES = {
  enregistrer: () => enregistrer(false),
  enregistrerSous: () => enregistrer(true),
  imprimer: () => imprimer(),
  annuler, refaire,
  coller: collerDepuisBouton, couper, copier, dupliquer,
  supprimer: supprimerSelection,
  toutSelectionner: () => { quitterEdition(); choisir(pageCourante().items.filter(o => !o.arrierePlan).map(o => o.id)); },
  gras: () => cmdTexte('gras'), italique: () => cmdTexte('italique'), souligne: () => cmdTexte('souligne'),
  exposant: () => cmdTexte('exposant'), indice: () => cmdTexte('indice'), effacer: () => cmdTexte('effacer'),
  agrandir: () => cmdTexte('agrandir'), reduire: () => cmdTexte('reduire'),
  aligner: v => cmdTexte('aligner', v),
  retraitPlus: () => cmdTexte('retrait', 6.35), retraitMoins: () => cmdTexte('retrait', -6.35),
  paragraphe: () => boiteParagraphe(), police: () => boitePolice(),
  dessinTexte: () => demarrerModeDessin({ type: 'texte' }),
  insererImage: () => insererImage(),
  wordart: () => modifierWordArt(null),
  grouper, dissocier,
  retournerH: () => retourner('h'), retournerV: () => retourner('v'),
  sensTexte: () => { const o = selection()[0]; if (!o || o.type !== 'texte') return; avant(); if (o.sensTexte) delete o.sensTexte; else o.sensTexte = 'bas-haut'; redessinerObjet(o); apres(); },
  changerImage: () => changerImage(),
  rogner: () => basculerRognage(),
  rognerValeurs: () => boiteRognage(),
  pinceau: () => (E.pinceau ? finPinceau() : prendrePinceau()),
  rechercher: () => panneauRecherche(false), remplacer: () => panneauRecherche(true),
  lien: () => insererLien(),
  creerLien: () => creerLien(), romprelien: () => romprelien(),
  tabulations: () => boiteTabulations(), degrade: () => boiteDegrade(),
  taquets: () => boiteTaquets(), cesure: () => basculerCesure(), calage: () => basculerCalage(),
  maitreNouvelle: () => insererPage(false), maitreDupliquer: () => insererPage(true),
  maitreRenommer: () => renommerMaitre(), maitreSupprimer: () => supprimerPage(), fermerMaitre: () => quitterModeMaitre(),
  proportions: () => proportionsOrigine(),
  sansRognage: () => { const s = selection().filter(o => o.type === 'image'); if (!s.length) return; avant(); s.forEach(o => { delete o.rognage; redessinerObjet(o); }); apres(); },
  insLigne: v => insLigne(v === 'apres'), insColonne: v => insColonne(v === 'apres'),
  supLigne, supColonne, fusionner: fusionnerCellules, fractionner: fractionnerCellule,
  sensCellule: () => sensTexteCellules(), repartirLignes, repartirColonnes,
  reperes: () => { E.options.reperes = !E.options.reperes; appliquerOptions(); },
  titreFiche: () => boiteTitre(),
  zoomPage, zoomLargeur, zoom100: () => definirZoom(1),
  zoomPlus: () => definirZoom(E.zoom * 1.2), zoomMoins: () => definirZoom(E.zoom / 1.2),
  fermerCoulisses: () => fermerCoulisses()
};
function commande(nom, val) {
  const f = COMMANDES[nom];
  if (f) f(val);
}

/* ---------------- menus ---------------- */
function ouvrirMenu(pos, items, html) {
  const m = $('#menu');
  m.innerHTML = '';
  if (html) m.appendChild(html);
  for (const it of items || []) {
    if (it === '-') { m.insertAdjacentHTML('beforeend', '<div class="menu-sep"></div>'); continue; }
    if (it.titre) { m.insertAdjacentHTML('beforeend', `<div class="menu-titre">${esc(it.titre)}</div>`); continue; }
    const b = document.createElement('button');
    b.className = 'menu-item' + (it.off ? ' desactive' : '');
    b.innerHTML = `<span class="ic">${it.ic ? ic(it.ic) : it.coche ? '✓' : ''}</span><span>${esc(it.lib)}</span>${it.rac ? `<span class="raccourci">${it.rac}</span>` : ''}`;
    b.addEventListener('mousedown', ev => ev.preventDefault());
    b.addEventListener('click', () => { fermerMenu(); it.act(); });
    m.appendChild(b);
  }
  m.hidden = false;
  const r = m.getBoundingClientRect();
  let x = pos.x, y = pos.y;
  if (x + r.width > innerWidth - 4) x = innerWidth - r.width - 4;
  if (y + r.height > innerHeight - 4) y = Math.max(4, innerHeight - r.height - 4);
  m.style.left = x + 'px';
  m.style.top = y + 'px';
  setTimeout(() => document.addEventListener('mousedown', fermerMenuDehors, true), 0);
}
function fermerMenuDehors(ev) { if (!$('#menu').contains(ev.target)) fermerMenu(); }
function fermerMenu() { $('#menu').hidden = true; document.removeEventListener('mousedown', fermerMenuDehors, true); }
function sousBouton(b) { const r = b.getBoundingClientRect(); return { x: r.left, y: r.bottom + 1 }; }

const COULEURS_STD = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];
const GRIS = ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#808080', '#595959', '#404040', '#262626', '#000000'];
function menuCouleur(b, surChoix, opt = {}) {
  const d = document.createElement('div');
  const theme = [...new Set((E.fiche.palette || []).filter(Boolean))].slice(0, 10);
  const grille = (titre, liste) => `<div class="menu-titre">${titre}</div><div class="grille-couleurs">${liste.map(c => `<button data-c="${c}" title="${c}" style="background:${c}"></button>`).join('')}</div>`;
  d.innerHTML = (theme.length > 1 ? grille('Couleurs de la fiche', theme) : '') + grille('Couleurs standard', COULEURS_STD) + grille('Gris', GRIS);
  d.addEventListener('mousedown', ev => ev.preventDefault());
  d.addEventListener('click', ev => { const c = ev.target.dataset && ev.target.dataset.c; if (c) { fermerMenu(); restaurerSelectionTexte(); surChoix(c); } });
  const items = [];
  if (opt.aucun) items.push({ lib: opt.aucun, act: () => surChoix(null) });
  items.push({
    lib: 'Autres couleurs…', act: () => {
      const i = document.createElement('input');
      i.type = 'color';
      i.value = opt.actuelle || '#000000';
      i.addEventListener('change', () => { restaurerSelectionTexte(); surChoix(i.value); });
      i.click();
    }
  });
  if (opt.plus) items.push('-', ...opt.plus);
  memoriserSelectionTexte();
  ouvrirMenu(sousBouton(b), items, d);
}

const FORMES_GALERIE = [
  ['ligne', 'Trait'], ['fleche', 'Flèche'], ['rect', 'Rectangle'], ['rectArrondi', 'Rectangle arrondi'], ['ellipse', 'Ellipse'], ['secteur', 'Secteur (diagramme circulaire)'], ['triangle', 'Triangle'],
  ['triangleRect', 'Triangle rectangle'], ['losange', 'Losange'], ['parallelogramme', 'Parallélogramme'], ['trapeze', 'Trapèze'], ['pentagone', 'Pentagone'], ['hexagone', 'Hexagone'],
  ['octogone', 'Octogone'], ['plus', 'Croix'], ['etoile4', 'Étoile à 4 branches'], ['etoile5', 'Étoile à 5 branches'], ['etoile8', 'Étoile à 8 branches'], ['explosion', 'Explosion'],
  ['flecheD', 'Flèche droite'], ['flecheG', 'Flèche gauche'], ['flecheH', 'Flèche haut'], ['flecheB', 'Flèche bas'], ['flecheGD', 'Double flèche'], ['chevron', 'Chevron'],
  ['bulleRect', 'Bulle rectangulaire'], ['bulleRectArrondi', 'Bulle arrondie'], ['bulleEllipse', 'Bulle ovale'], ['nuage', 'Bulle nuage'], ['coeur', 'Cœur'], ['eclair', 'Éclair'],
  ['coinPlie', 'Coin plié'], ['soleil', 'Soleil'], ['lune', 'Lune'], ['vague', 'Vague']
];
function apercuForme(f) {
  if (f === 'ligne') return '<svg viewBox="0 0 22 22"><path d="M3 19L19 3" stroke="#555" stroke-width="1.4"/></svg>';
  if (f === 'fleche') return '<svg viewBox="0 0 22 22"><path d="M3 19L17 5" stroke="#555" stroke-width="1.4"/><path d="M19 3l-6 2 4 4z" fill="#555"/></svg>';
  const d = Rendu.chemin({ forme: f, w: 20, h: 16 });
  return `<svg viewBox="-1 -3 22 22"><path d="${d}" fill="#d6e4f5" stroke="#2b579a" stroke-width=".9"/></svg>`;
}
function menuFormes(b) {
  const d = document.createElement('div');
  d.innerHTML = `<div class="menu-titre">Formes</div><div class="grille-formes">${FORMES_GALERIE.map(([f, n]) => `<button data-f="${f}" title="${esc(n)}">${apercuForme(f)}</button>`).join('')}</div>`;
  d.addEventListener('click', ev => {
    const x = ev.target.closest('[data-f]');
    if (!x) return;
    fermerMenu();
    const f = x.dataset.f;
    if (f === 'ligne' || f === 'fleche') demarrerModeDessin({ type: 'ligne', fleche: f === 'fleche' });
    else demarrerModeDessin({ type: 'forme', forme: f });
  });
  ouvrirMenu(sousBouton(b), [], d);
}
function menuTableau(b) {
  const d = document.createElement('div');
  d.className = 'grille-tableau';
  d.innerHTML = `<div class="cases">${Array.from({ length: 80 }, (_, i) => `<div class="case" data-l="${Math.floor(i / 10)}" data-c="${i % 10}"></div>`).join('')}</div><div class="legende">Insérer un tableau</div>`;
  d.addEventListener('mouseover', ev => {
    const c = ev.target.closest('.case');
    if (!c) return;
    const L = +c.dataset.l, C = +c.dataset.c;
    $$('.case', d).forEach(x => x.classList.toggle('on', +x.dataset.l <= L && +x.dataset.c <= C));
    $('.legende', d).textContent = `Tableau ${C + 1} x ${L + 1}`;
  });
  d.addEventListener('click', ev => {
    const c = ev.target.closest('.case');
    if (!c) return;
    fermerMenu();
    insererTableau(+c.dataset.l + 1, +c.dataset.c + 1);
  });
  ouvrirMenu(sousBouton(b), [{ lib: 'Insérer un tableau…', act: boiteTableau }], d);
}

const SYMBOLES = ['Ω', 'µ', '°', '±', '²', '³', '½', '¼', '≤', '≥', '≠', '≈', '×', '÷', '√', '∞', 'Δ', 'φ', 'π', 'Σ', '→', '←', '↑', '↓', '↔', '⇒', '•', '✓', '✗', '☐', '☑', '⚠', '⚡', '⏚', '€', '©', '«', '»', '–', '—', '…', '№'];
function menuSymboles(b) {
  const d = document.createElement('div');
  d.innerHTML = `<div class="menu-titre">Symboles</div><div class="grille-couleurs" style="grid-template-columns:repeat(7,26px)">${SYMBOLES.map(s => `<button data-s="${s}" style="width:26px;height:26px;background:#fff;font-size:15px">${s}</button>`).join('')}</div>`;
  d.addEventListener('mousedown', ev => ev.preventDefault());
  d.addEventListener('click', ev => {
    const s = ev.target.dataset && ev.target.dataset.s;
    if (!s) return;
    fermerMenu();
    restaurerSelectionTexte();
    if (E.edition) document.execCommand('insertText', false, s);
    else insererTexteBrut(s);
  });
  memoriserSelectionTexte();
  ouvrirMenu(sousBouton(b), [], d);
}

function ouvrirMenuNomme(nom, b) {
  const s = selection();
  const surFormes = fn => { const objs = s.filter(o => o.type !== 'tableau'); if (!objs.length) return; avant(); objs.forEach(o => { fn(o); redessinerObjet(o); }); apres(); };
  const P = E.fiche.page;
  const menus = {
    couleurTexte: () => menuCouleur(b, c => { $('#barre-couleur-texte').style.background = c; cmdTexte('couleur', c); }),
    formes: () => menuFormes(b),
    tableau: () => menuTableau(b),
    symboles: () => menuSymboles(b),
    puces: () => ouvrirMenu(sousBouton(b), [{ lib: 'Puces •', ic: 'puces', act: () => cmdTexte('puces', 'puces') }, { lib: 'Numéros 1. 2. 3.', ic: 'numeros', act: () => cmdTexte('puces', 'numeros') }]),
    interligne: () => ouvrirMenu(sousBouton(b), [['Simple', 'normal'], ['0,8', '0.96'], ['1,0', '1.2'], ['1,15', '1.38'], ['1,5', '1.8'], ['2,0', '2.4'], ['2,5', '3'], ['3,0', '3.6']]
      .map(([l, v]) => ({ lib: l, act: () => cmdTexte('interligne', v) })).concat(['-', { lib: 'Options d\'espacement…', act: boiteParagraphe }])),
    premierPlan: () => ouvrirMenu(sousBouton(b), [{ lib: 'Mettre au premier plan', ic: 'premierPlan16', act: () => ordre('premier') }, { lib: 'Avancer', act: () => ordre('avancer') }]),
    arrierePlan: () => ouvrirMenu(sousBouton(b), [{ lib: 'Mettre à l\'arrière-plan', ic: 'arrierePlan16', act: () => ordre('arriere') }, { lib: 'Reculer', act: () => ordre('reculer') }]),
    rotation: () => ouvrirMenu(sousBouton(b), [
      { lib: 'Faire pivoter à droite de 90°', act: () => pivoter(90) }, { lib: 'Faire pivoter à gauche de 90°', act: () => pivoter(-90) },
      { lib: 'Retourner verticalement', ic: 'retournerV', act: () => retourner('v') }, { lib: 'Retourner horizontalement', ic: 'retournerH', act: () => retourner('h') },
      { lib: 'Annuler la rotation', act: () => { avant(); s.forEach(o => { delete o.rot; redessinerObjet(o); }); apres(); } }]),
    aligner: () => ouvrirMenu(sousBouton(b), [
      { titre: s.length > 1 ? 'Aligner les objets entre eux' : 'Aligner sur la page' },
      { lib: 'Aligner à gauche', act: () => aligner('gauche') }, { lib: 'Centrer', act: () => aligner('centreH') }, { lib: 'Aligner à droite', act: () => aligner('droite') },
      { lib: 'Aligner en haut', act: () => aligner('haut') }, { lib: 'Aligner au milieu', act: () => aligner('milieu') }, { lib: 'Aligner en bas', act: () => aligner('bas') },
      '-', { lib: 'Distribuer horizontalement', act: () => aligner('distribuerH'), off: s.length < 3 }, { lib: 'Distribuer verticalement', act: () => aligner('distribuerV'), off: s.length < 3 }]),
    remplissage: () => menuCouleur(b, c => surFormes(o => { if (o.type === 'wordart') o.wordart.couleur = c || '#000000'; else if (c) o.fond = { couleur: c }; else delete o.fond; }), { aucun: 'Aucun remplissage', plus: [{ lib: 'Dégradé…', act: () => boiteDegrade() }, { lib: 'Motif (hachures)…', ic: 'motif', act: () => motifFormes() }] }),
    contour: () => menuContour(b, surFormes),
    vertical: () => ouvrirMenu(sousBouton(b), [['haut', 'En haut'], ['milieu', 'Au milieu'], ['bas', 'En bas']].map(([v, l]) => ({ lib: l, coche: s[0] && (s[0].vertical || 'haut') === v, act: () => surFormes(o => { if (o.type === 'texte') o.vertical = v; }) }))),
    margesTexte: () => ouvrirMenu(sousBouton(b), [['Aucune', 0], ['Étroites (1 mm)', 1], ['Moyennes (2,5 mm)', 2.54], ['Larges (5 mm)', 5]].map(([l, v]) => ({ lib: l, act: () => surFormes(o => { if (o.type === 'texte') o.marges = [v, v, v, v]; }) }))),
    page: () => ouvrirMenu(sousBouton(b), [
      { lib: 'Insérer une page vierge', ic: 'page16', act: () => insererPage(false) }, { lib: 'Dupliquer la page', ic: 'dupliquer', act: () => insererPage(true) },
      '-', { lib: 'Déplacer la page vers le haut', act: () => deplacerPage(-1), off: E.ip === 0 }, { lib: 'Déplacer la page vers le bas', act: () => deplacerPage(1), off: E.ip === E.fiche.pages.length - 1 },
      { lib: 'Supprimer la page', ic: 'supprimer', act: supprimerPage }]),
    marges: () => ouvrirMenu(sousBouton(b), [['Aucune', 0], ['Étroites (6,35 mm)', 6.35], ['Moyennes (12,7 mm)', 12.7], ['Larges (25,4 mm)', 25.4]]
      .map(([l, v]) => ({ lib: l, act: () => { avant(); P.marges = [v, v, v, v]; afficherPage(); apres(); } })).concat(['-', { lib: 'Marges personnalisées…', act: boiteMarges }])),
    orientation: () => ouvrirMenu(sousBouton(b), [
      { lib: 'Portrait', coche: P.h >= P.w, act: () => { if (P.w > P.h) changerTaillePage(P.h, P.w); } },
      { lib: 'Paysage', coche: P.w > P.h, act: () => { if (P.h > P.w) changerTaillePage(P.h, P.w); } }]),
    taillePage: () => {
      const paysage = P.w > P.h;
      const t = (w, h) => (paysage ? [Math.max(w, h), Math.min(w, h)] : [Math.min(w, h), Math.max(w, h)]);
      ouvrirMenu(sousBouton(b), [['A4 (21 x 29,7 cm)', 210, 297], ['A3 (29,7 x 42 cm)', 297, 420], ['A5 (14,8 x 21 cm)', 148, 210], ['Lettre US (21,6 x 27,9 cm)', 215.9, 279.4]]
        .map(([l, w, h]) => ({ lib: l, act: () => changerTaillePage(...t(w, h)) })).concat(['-', { lib: 'Taille personnalisée…', act: boiteTaillePage }]));
    },
    couleurPage: () => menuCouleur(b, c => { avant(); if (c) P.fond = c; else delete P.fond; afficherPage(); dessinerVignettes(); apres(); }, { aucun: 'Aucune couleur (blanc)' }),
    fondCellule: () => menuCouleur(b, c => fondCellules(c), { aucun: 'Aucun remplissage', plus: [{ lib: 'Motif (hachures)…', ic: 'motif', act: () => motifCellules() }] }),
    bordures: () => ouvrirMenu(sousBouton(b), [
      { lib: 'Toutes les bordures', ic: 'bordures', act: () => bordures('toutes') }, { lib: 'Bordures extérieures', act: () => bordures('exterieures') },
      { lib: 'Bordures intérieures', act: () => bordures('interieures') }, { lib: 'Aucune bordure', act: () => bordures('aucune') },
      '-', { lib: 'Bordure supérieure', act: () => bordures('h') }, { lib: 'Bordure inférieure', act: () => bordures('b') },
      { lib: 'Bordure gauche', act: () => bordures('g') }, { lib: 'Bordure droite', act: () => bordures('d') }]),
    styleBord: () => {
      const st = E.styleBord || BORD_DEFAUT;
      ouvrirMenu(sousBouton(b), [{ titre: 'Épaisseur des prochaines bordures' }].concat([0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6].map(e => ({ lib: String(e).replace('.', ',') + ' pt', coche: st.e === e, act: () => { E.styleBord = { c: st.c, e }; } })))
        .concat(['-', { lib: 'Couleur des prochaines bordures…', act: () => menuCouleur(b, c => { E.styleBord = { c: c || '#000000', e: st.e }; }) }]));
    },
    verticalCellule: () => ouvrirMenu(sousBouton(b), [['haut', 'En haut'], ['milieu', 'Au milieu'], ['bas', 'En bas']].map(([v, l]) => ({ lib: l, act: () => alignementVertical(v) }))),
    styles: () => menuStyles(b),
    lettrine: () => { memoriserSelectionTexte(); ouvrirMenu(sousBouton(b), [['Aucune', 0], ['Sur 2 lignes', 2], ['Sur 3 lignes', 3], ['Sur 4 lignes', 4]].map(([l, n]) => ({ lib: l, act: () => { restaurerSelectionTexte(); lettrine(n); } }))); },
    numeros: () => ouvrirMenu(sousBouton(b), [
      { titre: 'Sur toutes les pages (page maître)' },
      { lib: 'En bas, au centre', act: () => numerosDePage('bas-centre') }, { lib: 'En bas, à droite', act: () => numerosDePage('bas-droite') },
      { lib: 'En bas, à gauche', act: () => numerosDePage('bas-gauche') }, { lib: 'En haut, à droite', act: () => numerosDePage('haut-droite') },
      { titre: 'Dans le texte (curseur placé)' },
      { lib: 'Numéro de la page', act: () => insererChampTexte('page'), off: !E.edition }, { lib: 'Nombre de pages', act: () => insererChampTexte('total'), off: !E.edition }]),
    blocs: () => menuBlocs(b),
    maitres: () => menuMaitres(b),
    guides: () => ouvrirMenu(sousBouton(b), [
      { lib: 'Ajouter un guide horizontal', act: () => ajouterGuide('h') }, { lib: 'Ajouter un guide vertical', act: () => ajouterGuide('v') },
      { lib: 'Supprimer tous les guides', act: supprimerGuides, off: !(P.guides || []).length },
      '-', { lib: 'Grille de mise en page…', act: boiteGrille }, { lib: 'Repères de ligne de base…', act: boiteLignesBase },
      '-', { lib: 'Astuce : tirez un guide depuis la règle ; remettez-le sur la règle pour l\'effacer.', act: () => {} }]),
    effets: () => menuEffets(b),
    habillage: () => menuHabillage(b),
    ajuster: () => menuAjuster(b),
    colonnes: () => ouvrirMenu(sousBouton(b), [1, 2, 3, 4].map(n => ({ lib: n === 1 ? 'Une colonne' : n + ' colonnes', coche: (s[0] && (s[0].colonnes || 1)) === n, act: () => colonnes(n) })).concat(['-', { lib: 'Plus de colonnes…', act: boiteColonnes }])),
    corrections: () => menuCorrections(b),
    espacement: () => menuEspacement(b),
    jeuCouleurs: () => menuJeuCouleurs(b),
    jeuPolices: () => menuJeuPolices(b),
    diagonale: () => ouvrirMenu(sousBouton(b), [
      { lib: 'Diagonale descendante ╲', act: () => diagonaleCellules('desc') }, { lib: 'Diagonale montante ╱', act: () => diagonaleCellules('asc') },
      { lib: 'Pas de diagonale', act: () => diagonaleCellules(null) }]),
    stylesTableau: () => ouvrirMenu(sousBouton(b), STYLES_TABLEAU.map(([l, t]) => ({ lib: l, act: () => styleTableau(t) })))
  };
  if (menus[nom]) menus[nom]();
  else if (typeof MENUS_PLUS === 'object' && MENUS_PLUS[nom]) MENUS_PLUS[nom](b);
}

function menuContour(b, surFormes) {
  const items = [
    { lib: 'Couleur du contour…', ic: 'contour', act: () => menuCouleur(b, c => surFormes(o => { if (o.type === 'wordart') { if (c) o.wordart.contour = Object.assign({ epaisseur: 0.75 }, o.wordart.contour, { couleur: c }); else delete o.wordart.contour; } else if (c) o.trait = Object.assign({ epaisseur: 0.75 }, o.trait, { couleur: c }); else if (o.type !== 'ligne') delete o.trait; }), { aucun: 'Aucun contour' }) },
    { lib: 'Bordure décorative…', act: () => boiteBordure() },
    { titre: 'Épaisseur' }
  ];
  for (const e of [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6]) items.push({ lib: String(e).replace('.', ',') + ' pt', act: () => surFormes(o => { const t = o.type === 'wordart' ? (o.wordart.contour = o.wordart.contour || { couleur: '#000000' }) : (o.trait = o.trait || { couleur: '#000000' }); t.epaisseur = e; }) });
  items.push({ titre: 'Tirets' });
  for (const [l, v] of [['Continu', 0], ['Tirets', 1], ['Points', 2], ['Tiret-point', 3], ['Tirets longs', 7]]) items.push({ lib: l, act: () => surFormes(o => { if (o.trait) { if (v) o.trait.tirets = v; else delete o.trait.tirets; } }) });
  if (selection().some(o => o.type === 'ligne')) {
    items.push({ titre: 'Flèches' },
      { lib: 'Sans flèche', act: () => surFormes(o => { if (o.trait) { delete o.trait.flecheDebut; delete o.trait.flecheFin; } }) },
      { lib: 'Flèche à la fin', act: () => surFormes(o => { if (o.trait) { delete o.trait.flecheDebut; o.trait.flecheFin = 1; } }) },
      { lib: 'Flèche au début', act: () => surFormes(o => { if (o.trait) { o.trait.flecheDebut = 1; delete o.trait.flecheFin; } }) },
      { lib: 'Flèches aux deux bouts', act: () => surFormes(o => { if (o.trait) { o.trait.flecheDebut = 1; o.trait.flecheFin = 1; } }) });
  }
  ouvrirMenu(sousBouton(b), items);
}

function changerTaillePage(w, h) {
  avant();
  E.fiche.page.w = arrondi(w);
  E.fiche.page.h = arrondi(h);
  afficherPage();
  dessinerVignettes();
  zoomPage();
  apres();
}

/* ---------------- boîtes de dialogue ---------------- */
function ouvrirBoite(titre, corps, surOK, opt = {}) {
  const b = $('#boite');
  b.innerHTML = `<div class="boite-titre"><span>${esc(titre)}</span><button data-x title="Fermer">✕</button></div>
    <div class="boite-corps">${corps}</div>
    <div class="boite-pied">${opt.sansAnnuler ? '' : '<button class="bouton" data-annuler>Annuler</button>'}<button class="bouton principal" data-ok>${esc(opt.ok || 'OK')}</button></div>`;
  b.hidden = false;
  $('#voile').hidden = false;
  const fermer = () => fermerBoite();
  $('[data-x]', b).onclick = fermer;
  const a = $('[data-annuler]', b);
  if (a) a.onclick = fermer;
  $('[data-ok]', b).onclick = () => { const r = surOK ? surOK() : true; if (r !== false) fermer(); };
  b.onkeydown = ev => { if (ev.key === 'Enter' && ev.target.tagName !== 'TEXTAREA') { ev.preventDefault(); $('[data-ok]', b).click(); } };
  const premier = $('input,select,textarea', b) || $('[data-ok]', b);
  setTimeout(() => premier.focus(), 0);
}
function fermerBoite() { $('#boite').hidden = true; $('#voile').hidden = true; }
function alerte(msg) { mascotte('oups'); ouvrirBoite('PageLibre', `<p style="max-width:440px">${esc(msg)}</p>`, null, { sansAnnuler: true }); }
function confirmer(msg, ok) { ouvrirBoite('Confirmation', `<p style="max-width:440px">${esc(msg)}</p>`, () => { ok(); }, { ok: 'Oui' }); }
function indication(msg) {
  const b = $('#bandeau');
  if (!msg) { if (b.dataset.type === 'indication') b.hidden = true; return; }
  b.dataset.type = 'indication';
  b.innerHTML = `<span>${esc(msg)}</span><button class="bouton">Annuler</button>`;
  $('button', b).onclick = () => finDessin();
  b.hidden = false;
}

function boiteTaillePosition() {
  const s = selection();
  if (!s.length) return;
  const b = s.length === 1 ? s[0] : boiteEnglobante(s);
  ouvrirBoite('Taille et position', `<div class="grille-champs">
    <span>Largeur (cm)</span><input id="tp-w" class="champ champ-num" value="${cm(b.w)}">
    <span>Hauteur (cm)</span><input id="tp-h" class="champ champ-num" value="${cm(b.h)}">
    <span>Position horizontale (cm)</span><input id="tp-x" class="champ champ-num" value="${cm(b.x)}">
    <span>Position verticale (cm)</span><input id="tp-y" class="champ champ-num" value="${cm(b.y)}">
    ${s.length === 1 ? `<span>Rotation (°)</span><input id="tp-r" class="champ champ-num" value="${arrondi(s[0].rot || 0, 1)}">` : ''}</div>`, () => {
    for (const [id, c] of [['tp-w', 'c-w'], ['tp-h', 'c-h'], ['tp-x', 'c-x'], ['tp-y', 'c-y'], ['tp-r', 'c-rot']]) {
      const i = $('#' + id);
      if (i && i.defaultValue !== i.value) champTaillePosition(c, i.value);
    }
  });
}
function boiteTableau() {
  ouvrirBoite('Insérer un tableau', `<div class="grille-champs"><span>Nombre de lignes</span><input id="bt-l" class="champ champ-num" type="number" min="1" max="60" value="3"><span>Nombre de colonnes</span><input id="bt-c" class="champ champ-num" type="number" min="1" max="30" value="3"></div>`,
    () => insererTableau(Math.max(1, Math.min(60, +$('#bt-l').value || 1)), Math.max(1, Math.min(30, +$('#bt-c').value || 1))));
}
function boiteMarges() {
  const m = E.fiche.page.marges;
  ouvrirBoite('Marges de la page (mm)', `<div class="grille-champs">${['Haut', 'Droite', 'Bas', 'Gauche'].map((l, i) => `<span>${l}</span><input class="champ champ-num" type="number" step="0.5" min="0" data-i="${i}" value="${m[i]}">`).join('')}</div>`, () => {
    avant();
    $$('#boite [data-i]').forEach(i => { E.fiche.page.marges[+i.dataset.i] = Math.max(0, +i.value || 0); });
    afficherPage();
    apres();
  });
}
function boiteTaillePage() {
  const P = E.fiche.page;
  ouvrirBoite('Taille de la page', `<div class="grille-champs"><span>Largeur (mm)</span><input id="tg-w" class="champ champ-num" type="number" min="20" value="${P.w}"><span>Hauteur (mm)</span><input id="tg-h" class="champ champ-num" type="number" min="20" value="${P.h}"></div>`, () => {
    const w = +$('#tg-w').value, h = +$('#tg-h').value;
    if (w >= 20 && h >= 20) changerTaillePage(w, h);
  });
}
function boiteTitre() {
  ouvrirBoite('Titre de la fiche', `<label>Titre (nom proposé à l'enregistrement)</label><input type="text" id="bt-titre" value="${esc(E.fiche.titre)}">`, () => {
    const t = $('#bt-titre').value.trim();
    if (!t) return false;
    avant();
    E.fiche.titre = t;
    apres();
  });
}
function boiteRognage() {
  const o = selection().find(x => x.type === 'image');
  if (!o) return;
  const r = o.rognage || [0, 0, 0, 0];
  ouvrirBoite('Rogner l\'image (% de l\'image d\'origine)', `<div class="grille-champs">${['Haut', 'Droite', 'Bas', 'Gauche'].map((l, i) => `<span>${l}</span><input class="champ champ-num" type="number" min="0" max="95" step="1" data-i="${i}" value="${arrondi(r[i] * 100, 1)}">`).join('')}</div>
    <p style="color:#666">Le cadre garde sa taille : l'image visible s'agrandit pour le remplir.</p>`, () => {
    const v = $$('#boite [data-i]').map(i => Math.max(0, Math.min(95, +i.value || 0)) / 100);
    if (v[0] + v[2] >= 0.98 || v[1] + v[3] >= 0.98) { alerte('Rognage trop important.'); return false; }
    avant();
    if (v.some(x => x)) o.rognage = v; else delete o.rognage;
    redessinerObjet(o);
    apres();
  });
}

/* ---- WordArt ---- */
const WORDART_MODELES = [
  { nom: 'Bleu, contour foncé', police: 'Arial Black', couleur: '#5b9bd5', contour: { couleur: '#1f4e79', epaisseur: 0.75 } },
  { nom: 'Dégradé or', police: 'Impact', couleur: '#ffd966', degrade: '#bf8f00', contour: { couleur: '#7f6000', epaisseur: 0.5 } },
  { nom: 'Rouge vif ombré', police: 'Arial Black', couleur: '#e00000', ombre: { dx: 1, dy: 1, flou: 0.8 } },
  { nom: 'Vert sapin', police: 'Segoe UI', couleur: '#077568', degrade: '#0fb39f' },
  { nom: 'Contour seul', police: 'Arial Black', couleur: '#ffffff', contour: { couleur: '#000000', epaisseur: 1 } },
  { nom: 'Gris argent', police: 'Impact', couleur: '#f2f2f2', degrade: '#7f7f7f', contour: { couleur: '#404040', epaisseur: 0.5 }, ombre: { dx: 0.8, dy: 0.8, flou: 1, couleur: 'rgba(0,0,0,.35)' } }
];
function modifierWordArt(o) {
  const W = o ? o.wordart : { texte: 'Votre texte ici', police: 'Arial Black', couleur: '#2b579a', gras: false, italique: false };
  ouvrirBoite(o ? 'Modifier le texte WordArt' : 'Insérer un WordArt', `
    <label>Texte</label><input type="text" id="wa-t" value="${esc(W.texte)}">
    <div class="grille-champs" style="margin-top:8px">
      <span>Modèle</span><select id="wa-m" class="champ"><option value="">(garder le style actuel)</option>${WORDART_MODELES.map((m, i) => `<option value="${i}">${esc(m.nom)}</option>`).join('')}</select>
      <span>Police</span><select id="wa-p" class="champ">${[...new Set([W.police, ...POLICES])].map(p => `<option${p === W.police ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>
      <span>Couleur</span><input type="color" id="wa-c" value="${W.couleur || '#000000'}">
      <span>Style</span><span><label style="display:inline"><input type="checkbox" id="wa-g"${W.gras ? ' checked' : ''}> Gras</label> &nbsp; <label style="display:inline"><input type="checkbox" id="wa-i"${W.italique ? ' checked' : ''}> Italique</label></span>
    </div>`, () => {
    const t = $('#wa-t').value.trim();
    if (!t) return false;
    avant();
    let obj = o;
    if (!obj) {
      const P = E.fiche.page;
      obj = { id: nouvelId(), type: 'wordart', x: arrondi(P.w / 2 - 60), y: arrondi(P.h / 4), w: 120, h: 25, wordart: {} };
      pageCourante().items.push(obj);
    }
    Object.assign(obj.wordart, { texte: t, police: $('#wa-p').value, couleur: $('#wa-c').value, gras: $('#wa-g').checked, italique: $('#wa-i').checked });
    const mod = $('#wa-m').value !== '' ? WORDART_MODELES[+$('#wa-m').value] : null;
    if (mod) {
      Object.assign(obj.wordart, { couleur: mod.couleur, police: mod.police });
      if (mod.degrade) obj.wordart.degrade = mod.degrade; else delete obj.wordart.degrade;
      if (mod.contour) obj.wordart.contour = copie(mod.contour); else delete obj.wordart.contour;
      if (mod.ombre) obj.ombre = copie(mod.ombre); else delete obj.ombre;
    }
    redessinerObjet(obj);
    E.sel = [obj.id];
    apres();
  });
}

/* ---- images ---- */
function choisirFichierImage(fn) {
  const i = $('#entree-fichier');
  i.value = '';
  i.accept = 'image/*';
  i.onchange = () => { if (i.files[0]) fn(i.files[0]); };
  i.click();
}
function insererImage() { choisirFichierImage(f => insererImageFichier(f)); }
function lireImage(fichier) {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => {
      // photo trop grande ou trop lourde : réduite à 2 400 points et réenregistrée plus légère (editeur_plus4.js)
      allegerImage(r.result, 2400).then(ok, ko);
    };
    r.onerror = ko;
    r.readAsDataURL(fichier);
  });
}
async function insererImageFichier(fichier, pos) {
  try {
    const im = await lireImage(fichier);
    const ref = nouvelId('img');
    E.fiche.images[ref] = im.url;
    const P = E.fiche.page;
    let w = Math.min(P.w * 0.6, im.w * 25.4 / 96), h = w * im.h / im.w;
    if (h > P.h * 0.6) { h = P.h * 0.6; w = h * im.w / im.h; }
    const x = pos ? pos.x - w / 2 : (P.w - w) / 2, y = pos ? pos.y - h / 2 : (P.h - h) / 2;
    // comme en PAO : une image insérée repousse le texte (habillage carré)
    const o = { id: nouvelId(), type: 'image', image: ref, x: arrondi(x), y: arrondi(y), w: arrondi(w), h: arrondi(h), habillage: 'carre' };
    avant();
    pageCourante().items.push(o);
    redessinerObjet(o);
    E.sel = [o.id];
    apres();
    mascotte('content');
  } catch (e) { alerte('Impossible de lire cette image.'); }
}
function changerImage() {
  const o = selection().find(x => x.type === 'image');
  if (!o) return;
  choisirFichierImage(async f => {
    try {
      const im = await lireImage(f);
      const ref = nouvelId('img');
      E.fiche.images[ref] = im.url;
      avant();
      o.image = ref;
      delete o.rognage;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      o.h = arrondi(o.w * im.h / im.w);
      o.y = arrondi(cy - o.h / 2); o.x = arrondi(cx - o.w / 2);
      redessinerObjet(o);
      apres();
    } catch (e) { alerte('Impossible de lire cette image.'); }
  });
}
function proportionsOrigine() {
  const objs = selection().filter(x => x.type === 'image' && E.fiche.images[x.image]);
  if (!objs.length) return;
  let n = objs.length;
  const maj = [];
  for (const o of objs) {
    const img = new Image();
    img.onload = () => {
      const r = o.rognage || [0, 0, 0, 0];
      const vw = img.naturalWidth * (1 - r[1] - r[3]), vh = img.naturalHeight * (1 - r[0] - r[2]);
      maj.push([o, vw, vh]);
      if (--n === 0) {
        avant();
        for (const [ob, w, h] of maj) { const cy = ob.y + ob.h / 2; ob.h = arrondi(ob.w * h / w); ob.y = arrondi(cy - ob.h / 2); redessinerObjet(ob); }
        apres();
      }
    };
    img.src = E.fiche.images[o.image];
  }
}
