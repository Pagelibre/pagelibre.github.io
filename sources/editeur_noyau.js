/* =====================================================================
   Éditeur : état, affichage, sélection, règles, zoom, historique
   ===================================================================== */
'use strict';
const PX_MM = 96 / 25.4;
const MARGE_SCENE = 70;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const arrondi = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const cm = v => arrondi(v / 10, 2).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const E = {
  fiche: null,      // document courant
  ip: 0,            // index de la page affichée
  sel: [],          // identifiants sélectionnés
  zoom: 1,
  edition: null,    // { id, avant } pendant la saisie de texte
  histo: [], refaire: [],
  modifie: false,
  poignee: null,    // fichier (File System Access) pour « Enregistrer »
  nomFichier: null,
  dessin: null,     // mode insertion : { type, forme }
  cellules: [],     // cellules de tableau choisies (indices) pendant l'édition
  presse: null,     // presse-papiers interne
  options: { regles: true, reperes: true, limites: true, volet: true, magnetisme: true },
  feuille: null, calque: null, ox: 0, oy: 0
};

/* ---------------- modèle ---------------- */
let compteurId = 0;
function nouvelId(prefixe) { return (prefixe || 'o') + Date.now().toString(36) + (++compteurId).toString(36); }
const copie = o => JSON.parse(JSON.stringify(o));
// en mode « page maître », on travaille sur les pages maîtres au lieu des pages
function pagesActives() { return E.modeMaitre ? Object.values(E.fiche.maitres) : E.fiche.pages; }
function pageCourante() { return pagesActives()[E.ip]; }
function numeroCourant() { return E.modeMaitre ? null : E.ip + 1; }
function ctxObjet(o) {
  const obs = Rendu.obstacles(o, pageCourante().items);
  // habillage serré autour d'une image : il faut son profil de transparence (calculé en arrière-plan)
  for (const b of obs) if (b.type === 'image' && b.habillage === 'serre' && typeof profilImage === 'function') profilImage(b.image);
  return { obstacles: obs, numero: numeroCourant(), total: E.fiche.pages.length };
}
function objetParId(id) { return pageCourante().items.find(o => o.id === id) || null; }
function selection() { return E.sel.map(objetParId).filter(Boolean); }
function elementObjet(id) { return E.calque ? E.calque.querySelector(`.objet[data-id="${CSS.escape(id)}"]`) : null; }

function normaliserFiche(f) {
  if (!f || !Array.isArray(f.pages)) throw new Error('Fiche illisible.');
  f.format = 'pagelibre';
  f.version = f.version || 1;
  f.titre = f.titre || 'Sans titre';
  f.page = f.page || { w: 210, h: 297 };
  f.page.marges = f.page.marges || [12.7, 12.7, 12.7, 12.7]; // haut, droite, bas, gauche
  f.images = f.images || {};
  f.maitres = f.maitres || {};
  f.palette = f.palette || ['#000000'];
  if (!f.pages.length) f.pages.push({ id: nouvelId('p'), maitre: null, items: [] });
  const vus = new Set();
  for (const p of [...f.pages, ...Object.values(f.maitres)]) {
    p.items = p.items || [];
    for (const o of p.items) {
      if (!o.id || vus.has(o.id)) o.id = nouvelId();
      vus.add(o.id);
    }
  }
  delete f.avertissements;
  // un document peut venir de n'importe qui : on ne garde que la mise en forme (securite.js)
  assainirFiche(f);
  return f;
}

function ficheVierge(w, h, titre) {
  return normaliserFiche({ titre: titre || 'Sans titre', page: { w, h }, pages: [{ id: nouvelId('p'), maitre: null, items: [] }] });
}

/* ---------------- historique ---------------- */
function instantane() {
  const f = E.fiche;
  return JSON.stringify({ pages: f.pages, maitres: f.maitres, page: f.page, titre: f.titre, styles: f.styles || [] });
}
function avant() {
  const s = instantane();
  if (E.histo[E.histo.length - 1] !== s) E.histo.push(s);
  if (E.histo.length > 150) E.histo.shift();
  E.refaire = [];
}
function apres(opt) {
  opt = opt || {};
  E.modifie = true;
  rafraichirDependances();
  majTitre();
  planifierAutosave();
  planifierVignette(E.ip);
  if (!opt.sansUI) { majSelectionUI(); majRuban(); }
}
// après une modification : texte qui contourne les objets, cadres chaînés
function rafraichirDependances() {
  if (!E.calque) return;
  if (typeof refluerChaines === 'function') refluerChaines();
  for (const o of pageCourante().items) {
    if (o.type !== 'texte' || (E.edition && E.edition.id === o.id)) continue;
    const el = elementObjet(o.id);
    const avait = el && el.querySelector('.habillage');
    if (avait || Rendu.obstacles(o, pageCourante().items).length) redessinerObjet(o);
  }
}
function restaurer(s) {
  const d = JSON.parse(s);
  Object.assign(E.fiche, d);
  if (E.modeMaitre && !E.fiche.maitres[E.modeMaitre.retour] && !Object.keys(E.fiche.maitres).length) E.modeMaitre = null;
  E.ip = Math.max(0, Math.min(E.ip, pagesActives().length - 1));
  E.sel = E.sel.filter(id => objetParId(id));
  afficherPage();
  dessinerVignettes();
  E.modifie = true;
  majTitre();
  planifierAutosave();
}
function annuler() {
  if (E.edition) { document.execCommand('undo'); return; }
  if (!E.histo.length) return;
  E.refaire.push(instantane());
  restaurer(E.histo.pop());
}
function refaire() {
  if (E.edition) { document.execCommand('redo'); return; }
  if (!E.refaire.length) return;
  E.histo.push(instantane());
  restaurer(E.refaire.pop());
}

/* ---------------- affichage de la page ---------------- */
function afficherPage() {
  quitterEdition();
  const hote = $('#feuille-hote');
  hote.innerHTML = '';
  const f = Rendu.page(pageCourante(), E.fiche, { numero: numeroCourant() });
  const [mh, md, mb, mg] = E.fiche.page.marges;
  f.style.setProperty('--mh', mh + 'mm'); f.style.setProperty('--md', md + 'mm');
  f.style.setProperty('--mb', mb + 'mm'); f.style.setProperty('--mg', mg + 'mm');
  hote.appendChild(f);
  E.feuille = f;
  E.calque = f.querySelector('.calque-objets');
  E.sel = E.sel.filter(id => objetParId(id));
  // affichage deux pages : la page voisine, non modifiable tant qu'on n'a pas cliqué dessus
  $$('#scene > .feuille-voisine').forEach(x => x.remove());
  const iv = indexVoisine();
  if (iv != null) {
    const v = document.createElement('div');
    v.className = 'feuille-voisine';
    v.title = `Page ${iv + 1} : cliquer pour la modifier`;
    v.appendChild(Rendu.page(pagesActives()[iv], E.fiche, { numero: E.modeMaitre ? null : iv + 1 }));
    v.addEventListener('pointerdown', ev => { ev.stopPropagation(); allerPage(iv); });
    $('#scene').appendChild(v);
    Rendu.postMiseEnPage(v);
  }
  majScene();
  Rendu.postMiseEnPage(f);
  for (const o of pageCourante().items) apresRendu(o, elementObjet(o.id));
  majSelectionUI();
  majEtat();
  majVignettesActive();
  majRuban();
}

function redessinerObjet(o) {
  const ancien = elementObjet(o.id);
  const n = Rendu.objet(o, E.fiche, ctxObjet(o));
  if (ancien) {
    if (ancien.classList.contains('choisi')) n.classList.add('choisi');
    ancien.replaceWith(n);
  } else E.calque.appendChild(n);
  Rendu.postMiseEnPage(n);
  apresRendu(o, n);
  return n;
}

function redessinerCalque() {
  quitterEdition();
  E.calque.innerHTML = '';
  for (const o of pageCourante().items) {
    const n = Rendu.objet(o, E.fiche, ctxObjet(o));
    E.calque.appendChild(n);
    Rendu.postMiseEnPage(n);
    apresRendu(o, n);
  }
  majSelectionUI();
}

// après le rendu d'un objet : tableaux qui débordent, texte trop long
function apresRendu(o, el) {
  if (!el) return;
  if (o.type === 'tableau') {
    const t = el.querySelector('table');
    if (t) {
      const h = t.offsetHeight / PX_MM;
      if (h > o.h + 0.3) { o.h = arrondi(h); el.style.height = o.h + 'mm'; }
    }
  } else if (o.type === 'texte') {
    if (o.ajuster && !(E.edition && E.edition.id === o.id)) ajusterTexte(o, el);
    verifierDebordement(o, el);
  }
}

/* « Ajuster le texte » (comme en PAO) :
   reduire = réduire le texte qui dépasse ; meilleur = remplir le cadre au mieux ; cadre = adapter la hauteur du cadre */
function hauteurUtile(el) {
  const cadre = el.querySelector('.cadre-texte'), cs = getComputedStyle(cadre);
  return cadre.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
}
function ajusterTexte(o, el) {
  const z = el.querySelector('.contenu');
  if (!z) return;
  if (o.ajuster === 'cadre') {
    z.style.zoom = '';
    const m = o.marges || [2.54, 1.27, 2.54, 1.27];
    const h = arrondi(z.scrollHeight / PX_MM + m[1] + m[3] + 0.3);
    delete o.ajustement;
    if (Math.abs(h - o.h) > 0.2) { o.h = h; el.style.height = h + 'mm'; }
    return;
  }
  const dispo = hauteurUtile(el);
  const tient = k => { z.style.zoom = k; return z.scrollHeight * k <= dispo + 1 && z.scrollWidth * k <= z.parentElement.clientWidth + 2; };
  let k = 1;
  if (!tient(1) || o.ajuster === 'meilleur') {
    let lo = 0.2, hi = o.ajuster === 'meilleur' ? 6 : 1;
    if (tient(hi)) lo = hi;
    for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (tient(m)) lo = m; else hi = m; }
    k = arrondi(lo, 3);
  }
  z.style.zoom = k === 1 ? '' : k;
  if (k === 1) delete o.ajustement; else o.ajustement = k;
  // les flottants d'habillage dépendent du zoom : on les recalcule
  if (z.querySelector('.habillage')) {
    z.querySelectorAll('.habillage').forEach(h => h.remove());
    const n = Rendu.objet(o, E.fiche, ctxObjet(o)).querySelectorAll('.contenu > .habillage');
    [...n].reverse().forEach(h => z.insertBefore(h, z.firstChild));
  }
}

function indexVoisine() {
  if (!E.options.deuxPages) return null;
  const n = pagesActives().length, i = E.ip;
  if (E.modeMaitre || n < 2) return null;
  // page 1 seule (couverture), puis 2-3, 4-5…
  if (i === 0) return null;
  const j = i % 2 === 1 ? i + 1 : i - 1;
  return j < n ? j : null;
}
function verifierDebordement(o, el) {
  const cadre = el.querySelector('.cadre-texte'), z = el.querySelector('.contenu');
  if (!cadre || !z) return;
  const cs = getComputedStyle(cadre);
  const vertical = o.sensTexte;
  let deborde;
  const tol = 6; // px : les métriques des polices diffèrent un peu de l'application d'origine
  if (o.colonnes > 1) deborde = z.scrollWidth > z.clientWidth + tol;
  else if (vertical) deborde = z.scrollWidth > cadre.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + tol;
  else deborde = z.scrollHeight > cadre.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) + tol;
  el.classList.toggle('deborde', deborde);
}

function majScene() {
  const def = $('#defile');
  const w = E.fiche.page.w * PX_MM * E.zoom, h = E.fiche.page.h * PX_MM * E.zoom;
  const iv = indexVoisine();
  const total = iv != null ? 2 * w : w;
  const ox0 = Math.max(MARGE_SCENE, (def.clientWidth - total) / 2);
  // la page de gauche d'une double page porte un numéro pair (index impair)
  const activeADroite = iv != null && iv < E.ip;
  E.ox = activeADroite ? ox0 + w : ox0;
  E.oy = Math.max(MARGE_SCENE * 0.6, (def.clientHeight - h) / 2);
  const sc = $('#scene');
  sc.style.width = (total + 2 * ox0) + 'px';
  sc.style.height = (h + 2 * E.oy) + 'px';
  const hote = $('#feuille-hote');
  hote.style.left = E.ox + 'px';
  hote.style.top = E.oy + 'px';
  hote.style.transform = `scale(${E.zoom})`;
  const v = $('#scene > .feuille-voisine');
  if (v) {
    v.style.left = (activeADroite ? ox0 : ox0 + w) + 'px';
    v.style.top = E.oy + 'px';
    v.style.transform = `scale(${E.zoom})`;
  }
  dessinerGuides();
  majRegles();
}

/* guides de règle (verts, communs à toutes les pages) */
function dessinerGuides() {
  let c = $('#calque-guides');
  if (!c) { c = document.createElement('div'); c.id = 'calque-guides'; $('#scene').appendChild(c); }
  c.innerHTML = '';
  if (!E.options.reperes) return;
  const k = PX_MM * E.zoom, sc = $('#scene');
  // grille de mise en page (bleue) et lignes de base (fines)
  const R = reperesGrille(), P = E.fiche.page;
  const trait = (cls, x, y, w, h) => { const d = document.createElement('div'); d.className = cls; d.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`; c.appendChild(d); };
  for (const x of R.v) trait('repere-grille v', E.ox + x * k, E.oy, 1, P.h * k);
  for (const y of R.h) trait('repere-grille h', E.ox, E.oy + y * k, P.w * k, 1);
  for (const y of R.base) trait('ligne-base', E.ox + P.marges[3] * k, E.oy + y * k, (P.w - P.marges[1] - P.marges[3]) * k, 1);
  (E.fiche.page.guides || []).forEach((g, i) => {
    const d = document.createElement('div');
    d.className = 'guide-regle ' + g.sens;
    d.dataset.guide = i;
    if (g.sens === 'v') { d.style.left = (E.ox + g.pos * k) + 'px'; d.style.top = '0'; d.style.height = sc.style.height; }
    else { d.style.top = (E.oy + g.pos * k) + 'px'; d.style.left = '0'; d.style.width = sc.style.width; }
    d.title = 'Guide : faites-le glisser, ou remettez-le sur la règle pour le supprimer';
    c.appendChild(d);
  });
}

/* conversions */
function versMM(ev) {
  const r = E.feuille.getBoundingClientRect();
  const k = PX_MM * E.zoom;
  return { x: (ev.clientX - r.left) / k, y: (ev.clientY - r.top) / k };
}
function mmVersScene(x, y) { const k = PX_MM * E.zoom; return { x: E.ox + x * k, y: E.oy + y * k }; }

function boiteEnglobante(objs) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const o of objs) {
    const coins = coinsObjet(o);
    for (const [x, y] of coins) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function coinsObjet(o) {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const a = (o.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => {
    const lx = dx * o.w / 2, ly = dy * o.h / 2;
    return [cx + lx * c - ly * s, cy + lx * s + ly * c];
  });
}

/* ---------------- sélection : cadres et poignées ---------------- */
function groupeEntier(objs) {
  if (objs.length < 2) return false;
  const g = objs[0].groupe;
  if (!g || objs.some(o => o.groupe !== g)) return false;
  return pageCourante().items.filter(o => o.groupe === g).length === objs.length;
}

function majSelectionUI() {
  const ui = $('#calque-ui');
  ui.innerHTML = '';
  const objs = selection();
  if (E.calque) $$('.objet', E.calque).forEach(el => el.classList.toggle('choisi', E.sel.includes(el.dataset.id)));
  if (objs.length === 1) {
    ui.appendChild(cadreSel(objs[0], { poignees: !(E.rognage && E.rognage === objs[0].id) }));
  } else if (objs.length > 1) {
    for (const o of objs) ui.appendChild(cadreSel(o, { classe: 'secondaire' }));
    const b = boiteEnglobante(objs);
    ui.appendChild(cadreSel(b, { poignees: true, classe: groupeEntier(objs) ? 'groupe' : '' }));
  }
  extrasSelectionUI(ui, objs);
  majEtat();
}

function cadreSel(o, opt) {
  const k = PX_MM * E.zoom;
  const p = mmVersScene(o.x, o.y);
  const d = document.createElement('div');
  d.className = 'cadre-sel ' + (opt.classe || '') + (E.edition && E.edition.id === o.id ? ' edition' : '');
  d.style.left = p.x + 'px';
  d.style.top = p.y + 'px';
  d.style.width = Math.max(o.w * k, 1) + 'px';
  d.style.height = Math.max(o.h * k, 1) + 'px';
  if (o.rot) d.style.transform = `rotate(${o.rot}deg)`;
  if (opt.poignees) {
    if (o.type === 'ligne') {
      const [a, b] = extremitesLigne(o);
      d.style.border = '0';
      for (const [nom, pt] of [['a', a], ['b', b]]) {
        const h = document.createElement('div');
        h.className = 'poignee p-' + nom;
        h.dataset.poignee = nom;
        h.style.left = ((pt[0] - o.x) * k) + 'px';
        h.style.top = ((pt[1] - o.y) * k) + 'px';
        d.appendChild(h);
      }
      return d;
    }
    // bandes de bord : on saisit le cadre par là pour le déplacer
    for (const cote of ['h', 'd', 'b', 'g']) {
      const bd = document.createElement('div');
      bd.className = 'bord-sel bord-' + cote;
      d.appendChild(bd);
    }
    if (o.forme === 'secteur') poigneesSecteur(o, d, k);
    const petit = o.w * k < 26 || o.h * k < 26;
    const pos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
    for (const nom in pos) {
      if (petit && nom.length === 1) continue;
      const h = document.createElement('div');
      h.className = 'poignee p-' + nom;
      h.dataset.poignee = nom;
      h.style.left = pos[nom][0] + '%';
      h.style.top = pos[nom][1] + '%';
      d.appendChild(h);
    }
    const tige = document.createElement('div');
    tige.className = 'tige-rot';
    tige.style.left = '50%'; tige.style.top = '-18px'; tige.style.height = '18px';
    d.appendChild(tige);
    const r = document.createElement('div');
    r.className = 'poignee p-rot';
    r.dataset.poignee = 'rot';
    r.style.left = '50%'; r.style.top = '-22px';
    r.title = 'Faire pivoter (Maj : par pas de 15°)';
    d.appendChild(r);
  }
  return d;
}

function extremitesLigne(o) {
  let a = [o.x, o.y], b = [o.x + o.w, o.y + o.h];
  if (o.miroirH) { a[0] = o.x + o.w; b[0] = o.x; }
  if (o.miroirV) { a[1] = o.y + o.h; b[1] = o.y; }
  return [a, b];
}
function ligneDepuisPoints(o, a, b) {
  o.x = arrondi(Math.min(a[0], b[0])); o.y = arrondi(Math.min(a[1], b[1]));
  o.w = arrondi(Math.abs(b[0] - a[0])); o.h = arrondi(Math.abs(b[1] - a[1]));
  o.miroirH = b[0] < a[0] || undefined;
  o.miroirV = b[1] < a[1] || undefined;
  if (!o.miroirH) delete o.miroirH;
  if (!o.miroirV) delete o.miroirV;
}

function choisir(ids, ajouter) {
  if (E.edition && !ids.includes(E.edition.id)) quitterEdition();
  E.sel = ajouter ? [...new Set([...E.sel, ...ids])] : [...ids];
  majSelectionUI();
  majRuban();
}
function deselectionner() { quitterEdition(); E.sel = []; E.cellules = []; majSelectionUI(); majRuban(); }

// un clic sur un membre de groupe sélectionne tout le groupe
function idsAvecGroupe(o) {
  if (!o.groupe) return [o.id];
  return pageCourante().items.filter(x => x.groupe === o.groupe).map(x => x.id);
}

/* ---------------- barre d'état, titre ---------------- */
function majEtat() {
  if (!E.fiche) return;
  $('#etat-page').textContent = E.modeMaitre ? `Page maître ${String.fromCharCode(65 + E.ip)} sur ${pagesActives().length}` : `Page : ${E.ip + 1} sur ${E.fiche.pages.length}`;
  const objs = selection();
  if (objs.length) {
    const b = objs.length === 1 ? objs[0] : boiteEnglobante(objs);
    $('#etat-pos').textContent = `${cm(b.x)} ; ${cm(b.y)} cm`;
    $('#etat-taille').textContent = `${cm(b.w)} x ${cm(b.h)} cm`;
  } else {
    $('#etat-pos').textContent = '';
    $('#etat-taille').textContent = '';
  }
  $('#etat-zoom').textContent = Math.round(E.zoom * 100) + ' %';
  $('#curseur-zoom').value = Math.round(E.zoom * 100);
}
function majTitre() {
  const t = `${E.fiche.titre}${E.modifie ? ' *' : ''} - PageLibre`;
  $('#titre-doc').textContent = t;
  document.title = t;
  $$('[data-cmd="annuler"]').forEach(b => { b.disabled = !E.histo.length && !E.edition; });
  $$('[data-cmd="refaire"]').forEach(b => { b.disabled = !E.refaire.length && !E.edition; });
}

/* ---------------- zoom ---------------- */
function definirZoom(z, ancre) {
  z = Math.max(0.1, Math.min(4, z));
  const def = $('#defile');
  const ax = ancre ? ancre.x : def.clientWidth / 2, ay = ancre ? ancre.y : def.clientHeight / 2;
  // point de la page sous l'ancre
  const k = PX_MM * E.zoom;
  const mx = (def.scrollLeft + ax - E.ox) / k, my = (def.scrollTop + ay - E.oy) / k;
  E.zoom = z;
  majScene();
  const k2 = PX_MM * E.zoom;
  def.scrollLeft = E.ox + mx * k2 - ax;
  def.scrollTop = E.oy + my * k2 - ay;
  majSelectionUI();
  majRegles();
  majEtat();
}
function zoomPage() {
  const def = $('#defile');
  // mêmes marges que majScene (au moins MARGE_SCENE à gauche et à droite, 0,6 × MARGE_SCENE en haut et en bas) :
  // sinon le bas de la page dépasse de la zone et paraît rogné
  const nbPages = indexVoisine() != null ? 2 : 1;
  const z = Math.min((def.clientWidth - 2 * MARGE_SCENE - 4) / (nbPages * E.fiche.page.w * PX_MM), (def.clientHeight - 2 * MARGE_SCENE * 0.6 - 4) / (E.fiche.page.h * PX_MM));
  definirZoom(z);
  centrerVue();
}
function zoomLargeur() {
  const def = $('#defile');
  definirZoom((def.clientWidth - 50) / (E.fiche.page.w * PX_MM));
  def.scrollLeft = (def.scrollWidth - def.clientWidth) / 2;
}
function centrerVue() {
  const def = $('#defile');
  def.scrollLeft = (def.scrollWidth - def.clientWidth) / 2;
  def.scrollTop = (def.scrollHeight - def.clientHeight) / 2;
}

/* ---------------- règles ---------------- */
function majRegles() {
  if (!E.feuille || !E.options.regles) return;
  const def = $('#defile');
  const k = PX_MM * E.zoom;
  const dpr = window.devicePixelRatio || 1;
  const objs = selection();
  const b = objs.length ? (objs.length === 1 ? objs[0] : boiteEnglobante(objs)) : null;
  for (const sens of ['h', 'v']) {
    const cv = $('#regle-' + sens);
    const L = sens === 'h' ? cv.clientWidth : cv.clientHeight;
    const T = 22;
    cv.width = (sens === 'h' ? L : T) * dpr;
    cv.height = (sens === 'h' ? T : L) * dpr;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#e4e4e4';
    c.fillRect(0, 0, sens === 'h' ? L : T, sens === 'h' ? T : L);
    const origine = sens === 'h' ? E.ox - def.scrollLeft : E.oy - def.scrollTop;
    const taille = (sens === 'h' ? E.fiche.page.w : E.fiche.page.h) * k;
    c.fillStyle = '#fff';
    if (sens === 'h') c.fillRect(origine, 0, taille, T); else c.fillRect(0, origine, T, taille);
    if (b) {
      c.fillStyle = '#cfe0f0';
      const d0 = origine + (sens === 'h' ? b.x : b.y) * k, d1 = (sens === 'h' ? b.w : b.h) * k;
      if (sens === 'h') c.fillRect(d0, 0, d1, T); else c.fillRect(0, d0, T, d1);
    }
    // pas : au moins 45 px entre deux graduations numérotées
    const pas = [1, 2, 5, 10, 20, 50, 100, 200].find(p => p * k >= 45) || 200;
    const sous = pas >= 10 ? (pas === 20 ? 4 : 5) : pas === 5 ? 5 : 2;
    c.strokeStyle = '#8a8a8a';
    c.fillStyle = '#555';
    c.font = '10px Segoe UI';
    c.lineWidth = 1;
    const debut = Math.floor(-origine / k / pas) * pas - pas, fin = (L - origine) / k + pas;
    c.beginPath();
    for (let v = debut; v <= fin; v += pas / sous) {
      const p = Math.round(origine + v * k) + 0.5;
      const majeur = Math.abs(v / pas - Math.round(v / pas)) < 1e-6;
      const lg = majeur ? 9 : (sous === 4 || sous === 2 ? 4 : (Math.abs((v * 2 / pas) % 1) < 1e-6 ? 6 : 4));
      if (sens === 'h') { c.moveTo(p, T); c.lineTo(p, T - lg); } else { c.moveTo(T, p); c.lineTo(T - lg, p); }
      if (majeur) {
        const lib = pas >= 10 ? String(v / 10) : String(v);
        if (sens === 'h') c.fillText(lib, p + 2, 10);
        else { c.save(); c.translate(10, p + 2); c.rotate(-Math.PI / 2); c.fillText(lib, -c.measureText(lib).width - 2, 0); c.restore(); }
      }
    }
    c.stroke();
    c.strokeStyle = '#b9b9b9';
    c.beginPath();
    if (sens === 'h') { c.moveTo(0, T - 0.5); c.lineTo(L, T - 0.5); } else { c.moveTo(T - 0.5, 0); c.lineTo(T - 0.5, L); }
    c.stroke();
  }
}

/* ---------------- vignettes des pages ---------------- */
const LARGEUR_VIGNETTE = 108;
function dessinerVignettes() {
  const l = $('#liste-pages');
  l.innerHTML = '';
  $('#volet-pages .volet-titre').textContent = E.modeMaitre ? 'Pages maîtres' : 'Pages';
  pagesActives().forEach((p, i) => {
    const v = document.createElement('div');
    v.className = 'vignette' + (i === E.ip ? ' active' : '');
    v.dataset.index = i;
    const lettre = String.fromCharCode(65 + i);
    v.title = E.modeMaitre ? `Page maître ${lettre}${p.nom ? ' : ' + p.nom : ''}` : `Page ${i + 1}`;
    const n = document.createElement('div');
    n.className = 'num';
    n.textContent = E.modeMaitre ? lettre : i + 1;
    const m = document.createElement('div');
    m.className = 'mini';
    v.append(n, m);
    v.setAttribute('role', 'button'); v.tabIndex = 0; v.setAttribute('aria-label', v.title);
    v.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); allerPage(i); } });
    l.appendChild(v);
    remplirVignette(i, m);
  });
}
function remplirVignette(i, m) {
  m = m || $(`.vignette[data-index="${i}"] .mini`);
  const p = pagesActives()[i];
  if (!m || !p) return;
  const k = LARGEUR_VIGNETTE / (E.fiche.page.w * PX_MM);
  m.style.width = LARGEUR_VIGNETTE + 'px';
  m.style.height = (E.fiche.page.h * PX_MM * k) + 'px';
  m.innerHTML = '';
  const f = Rendu.page(p, E.fiche, { numero: E.modeMaitre ? null : i + 1 });
  f.style.transform = `scale(${k})`;
  m.appendChild(f);
  Rendu.postMiseEnPage(f);
}
const vignettesEnAttente = new Set();
let minuteurVignette = null;
function planifierVignette(i) {
  vignettesEnAttente.add(i);
  clearTimeout(minuteurVignette);
  minuteurVignette = setTimeout(() => {
    for (const k of vignettesEnAttente) remplirVignette(k);
    vignettesEnAttente.clear();
  }, 600);
}
function majVignettesActive() {
  $$('.vignette').forEach(v => v.classList.toggle('active', +v.dataset.index === E.ip));
  const a = $('.vignette.active');
  if (a) a.scrollIntoView({ block: 'nearest' });
}
function allerPage(i) {
  if (i < 0 || i >= pagesActives().length) return;
  quitterEdition();
  E.ip = i;
  E.sel = [];
  afficherPage();
  $('#defile').scrollTop = 0;
}

/* ---------------- pages ---------------- */
function insererPage(dupliquer) {
  quitterEdition();
  avant();
  if (E.modeMaitre) {
    const m = dupliquer ? copie(pageCourante()) : { items: [] };
    m.id = nouvelId('m');
    m.nom = dupliquer ? (pageCourante().nom || '') + ' (copie)' : 'Page maître ' + String.fromCharCode(65 + pagesActives().length);
    for (const o of m.items) o.id = nouvelId();
    renommerGroupes(m.items);
    E.fiche.maitres[m.id] = m;
    E.ip = pagesActives().length - 1;
    E.sel = [];
    dessinerVignettes();
    afficherPage();
    apres();
    return;
  }
  const p = dupliquer ? copie(pageCourante()) : { maitre: pageCourante().maitre, items: [] };
  p.id = nouvelId('p');
  for (const o of p.items) { o.id = nouvelId(); delete o.suivant; delete o.precedent; }
  if (dupliquer) renommerGroupes(p.items);
  E.fiche.pages.splice(E.ip + 1, 0, p);
  E.ip++;
  E.sel = [];
  dessinerVignettes();
  afficherPage();
  apres();
}
function supprimerPage() {
  if (E.modeMaitre) {
    const m = pageCourante();
    confirmer(`Supprimer la page maître « ${m.nom || String.fromCharCode(65 + E.ip)} » ? Les pages qui l'utilisent n'auront plus de page maître.`, () => {
      avant();
      delete E.fiche.maitres[m.id];
      for (const p of E.fiche.pages) if (p.maitre === m.id) p.maitre = null;
      if (!Object.keys(E.fiche.maitres).length) { quitterModeMaitre(); apres(); return; }
      E.ip = Math.min(E.ip, pagesActives().length - 1);
      E.sel = [];
      dessinerVignettes();
      afficherPage();
      apres();
    });
    return;
  }
  if (E.fiche.pages.length < 2) { alerte('Une publication garde au moins une page.'); return; }
  confirmer(`Supprimer la page ${E.ip + 1} et tout son contenu ?`, () => {
    avant();
    E.fiche.pages.splice(E.ip, 1);
    E.ip = Math.min(E.ip, E.fiche.pages.length - 1);
    E.sel = [];
    dessinerVignettes();
    afficherPage();
    apres();
  });
}
function deplacerPage(d) {
  const j = E.ip + d;
  if (E.modeMaitre || j < 0 || j >= E.fiche.pages.length) return;
  avant();
  const p = E.fiche.pages.splice(E.ip, 1)[0];
  E.fiche.pages.splice(j, 0, p);
  E.ip = j;
  dessinerVignettes();
  majEtat();
  apres();
}
function renommerGroupes(items) {
  const m = new Map();
  for (const o of items) if (o.groupe) { if (!m.has(o.groupe)) m.set(o.groupe, nouvelId('g')); o.groupe = m.get(o.groupe); }
}
