/* =====================================================================
   Éditeur : fonctions avancées (suite)
   styles liés, espacement des caractères, taquets, césure, grilles et lignes
   de base, jeux de couleurs et de polices, reflet / biseau / 3D, diagonales,
   images EMF/WMF, version à jour des fiches, fiches récentes
   ===================================================================== */

/* ---------------- styles liés ---------------- */
// liste effective : styles de base, éventuellement modifiés dans la fiche, puis styles de la fiche
function listeStyles() {
  const perso = E.fiche.styles || [];
  const base = STYLES_BASE.map(s => perso.find(p => p.nom === s.nom) || s);
  return [...base, ...perso.filter(p => !STYLES_BASE.some(s => s.nom === p.nom))];
}
function poserStyleParagraphe(p, st) {
  p.dataset.style = st.nom;
  if (!p.querySelector('span')) p.innerHTML = `<span>${p.innerHTML || '<br>'}</span>`;
  p.querySelectorAll('span:not(.puce):not(.champ-page):not(.tab):not(.hab-espace)').forEach(s => {
    s.style.fontFamily = `'${st.police}'`;
    s.style.fontSize = st.taille + 'pt';
    s.style.fontWeight = st.gras ? 'bold' : '';
    s.style.fontStyle = st.italique ? 'italic' : '';
    s.style.color = st.couleur || '';
  });
  p.style.marginTop = st.avant ? st.avant + 'pt' : '';
  p.style.marginBottom = st.apres ? st.apres + 'pt' : '';
  if (st.align) p.style.textAlign = st.align === 'left' ? '' : st.align;
}
// applique une fonction à tout le HTML du document (cadres, chaînes, cellules, pages maîtres)
function surToutLeHTML(fn) {
  for (const p of [...E.fiche.pages, ...Object.values(E.fiche.maitres)]) {
    for (const o of p.items) {
      const traiter = h => { if (!h) return h; const d = document.createElement('div'); d.innerHTML = h; return fn(d) ? d.innerHTML : h; };
      if (o.html) o.html = traiter(o.html);
      if (o.htmlComplet) o.htmlComplet = traiter(o.htmlComplet);
      if (o.tableau) for (const c of o.tableau.cellules) c.html = traiter(c.html);
    }
  }
}
function modifierStyle(nom) {
  const st = listeStyles().find(s => s.nom === nom);
  if (!st) return;
  ouvrirBoite(`Modifier le style « ${nom} »`, `<div class="grille-champs">
    <span>Police</span><select id="ms-p" class="champ">${[...new Set([st.police, ...POLICES])].map(p => `<option${p === st.police ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>
    <span>Taille (pt)</span><input id="ms-t" class="champ champ-num" type="number" min="4" step="0.5" value="${st.taille}">
    <span>Couleur</span><input id="ms-c" type="color" value="${st.couleur || '#000000'}">
    <span>Style</span><span><label style="display:inline"><input type="checkbox" id="ms-g"${st.gras ? ' checked' : ''}> Gras</label> &nbsp; <label style="display:inline"><input type="checkbox" id="ms-i"${st.italique ? ' checked' : ''}> Italique</label></span>
    <span>Espace avant (pt)</span><input id="ms-av" class="champ champ-num" type="number" min="0" value="${st.avant || 0}">
    <span>Espace après (pt)</span><input id="ms-ap" class="champ champ-num" type="number" min="0" value="${st.apres || 0}">
    <span>Alignement</span><select id="ms-al" class="champ">${[['', 'Inchangé'], ['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite'], ['justify', 'Justifié']].map(([v, l]) => `<option value="${v}"${(st.align || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
    </div><p style="color:#666;max-width:420px">Tout le texte qui utilise ce style dans la fiche est mis à jour.</p>`, () => {
    quitterEdition();
    avant();
    const n = { nom, police: $('#ms-p').value, taille: +$('#ms-t').value || st.taille, couleur: $('#ms-c').value, gras: $('#ms-g').checked, italique: $('#ms-i').checked, avant: +$('#ms-av').value || 0, apres: +$('#ms-ap').value || 0, align: $('#ms-al').value || undefined };
    E.fiche.styles = (E.fiche.styles || []).filter(s => s.nom !== nom).concat([n]);
    surToutLeHTML(d => { const ps = d.querySelectorAll(`p[data-style="${CSS.escape(nom)}"]`); ps.forEach(p => poserStyleParagraphe(p, n)); return ps.length > 0; });
    refluerChaines();
    afficherPage();
    dessinerVignettes();
    apres();
  });
}
function menuModifierStyles() {
  return listeStyles().map(s => ({ lib: 'Modifier « ' + s.nom + ' »…', act: () => modifierStyle(s.nom) }));
}

/* ---------------- espacement des caractères ---------------- */
// on marque la sélection (surlignage temporaire) puis on remplace la marque par l'espacement
function espacementCaracteres(pt) {
  appliquerTexte(z => {
    document.execCommand('hiliteColor', false, 'rgb(1, 2, 3)');
    z.querySelectorAll('[style*="rgb(1, 2, 3)"]').forEach(s => {
      s.style.removeProperty('background-color');
      if (pt) s.style.letterSpacing = pt + 'pt'; else s.style.removeProperty('letter-spacing');
      s.querySelectorAll('[style*="letter-spacing"]').forEach(x => x.style.removeProperty('letter-spacing'));
    });
  });
}
function menuEspacement(b) {
  memoriserSelectionTexte();
  ouvrirMenu(sousBouton(b), [['Très serré', -1.5], ['Serré', -0.75], ['Normal', 0], ['Large', 1], ['Très large', 2.5]]
    .map(([l, v]) => ({ lib: l, act: () => { restaurerSelectionTexte(); espacementCaracteres(v); } }))
    .concat(['-', { lib: 'Autre espacement…', act: () => {
      ouvrirBoite('Espacement des caractères', '<div class="grille-champs"><span>Espacement (pt, négatif = serré)</span><input id="ec-v" class="champ champ-num" type="number" step="0.25" value="0"></div>', () => { restaurerSelectionTexte(); espacementCaracteres(+$('#ec-v').value || 0); });
    } }]));
}

/* ---------------- taquets de tabulation ---------------- */
function boiteTaquets() {
  const s = window.getSelection();
  let p = null;
  if (E.edition && s.rangeCount) { const n = s.getRangeAt(0).startContainer; p = (n.nodeType === 1 ? n : n.parentElement).closest('p'); }
  else { const o = selection().find(x => x.type === 'texte'); const el = o && elementObjet(o.id); p = el && el.querySelector('.contenu p'); }
  const actuels = p && p.dataset.taquets ? p.dataset.taquets.split(',') : [];
  memoriserSelectionTexte();
  const ligne = (v, i) => `<div class="ligne" style="gap:6px;margin:3px 0"><input class="champ champ-num" data-tq="${i}" type="number" step="0.5" min="0" value="${v ? parseFloat(v) : ''}" placeholder="mm"><select class="champ" data-tqa="${i}">${[['', 'Gauche'], ['c', 'Centré'], ['d', 'Droite'], ['v', 'Décimal (virgule)']].map(([k, l]) => `<option value="${k}"${(v || '').trim().endsWith(k) && k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;
  ouvrirBoite('Taquets de tabulation', `<p style="color:#666;margin-top:0">Position de chaque taquet, en mm depuis le bord gauche du paragraphe.<br>S'applique aux paragraphes sélectionnés (ou à tout le cadre).</p>
    ${[0, 1, 2, 3, 4, 5].map(i => ligne(actuels[i], i)).join('')}
    <div class="grille-champs" style="margin-top:8px"><span>Au-delà : un taquet tous les (mm)</span><input id="tq-pas" class="champ champ-num" type="number" min="1" step="0.5" value="${(selection()[0] && selection()[0].tabulation) || tabulationDoc()}"></div>`, () => {
    const l = [0, 1, 2, 3, 4, 5].map(i => { const v = parseFloat($(`[data-tq="${i}"]`).value); return v >= 0 ? v + $(`[data-tqa="${i}"]`).value : null; }).filter(Boolean)
      .sort((a, b) => parseFloat(a) - parseFloat(b)).join(',');
    const pas = +$('#tq-pas').value;
    restaurerSelectionTexte();
    appliquerTexte((z, tout) => { for (const q of paragraphesVises(z, tout)) { if (l) q.dataset.taquets = l; else delete q.dataset.taquets; } });
    const objs = selection().filter(o => o.type === 'texte');
    if (objs.length && pas > 0) { avant(); for (const o of objs) { if (pas !== tabulationDoc()) o.tabulation = pas; else delete o.tabulation; redessinerObjet(o); } apres(); }
  });
}

/* ---------------- césure ---------------- */
function tabulationDoc() { return E.fiche.page.tabulation || 12.7; }
function basculerCesure() {
  const objs = selection().filter(o => o.type === 'texte' || o.type === 'tableau');
  if (!objs.length) return;
  quitterEdition();
  avant();
  const tous = objs.every(o => o.cesure);
  for (const o of objs) { if (tous) delete o.cesure; else o.cesure = true; redessinerObjet(o); }
  refluerChaines();
  apres();
}

/* ---------------- grilles de mise en page et lignes de base ---------------- */
function boiteGrille() {
  const g = E.fiche.page.grille || { cols: 2, lignes: 2, espace: 5 };
  ouvrirBoite('Grille de mise en page', `<div class="grille-champs">
    <span>Colonnes</span><input id="gr-c" class="champ champ-num" type="number" min="1" max="24" value="${g.cols}">
    <span>Lignes</span><input id="gr-l" class="champ champ-num" type="number" min="1" max="24" value="${g.lignes}">
    <span>Espacement (mm)</span><input id="gr-e" class="champ champ-num" type="number" min="0" step="0.5" value="${g.espace}">
    </div><p style="color:#666;max-width:400px">La grille découpe la zone entre les marges ; les objets s'y aimantent. Mettez 1 colonne et 1 ligne pour l'enlever.</p>`, () => {
    avant();
    const c = Math.max(1, +$('#gr-c').value || 1), l = Math.max(1, +$('#gr-l').value || 1);
    if (c === 1 && l === 1) delete E.fiche.page.grille; else E.fiche.page.grille = { cols: c, lignes: l, espace: Math.max(0, +$('#gr-e').value || 0) };
    dessinerGuides();
    apres();
  });
}
function boiteLignesBase() {
  const b = E.fiche.page.lignesBase || { pas: 12, decalage: 0 };
  ouvrirBoite('Repères de ligne de base', `<div class="grille-champs">
    <span>Espacement (pt)</span><input id="lb-p" class="champ champ-num" type="number" min="4" step="0.5" value="${b.pas}">
    <span>Décalage (pt)</span><input id="lb-d" class="champ champ-num" type="number" min="0" step="0.5" value="${b.decalage}">
    <span>Afficher</span><input id="lb-a" type="checkbox"${E.fiche.page.lignesBase ? ' checked' : ''}>
    </div><p style="color:#666;max-width:400px">Lignes régulières pour aligner le texte de plusieurs cadres ou colonnes ; les objets s'y aimantent.</p>`, () => {
    avant();
    if ($('#lb-a').checked) E.fiche.page.lignesBase = { pas: Math.max(4, +$('#lb-p').value || 12), decalage: Math.max(0, +$('#lb-d').value || 0) };
    else delete E.fiche.page.lignesBase;
    dessinerGuides();
    apres();
  });
}
// positions (mm) des repères de grille et de ligne de base, pour l'affichage et le magnétisme
function reperesGrille() {
  const P = E.fiche.page, [mh, md, mb, mg] = P.marges;
  const v = [], h = [], base = [];
  if (P.grille) {
    const { cols, lignes, espace } = P.grille;
    const lw = (P.w - mg - md - espace * (cols - 1)) / cols, lh = (P.h - mh - mb - espace * (lignes - 1)) / lignes;
    for (let i = 0; i < cols; i++) { const x = mg + i * (lw + espace); v.push(x, x + lw); }
    for (let i = 0; i < lignes; i++) { const y = mh + i * (lh + espace); h.push(y, y + lh); }
  }
  if (P.lignesBase) {
    const pas = P.lignesBase.pas * 25.4 / 72, d = P.lignesBase.decalage * 25.4 / 72;
    for (let y = mh + d; y <= P.h - mb + 0.01; y += pas) base.push(y);
  }
  return { v, h, base };
}

/* ---------------- jeux de couleurs et de polices ---------------- */
const JEUX_COULEURS = [
  ['Office', ['#000000', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#ffffff']],
  ['Vert sapin', ['#000000', '#077568', '#f0c25a', '#5b5b5b', '#c00000', '#0fb39f', '#2e75b6', '#ffffff']],
  ['Électricité', ['#000000', '#1f4e79', '#ffc000', '#7f7f7f', '#c00000', '#2e75b6', '#548235', '#ffffff']],
  ['Bleu nuit', ['#000000', '#002060', '#0070c0', '#7f7f7f', '#00b0f0', '#305496', '#8ea9db', '#ffffff']],
  ['Chantier', ['#000000', '#c55a11', '#ffc000', '#595959', '#843c0c', '#f4b183', '#bf9000', '#ffffff']],
  ['Nature', ['#000000', '#548235', '#a9d18e', '#7f7f7f', '#375623', '#c5e0b4', '#bf9000', '#ffffff']],
  ['Prune', ['#000000', '#7030a0', '#cc66ff', '#7f7f7f', '#c00000', '#b4a7d6', '#3a3838', '#ffffff']],
  ['Gris', ['#000000', '#404040', '#7f7f7f', '#a6a6a6', '#262626', '#d9d9d9', '#595959', '#ffffff']]
];
const JEUX_POLICES = [
  ['Office', 'Calibri Light', 'Calibri'], ['Classique', 'Cambria', 'Calibri'], ['Moderne', 'Segoe UI Semibold', 'Segoe UI'],
  ['Scolaire', 'Arial Black', 'Arial'], ['Élégant', 'Georgia', 'Garamond'], ['Lisible', 'Verdana', 'Tahoma'], ['Trebuchet', 'Trebuchet MS', 'Trebuchet MS']
];
const hexa = c => {
  if (!c) return null;
  c = String(c).trim().toLowerCase();
  const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('');
  return /^#[0-9a-f]{6}$/.test(c) ? c : null;
};
function appliquerJeuCouleurs(nouv) {
  quitterEdition();
  avant();
  const anc = (E.fiche.palette || []).map(hexa);
  const corresp = new Map();
  anc.forEach((c, i) => { if (c && nouv[i] && !corresp.has(c) && i > 0 && i < 7) corresp.set(c, nouv[i]); });
  const conv = c => { const h = hexa(c); return h && corresp.has(h) ? corresp.get(h) : c; };
  for (const p of [...E.fiche.pages, ...Object.values(E.fiche.maitres)]) for (const o of p.items) {
    if (o.fond) { o.fond.couleur = conv(o.fond.couleur); if (o.fond.degrade) o.fond.degrade = conv(o.fond.degrade); }
    if (o.trait) o.trait.couleur = conv(o.trait.couleur);
    if (o.wordart) { o.wordart.couleur = conv(o.wordart.couleur); if (o.wordart.degrade) o.wordart.degrade = conv(o.wordart.degrade); if (o.wordart.contour) o.wordart.contour.couleur = conv(o.wordart.contour.couleur); }
    if (o.fond && o.fond.fondMotif) o.fond.fondMotif = conv(o.fond.fondMotif);
    if (o.tableau) for (const c of o.tableau.cellules) if (c.motif) { c.motif.couleur = conv(c.motif.couleur); c.motif.fondMotif = conv(c.motif.fondMotif); }
    if (o.tableau) for (const c of o.tableau.cellules) { if (c.fond) c.fond = conv(c.fond); if (c.bords) for (const k in c.bords) if (c.bords[k]) c.bords[k] = Object.assign({}, c.bords[k], { c: conv(c.bords[k].c) }); }
  }
  surToutLeHTML(d => { let m = false; d.querySelectorAll('[style*="color"]').forEach(s => { const n = conv(s.style.color); if (n !== s.style.color && hexa(n) !== hexa(s.style.color)) { s.style.color = n; m = true; } }); return m; });
  E.fiche.palette = [...nouv];
  afficherPage();
  dessinerVignettes();
  apres();
}
function appliquerJeuPolices(titres, corps) {
  quitterEdition();
  avant();
  const speciales = /wingdings|webdings|symbol/i;
  // styles de titre -> police des titres ; les autres -> police du corps
  const perso = E.fiche.styles || [];
  for (const s of STYLES_BASE) {
    const n = Object.assign({}, perso.find(p => p.nom === s.nom) || s, { police: /^Titre|Sous-titre/.test(s.nom) ? titres : corps });
    E.fiche.styles = (E.fiche.styles || []).filter(p => p.nom !== s.nom).concat([n]);
  }
  // texte du document : grand texte (14 pt et plus) = titres, le reste = corps
  surToutLeHTML(d => {
    let m = false;
    d.querySelectorAll('span').forEach(s => {
      if (s.classList.contains('puce') || speciales.test(s.style.fontFamily)) return;
      const st = s.closest('[data-style]');
      const t = parseFloat(s.style.fontSize) || 0;
      const titre = st ? /^Titre|Sous-titre/.test(st.dataset.style) : t >= 14;
      if (s.style.fontFamily || t) { s.style.fontFamily = `'${titre ? titres : corps}'`; m = true; }
    });
    return m;
  });
  E.fiche.jeuPolices = { titres, corps };
  refluerChaines();
  afficherPage();
  dessinerVignettes();
  apres();
}
function menuJeuCouleurs(b) {
  const d = document.createElement('div');
  d.innerHTML = JEUX_COULEURS.map(([n, c], i) => `<button class="menu-item" data-j="${i}"><span style="display:inline-flex;gap:1px;margin-right:8px">${c.slice(1, 7).map(x => `<i style="display:inline-block;width:12px;height:14px;background:${x}"></i>`).join('')}</span>${esc(n)}</button>`).join('');
  d.addEventListener('click', ev => { const x = ev.target.closest('[data-j]'); if (x) { fermerMenu(); appliquerJeuCouleurs(JEUX_COULEURS[+x.dataset.j][1]); } });
  ouvrirMenu(sousBouton(b), [{ titre: 'Le jeu remplace les couleurs de la fiche, partout' }], d);
}
function menuJeuPolices(b) {
  const d = document.createElement('div');
  d.innerHTML = JEUX_POLICES.map(([n, t, c], i) => `<button class="menu-item" data-j="${i}" style="flex-direction:column;align-items:flex-start;gap:0"><span style="font:600 14px '${t}'">${esc(n)} : ${esc(t)}</span><span style="font:12px '${c}';color:#555">${esc(c)} pour le texte</span></button>`).join('');
  d.addEventListener('click', ev => { const x = ev.target.closest('[data-j]'); if (x) { fermerMenu(); const j = JEUX_POLICES[+x.dataset.j]; appliquerJeuPolices(j[1], j[2]); } });
  ouvrirMenu(sousBouton(b), [{ titre: 'Titres (14 pt et plus) / texte courant' }], d);
}

/* ---------------- effets : reflet, biseau, rotation 3D ---------------- */
function menuEffets3D() {
  const s = surObjetsFormes;
  return [
    { titre: 'Reflet' },
    { lib: 'Aucun reflet', act: () => s(o => delete o.reflet, () => true) },
    { lib: 'Reflet proche', act: () => s(o => { o.reflet = { taille: 35, opacite: 0.45, ecart: 0.3 }; }, () => true) },
    { lib: 'Reflet complet', act: () => s(o => { o.reflet = { taille: 70, opacite: 0.5, ecart: 1 }; }, () => true) },
    { titre: 'Biseau' },
    { lib: 'Aucun biseau', act: () => s(o => delete o.biseau, () => true) },
    { lib: 'Biseau doux', act: () => s(o => { o.biseau = 'doux'; }, () => true) },
    { lib: 'Biseau marqué', act: () => s(o => { o.biseau = 'marque'; }, () => true) },
    { titre: 'Profondeur 3D' },
    { lib: 'Sans profondeur', act: () => s(o => delete o.extrusion, () => true) },
    { lib: 'Profondeur faible', act: () => s(o => { o.extrusion = { p: 1, couleur: '#7f7f7f' }; }, () => true) },
    { lib: 'Profondeur moyenne', act: () => s(o => { o.extrusion = { p: 2.5, couleur: '#7f7f7f' }; }, () => true) },
    { lib: 'Profondeur forte', act: () => s(o => { o.extrusion = { p: 5, couleur: '#595959' }; }, () => true) },
    { lib: 'Couleur de la profondeur…', act: () => { const i = document.createElement('input'); i.type = 'color'; i.value = '#7f7f7f'; i.onchange = () => s(o => { o.extrusion = Object.assign({ p: 2.5 }, o.extrusion, { couleur: i.value }); }, () => true); i.click(); } },
    { titre: 'Rotation 3D' },
    { lib: 'Aucune', act: () => s(o => delete o.rot3d, () => true) },
    { lib: 'Perspective à gauche', act: () => s(o => { o.rot3d = { y: 25 }; }, () => true) },
    { lib: 'Perspective à droite', act: () => s(o => { o.rot3d = { y: -25 }; }, () => true) },
    { lib: 'Incliné vers l\'arrière', act: () => s(o => { o.rot3d = { x: 30 }; }, () => true) },
    { lib: 'Isométrique', act: () => s(o => { o.rot3d = { x: 20, y: -30 }; }, () => true) }
  ];
}

/* ---------------- tableaux : cellules coupées en diagonale ---------------- */
function diagonaleCellules(sens) {
  const st = E.styleBord || BORD_DEFAUT;
  changerCellules((T, ids) => { for (const i of ids) { if (sens) T.cellules[i].diagonale = { sens, c: st.c, e: st.e }; else delete T.cellules[i].diagonale; } });
}

/* ---------------- images EMF / WMF ---------------- */
async function convertirMetafichiers() {
  const refs = Object.keys(E.fiche.images).filter(k => /^data:image\/x-(emf|wmf)/.test(E.fiche.images[k]));
  if (!refs.length || typeof LecteurMeta === 'undefined') return;
  let n = 0, illisibles = 0;
  // taille d'affichage de chaque image (premier cadre qui l'utilise, rognage compris) : le dessin est fait à ces proportions
  const tailles = {};
  for (const p of [...E.fiche.pages, ...Object.values(E.fiche.maitres)]) for (const o of p.items) {
    if (o.image && !tailles[o.image] && o.w > 0 && o.h > 0) {
      const [ha, dr, ba, ga] = o.rognage || [0, 0, 0, 0];
      tailles[o.image] = { w: o.w / Math.max(0.05, 1 - ga - dr), h: o.h / Math.max(0.05, 1 - ha - ba) };
    }
    if (o.bordure) for (const k of o.bordure.images) tailles[k] = { px: 56 };
  }
  for (const k of refs) {
    try { const png = await LecteurMeta.versPNG(E.fiche.images[k], tailles[k]); if (png) { E.fiche.images[k] = png; n++; } }
    catch (e) { illisibles++; }
  }
  if (n) { afficherPage(); dessinerVignettes(); }
  if (illisibles) bandeau(`${illisibles} image(s) au format EMF+ (dessin Office récent) n'ont pas pu être affichées : elles restent en cadre gris. Clic droit › Changer l'image pour les remplacer.`);
}
// profil des pixels opaques des images (habillage serré) : calculé une fois par image
const profilsEnCours = new Set();
function profilImage(ref) {
  if (!ref || Rendu.profilsImages[ref] || profilsEnCours.has(ref) || !E.fiche.images[ref] || !/^data:image\/(png|gif|webp)/.test(E.fiche.images[ref])) return;
  profilsEnCours.add(ref);
  const im = new Image();
  im.onload = () => {
    const n = 64, w = Math.min(256, im.naturalWidth || 1);
    const c = document.createElement('canvas');
    c.width = w; c.height = n;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0, w, n);
    const d = g.getImageData(0, 0, w, n).data;
    const lignes = [];
    for (let y = 0; y < n; y++) {
      let a = -1, b = -1;
      for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (a < 0) a = x; b = x; }
      lignes.push(a < 0 ? null : [a / w, (b + 1) / w]);
    }
    Rendu.profilsImages[ref] = lignes;
    profilsEnCours.delete(ref);
    rafraichirDependances();
  };
  im.src = E.fiche.images[ref];
}

/* ---------------- version à jour des fiches (dossier OneDrive partagé) ----------------
   L'outil partagé note sa version et son adresse ; une fiche enregistrée avec une
   version plus ancienne propose de passer à la nouvelle. */
const CLE_OUTIL = 'pagelibre-outil';
function lireOutil() { try { return JSON.parse(localStorage.getItem(CLE_OUTIL) || 'null'); } catch (e) { return null; } }
function noterOutil(estFiche) {
  if (estFiche) return;
  try {
    const o = lireOutil();
    if (!o || o.version <= VERSION_EDITEUR || o.url === location.href) localStorage.setItem(CLE_OUTIL, JSON.stringify({ version: VERSION_EDITEUR, url: location.href }));
  } catch (e) { /* stockage indisponible */ }
}
function proposerNouvelleVersion() {
  const o = lireOutil();
  if (!o || !(o.version > VERSION_EDITEUR) || o.url === location.href) return;
  const bd = $('#bandeau');
  bd.dataset.type = 'version';
  bd.innerHTML = `<span>Une version plus récente de PageLibre est disponible (${esc(o.version.slice(0, 10).split('-').reverse().join('/'))}).</span><button class="bouton principal" data-v>Ouvrir cette fiche avec la nouvelle version</button><button class="bouton" data-n>Plus tard</button>`;
  bd.hidden = false;
  $('[data-n]', bd).onclick = () => { bd.hidden = true; };
  $('[data-v]', bd).onclick = async () => {
    quitterEdition();
    try {
      await bdFaire('readwrite', s => s.put({ fiche: E.fiche, nom: decodeURIComponent(location.pathname.split('/').pop() || ''), modifie: E.modifie, date: Date.now() }, 'transfert'));
      E.modifie = false;
      location.href = o.url;
    } catch (e) { alerte('Impossible de passer à la nouvelle version : ' + e.message); }
  };
}
async function reprendreTransfert() {
  let t = null;
  try { t = await bdFaire('readonly', s => s.get('transfert')); } catch (e) { return false; }
  if (!t || !t.fiche || Date.now() - t.date > 10 * 60 * 1000) return false;
  try { await bdFaire('readwrite', s => s.delete('transfert')); } catch (e) { /* */ }
  chargerFiche(t.fiche, { nom: t.nom });
  E.modifie = true;
  majTitre();
  bandeau(`Fiche « ${t.nom || E.fiche.titre} » reprise avec la nouvelle version de l'outil. Enregistrez-la (Ctrl+S) à la place de l'ancienne pour qu'elle reste à jour.`);
  return true;
}

/* ---------------- fiches récentes ---------------- */
async function noterRecent(poignee) {
  if (!poignee || !poignee.name) return;
  try {
    const l = (await bdFaire('readonly', s => s.get('recents'))) || [];
    const reste = [];
    for (const r of l) { try { if (!(await r.poignee.isSameEntry(poignee))) reste.push(r); } catch (e) { /* */ } }
    reste.unshift({ poignee, nom: poignee.name, date: Date.now() });
    await bdFaire('readwrite', s => s.put(reste.slice(0, 10), 'recents'));
  } catch (e) { /* les poignées de fichiers ne sont pas mémorisables ici */ }
}
async function listeRecents() { try { return (await bdFaire('readonly', s => s.get('recents'))) || []; } catch (e) { return []; } }
async function ouvrirRecent(r) {
  try {
    const opts = { mode: /\.html?$/i.test(r.nom) ? 'readwrite' : 'read' };
    if ((await r.poignee.queryPermission(opts)) !== 'granted' && (await r.poignee.requestPermission(opts)) !== 'granted') return;
    const f = await r.poignee.getFile();
    ouvrirFichier(f, /\.html?$/i.test(f.name) ? r.poignee : null);
  } catch (e) { alerte(`Impossible de rouvrir « ${r.nom} » : le fichier a peut-être été déplacé ou supprimé.`); }
}
