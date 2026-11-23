/* =====================================================================
   Éditeur : souris, clavier, saisie du texte, presse-papiers, organisation
   ===================================================================== */
let G = null; // geste en cours

function initInteractions() {
  const def = $('#defile');
  def.addEventListener('pointerdown', surAppui);
  def.addEventListener('pointermove', surSurvol);
  window.addEventListener('pointermove', surDeplacement);
  window.addEventListener('pointerup', surRelache);
  window.addEventListener('pointercancel', () => { G = null; nettoyerAides(); });
  def.addEventListener('dblclick', surDoubleClic);
  def.addEventListener('contextmenu', surMenuContextuel);
  // sur toute la fenêtre : sinon, hors de la page, Edge agrandit toute l'interface
  window.addEventListener('wheel', surMolette, { passive: false, capture: true });
  def.addEventListener('scroll', () => majRegles());
  window.addEventListener('resize', () => { majScene(); majSelectionUI(); });
  document.addEventListener('keydown', surTouche);
  document.addEventListener('paste', surColler);
  document.addEventListener('copy', ev => { if (!E.edition && !champActif() && E.sel.length) { copier(); ev.preventDefault(); } });
  document.addEventListener('cut', ev => { if (!E.edition && !champActif() && E.sel.length) { couper(); ev.preventDefault(); } });
  document.addEventListener('selectionchange', () => { if (E.edition) planifierEtatTexte(); });
  def.addEventListener('focusin', ev => {
    const td = ev.target.closest && ev.target.closest('td[data-cellule]');
    if (td && E.edition) { E.celluleActive = +td.dataset.cellule; majRuban(); }
  });
  def.addEventListener('input', ev => {
    if (!E.edition) return;
    const o = objetParId(E.edition.id), el = elementObjet(E.edition.id);
    const z = ev.target.closest && ev.target.closest('.contenu');
    if (z && z.querySelector('.puce[data-liste="num"]')) Rendu.numeroter(z);
    if (o && el && o.type === 'texte') verifierDebordement(o, el);
    if (o && el && o.type === 'tableau') { apresRendu(o, el); majSelectionUI(); }
    void ev;
  });
}

function champActif() {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
}

/* ---------------- souris ---------------- */
function surAppui(ev) {
  fermerMenu();
  if (ev.button === 1) return;
  const cible = ev.target;
  const elObj = cible.closest('#feuille-hote .calque-objets > .objet');
  if (ev.button === 2) {
    if (elObj && !E.sel.includes(elObj.dataset.id)) choisir(idsAvecGroupe(objetParId(elObj.dataset.id)));
    return;
  }
  if (interceptionAppui(ev, cible, elObj)) return;
  // saisie en cours : le clic dans le texte reste au navigateur
  if (E.edition) {
    const elE = elementObjet(E.edition.id);
    if (elE && elE.contains(cible) && cible.closest('[contenteditable="true"]')) {
      const td = cible.closest('td[data-cellule]');
      if (td && ev.shiftKey && E.celluleActive != null) { choisirPlageCellules(E.celluleActive, +td.dataset.cellule); ev.preventDefault(); }
      else if (td) effacerChoixCellules();
      return;
    }
  }
  const poignee = cible.closest('.poignee');
  if (poignee) { demarrerPoignee(ev, poignee.dataset.poignee); ev.preventDefault(); return; }
  if (E.dessin) { G = { type: 'dessin', p0: versMM(ev), x0: ev.clientX, y0: ev.clientY }; ev.preventDefault(); return; }
  // bord du cadre sélectionné : on le saisit pour le déplacer (même pendant la saisie)
  if (cible.closest('.bord-sel') && E.sel.length) {
    G = { type: 'deplacer', x0: ev.clientX, y0: ev.clientY, actif: false, origines: selection().map(x => ({ id: x.id, x: x.x, y: x.y })) };
    ev.preventDefault();
    return;
  }
  if (elObj) {
    const o = objetParId(elObj.dataset.id);
    if (!o) return;
    // comme en PAO : un clic dans le texte d'un cadre y place directement le curseur
    // (pour un cadre groupé, le premier clic choisit le groupe)
    if (accesDirectTexte(o) && !ev.shiftKey && !ev.ctrlKey && !surBordObjet(ev, o)) {
      if (!(E.edition && E.edition.id === o.id)) entrerEdition(o, null);
      return; // le navigateur place le curseur et gère la sélection au glisser
    }
    if (ev.shiftKey || ev.ctrlKey) {
      const ids = idsAvecGroupe(o);
      if (E.sel.includes(o.id)) choisir(E.sel.filter(id => !ids.includes(id)));
      else choisir(ids, true);
    }
    const dejaSeul = E.sel.length === 1 && E.sel[0] === o.id;
    const dansGroupeChoisi = E.sel.includes(o.id) && E.sel.length > 1 && groupeEntier(selection());
    if (!E.sel.includes(o.id)) choisir(idsAvecGroupe(o));
    if (E.edition && E.edition.id !== o.id) quitterEdition();
    G = {
      type: 'deplacer', x0: ev.clientX, y0: ev.clientY, actif: false,
      origines: selection().map(x => ({ id: x.id, x: x.x, y: x.y })),
      texte: dejaSeul && (o.type === 'texte' || o.type === 'tableau') ? o.id : null,
      sousSel: dansGroupeChoisi ? o.id : null
    };
    ev.preventDefault();
    $('#defile').focus({ preventScroll: true });
    return;
  }
  quitterEdition();
  if (!ev.shiftKey) { E.sel = []; majSelectionUI(); majRuban(); }
  G = { type: 'lasso', p0: versMM(ev), x0: ev.clientX, y0: ev.clientY, actif: false, base: [...E.sel] };
  $('#defile').focus({ preventScroll: true });
  ev.preventDefault();
}

// texte accessible d'un clic : cadre de texte ou tableau, non groupé ou dont le groupe est déjà choisi
function accesDirectTexte(o) {
  if (o.type !== 'texte' && o.type !== 'tableau') return false;
  return !o.groupe || E.sel.includes(o.id);
}
// le pointeur est-il sur le bord du cadre (zone de déplacement) ?
function surBordObjet(ev, o) {
  const p = versMM(ev);
  const a = -(o.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = p.x - (o.x + o.w / 2), dy = p.y - (o.y + o.h / 2);
  const lx = dx * c - dy * s + o.w / 2, ly = dx * s + dy * c + o.h / 2;
  // au doigt, le bord à saisir est plus large (14 px au lieu de 5)
  const px = ev.pointerType === 'touch' ? 14 : 5;
  const marge = Math.min(px / (PX_MM * E.zoom), o.w * 0.2, o.h * 0.2);
  return lx < marge || ly < marge || lx > o.w - marge || ly > o.h - marge;
}
function surSurvol(ev) {
  if (G || E.dessin) return;
  const elObj = ev.target.closest('#feuille-hote .calque-objets > .objet');
  if (!elObj) return;
  const o = objetParId(elObj.dataset.id);
  if (!o) return;
  const curseur = accesDirectTexte(o) && !surBordObjet(ev, o) ? 'text' : 'move';
  if (elObj.style.cursor !== curseur) elObj.style.cursor = curseur;
}

function demarrerPoignee(ev, nom) {
  const objs = selection();
  if (!objs.length) return;
  const p0 = versMM(ev);
  if (nom === 'a' || nom === 'b') {
    G = { type: 'extremite', nom, id: objs[0].id, p0, actif: false };
  } else if (nom === 'rot') {
    const b = objs.length === 1 ? objs[0] : boiteEnglobante(objs);
    const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    G = { type: 'rotation', centre: c, a0: Math.atan2(p0.y - c.y, p0.x - c.x), origines: objs.map(copie), actif: false };
  } else {
    G = { type: 'redim', dir: nom, p0, origines: objs.map(copie), boite: objs.length === 1 ? null : boiteEnglobante(objs), actif: false };
  }
  G.x0 = ev.clientX; G.y0 = ev.clientY;
}

function surDeplacement(ev) {
  if (!G) return;
  if (!G.actif) {
    if (Math.hypot(ev.clientX - G.x0, ev.clientY - G.y0) < 3) return;
    G.actif = true;
    if (G.type !== 'lasso' && G.type !== 'dessin') { avant(); if (E.edition) quitterEdition(); }
  }
  const p = versMM(ev);
  if (G.bouger) { G.bouger(p, ev); return; }
  const k = PX_MM * E.zoom;
  switch (G.type) {
    case 'deplacer': {
      let dx = (ev.clientX - G.x0) / k, dy = (ev.clientY - G.y0) / k;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const objs = G.origines.map(g => objetParId(g.id));
      if (E.options.magnetisme && !ev.altKey) {
        const b0 = boiteEnglobante(objs.map((o, i) => Object.assign({}, o, { x: G.origines[i].x, y: G.origines[i].y })));
        const r = aimanter({ x: b0.x + dx, y: b0.y + dy, w: b0.w, h: b0.h }, new Set(E.sel));
        dx += r.dx; dy += r.dy;
      }
      G.origines.forEach((g, i) => {
        const o = objs[i];
        o.x = arrondi(g.x + dx); o.y = arrondi(g.y + dy);
        const el = elementObjet(o.id);
        if (el) { el.style.left = o.x + 'mm'; el.style.top = o.y + 'mm'; }
      });
      majSelectionUIGarderAides();
      break;
    }
    case 'redim': redimensionner(p, ev); break;
    case 'rotation': {
      let a = Math.atan2(p.y - G.centre.y, p.x - G.centre.x);
      let delta = (a - G.a0) * 180 / Math.PI;
      if (G.origines.length === 1) {
        let r = (G.origines[0].rot || 0) + delta;
        if (ev.shiftKey) r = Math.round(r / 15) * 15;
        delta = r - (G.origines[0].rot || 0);
      } else if (ev.shiftKey) delta = Math.round(delta / 15) * 15;
      const rad = delta * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
      for (const o0 of G.origines) {
        const o = objetParId(o0.id);
        let r = ((o0.rot || 0) + delta) % 360;
        if (r < 0) r += 360;
        o.rot = arrondi(r, 1) || undefined;
        if (!o.rot) delete o.rot;
        if (G.origines.length > 1) {
          const cx = o0.x + o0.w / 2 - G.centre.x, cy = o0.y + o0.h / 2 - G.centre.y;
          o.x = arrondi(G.centre.x + cx * c - cy * s - o0.w / 2);
          o.y = arrondi(G.centre.y + cx * s + cy * c - o0.h / 2);
        }
        const el = elementObjet(o.id);
        if (el) { el.style.transform = o.rot ? `rotate(${o.rot}deg)` : ''; el.style.left = o.x + 'mm'; el.style.top = o.y + 'mm'; }
      }
      majSelectionUI();
      infoBulle(ev, `${Math.round(selection()[0].rot || 0)}°`);
      break;
    }
    case 'extremite': {
      const o = objetParId(G.id);
      let [a, b] = extremitesLigne(o);
      let q = [p.x, p.y];
      const fixe = G.nom === 'a' ? b : a;
      if (ev.shiftKey) {
        const ang = Math.round(Math.atan2(q[1] - fixe[1], q[0] - fixe[0]) / (Math.PI / 4)) * Math.PI / 4;
        const L = Math.hypot(q[0] - fixe[0], q[1] - fixe[1]);
        q = [fixe[0] + Math.cos(ang) * L, fixe[1] + Math.sin(ang) * L];
      }
      if (G.nom === 'a') a = q; else b = q;
      ligneDepuisPoints(o, a, b);
      redessinerObjet(o);
      majSelectionUI();
      break;
    }
    case 'lasso': case 'dessin': {
      const ui = $('#calque-ui');
      let l = $('.lasso', ui);
      if (!l) { l = document.createElement('div'); l.className = 'lasso'; ui.appendChild(l); }
      let p1 = { x: p.x, y: p.y };
      if (G.type === 'dessin' && ev.shiftKey && E.dessin.type !== 'ligne') {
        const d = Math.max(Math.abs(p.x - G.p0.x), Math.abs(p.y - G.p0.y));
        p1 = { x: G.p0.x + Math.sign(p.x - G.p0.x || 1) * d, y: G.p0.y + Math.sign(p.y - G.p0.y || 1) * d };
      }
      G.p1 = p1;
      const a = mmVersScene(Math.min(G.p0.x, p1.x), Math.min(G.p0.y, p1.y));
      l.style.left = a.x + 'px'; l.style.top = a.y + 'px';
      l.style.width = Math.abs(p1.x - G.p0.x) * k + 'px';
      l.style.height = Math.abs(p1.y - G.p0.y) * k + 'px';
      if (G.type === 'dessin') l.style.borderStyle = 'dashed';
      break;
    }
  }
}

function redimensionner(p, ev) {
  const dirs = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1] };
  const [sx, sy] = dirs[G.dir];
  const dxp = p.x - G.p0.x, dyp = p.y - G.p0.y;
  if (!G.boite) {
    const o0 = G.origines[0], o = objetParId(o0.id);
    const r = (o0.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const lx = dxp * c + dyp * s, ly = -dxp * s + dyp * c;
    let w = o0.w + sx * lx, h = o0.h + sy * ly;
    const garder = ev.shiftKey !== (o.type === 'image' && sx !== 0 && sy !== 0);
    if (garder && o0.w > 0 && o0.h > 0) {
      const k = sx && sy ? Math.max(w / o0.w, h / o0.h) : sx ? w / o0.w : h / o0.h;
      w = o0.w * k; h = o0.h * k;
    }
    w = Math.max(w, 1); h = Math.max(h, 1);
    const cx0 = o0.x + o0.w / 2, cy0 = o0.y + o0.h / 2;
    // point fixe (coin ou côté opposé)
    const fx = -sx * o0.w / 2, fy = -sy * o0.h / 2;
    const Fx = cx0 + fx * c - fy * s, Fy = cy0 + fx * s + fy * c;
    const nx = sx ? -sx * w / 2 : 0, ny = sy ? -sy * h / 2 : 0;
    const cx = Fx - (nx * c - ny * s), cy = Fy - (nx * s + ny * c);
    o.w = arrondi(w); o.h = arrondi(h); o.x = arrondi(cx - w / 2); o.y = arrondi(cy - h / 2);
    if (garder && (!sx || !sy)) { o.x = arrondi(cx - w / 2); o.y = arrondi(cy - h / 2); }
    echelleInterne(o, o0);
    redessinerObjet(o);
  } else {
    const b = G.boite;
    let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
    if (sx < 0) x1 += dxp; if (sx > 0) x2 += dxp;
    if (sy < 0) y1 += dyp; if (sy > 0) y2 += dyp;
    let kx = Math.max(x2 - x1, 1) / (b.w || 1), ky = Math.max(y2 - y1, 1) / (b.h || 1);
    if (ev.shiftKey || (sx && sy)) { const k = sx && sy ? Math.max(kx, ky) : sx ? kx : ky; kx = ky = k; if (sx < 0) x1 = x2 - b.w * k; if (sy < 0) y1 = y2 - b.h * k; }
    for (const o0 of G.origines) {
      const o = objetParId(o0.id);
      o.x = arrondi(x1 + (o0.x - b.x) * kx); o.y = arrondi(y1 + (o0.y - b.y) * ky);
      o.w = arrondi(o0.w * kx); o.h = arrondi(o0.h * ky);
      echelleInterne(o, o0);
      redessinerObjet(o);
    }
  }
  majSelectionUI();
  const s = selection();
  if (s.length === 1) infoBulle(ev, `${cm(s[0].w)} x ${cm(s[0].h)} cm`);
}

// tableau : les colonnes et lignes suivent le cadre
function echelleInterne(o, o0) {
  if (o.type !== 'tableau') return;
  const kx = o.w / (o0.w || 1), ky = o.h / (o0.h || 1);
  o.tableau.cols = o0.tableau.cols.map(v => arrondi(v * kx));
  o.tableau.lignes = o0.tableau.lignes.map(v => arrondi(v * ky));
}

function surRelache(ev) {
  if (!G) return;
  const g = G;
  G = null;
  nettoyerAides();
  if (g.fin) { g.fin(ev); return; }
  if (g.type === 'deplacer') {
    if (!g.actif) {
      if (g.sousSel) { choisir([g.sousSel]); return; }
      if (g.texte) { const o = objetParId(g.texte); if (o) entrerEdition(o, { x: ev.clientX, y: ev.clientY }); }
      return;
    }
    majSelectionUI();
    apres();
  } else if (g.type === 'lasso') {
    $$('.lasso').forEach(l => l.remove());
    if (!g.actif) return;
    const p = versMM(ev);
    const x1 = Math.min(g.p0.x, p.x), x2 = Math.max(g.p0.x, p.x), y1 = Math.min(g.p0.y, p.y), y2 = Math.max(g.p0.y, p.y);
    const ids = new Set(g.base);
    for (const o of pageCourante().items) {
      if (o.arrierePlan) continue; // le fond de page ne se choisit pas au lasso
      const b = boiteEnglobante([o]);
      if (b.x >= x1 && b.y >= y1 && b.x + b.w <= x2 && b.y + b.h <= y2) idsAvecGroupe(o).forEach(id => ids.add(id));
    }
    choisir([...ids]);
  } else if (g.type === 'dessin') {
    $$('.lasso').forEach(l => l.remove());
    const p1 = g.p1 || versMM(ev);
    terminerDessin(g.p0, g.actif ? p1 : null, ev);
  } else if (g.actif) {
    majSelectionUI();
    apres();
  }
}

function surDoubleClic(ev) {
  const elObj = ev.target.closest('#feuille-hote .calque-objets > .objet');
  if (!elObj) return;
  const o = objetParId(elObj.dataset.id);
  if (!o) return;
  if (E.edition && E.edition.id === o.id) return;
  if (o.type === 'texte' || o.type === 'tableau') { choisir([o.id]); entrerEdition(o, { x: ev.clientX, y: ev.clientY }); }
  else if (o.type === 'forme') { ajouterTexteForme(o); }
  else if (o.type === 'image') { choisir([o.id]); changerImage(); }
  else if (o.type === 'wordart') { choisir([o.id]); modifierWordArt(o); }
}

function surMolette(ev) {
  const def = $('#defile');
  const dansZone = def.contains(ev.target);
  // Ctrl+molette (ou pincement du pavé tactile) : zoom partout ; molette seule : zoom si l'option est cochée
  const zoomer = ev.ctrlKey || (E.options.zoomMolette && dansZone && !ev.shiftKey);
  if (!zoomer) return;
  if (!$('#coulisses').hidden || !$('#boite').hidden) { if (ev.ctrlKey) ev.preventDefault(); return; }
  ev.preventDefault();
  ev.stopPropagation();
  const r = def.getBoundingClientRect();
  const ancre = dansZone ? { x: ev.clientX - r.left, y: ev.clientY - r.top } : null;
  // pas proportionnel : un cran de molette ≈ 10 %, le pavé tactile reste progressif
  const d = Math.max(-300, Math.min(300, ev.deltaMode === 1 ? ev.deltaY * 40 : ev.deltaY));
  definirZoom(E.zoom * Math.exp(-d * 0.0008), ancre);
}

/* ---------------- aides visuelles et magnétisme ---------------- */
function nettoyerAides() { $$('.guide-mag, .info-bulle-pos').forEach(x => x.remove()); }
function majSelectionUIGarderAides() {
  const aides = $$('.guide-mag');
  majSelectionUI();
  const ui = $('#calque-ui');
  aides.forEach(a => ui.appendChild(a));
}
function infoBulle(ev, texte) {
  let b = $('.info-bulle-pos');
  if (!b) { b = document.createElement('div'); b.className = 'info-bulle-pos'; $('#calque-ui').appendChild(b); }
  const r = $('#scene').getBoundingClientRect();
  b.style.left = (ev.clientX - r.left + 14) + 'px';
  b.style.top = (ev.clientY - r.top + 14) + 'px';
  b.textContent = texte;
}
function aimanter(b, exclus) {
  const tol = 6 / (PX_MM * E.zoom);
  const P = E.fiche.page, [mh, md, mb, mg] = P.marges;
  const cx = [0, P.w / 2, P.w, mg, P.w - md], cy = [0, P.h / 2, P.h, mh, P.h - mb];
  for (const g of P.guides || []) (g.sens === 'v' ? cx : cy).push(g.pos);
  const R = reperesGrille();
  cx.push(...R.v); cy.push(...R.h, ...R.base);
  for (const o of pageCourante().items) {
    if (exclus.has(o.id)) continue;
    const q = boiteEnglobante([o]);
    cx.push(q.x, q.x + q.w / 2, q.x + q.w);
    cy.push(q.y, q.y + q.h / 2, q.y + q.h);
  }
  const meilleur = (vals, cibles) => {
    let best = null;
    for (const v of vals) for (const c of cibles) {
      const d = c - v;
      if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, c };
    }
    return best;
  };
  const bx = meilleur([b.x, b.x + b.w / 2, b.x + b.w], cx);
  const by = meilleur([b.y, b.y + b.h / 2, b.y + b.h], cy);
  nettoyerAides();
  const ui = $('#calque-ui');
  const k = PX_MM * E.zoom;
  if (bx) {
    const g = document.createElement('div'); g.className = 'guide-mag v';
    const p = mmVersScene(bx.c, 0); g.style.left = p.x + 'px'; g.style.top = (E.oy - 2000) + 'px'; g.style.height = (P.h * k + 4000) + 'px';
    ui.appendChild(g);
  }
  if (by) {
    const g = document.createElement('div'); g.className = 'guide-mag h';
    const p = mmVersScene(0, by.c); g.style.top = p.y + 'px'; g.style.left = (E.ox - 2000) + 'px'; g.style.width = (P.w * k + 4000) + 'px';
    ui.appendChild(g);
  }
  return { dx: bx ? bx.d : 0, dy: by ? by.d : 0 };
}

/* ---------------- saisie du texte ---------------- */
function entrerEdition(o, point) {
  if (E.edition && E.edition.id === o.id) return;
  quitterEdition();
  const el = elementObjet(o.id);
  if (!el) return;
  E.edition = { id: o.id, avant: instantane() };
  E.celluleActive = null;
  el.classList.add('edition');
  const zones = $$('.contenu', el);
  zones.forEach(nettoyerAffichage);
  zones.forEach(z => { z.contentEditable = 'true'; z.spellcheck = true; z.lang = 'fr'; });
  try {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('defaultParagraphSeparator', false, 'p');
  } catch (e) { /* ancien navigateur */ }
  let place = false;
  if (point && document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(point.x, point.y);
    const z = r && r.startContainer && (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest('.contenu');
    if (z && el.contains(z)) {
      z.focus({ preventScroll: true });
      const s = window.getSelection();
      s.removeAllRanges(); s.addRange(r);
      place = true;
      const td = z.closest('td[data-cellule]');
      if (td) E.celluleActive = +td.dataset.cellule;
    }
  }
  if (!place && zones[0]) {
    zones[0].focus({ preventScroll: true });
    const r = document.createRange();
    r.selectNodeContents(zones[0]);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges(); s.addRange(r);
    const td = zones[0].closest('td[data-cellule]');
    if (td) E.celluleActive = +td.dataset.cellule;
  }
  E.sel = [o.id];
  majSelectionUI();
  majRuban();
  majTitre();
}

// retire ce qui n'existe qu'à l'affichage : blancs d'habillage, largeurs de tabulation, coupures de mots
function nettoyerAffichage(z) {
  z.querySelectorAll('.hab-espace,.habillage').forEach(x => x.remove());
  z.querySelectorAll('span.tab').forEach(x => x.replaceWith(...x.childNodes));
  const tw = document.createTreeWalker(z, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) if (t.nodeValue.includes('­')) t.nodeValue = t.nodeValue.replace(/­/g, '');
  z.normalize();
}

function nettoyerHTML(html) {
  // analyse dans un document inerte (securite.js) : rien ne s'exécute ni ne se charge
  const d = DOC_INERTE.createElement('div');
  d.innerHTML = html;
  nettoyerAffichage(d);
  d.querySelectorAll('.habillage').forEach(x => x.remove());
  assainirArbre(d);
  d.querySelectorAll('.champ-page').forEach(x => { x.textContent = '#'; });
  // des <div> créés par la saisie deviennent des paragraphes
  d.querySelectorAll(':scope > div').forEach(x => {
    const p = document.createElement('p');
    for (const a of x.attributes) p.setAttribute(a.name, a.value);
    p.append(...x.childNodes);
    x.replaceWith(p);
  });
  // texte nu au premier niveau : on l'enveloppe
  [...d.childNodes].forEach(n => {
    if (n.nodeType === 3 && n.textContent.trim()) { const p = document.createElement('p'); n.replaceWith(p); p.appendChild(n); }
  });
  d.querySelectorAll('font').forEach(f => {
    const s = document.createElement('span');
    if (f.face) s.style.fontFamily = f.face;
    if (f.color) s.style.color = f.color;
    s.append(...f.childNodes); f.replaceWith(s);
  });
  let h = d.innerHTML;
  if (!h.trim()) h = '<p><br></p>';
  return h;
}

function lireTexteEdite(o, el) {
  if (o.type === 'tableau') {
    $$('td[data-cellule]', el).forEach(td => {
      const c = o.tableau.cellules[+td.dataset.cellule], z = $('.contenu:not(.diag-haut)', td), z2 = $('.contenu.diag-haut', td);
      if (c && z) c.html = nettoyerHTML(z.innerHTML);
      if (c && z2) c.html2 = nettoyerHTML(z2.innerHTML);
    });
  } else {
    const z = $('.contenu', el);
    if (z) o.html = nettoyerHTML(z.innerHTML);
  }
}

function quitterEdition() {
  if (!E.edition) return;
  const ed = E.edition;
  E.edition = null;
  effacerChoixCellules();
  const o = objetParId(ed.id), el = elementObjet(ed.id);
  if (o && el) {
    lireTexteEdite(o, el);
    apresSaisieChaine(o);
    if (instantane() !== ed.avant) {
      E.histo.push(ed.avant);
      E.refaire = [];
      E.modifie = true;
      planifierAutosave();
      planifierVignette(E.ip);
    }
    redessinerObjet(o);
  }
  const s = window.getSelection();
  if (s && el && el.contains(s.anchorNode)) s.removeAllRanges();
  majSelectionUI();
  majTitre();
}

function ajouterTexteForme(o) {
  avant();
  o.type = 'texte';
  o.html = '<p style="text-align:center"><span style="font-family:\'Calibri\';font-size:11pt"><br></span></p>';
  o.vertical = 'milieu';
  o.marges = [2, 1, 2, 1];
  redessinerObjet(o);
  apres();
  choisir([o.id]);
  entrerEdition(o);
}

/* ---------------- clavier ---------------- */
function surTouche(ev) {
  const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey;
  if (!$('#boite').hidden) {
    if (k === 'Escape') { fermerBoite(); ev.preventDefault(); }
    return;
  }
  if (!$('#menu').hidden && k === 'Escape') { fermerMenu(); ev.preventDefault(); return; }
  if (!$('#coulisses').hidden) { if (k === 'Escape') fermerCoulisses(); return; }
  // raccourcis toujours actifs
  if (ctrl && !ev.shiftKey && (k === 's' || k === 'S')) { ev.preventDefault(); commande('enregistrer'); return; }
  if (ctrl && (k === 'p' || k === 'P')) { ev.preventDefault(); commande('imprimer'); return; }
  if (ctrl && (k === 'o' || k === 'O')) { ev.preventDefault(); ouvrirCoulisses('ouvrir'); return; }
  // Ctrl + / Ctrl - / Ctrl 0 : zoom du document, pas du navigateur
  if (ctrl && !ev.altKey && (k === '+' || k === '=' || ev.code === 'NumpadAdd')) { ev.preventDefault(); definirZoom(E.zoom * 1.1); return; }
  if (ctrl && !ev.altKey && (k === '-' || ev.code === 'NumpadSubtract')) { ev.preventDefault(); definirZoom(E.zoom / 1.1); return; }
  if (ctrl && !ev.altKey && (k === '0' || k === 'à' || ev.code === 'Numpad0')) { ev.preventDefault(); zoomPage(); return; }
  if (champActif()) return;
  if (E.edition) {
    if (k === 'Escape') { const id = E.edition.id; quitterEdition(); E.sel = [id]; majSelectionUI(); ev.preventDefault(); return; }
    if (k === 'Tab') {
      const o = objetParId(E.edition.id);
      if (o && o.type === 'tableau') { ev.preventDefault(); celluleSuivante(o, ev.shiftKey ? -1 : 1); return; }
      ev.preventDefault();
      document.execCommand('insertText', false, '\t');
      return;
    }
    if (ctrl && (k === 'b' || k === 'B')) { ev.preventDefault(); commande('gras'); return; }
    if (ctrl && (k === 'i' || k === 'I')) { ev.preventDefault(); commande('italique'); return; }
    if (ctrl && (k === 'u' || k === 'U')) { ev.preventDefault(); commande('souligne'); return; }
    return; // le reste va au texte
  }
  if (E.dessin && k === 'Escape') { finDessin(); return; }
  if (ctrl) {
    switch (k.toLowerCase()) {
      case 'z': ev.preventDefault(); annuler(); return;
      case 'y': ev.preventDefault(); refaire(); return;
      case 'a': ev.preventDefault(); choisir(pageCourante().items.filter(o => !o.arrierePlan).map(o => o.id)); return;
      case 'd': ev.preventDefault(); dupliquer(); return;
      case 'g': ev.preventDefault(); if (ev.shiftKey) dissocier(); else grouper(); return;
      case 'b': ev.preventDefault(); commande('gras'); return;
      case 'i': ev.preventDefault(); commande('italique'); return;
      case 'u': ev.preventDefault(); commande('souligne'); return;
      case 'n': ev.preventDefault(); ouvrirCoulisses('nouveau'); return;
    }
    if (k === 'PageDown') { ev.preventDefault(); allerPage(E.ip + 1); return; }
    if (k === 'PageUp') { ev.preventDefault(); allerPage(E.ip - 1); return; }
    return;
  }
  if (k === 'PageDown' && !E.sel.length) { allerPage(E.ip + 1); ev.preventDefault(); return; }
  if (k === 'PageUp' && !E.sel.length) { allerPage(E.ip - 1); ev.preventDefault(); return; }
  if (k === 'F9') { ev.preventDefault(); definirZoom(1); return; }
  if (!E.sel.length) return;
  if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); supprimerSelection(); return; }
  if (k === 'Escape') { deselectionner(); return; }
  const fleches = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (fleches[k]) {
    ev.preventDefault();
    const pas = ev.shiftKey ? 5 : ev.altKey ? 0.2 : 1;
    avant();
    for (const o of selection()) { o.x = arrondi(o.x + fleches[k][0] * pas); o.y = arrondi(o.y + fleches[k][1] * pas); const el = elementObjet(o.id); if (el) { el.style.left = o.x + 'mm'; el.style.top = o.y + 'mm'; } }
    apres();
    return;
  }
  if (k === 'Enter' || k === 'F2') {
    const s = selection();
    if (s.length === 1 && (s[0].type === 'texte' || s[0].type === 'tableau')) { ev.preventDefault(); entrerEdition(s[0]); }
    return;
  }
  // une lettre tapée sur une zone de texte sélectionnée : on commence la saisie
  if (k.length === 1 && !ev.altKey) {
    const s = selection();
    if (s.length === 1 && s[0].type === 'texte') entrerEdition(s[0]);
  }
}

/* ---------------- presse-papiers ---------------- */
function copier() {
  if (!E.sel.length) return;
  const objs = copie(selection());
  const images = {};
  for (const o of objs) for (const k of imagesObjet(o)) if (E.fiche.images[k]) images[k] = E.fiche.images[k];
  E.presse = { objets: objs, images, page: E.ip, n: 0 };
  try { navigator.clipboard.writeText(objs.map(o => (o.html || '').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')).join('\n').trim()).catch(() => {}); } catch (e) { /* facultatif */ }
}
function couper() { copier(); supprimerSelection(); }
function collerInterne() {
  if (!E.presse) return false;
  avant();
  E.presse.n++;
  for (const [k, u] of Object.entries(E.presse.images || {})) if (!E.fiche.images[k]) E.fiche.images[k] = u; // collé dans un autre document
  const decal = E.presse.page === E.ip ? 4 * E.presse.n : 0;
  const objs = copie(E.presse.objets);
  renommerGroupes(objs);
  for (const o of objs) {
    delete o.suivant; delete o.precedent;
    if (o.htmlComplet != null) { o.html = o.htmlComplet; delete o.htmlComplet; }
    o.id = nouvelId(); o.x = arrondi(o.x + decal); o.y = arrondi(o.y + decal); pageCourante().items.push(o); redessinerObjet(o); }
  E.sel = objs.map(o => o.id);
  apres();
  return true;
}
function surColler(ev) {
  if (E.edition) {
    // dans un texte : texte brut seulement (garde la mise en forme de la fiche)
    const t = ev.clipboardData && ev.clipboardData.getData('text/plain');
    const img = ev.clipboardData && [...ev.clipboardData.files].find(f => f.type.startsWith('image/'));
    ev.preventDefault();
    if (img) { quitterEdition(); insererImageFichier(img); return; }
    if (t) document.execCommand('insertText', false, t);
    return;
  }
  if (champActif()) return;
  const cd = ev.clipboardData;
  const img = cd && [...cd.files].find(f => f.type.startsWith('image/'));
  ev.preventDefault();
  if (img) { insererImageFichier(img); return; }
  const t = cd && cd.getData('text/plain');
  if (E.presse && (!t || t.trim() === presseTexte())) { collerInterne(); return; }
  if (t && t.trim()) { insererTexteBrut(t); return; }
  collerInterne();
}
function presseTexte() {
  return E.presse ? E.presse.objets.map(o => (o.html || '').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')).join('\n').trim() : '';
}
async function collerDepuisBouton() {
  if (E.presse && collerInterne()) return;
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const ti = it.types.find(t => t.startsWith('image/'));
      if (ti) { insererImageFichier(await it.getType(ti)); return; }
      if (it.types.includes('text/plain')) { insererTexteBrut(await (await it.getType('text/plain')).text()); return; }
    }
  } catch (e) { alerte('Le navigateur ne donne pas accès au presse-papiers depuis ce bouton : utilisez Ctrl+V.'); }
}
function insererTexteBrut(t) {
  const P = E.fiche.page;
  const html = t.split(/\r?\n/).map(l => `<p><span style="font-family:'Calibri';font-size:11pt">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;') || '<br>'}</span></p>`).join('');
  const o = { id: nouvelId(), type: 'texte', forme: 'rect', x: arrondi(P.w / 2 - 50), y: arrondi(P.h / 3), w: 100, h: 30, marges: [1, 1, 1, 1], vertical: 'haut', html };
  avant();
  pageCourante().items.push(o);
  redessinerObjet(o);
  E.sel = [o.id];
  apres();
}

/* ---------------- organisation ---------------- */
function supprimerSelection() {
  if (!E.sel.length) return;
  quitterEdition();
  avant();
  const ids = new Set(E.sel);
  avantSuppressionChaines([...ids]);
  pageCourante().items = pageCourante().items.filter(o => !ids.has(o.id));
  rafraichirDependances();
  ids.forEach(id => { const el = elementObjet(id); if (el) el.remove(); });
  E.sel = [];
  apres();
}
function dupliquer() {
  if (!E.sel.length) return;
  quitterEdition();
  const sauve = E.presse;
  copier();
  E.presse.n = 0;
  collerInterne();
  E.presse = sauve;
}
function ordre(mode) {
  const items = pageCourante().items, ids = new Set(E.sel);
  if (!ids.size) return;
  avant();
  const choisis = items.filter(o => ids.has(o.id)), autres = items.filter(o => !ids.has(o.id));
  if (mode === 'premier') pageCourante().items = [...autres, ...choisis];
  else if (mode === 'arriere') pageCourante().items = [...choisis, ...autres];
  else if (mode === 'avancer' || mode === 'reculer') {
    const t = [...items];
    const pas = mode === 'avancer' ? 1 : -1;
    const ordreIdx = t.map((o, i) => i).filter(i => ids.has(t[i].id));
    if (pas > 0) ordreIdx.reverse();
    for (const i of ordreIdx) {
      const j = i + pas;
      if (j >= 0 && j < t.length && !ids.has(t[j].id)) [t[i], t[j]] = [t[j], t[i]];
    }
    pageCourante().items = t;
  }
  redessinerCalque();
  apres();
}
function grouper() {
  const s = selection();
  if (s.length < 2) return;
  avant();
  const g = nouvelId('g');
  s.forEach(o => { o.groupe = g; });
  apres();
}
function dissocier() {
  const s = selection();
  if (!s.some(o => o.groupe)) return;
  avant();
  s.forEach(o => { delete o.groupe; });
  apres();
}
function aligner(mode) {
  const s = selection();
  if (!s.length) return;
  avant();
  const ref = s.length === 1 ? { x: 0, y: 0, w: E.fiche.page.w, h: E.fiche.page.h } : boiteEnglobante(s);
  const blocs = groupesDeSelection(s);
  if (mode === 'distribuerH' || mode === 'distribuerV') {
    const h = mode === 'distribuerH';
    if (blocs.length < 3) { E.histo.pop(); return; }
    blocs.sort((a, b) => h ? a.b.x - b.b.x : a.b.y - b.b.y);
    const total = blocs.reduce((t, x) => t + (h ? x.b.w : x.b.h), 0);
    const espace = ((h ? ref.w : ref.h) - total) / (blocs.length - 1);
    let pos = h ? ref.x : ref.y;
    for (const bl of blocs) { decaler(bl.objs, h ? pos - bl.b.x : 0, h ? 0 : pos - bl.b.y); pos += (h ? bl.b.w : bl.b.h) + espace; }
  } else {
    for (const bl of blocs) {
      const b = bl.b;
      let dx = 0, dy = 0;
      if (mode === 'gauche') dx = ref.x - b.x;
      if (mode === 'centreH') dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
      if (mode === 'droite') dx = ref.x + ref.w - (b.x + b.w);
      if (mode === 'haut') dy = ref.y - b.y;
      if (mode === 'milieu') dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
      if (mode === 'bas') dy = ref.y + ref.h - (b.y + b.h);
      decaler(bl.objs, dx, dy);
    }
  }
  apres();
}
function groupesDeSelection(s) {
  const m = new Map();
  for (const o of s) { const k = o.groupe || o.id; if (!m.has(k)) m.set(k, []); m.get(k).push(o); }
  return [...m.values()].map(objs => ({ objs, b: boiteEnglobante(objs) }));
}
function decaler(objs, dx, dy) {
  for (const o of objs) { o.x = arrondi(o.x + dx); o.y = arrondi(o.y + dy); const el = elementObjet(o.id); if (el) { el.style.left = o.x + 'mm'; el.style.top = o.y + 'mm'; } }
}
function pivoter(delta) {
  const s = selection();
  if (!s.length) return;
  avant();
  for (const o of s) { let r = ((o.rot || 0) + delta) % 360; if (r < 0) r += 360; if (r) o.rot = r; else delete o.rot; redessinerObjet(o); }
  apres();
}
function retourner(sens) {
  const s = selection();
  if (!s.length) return;
  avant();
  for (const o of s) {
    const k = sens === 'h' ? 'miroirH' : 'miroirV';
    if (o[k]) delete o[k]; else o[k] = true;
    redessinerObjet(o);
  }
  apres();
}

/* ---------------- insertion par dessin ---------------- */
function demarrerModeDessin(spec) {
  quitterEdition();
  E.dessin = spec;
  document.body.classList.add('mode-dessin');
  indication('Tracez l\'objet sur la page (cliquez-glissez). Échap pour annuler.');
}
function finDessin() {
  E.dessin = null;
  document.body.classList.remove('mode-dessin');
  indication(null);
}
function terminerDessin(p0, p1, ev) {
  const spec = E.dessin;
  finDessin();
  if (!spec) return;
  let x, y, w, h;
  const defaut = { texte: [70, 25], forme: [30, 30], ligne: [40, 0] }[spec.type] || [30, 30];
  if (!p1 || (Math.abs(p1.x - p0.x) < 1.5 && Math.abs(p1.y - p0.y) < 1.5)) {
    x = p0.x; y = p0.y; w = defaut[0]; h = defaut[1];
    p1 = { x: x + w, y: y + h };
  } else {
    x = Math.min(p0.x, p1.x); y = Math.min(p0.y, p1.y); w = Math.abs(p1.x - p0.x); h = Math.abs(p1.y - p0.y);
  }
  let o;
  if (spec.type === 'texte') {
    o = { type: 'texte', forme: 'rect', marges: [1, 1, 1, 1], vertical: 'haut', html: '<p><span style="font-family:\'Calibri\';font-size:11pt"><br></span></p>' };
  } else if (spec.type === 'ligne') {
    o = { type: 'ligne', trait: { couleur: '#000000', epaisseur: 1, flecheFin: spec.fleche ? 1 : undefined } };
    if (!spec.fleche) delete o.trait.flecheFin;
    o.id = nouvelId();
    if (ev && ev.shiftKey) {
      const ang = Math.round(Math.atan2(p1.y - p0.y, p1.x - p0.x) / (Math.PI / 4)) * Math.PI / 4, L = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      p1 = { x: p0.x + Math.cos(ang) * L, y: p0.y + Math.sin(ang) * L };
    }
    ligneDepuisPoints(o, [p0.x, p0.y], [p1.x, p1.y]);
  } else {
    o = { type: 'forme', forme: spec.forme || 'rect', fond: { couleur: '#5b9bd5' }, trait: { couleur: '#41719c', epaisseur: 1 } };
  }
  o.id = o.id || nouvelId();
  if (spec.type !== 'ligne') { o.x = arrondi(x); o.y = arrondi(y); o.w = arrondi(Math.max(w, 2)); o.h = arrondi(Math.max(h, 2)); }
  avant();
  pageCourante().items.push(o);
  redessinerObjet(o);
  E.sel = [o.id];
  apres();
  if (o.type === 'texte') entrerEdition(o);
}

/* ---------------- menu contextuel ---------------- */
function surMenuContextuel(ev) {
  ev.preventDefault();
  if (E.edition) {
    const elE = elementObjet(E.edition.id);
    if (elE && elE.contains(ev.target)) {
      ouvrirMenu({ x: ev.clientX, y: ev.clientY }, [
        { lib: 'Couper', ic: 'couper', act: () => document.execCommand('cut'), rac: 'Ctrl+X' },
        { lib: 'Copier', ic: 'copier', act: () => document.execCommand('copy'), rac: 'Ctrl+C' },
        { lib: 'Coller (texte)', ic: 'coller', act: () => collerTexteEdition(), rac: 'Ctrl+V' },
        '-',
        { lib: 'Police…', act: () => boitePolice() },
        { lib: 'Paragraphe…', act: () => boiteParagraphe() }
      ]);
      return;
    }
  }
  const s = selection();
  const items = [];
  if (s.length) {
    items.push({ lib: 'Couper', ic: 'couper', act: couper, rac: 'Ctrl+X' }, { lib: 'Copier', ic: 'copier', act: copier, rac: 'Ctrl+C' });
  }
  items.push({ lib: 'Coller', ic: 'coller', act: collerDepuisBouton, rac: 'Ctrl+V', off: !E.presse });
  if (s.length) {
    items.push({ lib: 'Dupliquer', ic: 'dupliquer', act: dupliquer, rac: 'Ctrl+D' },
      { lib: 'Supprimer l\'objet', ic: 'supprimer', act: supprimerSelection, rac: 'Suppr' }, '-');
    if (s.length === 1 && (s[0].type === 'texte' || s[0].type === 'tableau')) items.push({ lib: 'Modifier le texte', act: () => entrerEdition(s[0]) });
    if (s.length === 1 && s[0].type === 'forme') items.push({ lib: 'Ajouter du texte', act: () => ajouterTexteForme(s[0]) });
    if (s.length === 1 && s[0].type === 'image') items.push({ lib: 'Changer l\'image…', ic: 'changerImage', act: changerImage });
    if (s.length === 1 && s[0].type === 'wordart') items.push({ lib: 'Modifier le WordArt…', act: () => modifierWordArt(s[0]) });
    items.push(
      { lib: 'Mettre au premier plan', ic: 'premierPlan16', act: () => ordre('premier') },
      { lib: 'Mettre à l\'arrière-plan', ic: 'arrierePlan16', act: () => ordre('arriere') });
    if (s.length > 1 && !groupeEntier(s)) items.push({ lib: 'Grouper', ic: 'grouper', act: grouper, rac: 'Ctrl+G' });
    if (s.some(o => o.groupe)) items.push({ lib: 'Dissocier', ic: 'dissocier', act: dissocier, rac: 'Ctrl+Maj+G' });
    items.push('-', { lib: 'Taille et position…', act: boiteTaillePosition });
  } else {
    items.push('-', { lib: 'Insérer une zone de texte', ic: 'zoneTexte16', act: () => demarrerModeDessin({ type: 'texte' }) },
      { lib: 'Insérer une image…', ic: 'image16', act: insererImage },
      { lib: 'Insérer une page', ic: 'page16', act: () => insererPage(false) });
  }
  ouvrirMenu({ x: ev.clientX, y: ev.clientY }, items);
}
async function collerTexteEdition() {
  try { const t = await navigator.clipboard.readText(); if (t) document.execCommand('insertText', false, t); }
  catch (e) { alerte('Utilisez Ctrl+V pour coller.'); }
}

/* ---------------- glisser-déposer de fichiers ---------------- */
function initDepot() {
  let n = 0;
  const voile = $('#glisser-ici');
  window.addEventListener('dragenter', ev => { if ([...ev.dataTransfer.types].includes('Files')) { n++; voile.hidden = false; ev.preventDefault(); } });
  window.addEventListener('dragleave', () => { n = Math.max(0, n - 1); if (!n) voile.hidden = true; });
  window.addEventListener('dragover', ev => { if ([...ev.dataTransfer.types].includes('Files')) ev.preventDefault(); });
  window.addEventListener('drop', ev => {
    n = 0; voile.hidden = true;
    const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!f) return;
    ev.preventDefault();
    if (f.type.startsWith('image/')) { insererImageFichier(f, E.feuille ? versMM(ev) : null); return; }
    // Edge donne aussi la « poignée » du fichier : on pourra enregistrer au même endroit
    const item = [...ev.dataTransfer.items].find(i => i.kind === 'file');
    const promesse = item && item.getAsFileSystemHandle ? item.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null);
    promesse.then(p => {
      if (p) noterRecent(p);
      ouvrirFichier(f, p && /\.html?$/i.test(f.name) ? p : null);
    });
  });
}
