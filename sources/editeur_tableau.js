/* =====================================================================
   Éditeur : tableaux
   Modèle : { cols:[mm], lignes:[mm], cellules:[{l,c,nl,nc,html,fond,bords:{h,b,g,d},vertical,sensTexte}] }
   ===================================================================== */
const BORD_DEFAUT = { c: '#000000', e: 0.75 };
const CEL_VIDE = '<p><span style="font-family:\'Calibri\';font-size:10pt"><br></span></p>';

function insererTableau(nl, nc) {
  quitterEdition();
  const P = E.fiche.page, [, md, , mg] = P.marges;
  const w = Math.min(P.w - mg - md, nc * 30), hl = 8;
  const cols = Array(nc).fill(arrondi(w / nc)), lignes = Array(nl).fill(hl);
  const cellules = [];
  for (let l = 0; l < nl; l++) for (let c = 0; c < nc; c++) {
    cellules.push({ l, c, nl: 1, nc: 1, html: CEL_VIDE, bords: { h: { ...BORD_DEFAUT }, b: { ...BORD_DEFAUT }, g: { ...BORD_DEFAUT }, d: { ...BORD_DEFAUT } } });
  }
  const o = { id: nouvelId(), type: 'tableau', x: arrondi((P.w - w) / 2), y: arrondi(P.h / 3), w: arrondi(w), h: nl * hl, tableau: { cols, lignes, cellules, marges: [1, 1, 1, 1] } };
  avant();
  pageCourante().items.push(o);
  redessinerObjet(o);
  E.sel = [o.id];
  apres();
  entrerEdition(o);
}

function grilleTableau(T) {
  const g = Array.from({ length: T.lignes.length }, () => Array(T.cols.length).fill(-1));
  T.cellules.forEach((c, i) => {
    for (let r = c.l; r < Math.min(c.l + c.nl, T.lignes.length); r++) for (let k = c.c; k < Math.min(c.c + c.nc, T.cols.length); k++) g[r][k] = i;
  });
  return g;
}
function completerTableau(T) {
  const g = grilleTableau(T);
  g.forEach((ligne, r) => ligne.forEach((v, k) => { if (v < 0) T.cellules.push({ l: r, c: k, nl: 1, nc: 1, html: CEL_VIDE }); }));
}

function tableauEdite() {
  const s = selection();
  return s.length === 1 && s[0].type === 'tableau' ? s[0] : null;
}
function cellulesCibles(o) {
  if (E.edition && E.edition.id === o.id) {
    if (E.cellules.length) return [...E.cellules];
    if (E.celluleActive != null) return [E.celluleActive];
  }
  return o.tableau.cellules.map((c, i) => i);
}
function celluleReference(o) {
  if (E.edition && E.edition.id === o.id) {
    if (E.cellules.length) return o.tableau.cellules[E.cellules[0]];
    if (E.celluleActive != null) return o.tableau.cellules[E.celluleActive];
  }
  return o.tableau.cellules[0];
}

// modification de structure : on enregistre le texte, on modifie, on revient dans la cellule
function modifierTableau(fn) {
  const o = tableauEdite();
  if (!o) return;
  const enEdition = E.edition && E.edition.id === o.id;
  const ref = celluleReference(o);
  const pos = ref ? { l: ref.l, c: ref.c } : { l: 0, c: 0 };
  if (enEdition) quitterEdition();
  avant();
  const cible = fn(o, ref, pos) || pos;
  completerTableau(o.tableau);
  o.h = arrondi(o.tableau.lignes.reduce((a, b) => a + b, 0));
  o.w = arrondi(o.tableau.cols.reduce((a, b) => a + b, 0));
  redessinerObjet(o);
  apres();
  if (enEdition) {
    entrerEdition(o);
    focaliserCellule(o, cible.l, cible.c);
  }
}
function focaliserCellule(o, l, c) {
  const T = o.tableau, g = grilleTableau(T);
  l = Math.max(0, Math.min(l, T.lignes.length - 1)); c = Math.max(0, Math.min(c, T.cols.length - 1));
  const i = g[l][c];
  const z = $(`td[data-cellule="${i}"] .contenu`, elementObjet(o.id));
  if (!z) return;
  toutSelectionner(z, true);
  E.celluleActive = i;
  majRuban();
}

function insLigne(apres_) {
  modifierTableau((o, ref) => {
    const T = o.tableau;
    const r = apres_ ? ref.l + ref.nl : ref.l;
    const modele = apres_ ? ref.l + ref.nl - 1 : ref.l;
    for (const x of T.cellules) { if (x.l >= r) x.l++; else if (x.l + x.nl > r) x.nl++; }
    T.lignes.splice(r, 0, T.lignes[Math.min(modele, T.lignes.length - 1)]);
    const g = grilleTableau(T);
    for (let k = 0; k < T.cols.length; k++) {
      if (g[r][k] >= 0) continue;
      const voisin = T.cellules[g[apres_ ? r - 1 : r + 1] ? g[apres_ ? r - 1 : r + 1][k] : -1];
      T.cellules.push({ l: r, c: k, nl: 1, nc: 1, html: CEL_VIDE, bords: voisin && voisin.bords ? copie(voisin.bords) : undefined, fond: voisin && voisin.fond, vertical: voisin && voisin.vertical });
    }
    return { l: r, c: ref.c };
  });
}
function insColonne(apres_) {
  modifierTableau((o, ref) => {
    const T = o.tableau;
    const k0 = apres_ ? ref.c + ref.nc : ref.c;
    const modele = apres_ ? ref.c + ref.nc - 1 : ref.c;
    for (const x of T.cellules) { if (x.c >= k0) x.c++; else if (x.c + x.nc > k0) x.nc++; }
    T.cols.splice(k0, 0, T.cols[Math.min(modele, T.cols.length - 1)]);
    const g = grilleTableau(T);
    for (let r = 0; r < T.lignes.length; r++) {
      if (g[r][k0] >= 0) continue;
      const iv = g[r][apres_ ? k0 - 1 : k0 + 1];
      const voisin = iv != null && iv >= 0 ? T.cellules[iv] : null;
      T.cellules.push({ l: r, c: k0, nl: 1, nc: 1, html: CEL_VIDE, bords: voisin && voisin.bords ? copie(voisin.bords) : undefined, fond: voisin && voisin.fond, sensTexte: voisin && voisin.sensTexte });
    }
    return { l: ref.l, c: k0 };
  });
}
function supLigne() {
  const o = tableauEdite();
  if (!o) return;
  if (o.tableau.lignes.length < 2) { supprimerSelection(); return; }
  modifierTableau((o2, ref) => {
    const T = o2.tableau, r = ref.l;
    T.cellules = T.cellules.filter(x => {
      if (x.l <= r && x.l + x.nl > r) { if (x.nl === 1) return false; x.nl--; }
      else if (x.l > r) x.l--;
      return true;
    });
    T.lignes.splice(r, 1);
    return { l: Math.min(r, T.lignes.length - 1), c: ref.c };
  });
}
function supColonne() {
  const o = tableauEdite();
  if (!o) return;
  if (o.tableau.cols.length < 2) { supprimerSelection(); return; }
  modifierTableau((o2, ref) => {
    const T = o2.tableau, k = ref.c;
    T.cellules = T.cellules.filter(x => {
      if (x.c <= k && x.c + x.nc > k) { if (x.nc === 1) return false; x.nc--; }
      else if (x.c > k) x.c--;
      return true;
    });
    T.cols.splice(k, 1);
    return { l: ref.l, c: Math.min(k, T.cols.length - 1) };
  });
}

/* ---- choix d'une plage de cellules (Maj+clic) ---- */
function plageDe(T, i1, i2) {
  const a = T.cellules[i1], b = T.cellules[i2];
  let r1 = Math.min(a.l, b.l), r2 = Math.max(a.l + a.nl, b.l + b.nl) - 1;
  let c1 = Math.min(a.c, b.c), c2 = Math.max(a.c + a.nc, b.c + b.nc) - 1;
  // élargir pour englober entièrement les cellules fusionnées
  let change = true;
  while (change) {
    change = false;
    for (const x of T.cellules) {
      const dedans = x.l <= r2 && x.l + x.nl - 1 >= r1 && x.c <= c2 && x.c + x.nc - 1 >= c1;
      if (!dedans) continue;
      if (x.l < r1) { r1 = x.l; change = true; }
      if (x.l + x.nl - 1 > r2) { r2 = x.l + x.nl - 1; change = true; }
      if (x.c < c1) { c1 = x.c; change = true; }
      if (x.c + x.nc - 1 > c2) { c2 = x.c + x.nc - 1; change = true; }
    }
  }
  return { r1, r2, c1, c2 };
}
function choisirPlageCellules(i1, i2) {
  const o = objetParId(E.edition.id);
  if (!o || o.type !== 'tableau') return;
  const p = plageDe(o.tableau, i1, i2);
  E.cellules = o.tableau.cellules.map((x, i) => i).filter(i => {
    const x = o.tableau.cellules[i];
    return x.l >= p.r1 && x.l <= p.r2 && x.c >= p.c1 && x.c <= p.c2;
  });
  E.plage = p;
  const el = elementObjet(o.id);
  $$('td[data-cellule]', el).forEach(td => td.classList.toggle('cel-choisie', E.cellules.includes(+td.dataset.cellule)));
  window.getSelection().removeAllRanges();
  majRuban();
}
function effacerChoixCellules() {
  E.cellules = [];
  E.plage = null;
  $$('td.cel-choisie').forEach(td => td.classList.remove('cel-choisie'));
}

function fusionnerCellules() {
  const o = tableauEdite();
  if (!o || E.cellules.length < 2 || !E.plage) { alerte('Choisissez d\'abord plusieurs cellules : cliquez dans une cellule, puis Maj+clic dans une autre.'); return; }
  const p = E.plage, ids = new Set(E.cellules);
  modifierTableau((o2) => {
    const T = o2.tableau;
    const choisies = T.cellules.filter((x, i) => ids.has(i)).sort((a, b) => a.l - b.l || a.c - b.c);
    const base = choisies[0];
    const textes = choisies.map(x => x.html).filter(h => h && h.replace(/<[^>]+>/g, '').trim());
    base.html = textes.length ? textes.join('') : base.html;
    base.l = p.r1; base.c = p.c1; base.nl = p.r2 - p.r1 + 1; base.nc = p.c2 - p.c1 + 1;
    const bords = Object.assign({}, base.bords || {});
    for (const x of choisies) { if (!x.bords) continue; if (x.c + x.nc - 1 === p.c2 && x.bords.d) bords.d = x.bords.d; if (x.l + x.nl - 1 === p.r2 && x.bords.b) bords.b = x.bords.b; }
    base.bords = bords;
    T.cellules = T.cellules.filter(x => x === base || !choisies.includes(x));
    return { l: p.r1, c: p.c1 };
  });
  effacerChoixCellules();
}
function fractionnerCellule() {
  const o = tableauEdite();
  if (!o) return;
  const ref = celluleReference(o);
  if (!ref || (ref.nl === 1 && ref.nc === 1)) { alerte('Cette cellule n\'est pas fusionnée.'); return; }
  modifierTableau((o2, r) => {
    const T = o2.tableau;
    for (let l = r.l; l < r.l + r.nl; l++) for (let c = r.c; c < r.c + r.nc; c++) {
      if (l === r.l && c === r.c) continue;
      T.cellules.push({ l, c, nl: 1, nc: 1, html: CEL_VIDE, bords: r.bords ? copie(r.bords) : undefined, fond: r.fond });
    }
    r.nl = 1; r.nc = 1;
    return { l: r.l, c: r.c };
  });
}

/* ---- apparence des cellules ---- */
function changerCellules(fn, sansStructure) {
  const o = tableauEdite();
  if (!o) return;
  const enEdition = E.edition && E.edition.id === o.id;
  if (enEdition) lireTexteEdite(o, elementObjet(o.id));
  const cibles = cellulesCibles(o);
  avant();
  fn(o.tableau, cibles);
  if (enEdition) {
    // on garde la saisie ouverte : on redessine le tableau et on rend les cellules modifiables
    const memo = { cel: E.celluleActive, choix: [...E.cellules], plage: E.plage, avantEd: E.edition.avant };
    E.edition = null;
    redessinerObjet(o);
    E.edition = { id: o.id, avant: memo.avantEd };
    const el = elementObjet(o.id);
    el.classList.add('edition');
    $$('.contenu', el).forEach(z => { z.contentEditable = 'true'; z.spellcheck = true; });
    E.cellules = memo.choix; E.plage = memo.plage; E.celluleActive = memo.cel;
    $$('td[data-cellule]', el).forEach(td => td.classList.toggle('cel-choisie', E.cellules.includes(+td.dataset.cellule)));
    if (memo.cel != null && !E.cellules.length) { const z = $(`td[data-cellule="${memo.cel}"] .contenu`, el); if (z) toutSelectionner(z, true); }
  } else redessinerObjet(o);
  apres();
  void sansStructure;
}
function fondCellules(couleur) {
  changerCellules((T, ids) => { for (const i of ids) { delete T.cellules[i].motif; if (couleur) T.cellules[i].fond = couleur; else delete T.cellules[i].fond; } });
}
function alignementVertical(v) {
  changerCellules((T, ids) => { for (const i of ids) { if (v === 'haut') delete T.cellules[i].vertical; else T.cellules[i].vertical = v; } });
}
function sensTexteCellules() {
  changerCellules((T, ids) => {
    const tous = ids.every(i => T.cellules[i].sensTexte);
    for (const i of ids) { if (tous) delete T.cellules[i].sensTexte; else T.cellules[i].sensTexte = 'bas-haut'; }
  });
}
function bordures(mode, style) {
  style = style || E.styleBord || BORD_DEFAUT;
  changerCellules((T, ids) => {
    const set = new Set(ids);
    const cs = ids.map(i => T.cellules[i]);
    const r1 = Math.min(...cs.map(x => x.l)), r2 = Math.max(...cs.map(x => x.l + x.nl)), c1 = Math.min(...cs.map(x => x.c)), c2 = Math.max(...cs.map(x => x.c + x.nc));
    const s = () => (mode === 'aucune' ? null : { c: style.c, e: style.e });
    const poser = (x, cote, v) => { x.bords = x.bords || {}; if (v) x.bords[cote] = v; else delete x.bords[cote]; };
    T.cellules.forEach((x, i) => {
      const dans = set.has(i);
      if (dans) {
        const ext = { h: x.l === r1, b: x.l + x.nl === r2, g: x.c === c1, d: x.c + x.nc === c2 };
        for (const cote of ['h', 'b', 'g', 'd']) {
          if (mode === 'toutes' || mode === 'aucune') poser(x, cote, s());
          else if (mode === 'exterieures' && ext[cote]) poser(x, cote, s());
          else if (mode === 'interieures' && !ext[cote]) poser(x, cote, s());
          else if (mode === cote && ext[cote]) poser(x, cote, s());
        }
      } else if (mode === 'aucune' || mode === 'toutes' || mode === 'exterieures') {
        // la bordure partagée avec une cellule voisine
        const v = mode === 'aucune' ? null : { c: style.c, e: style.e };
        const chevaucheC = x.c < c2 && x.c + x.nc > c1, chevaucheL = x.l < r2 && x.l + x.nl > r1;
        if (chevaucheC && x.l + x.nl === r1) poser(x, 'b', v);
        if (chevaucheC && x.l === r2) poser(x, 'h', v);
        if (chevaucheL && x.c + x.nc === c1) poser(x, 'd', v);
        if (chevaucheL && x.c === c2) poser(x, 'g', v);
      }
    });
  });
}
function dimensionLigneColonne(type, valeur) {
  const o = tableauEdite();
  if (!o || !(valeur > 0)) return;
  const ref = celluleReference(o);
  changerCellules(T => {
    if (type === 'ligne') T.lignes[ref.l] = arrondi(valeur);
    else T.cols[ref.c] = arrondi(valeur);
    o.h = arrondi(T.lignes.reduce((a, b) => a + b, 0));
    o.w = arrondi(T.cols.reduce((a, b) => a + b, 0));
  });
}
function repartirColonnes() {
  changerCellules(T => { const t = T.cols.reduce((a, b) => a + b, 0); T.cols = T.cols.map(() => arrondi(t / T.cols.length)); });
}
function repartirLignes() {
  changerCellules(T => { const t = T.lignes.reduce((a, b) => a + b, 0); T.lignes = T.lignes.map(() => arrondi(t / T.lignes.length)); });
}

function celluleSuivante(o, sens) {
  const T = o.tableau;
  const ordre = T.cellules.map((c, i) => i).sort((a, b) => T.cellules[a].l - T.cellules[b].l || T.cellules[a].c - T.cellules[b].c);
  let pos = ordre.indexOf(E.celluleActive);
  pos += sens;
  if (pos >= ordre.length) { E.celluleActive = ordre[ordre.length - 1]; insLigne(true); return; }
  if (pos < 0) pos = 0;
  effacerChoixCellules();
  const i = ordre[pos];
  const z = $(`td[data-cellule="${i}"] .contenu`, elementObjet(o.id));
  if (z) { toutSelectionner(z); E.celluleActive = i; }
}
