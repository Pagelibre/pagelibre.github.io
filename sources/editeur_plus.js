/* =====================================================================
   Éditeur : fonctions avancées (comme en PAO)
   rognage à la souris, cadres chaînés, pinceau, guides de règle, styles,
   pages maîtres, numéros de page, rechercher/remplacer, lettrines,
   colonnes, effets, habillage, blocs de construction, corrections d'image,
   colonnes/lignes de tableau à la souris, styles de tableau
   ===================================================================== */

/* ---------------- interceptions de la souris ---------------- */
// appelée au début de surAppui ; renvoie true si le clic est traité ici
function interceptionAppui(ev, cible, elObj) {
  // guides de règle
  const gd = cible.closest('.guide-regle');
  if (gd) { demarrerGuide(ev, gd.dataset.guide.length ? +gd.dataset.guide : null, null); return true; }
  // mode « créer un lien » : on clique sur la zone de texte qui recevra la suite
  if (E.lien) {
    const o = elObj && objetParId(elObj.dataset.id);
    ev.preventDefault();
    terminerLien(o);
    return true;
  }
  // pinceau : on clique sur l'objet qui reçoit la mise en forme
  if (E.pinceau && elObj && !(E.edition && E.edition.id === elObj.dataset.id)) {
    const o = objetParId(elObj.dataset.id);
    if (o) { ev.preventDefault(); appliquerPinceauObjet(o); return true; }
  }
  // rognage
  const pr = cible.closest('[data-rog]');
  if (pr && E.rognage) { demarrerRognage(ev, pr.dataset.rog); return true; }
  if (E.rognage && !cible.closest('[data-rog]')) quitterRognage();
  // séparateurs de colonnes / lignes de tableau
  const sep = cible.closest('[data-sep]');
  if (sep) { demarrerSeparateur(ev, sep.dataset.sep, +sep.dataset.k); return true; }
  return false;
}

// éléments ajoutés au calque de sélection
function extrasSelectionUI(ui, objs) {
  if (E.rognage && !(objs.length === 1 && objs[0].id === E.rognage)) E.rognage = null;
  if (objs.length !== 1) return;
  const o = objs[0];
  if (E.rognage && o.type === 'image') ui.appendChild(calqueRognage(o));
  if (o.type === 'tableau') ui.appendChild(calqueSeparateurs(o));
}
function cadreLocal(o, cls) {
  const k = PX_MM * E.zoom, p = mmVersScene(o.x, o.y);
  const d = document.createElement('div');
  d.className = cls;
  d.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;width:${o.w * k}px;height:${o.h * k}px;transform:${o.rot ? `rotate(${o.rot}deg)` : 'none'};transform-origin:50% 50%`;
  return d;
}
// geste générique : décalage local (dans le repère de l'objet tourné)
function deltaLocal(o0, p, p0) {
  const r = (o0.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const dx = p.x - p0.x, dy = p.y - p0.y;
  return { lx: dx * c + dy * s, ly: -dx * s + dy * c };
}
// place un cadre redimensionné en gardant fixe le côté opposé
function placerCadre(o, o0, w, h, sx, sy) {
  const r = (o0.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const cx0 = o0.x + o0.w / 2, cy0 = o0.y + o0.h / 2;
  const fx = -sx * o0.w / 2, fy = -sy * o0.h / 2;
  const Fx = cx0 + fx * c - fy * s, Fy = cy0 + fx * s + fy * c;
  const nx = sx ? -sx * w / 2 : 0, ny = sy ? -sy * h / 2 : 0;
  const cx = Fx - (nx * c - ny * s), cy = Fy - (nx * s + ny * c);
  o.w = arrondi(w); o.h = arrondi(h); o.x = arrondi(cx - w / 2); o.y = arrondi(cy - h / 2);
}

/* ---------------- 1. rognage à la souris ---------------- */
function basculerRognage() {
  const o = selection().find(x => x.type === 'image');
  if (!o) return;
  if (E.rognage === o.id) { quitterRognage(); return; }
  E.sel = [o.id];
  E.rognage = o.id;
  indicationModes('Rognage : tirez les poignées noires pour rogner, faites glisser l\'image pour la recadrer. Échap pour terminer.');
  majSelectionUI();
  majRuban();
}
function quitterRognage() {
  if (!E.rognage) return;
  E.rognage = null;
  indicationModes(null);
  majSelectionUI();
  majRuban();
}
function calqueRognage(o) {
  const d = cadreLocal(o, 'calque-rognage');
  const [t, r, b, l] = o.rognage || [0, 0, 0, 0];
  const W = 1 / (1 - l - r), H = 1 / (1 - t - b);
  const f = document.createElement('div');
  f.className = 'fantome-rog';
  f.dataset.rog = 'pan';
  f.style.cssText = `left:${-l * W * 100}%;top:${-t * H * 100}%;width:${W * 100}%;height:${H * 100}%`;
  const src = E.fiche.images[o.image];
  if (src) { const im = document.createElement('img'); im.src = src; im.draggable = false; f.appendChild(im); }
  d.appendChild(f);
  const fen = document.createElement('div');
  fen.className = 'fenetre-rog';
  fen.dataset.rog = 'pan';
  d.appendChild(fen);
  const pos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
  for (const nom in pos) {
    const h = document.createElement('div');
    h.className = 'poignee-rog r-' + nom;
    h.dataset.rog = nom;
    h.style.left = pos[nom][0] + '%';
    h.style.top = pos[nom][1] + '%';
    d.appendChild(h);
  }
  return d;
}
function demarrerRognage(ev, dir) {
  const o = objetParId(E.rognage);
  if (!o) return;
  ev.preventDefault();
  const o0 = copie(o), p0 = versMM(ev);
  const [t0, r0, b0, l0] = o0.rognage || [0, 0, 0, 0];
  const W0 = o0.w / (1 - l0 - r0), H0 = o0.h / (1 - t0 - b0);
  const dirs = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1] };
  G = {
    type: 'rogner', x0: ev.clientX, y0: ev.clientY, actif: false,
    bouger(p) {
      const { lx, ly } = deltaLocal(o0, p, p0);
      let t = t0, r = r0, b = b0, l = l0;
      if (dir === 'pan') {
        const dl = Math.max(-l0, Math.min(r0, -lx / W0)), dt = Math.max(-t0, Math.min(b0, -ly / H0));
        l = l0 + dl; r = r0 - dl; t = t0 + dt; b = b0 - dt;
        o.rognage = [t, r, b, l].map(v => arrondi(v, 4));
        redessinerObjet(o);
        majSelectionUI();
        return;
      }
      const [sx, sy] = dirs[dir];
      if (sx < 0) l = Math.max(0, Math.min(1 - r - 0.03, l0 + lx / W0));
      if (sx > 0) r = Math.max(0, Math.min(1 - l - 0.03, r0 - lx / W0));
      if (sy < 0) t = Math.max(0, Math.min(1 - b - 0.03, t0 + ly / H0));
      if (sy > 0) b = Math.max(0, Math.min(1 - t - 0.03, b0 - ly / H0));
      placerCadre(o, o0, W0 * (1 - l - r), H0 * (1 - t - b), sx, sy);
      if (t || r || b || l) o.rognage = [t, r, b, l].map(v => arrondi(v, 4)); else delete o.rognage;
      redessinerObjet(o);
      majSelectionUI();
    }
  };
}

/* ---------------- 2. cadres chaînés (le texte continue d'un cadre à l'autre) ---------------- */
function tousLesObjets() {
  const m = new Map();
  for (const p of [...E.fiche.pages, ...Object.values(E.fiche.maitres)]) for (const x of p.items) m.set(x.id, x);
  return m;
}
function chaineDe(o, tous) {
  tous = tous || tousLesObjets();
  let tete = o, garde = 0;
  while (tete.precedent && tous.get(tete.precedent) && garde++ < 200) tete = tous.get(tete.precedent);
  const l = [tete];
  let c = tete;
  while (c.suivant && tous.get(c.suivant) && l.length < 200) { c = tous.get(c.suivant); if (l.includes(c)) break; l.push(c); }
  return l;
}
// recolle les morceaux de paragraphe coupés entre deux cadres
function recoller(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  for (const p of [...d.querySelectorAll(':scope > [data-coupe]')]) {
    const n = p.nextElementSibling;
    if (n && n.hasAttribute('data-suite')) { while (n.firstChild) p.appendChild(n.firstChild); n.remove(); }
    p.removeAttribute('data-coupe');
  }
  d.querySelectorAll('[data-suite]').forEach(p => { p.removeAttribute('data-suite'); p.style.removeProperty('text-indent'); });
  d.querySelectorAll('[data-coupe]').forEach(p => p.removeAttribute('data-coupe'));
  return d.innerHTML;
}
function texteCompletChaine(chaine) {
  return recoller(chaine.map(x => x.html || '').join(''));
}
let hoteMesure = null;
function mesureHote() {
  if (!hoteMesure) {
    hoteMesure = document.createElement('div');
    hoteMesure.style.cssText = 'position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none';
    hoteMesure.className = 'feuille';
    document.body.appendChild(hoteMesure);
  }
  hoteMesure.style.width = E.fiche.page.w + 'mm';
  hoteMesure.style.height = E.fiche.page.h + 'mm';
  return hoteMesure;
}
function couperParagraphe(p, z, dispo) {
  const pos = [];
  const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.nodeValue;
    for (let i = 0; i < t.length; i++) if (t[i] === ' ' || t[i] === ' ' || t[i] === '\t') pos.push([n, i + 1]);
  }
  if (!pos.length) return null;
  const morceau = (debut, fin) => {
    const r = document.createRange();
    if (debut) r.setStart(debut[0], debut[1]); else r.setStart(p, 0);
    if (fin) r.setEnd(fin[0], fin[1]); else r.setEnd(p, p.childNodes.length);
    const e = p.cloneNode(false);
    e.appendChild(r.cloneContents());
    return e;
  };
  let lo = -1, hi = pos.length - 1;
  while (lo < hi) {
    const m = Math.ceil((lo + hi + 1) / 2);
    const e = morceau(null, pos[m]);
    z.appendChild(e);
    const ok = z.scrollHeight <= dispo + 1;
    e.remove();
    if (ok) lo = m; else hi = m - 1;
  }
  if (lo < 0) return null;
  const a = morceau(null, pos[lo]), b = morceau(pos[lo], null);
  a.setAttribute('data-coupe', '1');
  b.setAttribute('data-suite', '1');
  b.style.textIndent = '0';
  b.querySelectorAll('.puce,.lettrine').forEach(x => x.remove());
  return [a, b];
}
function refluerChaine(chaine) {
  const tete = chaine[0];
  if (tete.htmlComplet == null) tete.htmlComplet = texteCompletChaine(chaine);
  const hote = mesureHote();
  const src = document.createElement('div');
  src.innerHTML = tete.htmlComplet;
  let reste = [...src.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim()));
  chaine.forEach((box, i) => {
    const el = Rendu.objet(Object.assign({}, box, { html: '', ajustement: undefined, rot: 0 }), E.fiche, {});
    hote.appendChild(el);
    const z = el.querySelector('.contenu');
    z.innerHTML = '';
    if (i === chaine.length - 1) {
      reste.forEach(n => z.appendChild(n));
      reste = [];
    } else {
      const dispo = hauteurUtile(el);
      while (reste.length) {
        const n = reste[0];
        z.appendChild(n);
        if (z.scrollHeight <= dispo + 1) { reste.shift(); continue; }
        n.remove();
        const coupe = n.tagName === 'P' ? couperParagraphe(n, z, dispo) : null;
        if (coupe) { z.appendChild(coupe[0]); reste[0] = coupe[1]; }
        else if (!z.childNodes.length && i === 0) { z.appendChild(n); reste.shift(); }
        break;
      }
    }
    box.html = z.innerHTML || '<p><br></p>';
    el.remove();
  });
}
function refluerChaines() {
  const tous = tousLesObjets();
  const fait = new Set();
  for (const o of tous.values()) {
    if (!o.suivant || o.precedent || fait.has(o.id)) continue;
    const ch = chaineDe(o, tous);
    ch.forEach(x => fait.add(x.id));
    if (E.edition && ch.some(x => x.id === E.edition.id)) continue;
    refluerChaine(ch);
    for (const x of ch) if (elementObjet(x.id)) redessinerObjetSimple(x);
  }
}
function redessinerObjetSimple(o) {
  const a = elementObjet(o.id);
  if (!a) return;
  const n = Rendu.objet(o, E.fiche, ctxObjet(o));
  if (a.classList.contains('choisi')) n.classList.add('choisi');
  a.replaceWith(n);
  Rendu.postMiseEnPage(n);
  verifierDebordement(o, n);
}
// après la saisie dans un cadre chaîné : on refait le texte complet puis la répartition
function apresSaisieChaine(o) {
  if (!o.suivant && !o.precedent) return;
  const ch = chaineDe(o);
  ch[0].htmlComplet = texteCompletChaine(ch);
  refluerChaine(ch);
  for (const x of ch) if (x.id !== o.id && elementObjet(x.id)) redessinerObjetSimple(x);
}
function creerLien() {
  const o = selection()[0];
  if (!o || o.type !== 'texte' || selection().length !== 1) return;
  if (o.suivant) { alerte('Cette zone de texte a déjà une suite. Rompez d\'abord le lien.'); return; }
  quitterEdition();
  E.lien = o.id;
  document.body.classList.add('mode-lien');
  indicationModes('Cliquez sur une zone de texte VIDE : le texte qui dépasse continuera dedans. Échap pour annuler.');
}
function terminerLien(cible) {
  const src = objetParId(E.lien);
  E.lien = null;
  document.body.classList.remove('mode-lien');
  indicationModes(null);
  if (!cible || !src) return;
  if (cible.type !== 'texte' || cible.id === src.id) { alerte('Choisissez une autre zone de texte.'); return; }
  if (cible.precedent || cible.suivant) { alerte('Cette zone de texte fait déjà partie d\'un enchaînement.'); return; }
  if ((cible.html || '').replace(/<[^>]+>/g, '').trim()) { alerte('La zone de texte de destination doit être vide.'); return; }
  avant();
  const ch = chaineDe(src);
  ch[0].htmlComplet = texteCompletChaine(ch);
  src.suivant = cible.id;
  cible.precedent = src.id;
  cible.html = '';
  refluerChaine(chaineDe(src));
  redessinerCalque();
  E.sel = [cible.id];
  apres();
}
function romprelien() {
  const o = selection()[0];
  if (!o || !o.suivant) return;
  quitterEdition();
  avant();
  const tous = tousLesObjets();
  const ch = chaineDe(o, tous);
  const complet = texteCompletChaine(ch);
  const i = ch.indexOf(o);
  const suite = tous.get(o.suivant);
  delete o.suivant;
  if (suite) delete suite.precedent;
  // le texte revient dans la première partie ; les cadres détachés se vident
  ch[0].htmlComplet = complet;
  for (const x of ch.slice(i + 1)) { x.html = '<p><br></p>'; delete x.htmlComplet; }
  if (suite && suite.suivant) suite.htmlComplet = '<p><br></p>';
  if (ch[0].suivant) refluerChaine(chaineDe(ch[0])); else { ch[0].html = complet; delete ch[0].htmlComplet; }
  redessinerCalque();
  apres();
}
// avant la suppression d'objets : on garde l'enchaînement cohérent
function avantSuppressionChaines(ids) {
  const tous = tousLesObjets();
  for (const id of ids) {
    const o = tous.get(id);
    if (!o || (!o.suivant && !o.precedent)) continue;
    const ch = chaineDe(o, tous);
    const complet = texteCompletChaine(ch);
    const prec = o.precedent && tous.get(o.precedent), suiv = o.suivant && tous.get(o.suivant);
    if (prec) { if (suiv) prec.suivant = suiv.id; else delete prec.suivant; }
    if (suiv) { if (prec) suiv.precedent = prec.id; else delete suiv.precedent; }
    const reste = ch.filter(x => x !== o);
    if (reste.length) {
      reste[0].htmlComplet = complet;
      if (reste.length === 1) { reste[0].html = complet; delete reste[0].htmlComplet; }
      else refluerChaine(reste);
    }
  }
}

/* ---------------- 3. pinceau (reproduire la mise en forme) ---------------- */
function prendrePinceau() {
  const s = selection();
  if (!s.length) return;
  const o = s[0];
  const P = { fond: o.fond, trait: o.trait, ombre: o.ombre, marges: o.marges, vertical: o.vertical };
  let e = null;
  if (E.edition) {
    const sel = window.getSelection();
    if (sel.rangeCount) { const n = sel.getRangeAt(0).startContainer; e = n.nodeType === 1 ? n : n.parentElement; }
  } else {
    const el = elementObjet(o.id);
    e = el && el.querySelector('.contenu span:not(.puce)');
  }
  if (e) {
    const cs = getComputedStyle(e);
    P.car = { police: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), taille: Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2, gras: +cs.fontWeight >= 600, italique: cs.fontStyle === 'italic', couleur: cs.color };
    const p = e.closest('p');
    if (p) P.par = { textAlign: p.style.textAlign, lineHeight: p.style.lineHeight, marginTop: p.style.marginTop, marginBottom: p.style.marginBottom };
  }
  E.pinceau = P;
  document.body.classList.add('mode-pinceau');
  indicationModes('Pinceau : cliquez sur un objet, ou sélectionnez du texte, pour lui donner la même mise en forme. Échap pour annuler.');
}
function finPinceau() { E.pinceau = null; document.body.classList.remove('mode-pinceau'); indicationModes(null); }
function appliquerPinceauObjet(o) {
  const P = E.pinceau;
  finPinceau();
  quitterEdition();
  avant();
  if (o.type !== 'image' && o.type !== 'tableau' && o.type !== 'ligne') {
    for (const k of ['fond', 'ombre']) { if (P[k]) o[k] = copie(P[k]); else delete o[k]; }
  }
  if (P.trait && o.type !== 'tableau') o.trait = copie(P.trait);
  if (o.type === 'texte' && P.marges) { o.marges = copie(P.marges); if (P.vertical) o.vertical = P.vertical; }
  redessinerObjet(o);
  E.sel = [o.id];
  if ((o.type === 'texte' || o.type === 'tableau') && P.car) {
    apres();
    E.histo.pop(); // une seule étape d'annulation pour tout
    appliquerTexte((z, tout) => appliquerStyleCar(z, P.car, P.par, tout));
  } else apres();
}
function appliquerStyleCar(z, car, par, tout) {
  document.execCommand('fontName', false, car.police);
  appliquerTaille(z, car.taille);
  document.execCommand('foreColor', false, car.couleur);
  if (car.gras !== document.queryCommandState('bold')) document.execCommand('bold');
  if (car.italique !== document.queryCommandState('italic')) document.execCommand('italic');
  if (par) for (const p of paragraphesVises(z, tout)) for (const k in par) p.style[k] = par[k] || '';
}
document.addEventListener('mouseup', () => {
  if (!E.pinceau || !E.edition) return;
  const s = window.getSelection();
  if (!s.rangeCount || s.isCollapsed || !zoneDeSelection()) return;
  const P = E.pinceau;
  finPinceau();
  if (P.car) appliquerTexte(z => appliquerStyleCar(z, P.car, P.par, false));
});

/* ---------------- 4. guides de règle ---------------- */
function initGuides() {
  $('#regle-h').addEventListener('pointerdown', ev => { if (ev.button === 0) demarrerGuide(ev, null, 'h'); });
  $('#regle-v').addEventListener('pointerdown', ev => { if (ev.button === 0) demarrerGuide(ev, null, 'v'); });
}
function demarrerGuide(ev, index, sens) {
  ev.preventDefault();
  ev.stopPropagation();
  const guides = E.fiche.page.guides = E.fiche.page.guides || [];
  avant();
  if (index == null) { guides.push({ sens, pos: 0 }); index = guides.length - 1; }
  const g = guides[index];
  const placer = e => { const p = versMM(e); g.pos = arrondi(g.sens === 'v' ? p.x : p.y, 1); dessinerGuides(); };
  placer(ev);
  G = {
    type: 'guide', x0: ev.clientX, y0: ev.clientY, actif: true,
    bouger(p, e) { placer(e); infoBulle(e, `${cm(g.pos)} cm`); },
    fin(e) {
      const r = $('#defile').getBoundingClientRect();
      const dehors = g.sens === 'v' ? e.clientX < r.left : e.clientY < r.top;
      if (dehors) guides.splice(guides.indexOf(g), 1);
      nettoyerAides();
      dessinerGuides();
      apres();
    }
  };
}
function ajouterGuide(sens) {
  avant();
  const P = E.fiche.page;
  (P.guides = P.guides || []).push({ sens, pos: sens === 'v' ? P.w / 2 : P.h / 2 });
  dessinerGuides();
  apres();
}
function supprimerGuides() { if (!(E.fiche.page.guides || []).length) return; avant(); E.fiche.page.guides = []; dessinerGuides(); apres(); }

/* ---------------- 5. styles de texte ---------------- */
const STYLES_BASE = [
  { nom: 'Normal', police: 'Calibri', taille: 11 },
  { nom: 'Titre 1', police: 'Calibri Light', taille: 24, gras: true, couleur: '#1f4e79', apres: 6 },
  { nom: 'Titre 2', police: 'Calibri', taille: 16, gras: true, couleur: '#2e75b6', avant: 6, apres: 3 },
  { nom: 'Titre 3', police: 'Calibri', taille: 13, gras: true, couleur: '#404040', avant: 4, apres: 2 },
  { nom: 'Sous-titre', police: 'Calibri', taille: 13, italique: true, couleur: '#595959' },
  { nom: 'Citation', police: 'Georgia', taille: 11, italique: true, couleur: '#404040' },
  { nom: 'Consigne', police: 'Arial', taille: 11, gras: true, couleur: '#c00000' },
  { nom: 'Petit texte', police: 'Calibri', taille: 8 }
];
// le paragraphe garde le nom de son style : « Modifier le style » le mettra à jour
function appliquerStyle(st) {
  appliquerTexte((z, tout) => { for (const p of paragraphesVises(z, tout)) poserStyleParagraphe(p, st); });
}
function creerStyle() {
  memoriserSelectionTexte();
  const s = window.getSelection();
  let e = null;
  if (E.edition && s.rangeCount) { const n = s.getRangeAt(0).startContainer; e = n.nodeType === 1 ? n : n.parentElement; }
  else { const o = selection().find(x => x.type === 'texte'); const el = o && elementObjet(o.id); e = el && el.querySelector('.contenu span:not(.puce)'); }
  if (!e) { alerte('Placez d\'abord le curseur dans un texte mis en forme comme vous le souhaitez.'); return; }
  const cs = getComputedStyle(e);
  ouvrirBoite('Nouveau style', `<label>Nom du style</label><input type="text" id="ns-nom" value="Mon style">
    <p style="color:#666">Le style reprend la police, la taille, le gras, l'italique et la couleur du texte où se trouve le curseur.</p>`, () => {
    const nom = $('#ns-nom').value.trim();
    if (!nom) return false;
    avant();
    E.fiche.styles = (E.fiche.styles || []).filter(x => x.nom !== nom);
    const rgb = cs.color.match(/\d+/g) || [0, 0, 0];
    E.fiche.styles.push({
      nom, police: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), taille: Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2,
      gras: +cs.fontWeight >= 600, italique: cs.fontStyle === 'italic', couleur: '#' + rgb.slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('')
    });
    apres();
  });
}
function menuStyles(b) {
  const tous = listeStyles();
  const perso = (E.fiche.styles || []).filter(p => !STYLES_BASE.some(s => s.nom === p.nom));
  const ech = st => `font-family:'${st.police}';font-size:${Math.min(st.taille, 16)}pt;${st.gras ? 'font-weight:bold;' : ''}${st.italique ? 'font-style:italic;' : ''}${st.couleur ? 'color:' + st.couleur : ''}`;
  const d = document.createElement('div');
  d.innerHTML = tous.map((st, i) => `<button class="menu-item" data-i="${i}"><span style="${esc(ech(st))}">${esc(st.nom)}</span></button>`).join('');
  d.addEventListener('mousedown', ev => ev.preventDefault());
  d.addEventListener('click', ev => {
    const x = ev.target.closest('[data-i]');
    if (!x) return;
    fermerMenu();
    restaurerSelectionTexte();
    appliquerStyle(tous[+x.dataset.i]);
  });
  memoriserSelectionTexte();
  const items = ['-', { lib: 'Nouveau style à partir de la sélection…', act: creerStyle },
    { lib: 'Modifier un style…', act: () => ouvrirMenu(sousBouton(b), menuModifierStyles()) }];
  if (perso.length) items.push({ lib: 'Supprimer un style…', act: supprimerStyle });
  ouvrirMenu(sousBouton(b), items, d);
}
function supprimerStyle() {
  const perso = E.fiche.styles || [];
  ouvrirBoite('Supprimer un style', `<select id="ss-nom" class="champ">${perso.map(s => `<option>${esc(s.nom)}</option>`).join('')}</select>`, () => {
    avant();
    E.fiche.styles = perso.filter(s => s.nom !== $('#ss-nom').value);
    apres();
  });
}

/* ---------------- 6. pages maîtres ---------------- */
function entrerModeMaitre() {
  quitterEdition();
  if (!Object.keys(E.fiche.maitres).length) {
    avant();
    const id = nouvelId('m');
    E.fiche.maitres[id] = { id, nom: 'Page maître A', items: [] };
    for (const p of E.fiche.pages) if (!p.maitre) p.maitre = id;
    apres({ sansUI: true });
  }
  const m = pageCourante().maitre;
  E.modeMaitre = { retour: E.ip };
  const liste = Object.values(E.fiche.maitres);
  E.ip = Math.max(0, liste.findIndex(x => x.id === m));
  E.sel = [];
  dessinerVignettes();
  afficherPage();
  activerOnglet('maitre');
}
function quitterModeMaitre() {
  if (!E.modeMaitre) return;
  quitterEdition();
  const r = E.modeMaitre.retour;
  E.modeMaitre = null;
  E.ip = Math.min(r || 0, E.fiche.pages.length - 1);
  E.sel = [];
  dessinerVignettes();
  afficherPage();
  activerOnglet('accueil');
}
function appliquerMaitre(id) {
  avant();
  pageCourante().maitre = id;
  afficherPage();
  apres();
}
function renommerMaitre() {
  const m = pageCourante();
  ouvrirBoite('Renommer la page maître', `<label>Nom</label><input type="text" id="rm-nom" value="${esc(m.nom || '')}">`, () => {
    avant(); m.nom = $('#rm-nom').value.trim(); dessinerVignettes(); apres();
  });
}
function menuMaitres(b) {
  const liste = Object.values(E.fiche.maitres);
  const p = !E.modeMaitre && pageCourante();
  const items = [{ lib: 'Modifier les pages maîtres', act: entrerModeMaitre }];
  if (p) {
    items.push({ titre: 'Appliquer à cette page' });
    liste.forEach((m, i) => items.push({ lib: `${String.fromCharCode(65 + i)} – ${m.nom || 'Page maître'}`, coche: p.maitre === m.id, act: () => appliquerMaitre(m.id) }));
    items.push({ lib: 'Aucune', coche: !p.maitre, act: () => appliquerMaitre(null) });
  }
  ouvrirMenu(sousBouton(b), items);
}

/* ---------------- 7. numéros de page ---------------- */
const CHAMP_PAGE = '<span class="champ-page" data-champ="page" contenteditable="false">#</span>';
function insererChampTexte(type) {
  if (!E.edition) { alerte('Placez d\'abord le curseur dans une zone de texte.'); return; }
  restaurerSelectionTexte();
  document.execCommand('insertHTML', false, type === 'total' ? CHAMP_PAGE.replace('"page"', '"total"') : CHAMP_PAGE);
}
function numerosDePage(position) {
  quitterEdition();
  avant();
  // comme en PAO : les numéros vont sur la page maître (créée si besoin)
  let mid = pageCourante().maitre;
  if (E.modeMaitre) mid = pageCourante().id;
  if (!mid || !E.fiche.maitres[mid]) {
    mid = nouvelId('m');
    E.fiche.maitres[mid] = { id: mid, nom: 'Page maître A', items: [] };
    for (const p of E.fiche.pages) if (!p.maitre) p.maitre = mid;
  }
  const M = E.fiche.maitres[mid], P = E.fiche.page;
  M.items = M.items.filter(o => !o.numeroPage);
  const w = 30, h = 8;
  const x = position.endsWith('gauche') ? P.marges[3] : position.endsWith('droite') ? P.w - P.marges[1] - w : (P.w - w) / 2;
  const y = position.startsWith('haut') ? Math.max(3, P.marges[0] - h - 1) : P.h - Math.max(P.marges[2], h + 3);
  const align = position.endsWith('gauche') ? 'left' : position.endsWith('droite') ? 'right' : 'center';
  M.items.push({ id: nouvelId(), type: 'texte', forme: 'rect', numeroPage: true, x: arrondi(x), y: arrondi(y), w, h, marges: [1, 1, 1, 1], vertical: 'milieu',
    html: `<p style="text-align:${align}"><span style="font-family:'Calibri';font-size:10pt">${CHAMP_PAGE}</span></p>` });
  afficherPage();
  dessinerVignettes();
  apres();
}

/* ---------------- 8. rechercher / remplacer ---------------- */
function panneauRecherche(remplacer) {
  let p = $('#panneau-recherche');
  if (!p) {
    p = document.createElement('div');
    p.id = 'panneau-recherche';
    p.innerHTML = `<div class="boite-titre"><span>Rechercher et remplacer</span><button data-x title="Fermer">✕</button></div>
      <div class="boite-corps"><label>Rechercher</label><input type="text" id="rr-quoi">
      <label>Remplacer par</label><input type="text" id="rr-par">
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="rr-casse"> Respecter la casse</label>
      <div id="rr-etat" style="color:#666;min-height:18px;margin-top:6px"></div></div>
      <div class="boite-pied"><button class="bouton" data-rr="suivant">Suivant</button><button class="bouton" data-rr="remplacer">Remplacer</button><button class="bouton principal" data-rr="tout">Remplacer tout</button></div>`;
    document.body.appendChild(p);
    $('[data-x]', p).onclick = () => { p.hidden = true; };
    p.addEventListener('click', ev => { const b = ev.target.closest('[data-rr]'); if (b) actionRecherche(b.dataset.rr); });
    p.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); actionRecherche('suivant'); } if (ev.key === 'Escape') p.hidden = true; ev.stopPropagation(); });
  }
  p.hidden = false;
  p.classList.toggle('sans-remplacer', !remplacer);
  const s = window.getSelection();
  if (E.edition && s.rangeCount && !s.isCollapsed) $('#rr-quoi').value = s.toString().slice(0, 80);
  setTimeout(() => $('#rr-quoi').focus(), 0);
}
let posRecherche = null;
// liste des zones de texte du document, dans l'ordre
function zonesTexte() {
  const l = [];
  E.fiche.pages.forEach((p, ip) => p.items.forEach(o => {
    if (o.type === 'texte' && !o.precedent) l.push({ ip, o, cel: null });
    if (o.type === 'tableau') o.tableau.cellules.forEach((c, i) => l.push({ ip, o, cel: i }));
  }));
  return l;
}
function htmlZone(z) { return z.cel == null ? (z.o.suivant ? texteCompletChaine(chaineDe(z.o)) : z.o.html) : z.o.tableau.cellules[z.cel].html; }
function actionRecherche(action) {
  const quoi = $('#rr-quoi').value, par = $('#rr-par').value, casse = $('#rr-casse').checked;
  const etat = $('#rr-etat');
  if (!quoi) return;
  const norm = t => (casse ? t : t.toLowerCase());
  if (action === 'tout') {
    quitterEdition();
    avant();
    let n = 0;
    for (const z of zonesTexte()) {
      const d = document.createElement('div');
      d.innerHTML = htmlZone(z);
      const tw = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
      let modif = false;
      for (let t = tw.nextNode(); t; t = tw.nextNode()) {
        const re = new RegExp(quoi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), casse ? 'g' : 'gi');
        const v = t.nodeValue.replace(re, () => { n++; modif = true; return par; });
        if (modif) t.nodeValue = v;
      }
      if (!modif) continue;
      if (z.cel != null) z.o.tableau.cellules[z.cel].html = d.innerHTML;
      else if (z.o.suivant) { const ch = chaineDe(z.o); ch[0].htmlComplet = d.innerHTML; refluerChaine(ch); }
      else z.o.html = d.innerHTML;
    }
    if (!n) { E.histo.pop(); etat.textContent = 'Aucune occurrence trouvée.'; return; }
    afficherPage();
    dessinerVignettes();
    apres();
    etat.textContent = `${n} remplacement(s) effectué(s).`;
    return;
  }
  if (action === 'remplacer' && E.edition) {
    const s = window.getSelection();
    if (s.rangeCount && norm(s.toString()) === norm(quoi)) document.execCommand('insertText', false, par);
  }
  // recherche de l'occurrence suivante, à partir de la position courante
  const zones = zonesTexte();
  const depart = posRecherche || { zone: -1, offset: 0 };
  for (let k = 0; k <= zones.length; k++) {
    const iz = (Math.max(depart.zone, 0) + k) % zones.length;
    const z = zones[iz];
    const d = document.createElement('div');
    d.innerHTML = z.cel == null ? z.o.html : z.o.tableau.cellules[z.cel].html;
    const texte = norm(d.textContent);
    const from = k === 0 && depart.zone === iz ? depart.offset : 0;
    const i = texte.indexOf(norm(quoi), from);
    if (i < 0) continue;
    posRecherche = { zone: iz, offset: i + quoi.length };
    montrerOccurrence(z, i, quoi.length);
    etat.textContent = `Trouvé page ${z.ip + 1}.`;
    return;
  }
  posRecherche = null;
  etat.textContent = 'Aucune autre occurrence.';
}
function montrerOccurrence(z, debut, long) {
  if (E.modeMaitre) quitterModeMaitre();
  if (E.ip !== z.ip) allerPage(z.ip);
  E.sel = [z.o.id];
  entrerEdition(z.o);
  const el = elementObjet(z.o.id);
  const zone = z.cel == null ? $('.contenu', el) : $(`td[data-cellule="${z.cel}"] .contenu`, el);
  if (!zone) return;
  const tw = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
  let pos = 0, r = document.createRange(), ok = 0;
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    const L = t.nodeValue.length;
    if (!ok && debut < pos + L) { r.setStart(t, debut - pos); ok = 1; }
    if (ok && debut + long <= pos + L) { r.setEnd(t, debut + long - pos); ok = 2; break; }
    pos += L;
  }
  if (ok === 2) {
    zone.focus({ preventScroll: true });
    const s = window.getSelection();
    s.removeAllRanges(); s.addRange(r);
    const b = r.getBoundingClientRect(), d = $('#defile'), rd = d.getBoundingClientRect();
    if (b.top < rd.top || b.bottom > rd.bottom) d.scrollTop += b.top - rd.top - rd.height / 2;
  }
}

/* ---------------- 9. lettrines, colonnes, tabulations, liens ---------------- */
function lettrine(n) {
  appliquerTexte((z, tout) => {
    const p = paragraphesVises(z, tout)[0];
    if (!p) return;
    const ex = p.querySelector('.lettrine');
    if (ex) { ex.replaceWith(...ex.childNodes); p.normalize(); }
    if (!n) return;
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let t = tw.nextNode();
    while (t && (!t.nodeValue.trim() || t.parentElement.closest('.puce'))) t = tw.nextNode();
    if (!t) return;
    const i = t.nodeValue.search(/\S/);
    const r = document.createRange();
    r.setStart(t, i); r.setEnd(t, i + 1);
    const s = document.createElement('span');
    s.className = 'lettrine';
    s.style.fontSize = (1.32 * n) + 'em';
    r.surroundContents(s);
  });
}
function colonnes(n) {
  const objs = selection().filter(o => o.type === 'texte');
  if (!objs.length) return;
  quitterEdition();
  avant();
  for (const o of objs) { if (n > 1) o.colonnes = n; else delete o.colonnes; redessinerObjet(o); }
  apres();
}
function boiteColonnes() {
  const o = selection().find(x => x.type === 'texte');
  if (!o) return;
  ouvrirBoite('Colonnes', `<div class="grille-champs"><span>Nombre de colonnes</span><input id="bc-n" class="champ champ-num" type="number" min="1" max="6" value="${o.colonnes || 1}">
    <span>Espacement (mm)</span><input id="bc-e" class="champ champ-num" type="number" min="0" step="0.5" value="${o.espaceColonnes != null ? o.espaceColonnes : 5}"></div>`, () => {
    quitterEdition();
    avant();
    const n = Math.max(1, Math.min(6, +$('#bc-n').value || 1));
    if (n > 1) o.colonnes = n; else delete o.colonnes;
    o.espaceColonnes = Math.max(0, +$('#bc-e').value || 0);
    redessinerObjet(o);
    apres();
  });
}
function boiteTabulations() {
  const objs = selection().filter(o => o.type === 'texte');
  if (!objs.length) return;
  ouvrirBoite('Tabulations', `<div class="grille-champs"><span>Écart entre les taquets (mm)</span><input id="bt-tab" class="champ champ-num" type="number" min="1" step="0.5" value="${objs[0].tabulation || 12.7}"></div>
    <p style="color:#666;max-width:380px">Chaque appui sur Tab dans ces zones de texte avance jusqu'au taquet suivant, placé tous les N mm.</p>`, () => {
    quitterEdition();
    avant();
    const v = +$('#bt-tab').value;
    for (const o of objs) { if (v > 0 && v !== 12.7) o.tabulation = v; else delete o.tabulation; redessinerObjet(o); }
    apres();
  });
}
function insererLien() {
  if (!E.edition) { alerte('Sélectionnez d\'abord le texte qui deviendra un lien (dans une zone de texte).'); return; }
  memoriserSelectionTexte();
  const s = window.getSelection();
  const a = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('a');
  ouvrirBoite('Lien hypertexte', `<label>Adresse (site web, ou courriel avec « mailto: »)</label><input type="text" id="li-url" value="${esc(a ? a.getAttribute('href') : 'https://')}">`, () => {
    let u = $('#li-url').value.trim();
    restaurerSelectionTexte();
    if (!u || u === 'https://') { document.execCommand('unlink'); return; }
    if (!/^(https?:|mailto:|tel:)/i.test(u)) u = 'https://' + u;
    if (window.getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(u)}">${esc(u)}</a>`);
    else document.execCommand('createLink', false, u);
  });
}

/* ---------------- 10. effets, transparence, dégradés, habillage ---------------- */
const OMBRES = { aucune: null, portee: { dx: 1, dy: 1, flou: 0.6 }, douce: { dx: 1.5, dy: 1.5, flou: 2.5, couleur: 'rgba(0,0,0,.3)' }, decalee: { dx: 2, dy: 2, flou: 0 }, lueur: { dx: 0, dy: 0, flou: 2.5, couleur: 'rgba(255,192,0,.9)' } };
function surObjetsFormes(fn, filtre) {
  const objs = selection().filter(filtre || (o => o.type !== 'tableau'));
  if (!objs.length) return;
  quitterEdition();
  avant();
  objs.forEach(o => { fn(o); redessinerObjet(o); });
  apres();
}
function menuEffets(b) {
  ouvrirMenu(sousBouton(b), [
    { titre: 'Ombre' },
    { lib: 'Aucune ombre', act: () => surObjetsFormes(o => delete o.ombre, () => true) },
    { lib: 'Ombre portée', act: () => surObjetsFormes(o => { o.ombre = copie(OMBRES.portee); }, () => true) },
    { lib: 'Ombre douce', act: () => surObjetsFormes(o => { o.ombre = copie(OMBRES.douce); }, () => true) },
    { lib: 'Ombre décalée (nette)', act: () => surObjetsFormes(o => { o.ombre = copie(OMBRES.decalee); }, () => true) },
    { lib: 'Lueur dorée', act: () => surObjetsFormes(o => { o.ombre = copie(OMBRES.lueur); }, () => true) },
    { titre: 'Transparence du remplissage' },
    ...[0, 25, 50, 75].map(t => ({ lib: t + ' %', act: () => surObjetsFormes(o => { if (!o.fond) return; if (t) o.fond.opacite = (100 - t) / 100; else delete o.fond.opacite; }) })),
    ...menuEffets3D()
  ]);
}
function boiteDegrade() {
  const o = selection().find(x => x.fond || x.type === 'forme' || x.type === 'texte' || x.type === 'wordart');
  if (!o) return;
  const f = o.type === 'wordart' ? { couleur: o.wordart.couleur, degrade: o.wordart.degrade } : (o.fond || { couleur: '#5b9bd5' });
  ouvrirBoite('Remplissage dégradé', `<div class="grille-champs">
    <span>Couleur 1</span><input type="color" id="dg-1" value="${f.couleur && f.couleur.startsWith('#') ? f.couleur : '#5b9bd5'}">
    <span>Couleur 2</span><input type="color" id="dg-2" value="${f.degrade || '#ffffff'}">
    <span>Direction</span><select id="dg-a" class="champ"><option value="0">Haut → bas</option><option value="90">Gauche → droite</option><option value="45">Diagonale</option><option value="180">Bas → haut</option></select></div>`, () => {
    surObjetsFormes(x => {
      if (x.type === 'wordart') { x.wordart.couleur = $('#dg-1').value; x.wordart.degrade = $('#dg-2').value; return; }
      x.fond = { couleur: $('#dg-1').value, degrade: $('#dg-2').value, angle: +$('#dg-a').value };
    });
  });
}
function menuHabillage(b) {
  const s = selection();
  const v = s[0] && (s[0].habillage || 'aucun');
  ouvrirMenu(sousBouton(b), [
    { lib: 'Aucun (le texte passe dessous)', coche: v === 'aucun', act: () => surObjetsFormes(o => delete o.habillage, () => true) },
    { lib: 'Carré (le texte contourne le cadre)', coche: v === 'carre', act: () => surObjetsFormes(o => { o.habillage = 'carre'; }, () => true) },
    { lib: 'Serré (le texte suit la forme)', coche: v === 'serre', act: () => surObjetsFormes(o => { o.habillage = 'serre'; }, () => true) },
    { lib: 'Haut et bas (pas de texte à côté)', coche: v === 'hautbas', act: () => surObjetsFormes(o => { o.habillage = 'hautbas'; }, () => true) },
    '-', { lib: 'Distance du texte…', act: boiteDistanceHabillage }
  ]);
}
function boiteDistanceHabillage() {
  const s = selection();
  if (!s.length) return;
  ouvrirBoite('Habillage', `<div class="grille-champs"><span>Distance au texte (mm)</span><input id="dh-d" class="champ champ-num" type="number" min="0" step="0.5" value="${s[0].distanceHabillage != null ? s[0].distanceHabillage : 2.5}"></div>`,
    () => surObjetsFormes(o => { o.distanceHabillage = Math.max(0, +$('#dh-d').value || 0); if (!o.habillage) o.habillage = 'carre'; }, () => true));
}

/* ---------------- 11. corrections d'image ---------------- */
function correction(cle, val) {
  surObjetsFormes(o => {
    const F = o.filtres = o.filtres || {};
    if (cle === 'reinit') { delete o.filtres; return; }
    if (cle === 'luminosite' || cle === 'contraste') F[cle] = Math.max(-80, Math.min(150, (F[cle] || 0) + val));
    else F[cle] = !F[cle];
    if (!Object.values(F).some(Boolean)) delete o.filtres;
  }, o => o.type === 'image');
}
function menuCorrections(b) {
  const F = (selection()[0] && selection()[0].filtres) || {};
  ouvrirMenu(sousBouton(b), [
    { titre: `Luminosité ${F.luminosite ? (F.luminosite > 0 ? '+' : '') + F.luminosite + ' %' : ''}` },
    { lib: 'Plus lumineuse (+10 %)', act: () => correction('luminosite', 10) }, { lib: 'Plus sombre (−10 %)', act: () => correction('luminosite', -10) },
    { titre: `Contraste ${F.contraste ? (F.contraste > 0 ? '+' : '') + F.contraste + ' %' : ''}` },
    { lib: 'Plus de contraste (+10 %)', act: () => correction('contraste', 10) }, { lib: 'Moins de contraste (−10 %)', act: () => correction('contraste', -10) },
    { titre: 'Recolorier' },
    { lib: 'Niveaux de gris', coche: F.gris, act: () => correction('gris') }, { lib: 'Sépia', coche: F.sepia, act: () => correction('sepia') },
    { lib: 'Délavé (filigrane)', coche: F.delave, act: () => correction('delave') },
    '-', { lib: 'Réinitialiser l\'image', act: () => correction('reinit') }
  ]);
}

/* ---------------- 12. tableaux : colonnes et lignes à la souris, styles ---------------- */
function calqueSeparateurs(o) {
  const d = cadreLocal(o, 'calque-separateurs');
  const T = o.tableau, k = PX_MM * E.zoom;
  const el = elementObjet(o.id);
  const tab = el && el.querySelector('table');
  let x = 0;
  T.cols.slice(0, -1).forEach((c, i) => {
    x += c;
    const s = document.createElement('div');
    s.className = 'sep-tab sep-col';
    s.dataset.sep = 'col'; s.dataset.k = i + 1;
    s.style.left = (x * k - 3) + 'px';
    s.title = 'Faire glisser pour changer la largeur des colonnes';
    d.appendChild(s);
  });
  // lignes : positions réelles (une ligne peut grandir avec son texte)
  const lignes = tab ? [...tab.rows].map(r => r.getBoundingClientRect().height / E.zoom / PX_MM) : T.lignes;
  let y = 0;
  lignes.slice(0, -1).forEach((h, i) => {
    y += h;
    const s = document.createElement('div');
    s.className = 'sep-tab sep-lig';
    s.dataset.sep = 'lig'; s.dataset.k = i + 1;
    s.style.top = (y * k - 3) + 'px';
    s.title = 'Faire glisser pour changer la hauteur de la ligne';
    d.appendChild(s);
  });
  return d;
}
function demarrerSeparateur(ev, sens, kk) {
  const o = tableauEdite();
  if (!o) return;
  ev.preventDefault();
  if (E.edition) lireTexteEdite(o, elementObjet(o.id));
  const o0 = copie(o), p0 = versMM(ev);
  G = {
    type: 'separateur', x0: ev.clientX, y0: ev.clientY, actif: false,
    bouger(p) {
      const { lx, ly } = deltaLocal(o0, p, p0);
      const T = o.tableau;
      if (sens === 'col') {
        const a = o0.tableau.cols[kk - 1], b = o0.tableau.cols[kk];
        const d = Math.max(2 - a, Math.min(b - 2, lx));
        T.cols[kk - 1] = arrondi(a + d); T.cols[kk] = arrondi(b - d);
      } else {
        const a = o0.tableau.lignes[kk - 1];
        T.lignes[kk - 1] = arrondi(Math.max(2, a + ly));
        o.h = arrondi(T.lignes.reduce((s, v) => s + v, 0));
      }
      const ed = E.edition;
      E.edition = null;
      redessinerObjet(o);
      E.edition = ed;
      if (ed) { const el = elementObjet(o.id); el.classList.add('edition'); $$('.contenu', el).forEach(z => { z.contentEditable = 'true'; }); }
      majSelectionUI();
    }
  };
}
const STYLES_TABLEAU = [
  ['Grille simple', 'grille'], ['En-tête bleu', 'entete'], ['Lignes alternées', 'bandes'], ['En-tête et bandes', 'entete-bandes'], ['Encadré seulement', 'encadre'], ['Sans bordure', 'aucun']
];
function styleTableau(type) {
  const o = tableauEdite();
  if (!o) return;
  if (E.edition) quitterEdition();
  avant();
  const T = o.tableau, nl = T.lignes.length, nc = T.cols.length;
  const fin = { c: '#000000', e: 0.75 }, epais = { c: '#000000', e: 1.5 }, bleu = { c: '#2e75b6', e: 0.75 };
  for (const c of T.cellules) {
    delete c.fond;
    const ext = { h: c.l === 0, b: c.l + c.nl === nl, g: c.c === 0, d: c.c + c.nc === nc };
    if (type === 'grille') c.bords = { h: fin, b: fin, g: fin, d: fin };
    else if (type === 'aucun') c.bords = {};
    else if (type === 'encadre') { c.bords = {}; for (const k in ext) if (ext[k]) c.bords[k] = epais; }
    else c.bords = { h: bleu, b: bleu, g: bleu, d: bleu };
    if ((type === 'entete' || type === 'entete-bandes') && c.l === 0) {
      c.fond = '#1f4e79';
      const d = document.createElement('div');
      d.innerHTML = c.html;
      d.querySelectorAll('span').forEach(s => { s.style.color = '#ffffff'; s.style.fontWeight = 'bold'; });
      if (!d.querySelector('span')) d.querySelectorAll('p').forEach(p => { p.innerHTML = `<span style="color:#ffffff;font-weight:bold">${p.innerHTML}</span>`; });
      c.html = d.innerHTML;
    }
    if ((type === 'bandes' || type === 'entete-bandes') && c.l > 0 && c.l % 2 === (type === 'bandes' ? 1 : 0)) c.fond = '#ddebf7';
    c.bords = copie(c.bords);
  }
  redessinerObjet(o);
  apres();
}

/* ---------------- 13. blocs de construction ---------------- */
function insererObjets(objs, groupe) {
  quitterEdition();
  avant();
  const g = groupe ? nouvelId('g') : null;
  for (const o of objs) { o.id = nouvelId(); if (g) o.groupe = g; pageCourante().items.push(o); }
  redessinerCalque();
  E.sel = objs.map(o => o.id);
  apres();
}
const spanTxt = (t, taille, extra) => `<span style="font-family:'Calibri';font-size:${taille}pt;${extra || ''}">${t}</span>`;
function blocConstruction(type) {
  const P = E.fiche.page, [mh, md, mb, mg] = P.marges;
  const lu = P.w - mg - md;
  if (type === 'encadre') {
    const x = mg, y = P.h / 3, w = Math.min(90, lu);
    insererObjets([
      { type: 'forme', forme: 'rect', x, y, w, h: 50, fond: { couleur: '#ffffff' }, trait: { couleur: '#2e75b6', epaisseur: 1.5 } },
      { type: 'texte', forme: 'rect', x, y, w, h: 9, fond: { couleur: '#2e75b6' }, marges: [2, 1, 2, 1], vertical: 'milieu', html: `<p>${spanTxt('Titre de l\'encadré', 12, 'font-weight:bold;color:#ffffff')}</p>` },
      { type: 'texte', forme: 'rect', x: x + 1, y: y + 10, w: w - 2, h: 39, marges: [2, 1, 2, 1], vertical: 'haut', html: `<p>${spanTxt('Texte de l\'encadré.', 11)}</p>` }
    ], true);
  } else if (type === 'bandeau') {
    insererObjets([
      { type: 'texte', forme: 'rect', x: mg, y: mh, w: lu, h: 16, fond: { couleur: '#077568' }, marges: [4, 1, 4, 1], vertical: 'milieu', html: `<p>${spanTxt('TITRE DE LA FICHE', 22, 'font-weight:bold;color:#ffffff')}</p>` },
      { type: 'texte', forme: 'rect', x: mg, y: mh + 16, w: lu, h: 8, fond: { couleur: '#d9eeeb' }, marges: [4, 1, 4, 1], vertical: 'milieu', html: `<p>${spanTxt('Sous-titre ou section', 11, 'color:#055a50')}</p>` }
    ], true);
  } else if (type === 'identite') {
    const cel = t => ({ l: 0, c: 0, nl: 1, nc: 1, html: `<p>${spanTxt(t, 10)}</p>`, bords: { h: BORD_DEFAUT, b: BORD_DEFAUT, g: BORD_DEFAUT, d: BORD_DEFAUT } });
    const cellules = ['Nom :', 'Prénom :', 'Date :', 'Section :', 'Année :', 'Note :'].map((t, i) => Object.assign(cel(t), { l: Math.floor(i / 3), c: i % 3 }));
    insererObjets([{ type: 'tableau', x: mg, y: P.h - mb - 16, w: lu, h: 16, tableau: { cols: [lu / 3, lu / 3, lu / 3].map(v => arrondi(v)), lignes: [8, 8], cellules, marges: [1, 1, 1, 1] } }]);
  } else if (type === 'bordure') {
    insererObjets([{ type: 'forme', forme: 'rect', x: mg / 2, y: mh / 2, w: P.w - (mg + md) / 2, h: P.h - (mh + mb) / 2, trait: { couleur: '#077568', epaisseur: 2.25 }, habillage: 'aucun' }]);
    ordre('arriere');
  } else if (type === 'calendrier') {
    const now = new Date(), an = now.getFullYear(), mois = now.getMonth();
    const premier = (new Date(an, mois, 1).getDay() + 6) % 7, nbj = new Date(an, mois + 1, 0).getDate();
    const nl = Math.ceil((premier + nbj) / 7) + 2, w = Math.min(lu, 120), cw = arrondi(w / 7);
    const B = { h: { c: '#7f7f7f', e: 0.5 }, b: { c: '#7f7f7f', e: 0.5 }, g: { c: '#7f7f7f', e: 0.5 }, d: { c: '#7f7f7f', e: 0.5 } };
    const cellules = [{ l: 0, c: 0, nl: 1, nc: 7, fond: '#077568', bords: copie(B), html: `<p style="text-align:center">${spanTxt(now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase(), 14, 'font-weight:bold;color:#ffffff')}</p>` }];
    ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach((j, c) => cellules.push({ l: 1, c, nl: 1, nc: 1, fond: '#d9eeeb', bords: copie(B), html: `<p style="text-align:center">${spanTxt(j, 9, 'font-weight:bold')}</p>` }));
    for (let l = 2; l < nl; l++) for (let c = 0; c < 7; c++) {
      const j = (l - 2) * 7 + c - premier + 1;
      cellules.push({ l, c, nl: 1, nc: 1, bords: copie(B), fond: c >= 5 ? '#f2f2f2' : undefined, html: `<p>${spanTxt(j >= 1 && j <= nbj ? String(j) : '<br>', 9)}</p>` });
    }
    insererObjets([{ type: 'tableau', x: (P.w - w) / 2, y: P.h / 4, w: cw * 7, h: 10 + 6 + (nl - 2) * 12, tableau: { cols: Array(7).fill(cw), lignes: [10, 6, ...Array(nl - 2).fill(12)], cellules, marges: [1, 1, 1, 1] } }]);
  } else if (type === 'consigne') {
    insererObjets([
      { type: 'forme', forme: 'rectArrondi', x: mg, y: P.h / 2, w: Math.min(lu, 120), h: 22, fond: { couleur: '#fff2cc' }, trait: { couleur: '#bf9000', epaisseur: 1 } },
      { type: 'texte', forme: 'rect', x: mg + 2, y: P.h / 2 + 1, w: Math.min(lu, 120) - 4, h: 20, marges: [2, 1, 2, 1], vertical: 'milieu', html: `<p>${spanTxt('⚠ CONSIGNE :', 11, 'font-weight:bold;color:#c00000')} ${spanTxt('texte de la consigne.', 11)}</p>` }
    ], true);
  }
}
function menuBlocs(b) {
  ouvrirMenu(sousBouton(b), [
    { lib: 'Bandeau de titre', act: () => blocConstruction('bandeau') },
    { lib: 'Encadré avec titre', act: () => blocConstruction('encadre') },
    { lib: 'Consigne (encadré jaune)', act: () => blocConstruction('consigne') },
    { lib: 'Cartouche Nom / Prénom / Date', act: () => blocConstruction('identite') },
    { lib: 'Calendrier du mois', act: () => blocConstruction('calendrier') },
    { lib: 'Bordure de page', act: () => blocConstruction('bordure') }
  ]);
}

/* ---------------- 14. ajuster le texte ---------------- */
function menuAjuster(b) {
  const o = selection().find(x => x.type === 'texte');
  const v = o && o.ajuster;
  const choix = m => surObjetsFormes(x => { if (x.type !== 'texte') return; if (m) x.ajuster = m; else { delete x.ajuster; delete x.ajustement; } }, x => x.type === 'texte');
  ouvrirMenu(sousBouton(b), [
    { lib: 'Ajuster au mieux', coche: v === 'meilleur', act: () => choix('meilleur') },
    { lib: 'Réduire le texte dépassant', coche: v === 'reduire', act: () => choix('reduire') },
    { lib: 'Redimensionner la zone de texte en fonction du texte', coche: v === 'cadre', act: () => choix('cadre') },
    { lib: 'Ne pas ajuster automatiquement', coche: !v, act: () => choix(null) }
  ]);
}

/* ---------------- modes : indication et touche Échap ---------------- */
function indicationModes(msg) {
  const b = $('#bandeau');
  if (!msg) { if (b.dataset.type === 'mode') b.hidden = true; return; }
  b.dataset.type = 'mode';
  b.innerHTML = `<span>${esc(msg)}</span><button class="bouton">Terminer</button>`;
  $('button', b).onclick = annulerModes;
  b.hidden = false;
}
function annulerModes() {
  let fait = false;
  if (E.rognage) { quitterRognage(); fait = true; }
  if (E.pinceau) { finPinceau(); fait = true; }
  if (E.lien) { E.lien = null; document.body.classList.remove('mode-lien'); indicationModes(null); fait = true; }
  return fait;
}
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && (E.rognage || E.pinceau || E.lien) && $('#boite').hidden) { annulerModes(); ev.stopPropagation(); ev.preventDefault(); }
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
    const k = ev.key.toLowerCase();
    if (k === 'f' || k === 'h') { ev.preventDefault(); ev.stopPropagation(); panneauRecherche(k === 'h'); }
    else if (k === 'k' && E.edition) { ev.preventDefault(); ev.stopPropagation(); insererLien(); }
  }
}, true);
