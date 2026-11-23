/* =====================================================================
   Cinquième série (23/11/2026) : ce qui était repris des .pub peut aussi être créé et modifié
   - petites capitales ;
   - secteur (diagramme circulaire) : poignées jaunes pour les angles ;
   - bordures décoratives ;
   - retournement d'un groupe entier (en miroir).
   ===================================================================== */

/* ---------------- petites capitales ---------------- */
// enveloppe chaque morceau de texte sélectionné dans un span (sans toucher au reste de la mise en forme)
function spansDeSelection(z) {
  const s = window.getSelection();
  if (!s.rangeCount) return [];
  const r = s.getRangeAt(0);
  const textes = [], tw = document.createTreeWalker(z, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) if (r.intersectsNode(t) && !t.parentElement.closest('.puce,.champ-page')) textes.push(t);
  const out = [];
  for (let t of textes) {
    let a = t === r.startContainer ? r.startOffset : 0, b = t === r.endContainer ? r.endOffset : t.length;
    if (a >= b) continue;
    if (b < t.length) t.splitText(b);
    if (a > 0) t = t.splitText(a);
    const p = t.parentElement;
    if (p.tagName === 'SPAN' && p.childNodes.length === 1 && !p.classList.contains('contenu')) { out.push(p); continue; }
    const sp = document.createElement('span');
    t.replaceWith(sp);
    sp.appendChild(t);
    out.push(sp);
  }
  if (out.length) { const n = document.createRange(); n.setStartBefore(out[0]); n.setEndAfter(out[out.length - 1]); s.removeAllRanges(); s.addRange(n); }
  return out;
}
function petitesCapitales() {
  appliquerTexte(z => {
    const l = spansDeSelection(z);
    const toutes = l.length && l.every(x => getComputedStyle(x).fontVariantCaps === 'small-caps');
    for (const x of l) {
      x.querySelectorAll('[style*="font-variant"]').forEach(y => y.style.removeProperty('font-variant'));
      x.style.fontVariant = toutes ? 'normal' : 'small-caps';
      if (toutes && getComputedStyle(x.parentElement).fontVariantCaps !== 'small-caps') x.style.removeProperty('font-variant');
    }
  });
}

/* ---------------- secteur ---------------- */
// angles en degrés, dans le sens des aiguilles d'une montre à partir de 3 heures : du début à la fin
const anglesSecteur = o => o.angles || [0, 270];
function pointSecteur(o, a) { const t = a * Math.PI / 180; return [o.w / 2 + o.w / 2 * Math.cos(t), o.h / 2 + o.h / 2 * Math.sin(t)]; }
function poigneesSecteur(o, d, k) {
  anglesSecteur(o).forEach((a, i) => {
    const [x0, y0] = pointSecteur(o, a), h = document.createElement('div');
    // aux trois quarts du rayon : sur le bord, elle se confondrait avec les poignées de taille
    const x = o.w / 2 + (x0 - o.w / 2) * 0.75, y = o.h / 2 + (y0 - o.h / 2) * 0.75;
    h.className = 'poignee p-angle';
    h.dataset.poignee = 'angle' + i;
    h.style.left = x * k + 'px'; h.style.top = y * k + 'px';
    h.title = i ? 'Fin du secteur' : 'Début du secteur (Maj : par pas de 15°)';
    d.appendChild(h);
  });
}
function gesteAngle(o, i) {
  avant();
  return {
    type: 'angle', actif: false,
    bouger(p, ev) {
      this.actif = true;
      const r = -(o.rot || 0) * Math.PI / 180, cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const dx = p.x - cx, dy = p.y - cy, x = dx * Math.cos(r) - dy * Math.sin(r), y = dx * Math.sin(r) + dy * Math.cos(r);
      let a = Math.atan2(y / (o.h || 1), x / (o.w || 1)) * 180 / Math.PI;
      a = (Math.round(ev.shiftKey ? Math.round(a / 15) * 15 : a) + 360) % 360;
      const l = [...anglesSecteur(o)];
      l[i] = a;
      o.angles = l;
      redessinerObjet(o);
      majSelectionUI();
    },
    fin() { if (this.actif) apres(); else E.histo.pop(); }
  };
}
function boiteAngles() {
  const o = selection().find(x => x.forme === 'secteur');
  if (!o) return;
  const [a, b] = anglesSecteur(o), part = Math.round((((b - a) % 360 + 360) % 360 || 360) / 3.6 * 10) / 10;
  ouvrirBoite('Secteur', `<div class="grille-champs"><span>Début (degrés)</span><input id="se-a" class="champ champ-num" type="number" value="${Math.round(a * 10) / 10}">
    <span>Part du disque (%)</span><input id="se-p" class="champ champ-num" type="number" min="0.1" max="100" step="0.1" value="${part}"></div>
    <p style="color:#666;max-width:380px">0° est à droite (3 heures) ; les angles tournent dans le sens des aiguilles d'une montre.</p>`, () => {
    const d = +$('#se-a').value || 0, p = Math.max(0.1, Math.min(100, +$('#se-p').value || 25));
    avant();
    o.angles = [((d % 360) + 360) % 360, p >= 100 ? ((d % 360) + 360) % 360 : (d + p * 3.6 + 360) % 360];
    redessinerObjet(o);
    apres();
  });
}

/* ---------------- bordures décoratives ---------------- */
// 8 dessins : coin haut gauche, haut, coin haut droit, droite, coin bas droit, bas, coin bas gauche, gauche
const BORDURES = (() => {
  const c = corps => couleur => {
    const svg = r => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><g transform="rotate(${r} 10 10)" fill="${couleur}" stroke="none">${corps}</g></svg>`;
    return [0, 0, 90, 90, 180, 180, 270, 270].map(svg);
  };
  return [
    ['Points', c('<circle cx="10" cy="10" r="5"/>')],
    ['Carrés', c('<rect x="5" y="5" width="10" height="10"/>')],
    ['Losanges', c('<path d="M10 2L18 10L10 18L2 10Z"/>')],
    ['Triangles', c('<path d="M1 18L10 3L19 18Z"/>')],
    ['Étoiles', c('<path d="M10 1l2.7 6 6.5.6-4.9 4.3 1.5 6.4L10 15l-5.8 3.3 1.5-6.4L.8 7.6 7.3 7z"/>')],
    ['Cœurs', c('<path d="M10 18C3 12 1 9 1 6a4.5 4.5 0 019-1 4.5 4.5 0 019 1c0 3-2 6-9 12z"/>')],
    ['Damier', c('<path d="M0 0h10v10H0zM10 10h10v10H10z"/>')],
    ['Zigzag', c('<path d="M0 12L10 2L20 12V18L10 8L0 18z"/>')],
    ['Vagues', c('<path d="M0 10q5-10 10 0t10 0v5q-5 10-10 0t-10 0z"/>')],
    ['Barreaux', c('<path d="M3 0h4v20H3zM13 0h4v20h-4z"/>')],
    ['Double trait', c('<path d="M0 4h20v3H0zM0 12h20v3H0z"/>')],
    ['Flèches', c('<path d="M2 7h8V2l9 8-9 8v-5H2z"/>')]
  ].map(([nom, f]) => ({ nom, dessins: f }));
})();
// enregistre les 8 dessins dans le document (une seule fois par nom et par couleur) et renvoie leurs clés
function imagesBordure(b, couleur) {
  const base = 'bd-' + b.nom.normalize('NFD').replace(/[^a-z]/gi, '') + '-' + couleur.slice(1) + '-';
  return b.dessins(couleur).map((svg, i) => { const k = base + i; E.fiche.images[k] = 'data:image/svg+xml;base64,' + btoa(svg); return k; });
}
function borduresDuDocument() {
  const vues = new Map();
  for (const p of [...E.fiche.pages, ...Object.values(E.fiche.maitres)]) for (const o of p.items) if (o.bordure && !/^bd-/.test(o.bordure.images[0])) vues.set(o.bordure.images.join(), o.bordure);
  return [...vues.values()];
}
function boiteBordure() {
  const cibles = () => selection().filter(o => o.type === 'texte' || o.type === 'forme');
  const objs = cibles();
  if (!objs.length) { alerte('Sélectionnez une zone de texte ou une forme.'); return; }
  const doc = borduresDuDocument(), a = objs[0].bordure;
  let choix = a ? (/^bd-/.test(a.images[0]) ? 'b' + BORDURES.findIndex(b => b.nom === a.nom) : 'd' + doc.findIndex(x => x.images.join() === a.images.join())) : 'b0';
  const mc = a && /^bd-.*-([0-9a-f]{6})-0$/i.exec(a.images[0]);
  const couleurActuelle = mc ? '#' + mc[1] : '#1f4e79';
  ouvrirBoite('Bordure décorative', `<div class="grille-bordures" id="bd-grille" role="listbox" aria-label="Bordures"></div>
    <div class="grille-champs" style="margin-top:10px"><span>Couleur</span><input type="color" id="bd-c" value="${couleurActuelle}">
      <span>Épaisseur (pt)</span><input id="bd-e" class="champ champ-num" type="number" min="3" max="80" value="${a ? Math.round(a.taille / 0.3528) : 12}"></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="bd-aucune"> Retirer la bordure décorative</label>`, () => {
    const e = Math.max(3, Math.min(80, +$('#bd-e').value || 12)), coul = $('#bd-c').value;
    avant();
    for (const o of cibles()) {
      if ($('#bd-aucune').checked) delete o.bordure;
      else if (choix[0] === 'd') o.bordure = Object.assign(copie(doc[+choix.slice(1)]), { taille: arrondi(e * 0.3528) });
      else { const b = BORDURES[+choix.slice(1)]; o.bordure = { nom: b.nom, images: imagesBordure(b, coul), taille: arrondi(e * 0.3528) }; }
      redessinerObjet(o);
    }
    apres();
  });
  const dessiner = () => {
    const coul = $('#bd-c').value;
    const vue = (cle, nom, srcs) => `<button type="button" role="option" data-b="${cle}" title="${esc(nom)}" aria-label="${esc(nom)}" aria-selected="${cle === choix}"><span class="apercu-bordure">${[0, 1, 1, 1, 2].map(i => `<img alt="" src="${esc(srcs[i])}">`).join('')}</span><small>${esc(nom)}</small></button>`;
    $('#bd-grille').innerHTML = doc.map((d, i) => vue('d' + i, d.nom + ' (document)', d.images.map(k => E.fiche.images[k] || ''))).join('') +
      BORDURES.map((b, i) => vue('b' + i, b.nom, b.dessins(coul).map(s => 'data:image/svg+xml;base64,' + btoa(s)))).join('');
  };
  $('#bd-grille').addEventListener('click', ev => { const b = ev.target.closest('[data-b]'); if (b) { choix = b.dataset.b; $('#bd-aucune').checked = false; dessiner(); } });
  $('#bd-c').addEventListener('input', dessiner);
  dessiner();
}

/* ---------------- retourner un groupe entier ---------------- */
// en miroir autour du centre du groupe : chaque objet change de côté, se retourne, et tourne en sens inverse
function retournerGroupe(objs, sens) {
  const b = boiteEnglobante(objs), k = sens === 'h' ? 'miroirH' : 'miroirV';
  for (const o of objs) {
    if (sens === 'h') o.x = arrondi(2 * b.x + b.w - o.x - o.w); else o.y = arrondi(2 * b.y + b.h - o.y - o.h);
    if (o[k]) delete o[k]; else o[k] = true;
    if (o.rot) o.rot = arrondi((360 - o.rot) % 360);
    redessinerObjet(o);
  }
}

Object.assign(COMMANDES, { petitesCapitales, anglesSecteur: boiteAngles, bordureDeco: boiteBordure });
