/* =====================================================================
   Éditeur : mise en forme du texte
   - pendant la saisie : s'applique à la sélection du texte ;
   - sur un cadre sélectionné : s'applique à tout son texte.
   ===================================================================== */
const TAILLES = [6, 7, 8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const POLICES = ['Arial', 'Arial Black', 'Arial Narrow', 'Bookman Old Style', 'Calibri', 'Calibri Light', 'Cambria', 'Candara', 'Century Gothic',
  'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Franklin Gothic Medium', 'Garamond', 'Georgia', 'Impact',
  'Lucida Console', 'Lucida Sans Unicode', 'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Tahoma', 'Times New Roman',
  'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings'];

function zoneDeSelection() {
  const s = window.getSelection();
  if (!s.rangeCount) return null;
  const n = s.getRangeAt(0).commonAncestorContainer;
  const el = n.nodeType === 1 ? n : n.parentElement;
  return el ? el.closest('.contenu[contenteditable="true"]') : null;
}

// applique fn(zone, toutLeTexte) au texte visé
function appliquerTexte(fn) {
  if (E.edition) {
    const o = objetParId(E.edition.id), el = elementObjet(E.edition.id);
    if (o && o.type === 'tableau' && E.cellules.length) {
      for (const i of E.cellules) {
        const z = $(`td[data-cellule="${i}"] .contenu`, el);
        if (z) { toutSelectionner(z); fn(z, true); }
      }
    } else {
      let z = zoneDeSelection();
      if (!z) { z = $('.contenu[contenteditable="true"]', el); if (z) toutSelectionner(z, true); }
      if (z) fn(z, false);
    }
    if (o && el) { if (o.type === 'texte') verifierDebordement(o, el); else apresRendu(o, el); }
    majSelectionUI();
    planifierEtatTexte();
    return;
  }
  let objs = selection().filter(o => o.type === 'texte' || o.type === 'tableau');
  if (!objs.length) return;
  // cadres chaînés : la mise en forme vaut pour tout l'enchaînement
  const chaines = new Set();
  for (const o of [...objs]) {
    if (!o.suivant && !o.precedent) continue;
    const ch = chaineDe(o);
    chaines.add(ch[0]);
    for (const x of ch) if (!objs.includes(x) && objetParId(x.id)) objs.push(x);
  }
  avant();
  for (const o of objs) {
    const el = elementObjet(o.id);
    if (!el) continue;
    for (const z of $$('.contenu', el)) {
      z.contentEditable = 'true';
      try { document.execCommand('styleWithCSS', false, true); } catch (e) { /* */ }
      toutSelectionner(z);
      fn(z, true);
      z.removeAttribute('contenteditable');
    }
    lireTexteEdite(o, el);
    redessinerObjet(o);
  }
  for (const tete of chaines) apresSaisieChaine(tete);
  window.getSelection().removeAllRanges();
  apres();
  majEtatTexte();
}
function toutSelectionner(z, fin) {
  z.focus({ preventScroll: true });
  const r = document.createRange();
  r.selectNodeContents(z);
  if (fin) r.collapse(false);
  const s = window.getSelection();
  s.removeAllRanges(); s.addRange(r);
}

function paragraphesVises(z, tout) {
  const ps = $$(':scope > p', z);
  if (tout) return ps;
  const s = window.getSelection();
  if (!s.rangeCount) return ps.slice(0, 1);
  const r = s.getRangeAt(0);
  const touches = ps.filter(p => r.intersectsNode(p));
  if (touches.length) return touches;
  const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  const p = n && n.closest('p');
  return p ? [p] : ps.slice(0, 1);
}

function cmdTexte(nom, val) {
  appliquerTexte((z, tout) => {
    switch (nom) {
      case 'gras': document.execCommand('bold'); break;
      case 'italique': document.execCommand('italic'); break;
      case 'souligne': document.execCommand('underline'); break;
      case 'barre': document.execCommand('strikeThrough'); break;
      case 'exposant': document.execCommand('superscript'); break;
      case 'indice': document.execCommand('subscript'); break;
      case 'police': document.execCommand('fontName', false, val); break;
      case 'couleur': document.execCommand('foreColor', false, val); break;
      case 'surligne': document.execCommand('hiliteColor', false, val || 'transparent'); break;
      case 'effacer': document.execCommand('removeFormat'); break;
      case 'taille': appliquerTaille(z, val); break;
      case 'agrandir': case 'reduire': {
        const t = tailleCourante() || 11;
        const n = nom === 'agrandir' ? (TAILLES.find(x => x > t + 0.01) || t + 12) : ([...TAILLES].reverse().find(x => x < t - 0.01) || Math.max(1, t - 1));
        appliquerTaille(z, n);
        break;
      }
      case 'aligner': {
        for (const p of paragraphesVises(z, tout)) { if (val === 'left') p.style.removeProperty('text-align'); else p.style.textAlign = val; }
        break;
      }
      case 'interligne': for (const p of paragraphesVises(z, tout)) p.style.lineHeight = val; break;
      case 'retrait': {
        for (const p of paragraphesVises(z, tout)) {
          const v = Math.max(0, (parseFloat(p.style.marginLeft) || 0) + val);
          if (v) p.style.marginLeft = v + 'mm'; else p.style.removeProperty('margin-left');
        }
        break;
      }
      case 'puces': basculerPuces(paragraphesVises(z, tout), val); Rendu.numeroter(z); break;
      case 'paragraphe': for (const p of paragraphesVises(z, tout)) Object.assign(p.style, val); break;
    }
  });
}

function appliquerTaille(z, pt) {
  pt = +pt;
  if (!pt) return;
  const s = window.getSelection();
  if (s.rangeCount && s.getRangeAt(0).collapsed) {
    // pas de sélection : on agit sur le paragraphe entier
    const r = s.getRangeAt(0);
    const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    const p = n && n.closest('p');
    if (p) { const rr = document.createRange(); rr.selectNodeContents(p); s.removeAllRanges(); s.addRange(rr); }
  }
  document.execCommand('fontSize', false, '7');
  z.querySelectorAll('[style*="xxx-large"], font[size="7"]').forEach(e => {
    if (e.tagName === 'FONT') { const sp = document.createElement('span'); sp.append(...e.childNodes); e.replaceWith(sp); sp.style.fontSize = pt + 'pt'; }
    else e.style.fontSize = pt + 'pt';
    e.querySelectorAll && e.querySelectorAll('[style*="font-size"]').forEach(x => x.style.removeProperty('font-size'));
  });
  z.querySelectorAll('.puce').forEach(pu => {
    const p = pu.closest('p');
    const sp = p && p.querySelector('span:not(.puce)');
    if (sp && sp.style.fontSize) pu.style.fontSize = sp.style.fontSize;
  });
}

function basculerPuces(ps, type) {
  const avec = ps.length && ps.every(p => p.querySelector(':scope > .puce'));
  let n = 0;
  for (const p of ps) {
    const pu = p.querySelector(':scope > .puce');
    if (pu) pu.remove();
    if (avec) {
      p.style.removeProperty('margin-left');
      p.style.removeProperty('text-indent');
      continue;
    }
    n++;
    const s = document.createElement('span');
    s.className = 'puce';
    s.setAttribute('contenteditable', 'false');
    const premier = p.querySelector('span');
    if (premier) { s.style.fontFamily = premier.style.fontFamily; s.style.fontSize = premier.style.fontSize; s.style.color = premier.style.color; }
    s.textContent = (type === 'numeros' ? n + '.' : '•') + ' ';
    if (type === 'numeros') s.dataset.liste = 'num'; // numéro recalculé automatiquement
    p.insertBefore(s, p.firstChild);
    p.style.marginLeft = '6.35mm';
    p.style.textIndent = '-6.35mm';
  }
}

/* ---- état de la mise en forme (pour le ruban) ---- */
function tailleCourante() {
  const s = window.getSelection();
  let n = s.rangeCount ? s.getRangeAt(0).startContainer : null;
  if (!E.edition) {
    const o = selection().find(x => x.type === 'texte' || x.type === 'tableau');
    const el = o && elementObjet(o.id);
    n = el && (el.querySelector('.contenu span:not(.puce)') || el.querySelector('.contenu'));
  }
  if (!n) return null;
  const e = n.nodeType === 1 ? n : n.parentElement;
  if (!e) return null;
  return Math.round(parseFloat(getComputedStyle(e).fontSize) * 0.75 * 2) / 2;
}
let minuteurEtat = null;
function planifierEtatTexte() { clearTimeout(minuteurEtat); minuteurEtat = setTimeout(majEtatTexte, 80); }
function majEtatTexte() {
  const champPolice = $('#c-police'), champTaille = $('#c-taille');
  if (!champPolice) return;
  let e = null;
  if (E.edition) {
    const s = window.getSelection();
    if (s.rangeCount) { const n = s.getRangeAt(0).startContainer; e = n.nodeType === 1 ? n : n.parentElement; }
  } else {
    const o = selection().find(x => x.type === 'texte' || x.type === 'tableau');
    const el = o && elementObjet(o.id);
    e = el && (el.querySelector('.contenu span:not(.puce)') || el.querySelector('.contenu'));
  }
  if (!e) return;
  const cs = getComputedStyle(e);
  const police = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  if (![...champPolice.options].some(o => o.value === police)) champPolice.add(new Option(police, police));
  champPolice.value = police;
  const t = Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2;
  champTaille.value = String(t).replace('.', ',');
  const gras = +cs.fontWeight >= 600, ital = cs.fontStyle === 'italic';
  let soul = false;
  for (let x = e; x && !x.classList.contains('contenu'); x = x.parentElement) if (getComputedStyle(x).textDecorationLine.includes('underline')) soul = true;
  const p = e.closest('p');
  const al = p ? getComputedStyle(p).textAlign : 'left';
  const etat = { gras, italique: ital, souligne: soul, 'aligner:left': al === 'left' || al === 'start', 'aligner:center': al === 'center', 'aligner:right': al === 'right' || al === 'end', 'aligner:justify': al === 'justify' };
  for (const [k, v] of Object.entries(etat)) $$(`[data-etat="${k}"]`).forEach(b => b.classList.toggle('on', !!v));
}

/* ---- boîtes de dialogue Police / Paragraphe ---- */
function boitePolice() {
  const t = tailleCourante() || 11;
  const champPolice = $('#c-police');
  ouvrirBoite('Police', `
    <div class="grille-champs">
      <span>Police</span><select id="bp-police" class="champ">${POLICES.map(p => `<option${champPolice && champPolice.value === p ? ' selected' : ''}>${p}</option>`).join('')}</select>
      <span>Taille (pt)</span><input id="bp-taille" class="champ champ-num" type="number" min="1" max="400" step="0.5" value="${t}">
      <span>Couleur</span><input id="bp-couleur" type="color" value="#000000">
      <span>Style</span><span><label style="display:inline"><input type="checkbox" id="bp-gras"> Gras</label> &nbsp; <label style="display:inline"><input type="checkbox" id="bp-ital"> Italique</label> &nbsp; <label style="display:inline"><input type="checkbox" id="bp-soul"> Souligné</label></span>
    </div>`, () => {
    const police = $('#bp-police').value, taille = +$('#bp-taille').value, coul = $('#bp-couleur').value;
    const g = $('#bp-gras').checked, i = $('#bp-ital').checked, u = $('#bp-soul').checked;
    restaurerSelectionTexte();
    appliquerTexte(z => {
      document.execCommand('fontName', false, police);
      appliquerTaille(z, taille);
      document.execCommand('foreColor', false, coul);
      if (g !== document.queryCommandState('bold')) document.execCommand('bold');
      if (i !== document.queryCommandState('italic')) document.execCommand('italic');
      if (u !== document.queryCommandState('underline')) document.execCommand('underline');
    });
  });
  memoriserSelectionTexte();
}
function boiteParagraphe() {
  let p = null;
  const s = window.getSelection();
  if (E.edition && s.rangeCount) { const n = s.getRangeAt(0).startContainer; p = (n.nodeType === 1 ? n : n.parentElement).closest('p'); }
  else { const o = selection().find(x => x.type === 'texte'); const el = o && elementObjet(o.id); p = el && el.querySelector('.contenu p'); }
  const st = p ? p.style : {};
  const mm = v => (v ? arrondi(parseFloat(v) * (String(v).endsWith('pt') ? 25.4 / 72 : 1), 1) : 0);
  const pt = v => (v ? arrondi(parseFloat(v) * (String(v).endsWith('mm') ? 72 / 25.4 : 1), 1) : 0);
  ouvrirBoite('Paragraphe', `
    <div class="grille-champs">
      <span>Alignement</span><select id="bq-align" class="champ"><option value="left">Gauche</option><option value="center">Centré</option><option value="right">Droite</option><option value="justify">Justifié</option></select>
      <span>Retrait gauche (mm)</span><input id="bq-rg" class="champ champ-num" type="number" step="0.5" value="${mm(st.marginLeft)}">
      <span>Retrait droit (mm)</span><input id="bq-rd" class="champ champ-num" type="number" step="0.5" value="${mm(st.marginRight)}">
      <span>Première ligne (mm)</span><input id="bq-r1" class="champ champ-num" type="number" step="0.5" value="${mm(st.textIndent)}">
      <span>Espace avant (pt)</span><input id="bq-av" class="champ champ-num" type="number" min="0" step="1" value="${pt(st.marginTop)}">
      <span>Espace après (pt)</span><input id="bq-ap" class="champ champ-num" type="number" min="0" step="1" value="${pt(st.marginBottom)}">
      <span>Interligne</span><select id="bq-il" class="champ"><option value="">Simple</option><option value="1">1,0</option><option value="1.15">1,15</option><option value="1.5">1,5</option><option value="2">2,0</option><option value="0.9">0,9</option><option value="0.8">0,8</option></select>
    </div>`, () => {
    const v = {
      textAlign: $('#bq-align').value === 'left' ? '' : $('#bq-align').value,
      marginLeft: +$('#bq-rg').value ? $('#bq-rg').value + 'mm' : '',
      marginRight: +$('#bq-rd').value ? $('#bq-rd').value + 'mm' : '',
      textIndent: +$('#bq-r1').value ? $('#bq-r1').value + 'mm' : '',
      marginTop: +$('#bq-av').value ? $('#bq-av').value + 'pt' : '',
      marginBottom: +$('#bq-ap').value ? $('#bq-ap').value + 'pt' : '',
      lineHeight: $('#bq-il').value ? String(+$('#bq-il').value * 1.2) : ''
    };
    restaurerSelectionTexte();
    cmdTexte('paragraphe', v);
  });
  if (p) {
    $('#bq-align').value = p.style.textAlign || 'left';
    const lh = parseFloat(p.style.lineHeight);
    if (lh) { const m = String(arrondi(lh / 1.2, 2)); if ([...$('#bq-il').options].some(o => o.value === m)) $('#bq-il').value = m; }
  }
  memoriserSelectionTexte();
}
let selectionMemo = null;
function memoriserSelectionTexte() {
  const s = window.getSelection();
  selectionMemo = E.edition && s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
}
function restaurerSelectionTexte() {
  if (!selectionMemo || !E.edition) return;
  const z = selectionMemo.startContainer.parentElement && selectionMemo.startContainer.parentElement.closest('.contenu');
  if (z) z.focus({ preventScroll: true });
  const s = window.getSelection();
  s.removeAllRanges(); s.addRange(selectionMemo);
}
