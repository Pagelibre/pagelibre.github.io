/* =====================================================================
   Export Word (.docx) fidèle à la page, sans serveur ni Internet.
   Chaque objet devient un objet Word posé au même endroit : zone de texte, vrai tableau,
   image, forme modifiable. Les mesures (hauteurs de ligne, hauteurs de rangée, retours à la ligne
   autour d'un objet) sont prises sur l'affichage de PageLibre.
   ===================================================================== */
const ExportDocx = (() => {
  const EMU = 36000;                       // unités Word par mm
  const emu = mm => Math.round(mm * EMU);
  const TW = 1440 / 25.4;                  // twips (1/20 pt) par mm
  const tw = mm => Math.round(mm * TW);
  const PX = 25.4 / 96;                    // mm par point écran
  const x = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS_DOC = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"';

  let C = null; // export en cours : images, liens, listes, remarques

  /* ---------------- texte ---------------- */
  function rPr(s, o = {}) {
    const f = x(o.famille || s.familles[0] || 'Times New Roman');
    let taille = s.taille;
    let v = `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/>`;
    if (s.gras) v += '<w:b/>';
    if (s.italique) v += '<w:i/>';
    if (s.majuscules) v += '<w:caps/>';
    else if (s.petitesCaps) v += '<w:smallCaps/>';
    if (s.barre) v += '<w:strike/>';
    const c = lireCouleur(s.couleur);
    v += `<w:color w:val="${c ? c.hex : '000000'}"/>`;
    if (s.espacement) v += `<w:spacing w:val="${Math.round(s.espacement * 15)}"/>`;
    if (s.decalage) taille /= 0.65;      // Word réduit lui-même les exposants et indices
    v += `<w:sz w:val="${Math.max(2, Math.round(taille * 1.5))}"/>`;
    if (s.souligne) v += `<w:u w:val="${{ double: 'double', dotted: 'dotted', dashed: 'dash', wavy: 'wave' }[s.souligneStyle] || 'single'}"/>`;
    const fond = s.fond && lireCouleur(s.fond);
    if (fond) v += `<w:shd w:val="clear" w:color="auto" w:fill="${fond.hex}"/>`;
    if (s.decalage) v += `<w:vertAlign w:val="${s.decalage === 'haut' ? 'superscript' : 'subscript'}"/>`;
    // Word retire les accents des capitales en français de France (option de l'utilisateur) : pas en français du Canada
    if (s.majuscules || s.petitesCaps) v += '<w:lang w:val="fr-CA"/>';
    return `<w:rPr>${v}</w:rPr>`;
  }
  // texte -> morceaux Word (tabulations, césures, caractères des polices de symboles)
  function run(texte, s) {
    let out = '', buf = '', fam = null, symbole = false;
    const vider = () => {
      if (!buf) return;
      const pr = rPr(s, { famille: fam });
      if (symbole) out += [...buf].map(ch => { const u = ch.charCodeAt(0); return `<w:r>${pr}<w:sym w:font="${x(fam)}" w:char="${(u < 0x100 ? u + 0xf000 : u).toString(16).toUpperCase().padStart(4, '0')}"/></w:r>`; }).join('');
      else out += `<w:r>${pr}` + buf.split(/(\t|­|‑)/).filter(t => t !== '').map(t => (t === '\t' ? '<w:tab/>' : t === '­' ? '<w:softHyphen/>' : t === '‑' ? '<w:noBreakHyphen/>' : `<w:t xml:space="preserve">${x(t)}</w:t>`)).join('') + '</w:r>';
      buf = '';
    };
    for (const ch of texte) {
      const f = famillePour(s.familles, ch);
      // espaces, tabulations : restent dans le morceau en cours, jamais en « symbole »
      const sy = POLICE_SYMBOLE.test(f) && !/[\s­]/.test(ch);
      if (buf && (f !== fam || sy !== symbole)) vider();
      fam = f; symbole = sy;
      buf += ch;
    }
    vider();
    return out;
  }
  function contenuRuns(runs) {
    let out = '';
    const lien = (u, xml) => (u && /^(https?:|mailto:)/i.test(u) ? `<w:hyperlink r:id="${C.lien(u)}">${xml}</w:hyperlink>` : xml);
    for (const r of runs) {
      if (r.genre === 'br') out += '<w:r><w:br/></w:r>';
      else if (r.genre === 'tab') out += `<w:r>${rPr(r.s)}<w:tab/></w:r>`;
      else if (r.genre === 'champ') {
        const pr = rPr(r.s), c = ty => `<w:r>${pr}<w:fldChar w:fldCharType="${ty}"/></w:r>`;
        out += c('begin') + `<w:r>${pr}<w:instrText xml:space="preserve"> ${r.champ === 'total' ? 'NUMPAGES' : 'PAGE'} </w:instrText></w:r>` + c('separate') + `<w:r>${pr}<w:t>${x(r.texte)}</w:t></w:r>` + c('end');
      }
      else out += lien(r.s.lien, run(r.texte, r.s));
    }
    return out;
  }

  // paragraphes d'une zone affichée. figer : une ligne affichée = un paragraphe (texte qui contourne un objet, lettrine)
  function lireZone(ct, z, figer) {
    const blocs = [];
    let libre = null;
    for (const n of ct.childNodes) {
      if (n.nodeType === 1 && n.classList.contains('habillage')) continue;
      if (n.nodeType === 1 && /^(P|DIV|LI|H[1-6]|BLOCKQUOTE)$/.test(n.tagName)) { blocs.push([n, [...n.childNodes]]); libre = null; }
      else if (n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName)) { for (const li of n.children) blocs.push([li, [...li.childNodes]]); libre = null; }
      else if (n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim())) { if (!libre) { libre = [ct, []]; blocs.push(libre); } libre[1].push(n); }
    }
    const res = [];
    let basPrec = 0, finPrec = null;
    for (const [el, enfants] of blocs) {
      const cs = getComputedStyle(el), propre = el !== ct;
      const p = { runs: [], align: { center: 'center', right: 'right', end: 'right', justify: 'both' }[cs.textAlign] || 'left' };
      const mm = v => (parseFloat(v) || 0) * PX * z;
      p.mg = propre ? mm(cs.marginLeft) + mm(cs.paddingLeft) : 0;
      p.md = propre ? mm(cs.marginRight) : 0;
      p.r1 = propre ? mm(cs.textIndent) : 0;
      const mt = propre ? mm(cs.marginTop) : 0;
      p.avant = Math.max(basPrec, mt);
      basPrec = propre ? mm(cs.marginBottom) : 0;
      p.taquets = propre ? el.dataset.taquets : '';
      p.sBase = styleTexte(el, z, ct);
      const voir = n => {
        if (n.nodeType === 3) { if (n.nodeValue) p.runs.push({ genre: 't', texte: n.nodeValue, s: styleTexte(n.parentElement, z, ct), noeud: n }); return; }
        if (n.nodeType !== 1) return;
        if (n.classList.contains('habillage') || n.classList.contains('lettrine')) return; // la lettrine est posée à part
        if (n.tagName === 'BR') { p.runs.push({ genre: 'br', noeud: n, s: styleTexte(n.parentElement, z, ct) }); return; }
        if (n.classList.contains('puce') && n.parentElement === el) {
          const t = n.textContent.trim(), f = n.querySelector('span') || n;
          p.puce = { texte: t, s: styleTexte(f, z, ct), num: n.dataset.liste === 'num' };
          return;
        }
        if (n.classList.contains('champ-page')) { p.runs.push({ genre: 'champ', champ: n.dataset.champ, texte: n.textContent, s: styleTexte(n, z, ct), noeud: n }); return; }
        if (n.classList.contains('tab')) { p.runs.push({ genre: 'tab', s: styleTexte(n, z, ct), noeud: n }); return; }
        if (n.classList.contains('hab-espace')) { p.runs.push({ genre: 'espace', s: styleTexte(n.parentElement, z, ct), noeud: n }); return; }
        n.childNodes.forEach(voir);
      };
      enfants.forEach(voir);
      // un <br> en fin de paragraphe ne fait pas de ligne de plus ; il donne la taille d'une ligne vide
      const der = p.runs[p.runs.length - 1];
      if (der && der.genre === 'br') { p.runs.pop(); p.sFin = der.s; }
      // style dominant : celui du plus long morceau
      let dom = null, nb = -1;
      for (const r of p.runs) if (r.s && r.texte) { const k = r.texte.trim().length; if (k > nb && !r.s.decalage) { nb = k; dom = r.s; } }
      p.dom = dom || p.sFin || (p.runs[0] && p.runs[0].s) || p.sBase;
      p.sFin = p.sFin || (p.runs.length ? p.runs[p.runs.length - 1].s : p.dom);
      // interligne : en fraction de la hauteur naturelle de la police, ou exact s'il est réglé en points
      const lh = el.style && el.style.lineHeight, calc = cs.lineHeight;
      const nat = mesuresPolice(famillePour(p.dom.familles), p.dom.gras, p.dom.italique).ligne;
      if (calc !== 'normal') {
        const px = parseFloat(calc) * z;
        if (/(pt|px|mm|cm)$/.test(lh || '') || ct.classList.contains('calage')) p.exact = px * 0.75;
        else { p.ratio = px / (parseFloat(cs.fontSize) * z) / nat; }
      }
      // polices ou tailles mélangées : Word prend, ligne par ligne, la plus haute ; on cale sur la hauteur affichée
      if (!p.exact && propre && !ct.style.columnCount && !ct.className.includes('sens-') && !ct.querySelector('.lettrine')) { const q = rapportLignes(el, p, z); if (q) p.ratio = q; }
      if (!figer) { res.push(p); continue; }

      /* lignes figées : on relève chaque ligne telle qu'elle est affichée */
      const zr = ct.getBoundingClientRect();
      let ligne = null;
      const nouvelle = (r, gauche) => { ligne = { runs: [], g: gauche, haut: r.top, bas: r.bottom }; lignes.push(ligne); };
      const lignes = [];
      const poser = (item, r) => {
        if (!ligne || r.top >= ligne.bas - 1 || (r.left < ligne.d - 3 && r.bottom > ligne.bas + 1)) nouvelle(r, r.left);
        ligne.d = r.right; ligne.bas = Math.max(ligne.bas, r.bottom); ligne.haut = Math.min(ligne.haut, r.top);
        if (item.genre === 't' && ligne.runs.length) { const q = ligne.runs[ligne.runs.length - 1]; if (q.genre === 't' && q.s === item.s) { q.texte += item.texte; return; } }
        ligne.runs.push(item);
      };
      for (const r of p.runs) {
        if (r.genre === 'br') { ligne = null; continue; }
        if (r.genre === 'espace') { const b = r.noeud.getBoundingClientRect(); if (ligne) { ligne.runs.push({ genre: 'tab', s: r.s }); (ligne.taquets = ligne.taquets || []).push((b.right - ligne.g) * PX); ligne.d = b.right; } continue; }
        if (r.genre !== 't') { poser(r, r.noeud.getBoundingClientRect()); continue; }
        const g = document.createRange();
        for (let i = 0; i < r.texte.length; i++) {
          const ch = r.texte[i];
          g.setStart(r.noeud, i); g.setEnd(r.noeud, i + 1);
          const l = g.getClientRects(), b = l[l.length - 1];
          if (!b) continue;
          if (ch === '­') { if (b.width > 1) { poser({ genre: 't', texte: '-', s: r.s }, b); } continue; }
          if (ch === ' ' && ligne && (b.left >= ligne.d - 0.5 && b.top < ligne.bas - 1 || !b.width)) { poser({ genre: 't', texte: ch, s: r.s }, { left: ligne.d, right: Math.max(ligne.d, b.right), top: ligne.haut, bottom: ligne.bas }); continue; }
          poser({ genre: 't', texte: ch, s: r.s }, b);
        }
      }
      if (!lignes.length) { res.push(p); finPrec = null; continue; }
      const elr = el.getBoundingClientRect();
      lignes.forEach((l, i) => {
        const q = Object.assign({}, p, { runs: l.runs, r1: 0, md: -5, align: 'left', mg: Math.max(0, (l.g - zr.left) * PX), puce: i ? null : p.puce });
        if (p.puce && !i) { const pr = el.querySelector('.puce').getBoundingClientRect(); q.mg = Math.max(0, (Math.min(pr.left, l.g) - zr.left) * PX); }
        q.avant = i ? 0 : p.avant;
        // saut vertical (objet « haut et bas » entre deux lignes)
        const attendu = finPrec == null ? elr.top : finPrec;
        const saut = (l.haut - attendu) * PX;
        if (i && saut > 1.5) q.avant = saut;
        finPrec = l.bas;
        q.taquetsMM = l.taquets;
        res.push(q);
      });
    }
    if (res.length) res[res.length - 1].apres = basPrec; // l'espace après le dernier paragraphe compte pour un texte centré ou calé en bas
    return res;
  }

  function rapportLignes(el, p, z) {
    const g = document.createRange(), frags = [];
    const tous = p.runs.filter(r => r.genre === 't' && !r.s.decalage && r.texte.trim());
    for (const r of tous) {
      // polices de symboles : Word leur donne à peu près la hauteur de Times (mesuré), pas celle du navigateur
      const fam = famillePour(r.s.familles, r.texte.trim()[0]);
      const n = mesuresPolice(POLICE_SYMBOLE.test(fam) ? 'Times New Roman' : fam, r.s.gras, r.s.italique).ligne * r.s.taille;
      g.selectNodeContents(r.noeud);
      for (const b of g.getClientRects()) if (b.width > 0.5) frags.push({ c: (b.top + b.bottom) / 2, h: b.height, n });
    }
    if (!frags.length) return 0;
    frags.sort((a, b) => a.c - b.c);
    const lignes = [];
    for (const f of frags) { const l = lignes[lignes.length - 1]; if (l && f.c - l.c < 0.6 * Math.min(l.h, f.h)) l.n = Math.max(l.n, f.n); else lignes.push({ c: f.c, h: f.h, n: f.n }); }
    const naturelle = lignes.reduce((s, l) => s + l.n, 0);
    const rapport = el.getBoundingClientRect().height / naturelle;
    return rapport > 0.5 && rapport < 1.6 && !p.runs.some(r => r.genre === 'br') ? rapport : 0;
  }

  function paragrapheXML(p, ctx) {
    let v = '';
    if (p.puce) v += `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${C.liste(p.puce, ctx.liste)}"/></w:numPr>`;
    // taquets : ceux du paragraphe, puis le pas de la zone s'il n'est pas celui du document
    const taq = [];
    if (p.taquets) for (const t of String(p.taquets).split(/[;,](?=\s*\d)/)) { const pos = parseFloat(t); if (pos >= 0) taq.push([pos, { d: 'right', c: 'center', v: 'decimal' }[(/[dcv]$/.exec(t.trim()) || [''])[0]] || 'left']); }
    if (p.taquetsMM) for (const t of p.taquetsMM) taq.push([t + p.mg, 'left']);
    else if (ctx.pasTab && Math.abs(ctx.pasTab - C.pasTab) > 0.05 && p.runs.some(r => r.genre === 'tab' || (r.texte || '').includes('\t'))) {
      const max = taq.length ? Math.max(...taq.map(t => t[0])) : 0;
      for (let k = 1; k * ctx.pasTab < (ctx.largeur || 200); k++) if (k * ctx.pasTab > max) taq.push([k * ctx.pasTab, 'left']);
    }
    if (taq.length) v += `<w:tabs>${taq.sort((a, b) => a[0] - b[0]).slice(0, 60).map(([pos, t]) => `<w:tab w:val="${t}" w:pos="${tw(pos)}"/>`).join('')}</w:tabs>`;
    const avant = p.avant;
    let esp = `w:before="${Math.max(0, tw(avant))}" w:after="${tw(p.apres || 0)}"`;
    if (p.exact) esp += ` w:line="${Math.round(p.exact * 20)}" w:lineRule="exact"`;
    else esp += ` w:line="${Math.max(120, Math.round(240 * (p.ratio || 1)))}" w:lineRule="auto"`;
    v += `<w:spacing ${esp}/>`;
    v += `<w:ind w:left="${tw(p.mg)}" w:right="${tw(p.md)}"${p.r1 < 0 ? ` w:hanging="${tw(-p.r1)}"` : ` w:firstLine="${tw(p.r1)}"`}/>`;
    if (p.align !== 'left') v += `<w:jc w:val="${p.align}"/>`;
    const fin = p.runs.length ? p.sFin : p.sFin || p.dom;
    v += rPr(Object.assign({}, fin, { souligne: false, barre: false, fond: null }));
    return `<w:p><w:pPr>${v}</w:pPr>${contenuRuns(p.runs)}</w:p>`;
  }
  function texteXML(ps, ctx) {
    ctx = Object.assign({ liste: { n: null } }, ctx);
    let out = '';
    ps.forEach((p, i) => {
      if (!(p.puce && p.puce.num) && p.runs.some(r => (r.texte || '').trim())) ctx.liste.n = null; // la numérotation repart à 1
      out += paragrapheXML(p, Object.assign({}, ctx, { premier: i === 0 }));
    });
    return out || VIDE;
  }
  const VIDE = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>';

  /* ---------------- formes ---------------- */
  const couleurXML = (c, op) => {
    const k = lireCouleur(c) || { hex: '000000', a: 1 };
    const a = k.a * (op == null ? 1 : op);
    return `<a:srgbClr val="${k.hex}">${a < 0.999 ? `<a:alpha val="${Math.round(a * 100000)}"/>` : ''}</a:srgbClr>`;
  };
  async function fondXML(f) {
    if (!f) return '<a:noFill/>';
    const pts = Rendu.pointsMotif(f, E.fiche);
    if (pts) {
      // carreau de 8 × 8 points répété : les motifs propres à Word n'ont ni le même dessin ni la même taille
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d');
      g.fillStyle = f.fondMotif || '#ffffff'; g.fillRect(0, 0, 32, 32); g.fillStyle = f.couleur || '#000000'; g.scale(4, 4); g.fill(new Path2D(Rendu.cheminMotif(pts)));
      const id = await C.image('motif-' + pts + f.couleur + f.fondMotif, async () => ({ ext: 'png', octets: await octetsBlob(await toileVers(c)) }));
      return `<a:blipFill><a:blip r:embed="${id}"/><a:srcRect/><a:tile tx="0" ty="0" sx="25000" sy="25000" flip="none" algn="tl"/></a:blipFill>`;
    }
    if (f.image && E.fiche.images[f.image]) {
      const id = await C.imageDoc(f.image);
      if (id) return `<a:blipFill><a:blip r:embed="${id}"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`;
    }
    if (f.degrade) {
      const ang = ((90 - (f.angle || 0)) % 360 + 360) % 360;
      return `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0">${couleurXML(f.couleur, f.opacite)}</a:gs><a:gs pos="100000">${couleurXML(f.degrade, f.opacite)}</a:gs></a:gsLst><a:lin ang="${Math.round(ang * 60000)}" scaled="1"/></a:gradFill>`;
    }
    return f.couleur ? `<a:solidFill>${couleurXML(f.couleur, f.opacite)}</a:solidFill>` : '<a:noFill/>';
  }
  const TIRETS_WORD = { 1: [4, 3], 2: [1, 1], 3: [4, 1, 1, 1], 4: [4, 1, 1, 1, 1, 1], 5: [1, 1], 6: [3, 1], 7: [8, 3], 8: [8, 3, 1, 3], 9: [8, 3, 1, 3, 1, 3], 10: [3, 1] };
  function traitXML(t) {
    if (!t) return '<a:ln><a:noFill/></a:ln>';
    const d = TIRETS_WORD[t.tirets];
    let v = `<a:solidFill>${couleurXML(t.couleur)}</a:solidFill>`;
    if (d) { v += '<a:custDash>'; for (let i = 0; i < d.length; i += 2) v += `<a:ds d="${d[i] * 100000}" sp="${d[i + 1] * 100000}"/>`; v += '</a:custDash>'; }
    v += '<a:miter lim="800000"/>';
    if (t.flecheDebut) v += '<a:headEnd type="triangle" w="med" len="med"/>';
    if (t.flecheFin) v += '<a:tailEnd type="triangle" w="med" len="med"/>';
    return `<a:ln w="${Math.max(1800, Math.round((t.epaisseur || 0.75) * 12700))}" cap="flat">${v}</a:ln>`;
  }
  function effetsXML(o) {
    let v = '';
    if (o.ombre) {
      const { dx = 0, dy = 0, flou = 0 } = o.ombre, dist = Math.hypot(dx, dy), dir = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
      v += `<a:outerShdw blurRad="${emu(flou * 2)}" dist="${emu(dist)}" dir="${Math.round(dir * 60000)}" algn="ctr" rotWithShape="0">${couleurXML(o.ombre.couleur || 'rgba(0,0,0,.45)')}</a:outerShdw>`;
    }
    if (o.reflet) v += `<a:reflection blurRad="0" stA="${Math.round((o.reflet.opacite || 0.5) * 100000)}" endA="0" endPos="${(o.reflet.taille || 45) * 1000}" dist="${emu(o.reflet.ecart != null ? o.reflet.ecart : 0.5)}" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/>`;
    let r = v ? `<a:effectLst>${v}</a:effectLst>` : '';
    if (o.biseau) { const b = emu(o.biseau === 'marque' ? 1.6 : 0.9); r += `<a:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></a:scene3d><a:sp3d><a:bevelT w="${b}" h="${b}"/></a:sp3d>`; }
    if (o.extrusion || o.rot3d) C.remarque('les effets 3D (profondeur, rotation) ne sont pas repris');
    return r;
  }
  // géométrie : formes simples reconnues par Word (poignées d'ajustement), les autres en tracé libre
  function geometrieXML(o, retourner) {
    if (o.type === 'ligne') return '<a:prstGeom prst="line"><a:avLst/></a:prstGeom>';
    if (!o.forme || o.forme === 'rect' || o.type === 'image') return '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
    if (o.forme === 'ellipse') return '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>';
    if (o.forme === 'rectArrondi') return `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.round((o.ajust != null ? o.ajust : 3600) / 21600 * 100000)}"/></a:avLst></a:prstGeom>`;
    if (o.forme === 'losange') return '<a:prstGeom prst="diamond"><a:avLst/></a:prstGeom>';
    if (o.forme === 'secteur') {
      const [a, b] = anglesSecteur(o), bal = ((b - a) % 360 + 360) % 360 || 360;
      // angles Word : ceux du tracé ; sur une ellipse, l'angle visible dépend des deux rayons
      const vis = t => { const r = t * Math.PI / 180; return ((Math.atan2(o.h * Math.sin(r), o.w * Math.cos(r)) * 180 / Math.PI) + 360) % 360; };
      if (bal > 359.9) return '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>';
      return `<a:prstGeom prst="pie"><a:avLst><a:gd name="adj1" fmla="val ${Math.round(vis(a) * 60000)}"/><a:gd name="adj2" fmla="val ${Math.round(vis(b) * 60000)}"/></a:avLst></a:prstGeom>`;
    }
    const pt = (px, py) => `<a:pt x="${emu(retourner && o.miroirH ? o.w - px : px)}" y="${emu(retourner && o.miroirV ? o.h - py : py)}"/>`;
    let d = '';
    for (const s of segmentsTrace(Rendu.chemin(o))) {
      if (s[0] === 'M') d += `<a:moveTo>${pt(s[1], s[2])}</a:moveTo>`;
      else if (s[0] === 'L') d += `<a:lnTo>${pt(s[1], s[2])}</a:lnTo>`;
      else if (s[0] === 'C') d += `<a:cubicBezTo>${pt(s[1], s[2])}${pt(s[3], s[4])}${pt(s[5], s[6])}</a:cubicBezTo>`;
      else d += '<a:close/>';
    }
    if (!/^<a:moveTo>/.test(d)) d = `<a:moveTo>${pt(0, 0)}</a:moveTo>` + d;
    return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${Math.max(1, emu(o.w))}" h="${Math.max(1, emu(o.h))}">${d}</a:path></a:pathLst></a:custGeom>`;
  }

  /* ---------------- pièces (un objet Word posé sur la page) ---------------- */
  function xfrm(p, groupe) {
    const at = [];
    if (p.rot) at.push(`rot="${Math.round((((p.rot % 360) + 360) % 360) * 60000)}"`);
    if (p.mh) at.push('flipH="1"');
    if (p.mv) at.push('flipV="1"');
    return `<a:xfrm${at.length ? ' ' + at.join(' ') : ''}><a:off x="${groupe ? emu(p.x) : 0}" y="${groupe ? emu(p.y) : 0}"/><a:ext cx="${emu(p.w)}" cy="${emu(p.h)}"/></a:xfrm>`;
  }
  const props = (p, balise) => `<${balise} id="${p.no}" name="${x(p.nom)}"${p.alt ? ` descr="${x(p.alt)}"` : ''}/>`;
  function corpsPiece(p, groupe) {
    if (p.genre === 'image') {
      return `<pic:pic><pic:nvPicPr>${props(p, 'pic:cNvPr')}<pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${p.rid}"/>${p.rognage ? `<a:srcRect l="${p.rognage[3]}" t="${p.rognage[0]}" r="${p.rognage[1]}" b="${p.rognage[2]}"/>` : ''}<a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr>${xfrm(p, groupe)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${p.fond || ''}${p.trait || ''}${p.effets || ''}</pic:spPr></pic:pic>`;
    }
    const nv = p.ligne ? '<wps:cNvCnPr/>' : `<wps:cNvSpPr${p.texte != null ? ' txBox="1"' : ''}/>`;
    const tx = p.texte != null ? `<wps:txbx${p.chaine ? ` id="${p.chaine}"` : ''}><w:txbxContent>${p.texte}</w:txbxContent></wps:txbx>` : p.suite ? `<wps:linkedTxbx id="${p.suite[0]}" seq="${p.suite[1]}"/>` : '';
    const [mg, mh, md, mb] = p.marges || [0, 0, 0, 0];
    const bp = `<wps:bodyPr rot="0" vert="${p.vert || 'horz'}" wrap="square" lIns="${emu(mg)}" tIns="${emu(mh)}" rIns="${emu(Math.max(0, md - 0.3))}" bIns="${emu(mb)}" anchor="${{ milieu: 'ctr', bas: 'b' }[p.vertical] || 't'}" anchorCtr="0"${p.deformation ? ` fromWordArt="1"><a:prstTxWarp prst="textPlain"><a:avLst/></a:prstTxWarp>` : '>'}<a:noAutofit/></wps:bodyPr>`;
    return `<wps:wsp>${groupe ? props(p, 'wps:cNvPr') : ''}${nv}<wps:spPr>${xfrm(p, groupe)}${p.geo}${p.fond || '<a:noFill/>'}${p.trait || '<a:ln><a:noFill/></a:ln>'}${p.effets || ''}</wps:spPr>${tx}${bp}</wps:wsp>`;
  }
  function ancre(p, graphique, requiert) {
    const no = ++C.plan;
    const { x: px, y: py, w, h } = p; // position du cadre avant rotation, comme dans PageLibre (vérifié à 30, 60, 90 et 315°)
    const d = `<w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${1000 + no * 10}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>` +
      `<wp:positionH relativeFrom="page"><wp:posOffset>${emu(px)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${emu(py)}</wp:posOffset></wp:positionV>` +
      `<wp:extent cx="${emu(w)}" cy="${emu(h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>${props(p, 'wp:docPr')}<wp:cNvGraphicFramePr/>${graphique}</wp:anchor></w:drawing>`;
    return `<w:r>${requiert ? `<mc:AlternateContent><mc:Choice Requires="${requiert}">${d}</mc:Choice></mc:AlternateContent>` : d}</w:r>`;
  }
  function piecesXML(liste) {
    let out = '';
    for (let i = 0; i < liste.length;) {
      const p = liste[i];
      let j = i + 1;
      if (p.groupe) while (j < liste.length && liste[j].groupe === p.groupe) j++;
      const lot = liste.slice(i, j);
      if (lot.length > 1 && lot.every(q => !q.chaine && !q.suite)) {
        const x1 = Math.min(...lot.map(q => q.x)), y1 = Math.min(...lot.map(q => q.y)), x2 = Math.max(...lot.map(q => q.x + q.w)), y2 = Math.max(...lot.map(q => q.y + q.h));
        const g = { x: x1, y: y1, w: Math.max(x2 - x1, 0.1), h: Math.max(y2 - y1, 0.1), no: C.no(), nom: 'Groupe ' + C.id };
        out += ancre(g, `<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"><wpg:wgp><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(g.w)}" cy="${emu(g.h)}"/><a:chOff x="${emu(g.x)}" y="${emu(g.y)}"/><a:chExt cx="${emu(g.w)}" cy="${emu(g.h)}"/></a:xfrm></wpg:grpSpPr>${lot.map(q => corpsPiece(q, true)).join('')}</wpg:wgp></a:graphicData></a:graphic>`, 'wpg');
      } else {
        for (const q of lot) {
          const im = q.genre === 'image';
          out += ancre(q, `<a:graphic><a:graphicData uri="${im ? 'http://schemas.openxmlformats.org/drawingml/2006/picture' : 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'}">${corpsPiece(q, false)}</a:graphicData></a:graphic>`, im ? '' : 'wps');
        }
      }
      i = j;
    }
    return out;
  }

  /* ---------------- objets ---------------- */
  const NOMS = { texte: 'Zone de texte', forme: 'Forme', image: 'Image', ligne: 'Trait', tableau: 'Tableau', wordart: 'WordArt' };
  async function pieces(o, el) {
    const base = suf => ({ x: o.x, y: o.y, w: Math.max(o.w, 0), h: Math.max(o.h, 0), rot: o.rot || 0, groupe: o.groupe, no: C.no(), nom: (NOMS[o.type] || 'Objet') + ' ' + C.id + (suf || ''), alt: o.alt || '' });
    switch (o.type) {
      case 'image': return pieceImage(o, base);
      case 'ligne': return [Object.assign(base(), { ligne: true, mh: o.miroirH, mv: o.miroirV, geo: geometrieXML(o), trait: traitXML(o.trait), effets: effetsXML(o) })];
      case 'tableau': return [pieceTableau(o, el, base)];
      case 'wordart': return pieceWordart(o, el, base);
      default: return pieceTexte(o, el, base);
    }
  }
  async function pieceImage(o, base) {
    const src = o.image && E.fiche.images[o.image];
    if (!src || /^data:image\/x-/.test(src)) { if (src) C.remarque('certaines images EMF/WMF n’ont pas pu être reprises'); return []; }
    const rid = await C.imageDoc(o.image, o.filtres, o.w, o.h);
    if (!rid) return [];
    // rogné puis retourné : Word rogne avant de retourner, PageLibre après
    let r = o.rognage;
    if (r && o.miroirH) r = [r[0], r[3], r[2], r[1]];
    if (r && o.miroirV) r = [r[2], r[1], r[0], r[3]];
    return [Object.assign(base(), { genre: 'image', rid, mh: o.miroirH, mv: o.miroirV, rognage: r && r.some(v => v) ? r.map(v => Math.round(v * 100000)) : null,
      fond: o.fond && o.fond.couleur ? await fondXML({ couleur: o.fond.couleur }) : '<a:noFill/>', trait: o.trait ? traitXML(o.trait) : '', effets: effetsXML(o) })];
  }
  async function pieceTexte(o, el, base) {
    const out = [];
    const ct = el.querySelector(':scope > .cadre-texte > .contenu');
    const simple = !o.forme || o.forme === 'rect' || o.forme === 'ellipse' || o.forme === 'losange';
    const forme = async () => ({ geo: geometrieXML(o, !!ct), fond: await fondXML(o.fond), trait: traitXML(o.bordure ? null : o.trait), effets: effetsXML(o), mh: !ct && !simple && o.miroirH, mv: !ct && !simple && o.miroirV });
    const visible = o.fond || o.trait || o.type === 'forme';
    if (o.bordure) {
      if (o.fond) out.push(Object.assign(base(' (fond)'), await forme()));
      const svg = el.querySelector(':scope > .bordure-deco');
      const rid = await C.image('bordure-' + o.id, async () => ({ ext: 'png', octets: await octetsBlob(await toileVers(await toileSVG(svg, o.w, o.h, 300))) }));
      out.push(Object.assign(base(' (bordure)'), { genre: 'image', rid }));
      C.remarque('les bordures décoratives deviennent des images');
    }
    if (!ct) { if (!o.bordure) out.push(Object.assign(base(), await forme())); return out; }

    const m = o.marges || [2.54, 1.27, 2.54, 1.27], eb = o.bordure ? o.bordure.taille : o.trait && o.type === 'texte' ? (o.trait.epaisseur || 0) * Rendu.PT_MM : 0;
    const marges = m.map(v => v + eb);
    const z = parseFloat(ct.style.zoom) || 1;
    const vide = !ct.textContent.trim() && !ct.querySelector('img');
    const figer = !!(ct.querySelector('.habillage,.lettrine') || ct.dataset.exclusions);
    if (figer) C.remarque('le texte qui contourne un objet est coupé ligne par ligne');
    const lettrines = [];
    if (ct.querySelector('.lettrine')) {
      // la lettrine devient une petite zone de texte à part
      for (const l of ct.querySelectorAll('.lettrine')) {
        const r = l.getBoundingClientRect(), b = el.getBoundingClientRect(), s = styleTexte(l, z, ct);
        lettrines.push([l, { x: o.x + (r.left - b.left) * PX - 0.5, y: o.y + (r.top - b.top) * PX - 1, w: r.width * PX + 4, h: r.height * PX + 4 }, s]);
      }
      C.remarque('les lettrines deviennent des zones de texte');
    }
    const ps = lireZone(ct, z, figer);
    const rt = document.createRange();
    rt.selectNodeContents(ct);
    const rb = rt.getBoundingClientRect();
    const haut = (o.colonnes > 1 ? 0 : Math.max(rb.height, ct.scrollHeight * (ct.style.zoom ? z : 1))) * PX, dispo = o.h - marges[1] - marges[3];
    const ctx = { pasTab: o.tabulation || E.fiche.page.tabulation, largeur: o.w - marges[0] - marges[2] };
    const vert = o.sensTexte === 'haut-bas' ? 'vert' : o.sensTexte === 'bas-haut' ? 'vert270' : '';

    if (o.colonnes > 1 && !vert) {
      // colonnes : des zones de texte liées, le texte passe de l'une à l'autre
      if (visible && !o.bordure) out.push(Object.assign(base(' (fond)'), await forme()));
      const ec = o.espaceColonnes != null ? o.espaceColonnes : 5, lu = o.w - marges[0] - marges[2], lc = (lu - ec * (o.colonnes - 1)) / o.colonnes;
      const ch = ++C.chaine;
      for (let k = 0; k < o.colonnes; k++) {
        const q = Object.assign(base(' (colonne ' + (k + 1) + ')'), { x: o.x + marges[0] + k * (lc + ec), y: o.y + marges[1], w: lc, h: o.h - marges[1] - marges[3], rot: 0, geo: geometrieXML({ forme: 'rect' }), marges: [0, 0, 0, 0], vertical: 'haut' });
        if (o.rot) tourner(q, o);
        if (k) q.suite = [ch, k]; else { q.texte = texteXML(ps, Object.assign(ctx, { largeur: lc })); q.chaine = ch; }
        out.push(q);
      }
      return out;
    }
    // Word coupe ce qui dépasse d'une zone de texte : si le texte remplit le cadre, la zone est agrandie (elle est transparente)
    const serre = !vert && haut + 1.2 > dispo;
    if (visible && !o.bordure && (serre || (o.forme && o.forme !== 'rect' && !vide))) {
      out.push(Object.assign(base(vide ? '' : ' (fond)'), await forme()));
      if (vide && o.type === 'forme') return out;
      const t = Object.assign(base(), { geo: geometrieXML({ forme: 'rect' }), marges, vertical: o.vertical, vert, texte: texteXML(ps, ctx) });
      if (serre) agrandir(t, o, haut, dispo, marges);
      out.push(t);
    } else {
      const t = Object.assign(base(), o.bordure ? { geo: geometrieXML({ forme: 'rect' }) } : await forme(), { marges, vertical: o.vertical, vert, texte: texteXML(ps, ctx) });
      if (serre) agrandir(t, o, haut, dispo, marges);
      out.push(t);
    }
    for (const [l, r, s] of lettrines) {
      const t = Object.assign(base(' (lettrine)'), r, { rot: 0, geo: geometrieXML({ forme: 'rect' }), marges: [0.5, 1, 0, 0], texte: `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${Math.round(s.taille * 0.82 * 15)}" w:lineRule="exact"/></w:pPr>${run(l.textContent, s)}</w:p>` });
      if (o.rot) tourner(t, o);
      out.push(t);
    }
    return out;
  }
  function agrandir(t, o, haut, dispo, marges) {
    const plus = Math.max(0, haut - dispo) + 3;
    const v = o.vertical || 'haut';
    const dh = v === 'milieu' ? plus : 0, db = v === 'bas' ? plus : 0;
    if (o.rot) { t.marges = marges; } // tournée : le centre doit rester le même, on agrandit des deux côtés
    if (o.rot || v === 'milieu') { t.y -= plus; t.h += 2 * plus; if (v === 'haut') t.marges = [marges[0], marges[1] + plus, marges[2], marges[3]]; if (v === 'bas') t.marges = [marges[0], marges[1], marges[2], marges[3] + plus]; }
    else { t.y -= db; t.h += plus; void dh; }
  }
  // pièce dont la position est donnée dans le repère de l'objet non tourné
  function tourner(q, o) {
    const a = o.rot * Math.PI / 180, cx = o.x + o.w / 2, cy = o.y + o.h / 2, dx = q.x + q.w / 2 - cx, dy = q.y + q.h / 2 - cy;
    q.x = cx + dx * Math.cos(a) - dy * Math.sin(a) - q.w / 2;
    q.y = cy + dx * Math.sin(a) + dy * Math.cos(a) - q.h / 2;
    q.rot = o.rot;
  }

  async function pieceWordart(o, el, base) {
    const svg = el.querySelector(':scope > .svg-wordart');
    const rid = await C.image('wordart-' + o.id, async () => {
      // marge : les lettres dépassent un peu du cadre
      return { ext: 'png', octets: await octetsBlob(await toileVers(await toileElement(el, o.w, o.h, MARGE_WA, 300))) };
    });
    C.remarque('les textes WordArt deviennent des images');
    const p = Object.assign(base(), { genre: 'image', rid, alt: o.alt || (o.wordart && o.wordart.texte) || '' });
    p.x -= MARGE_WA; p.y -= MARGE_WA; p.w += 2 * MARGE_WA; p.h += 2 * MARGE_WA;
    return [p];
  }
  const MARGE_WA = 6;

  /* ---------------- tableaux ---------------- */
  function pieceTableau(o, el, base) {
    const T = o.tableau, table = el.querySelector(':scope > table.tab'), nl = T.lignes.length, nc = T.cols.length;
    const occupe = Array.from({ length: nl }, () => Array(nc).fill(null));
    T.cellules.forEach((c, i) => { for (let r = c.l; r < Math.min(c.l + c.nl, nl); r++) for (let k = c.c; k < Math.min(c.c + c.nc, nc); k++) occupe[r][k] = i; });
    const br = table.getBoundingClientRect();
    const total = T.cols.reduce((s, c) => s + c, 0) || 1, kl = br.width * PX / total;
    const larg = T.cols.map(c => c * kl);
    const hauts = [...table.rows].map(tr => tr.getBoundingClientRect().height * PX);
    const m = T.marges || [1, 1, 1, 1];
    const bord = (nom, b) => (b ? `<w:${nom} w:val="single" w:sz="${Math.max(2, Math.min(96, Math.round((b.e || 0.5) * 8)))}" w:space="0" w:color="${(lireCouleur(b.c) || { hex: '000000' }).hex}"/>` : `<w:${nom} w:val="nil"/>`);
    let lignes = '';
    for (let r = 0; r < nl; r++) {
      let cells = '';
      for (let k = 0; k < nc;) {
        const i = occupe[r][k], c = i == null ? null : T.cellules[i];
        const span = c ? Math.min(c.nc, nc - k) : 1;
        const w = larg.slice(k, k + span).reduce((s, v) => s + v, 0);
        const tete = c && c.l === r;
        let pr = `<w:tcW w:w="${tw(w)}" w:type="dxa"/>`;
        if (span > 1) pr += `<w:gridSpan w:val="${span}"/>`;
        if (c && c.nl > 1) pr += tete ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>';
        const b = c ? c.bords || {} : {};
        pr += `<w:tcBorders>${bord('top', b.h)}${bord('left', b.g)}${bord('bottom', b.b)}${bord('right', b.d)}`;
        if (c && c.diagonale) pr += bord(c.diagonale.sens === 'asc' ? 'tr2bl' : 'tl2br', { e: c.diagonale.e || 0.75, c: c.diagonale.c });
        pr += '</w:tcBorders>';
        const fond = c && (c.fond || T.fond), kf = fond && lireCouleur(fond);
        if (c && c.motif && /^[0-9a-f]{16}$/i.test(c.motif.points || '')) pr += shdMotif(c.motif);
        else if (kf) pr += `<w:shd w:val="clear" w:color="auto" w:fill="${kf.hex}"/>`;
        const mc = c ? c.marges || m : [0, 0, 0, 0];
        pr += `<w:tcMar><w:top w:w="${tw(mc[1])}" w:type="dxa"/><w:left w:w="${tw(mc[0])}" w:type="dxa"/><w:bottom w:w="${tw(mc[3])}" w:type="dxa"/><w:right w:w="${tw(Math.max(0, mc[2] - 0.3))}" w:type="dxa"/></w:tcMar>`;
        if (c && c.sensTexte) pr += `<w:textDirection w:val="${c.sensTexte === 'bas-haut' ? 'btLr' : 'tbRl'}"/>`;
        if (c && c.vertical) pr += `<w:vAlign w:val="${{ milieu: 'center', bas: 'bottom' }[c.vertical] || 'top'}"/>`;
        let texte = VIDE;
        if (tete) {
          const td = table.querySelector(`td[data-cellule="${i}"]`);
          texte = '';
          for (const ct of td.querySelectorAll(':scope > .contenu')) texte += texteXML(lireZone(ct, 1, false), { pasTab: E.fiche.page.tabulation, largeur: w });
        }
        cells += `<w:tc><w:tcPr>${pr}</w:tcPr>${texte}</w:tc>`;
        k += span;
      }
      // Word ajoute les marges haute et basse des cellules, et la bordure du haut, à la hauteur de ligne demandée
      let mhb = 0;
      let ep = 0;
      for (const i of new Set(occupe[r])) if (i != null) { const c = T.cellules[i], mc = c.marges || m; mhb = Math.max(mhb, mc[1] + mc[3]); if (c.l === r && c.bords && c.bords.h) ep = Math.max(ep, c.bords.h.e * Rendu.PT_MM); }
      mhb += ep;
      lignes += `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${Math.max(20, tw((hauts[r] != null ? hauts[r] : T.lignes[r]) - mhb))}" w:hRule="atLeast"/></w:trPr>${cells}</w:tr>`;
    }
    const tbl = `<w:tbl><w:tblPr><w:tblW w:w="${tw(larg.reduce((s, v) => s + v, 0))}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${larg.map(w => `<w:gridCol w:w="${tw(w)}"/>`).join('')}</w:tblGrid>${lignes}</w:tbl>`;
    // cadre un peu plus grand que le tableau, pour que les bordures extérieures ne soient pas coupées
    const M = 1, hT = Math.max(o.h, hauts.reduce((s, v) => s + v, 0)), ht = hT + 6;
    const p = Object.assign(base(), { geo: geometrieXML({ forme: 'rect' }), marges: [M, M, 0, 0], vertical: 'haut', texte: tbl + VIDE, effets: '' });
    p.x = o.x - M; p.y = o.y - M; p.w = br.width * PX + 2 * M; p.h = ht + M;
    if (o.rot) { // le centre de rotation reste celui du tableau
      const q = { x: p.x, y: p.y, w: p.w, h: p.h };
      tourner(q, o);
      Object.assign(p, q);
    }
    if (o.ombre || o.reflet || o.biseau) C.remarque('les effets (ombre, reflet, relief) des tableaux ne sont pas repris');
    return p;
  }
  function shdMotif(mo) {
    let n = 0;
    for (let k = 0; k < 16; k++) n += [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4][parseInt(mo.points[k], 16)];
    const nom = (MOTIFS.find(q => q.points.toLowerCase() === mo.points.toLowerCase()) || { nom: '' }).nom;
    let v = { 'Lignes horizontales': 'thinHorzStripe', 'Lignes horizontales serrées': 'thinHorzStripe', 'Lignes horizontales épaisses': 'horzStripe', 'Lignes horizontales fines': 'horzStripe',
      'Lignes verticales': 'thinVertStripe', 'Lignes verticales serrées': 'thinVertStripe', 'Lignes verticales épaisses': 'vertStripe', 'Lignes verticales fines': 'vertStripe',
      'Hachures montantes': 'thinDiagStripe', 'Hachures montantes serrées': 'thinDiagStripe', 'Hachures montantes épaisses': 'diagStripe', 'Hachures montantes larges': 'diagStripe',
      'Hachures descendantes': 'thinReverseDiagStripe', 'Hachures descendantes serrées': 'thinReverseDiagStripe', 'Hachures descendantes épaisses': 'reverseDiagStripe', 'Hachures descendantes larges': 'reverseDiagStripe',
      'Quadrillage': 'thinHorzCross', 'Quadrillage serré': 'thinHorzCross', 'Croisillons': 'thinDiagCross', 'Croisillons serrés': 'thinDiagCross' }[nom];
    if (!v) { const pc = n / 64 * 100; v = 'pct' + [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90].reduce((a, q) => (Math.abs(q - pc) < Math.abs(a - pc) ? q : a)); }
    return `<w:shd w:val="${v}" w:color="${(lireCouleur(mo.couleur || '#000000') || { hex: '000000' }).hex}" w:fill="${(lireCouleur(mo.fondMotif || '#ffffff') || { hex: 'FFFFFF' }).hex}"/>`;
  }

  /* ---------------- document ---------------- */
  function nouveauContexte() {
    const c = { id: 0, plan: 0, chaine: 0, medias: new Map(), fichiers: [], rels: [], listes: [], remarques: new Set(), nbListes: 0, pasTab: E.fiche.page.tabulation || 12.7 };
    c.no = () => ++c.id;
    c.remarque = t => c.remarques.add(t);
    c.rel = (type, cible, externe) => { const id = 'rId' + (c.rels.length + 10); c.rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${x(cible)}"${externe ? ' TargetMode="External"' : ''}/>`); return id; };
    const liens = new Map();
    c.lien = u => { if (!liens.has(u)) liens.set(u, c.rel('hyperlink', u, true)); return liens.get(u); };
    c.image = async (cle, fn) => {
      if (c.medias.has(cle)) return c.medias.get(cle);
      let id = null;
      try { const { ext, octets } = await fn(); const nom = `media/image${c.fichiers.length + 1}.${ext}`; c.fichiers.push(['word/' + nom, octets, true]); id = c.rel('image', nom); } catch (e) { console.warn('Image non reprise', cle, e); c.remarque('une image n’a pas pu être reprise'); }
      c.medias.set(cle, id);
      return id;
    };
    // image du document : reprise telle quelle (PNG, JPEG, GIF) ou convertie en PNG (autres formats, corrections de couleur)
    c.imageDoc = (cle, filtres, w, h) => {
      const url = E.fiche.images[cle], f = filtreCSSImage(filtres);
      return c.image(cle + '|' + f, async () => {
        const d = dataURLEnOctets(url), ext = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/gif': 'gif' }[d && d.type];
        if (ext && !f) return { ext, octets: d.octets };
        return { ext: 'png', octets: await octetsBlob(await toileVers(await toileImage(url, f, w || 100, h || 100))) };
      });
    };
    c.liste = (p, etat) => {
      if (p.num && etat.n) return etat.n;
      const s = p.s, f = famillePour(s.familles, p.texte), sym = POLICE_SYMBOLE.test(f);
      const t = p.num ? '%1.' : sym ? [...p.texte].map(ch => String.fromCharCode(ch.charCodeAt(0) < 0x100 ? ch.charCodeAt(0) + 0xf000 : ch.charCodeAt(0))).join('') : p.texte;
      const cle = p.num ? null : [t, f, s.taille, s.couleur, s.gras].join('|');
      const deja = cle && c.listes.find(l => l.cle === cle);
      if (deja) return deja.id;
      const l = { cle, id: ++c.nbListes, xml: `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${p.num ? 'decimal' : 'bullet'}"/><w:suff w:val="space"/><w:lvlText w:val="${x(t)}"/><w:lvlJc w:val="left"/>${rPr(s, { famille: f })}</w:lvl>` };
      c.listes.push(l);
      if (p.num) etat.n = l.id;
      return l.id;
    };
    return c;
  }

  async function fabriquer(indices) {
    const P = E.fiche.page;
    if (P.w > 558 || P.h > 558) throw new Error('Word n’accepte pas les pages de plus de 55,8 cm.');
    C = nouveauContexte();
    const tout = indices || E.fiche.pages.map((p, i) => i);
    let corps = '';
    for (let n = 0; n < tout.length; n++) {
      const page = E.fiche.pages[tout[n]];
      const z = await preparerPages([tout[n]], false);
      const f = z.querySelector(':scope > .feuille');
      // positions relevées sans rotation : c'est Word qui tourne l'objet
      $$('.objet', f).forEach(e => { e.style.transform = 'none'; });
      const m = page.maitre && E.fiche.maitres && E.fiche.maitres[page.maitre];
      const liste = [];
      if (P.fond && lireCouleur(P.fond) && lireCouleur(P.fond).hex !== 'FFFFFF') liste.push({ x: 0, y: 0, w: P.w, h: P.h, no: C.no(), nom: 'Fond de page', geo: geometrieXML({ forme: 'rect' }), fond: await fondXML({ couleur: P.fond }) });
      const voir = async (objs, calque) => {
        const els = [...calque.children];
        for (let k = 0; k < objs.length; k++) for (const q of await pieces(objs[k], els[k])) liste.push(q);
      };
      if (m && m.items.length) await voir(m.items, f.querySelector(':scope > .calque-maitre'));
      await voir(page.items, f.querySelector(':scope > .calque-objets'));
      corps += `<w:p><w:pPr>${n ? '<w:pageBreakBefore/>' : ''}<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>${piecesXML(liste)}</w:p>`;
      libererPages();
    }
    const mg = (P.marges || [12.7, 12.7, 12.7, 12.7]).map(v => Math.max(5, Math.min(v, 30)));
    const doc = `${XML}<w:document ${NS_DOC}><w:body>${corps}<w:sectPr><w:pgSz w:w="${tw(P.w)}" w:h="${tw(P.h)}"${P.w > P.h ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${tw(mg[0])}" w:right="${tw(mg[1])}" w:bottom="${tw(mg[2])}" w:left="${tw(mg[3])}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.';
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const rel = l => `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${l}</Relationships>`;
    const numerotation = `${XML}<w:numbering ${W}>${C.listes.map(l => `<w:abstractNum w:abstractNumId="${l.id}"><w:multiLevelType w:val="singleLevel"/>${l.xml}</w:abstractNum>`).join('')}${C.listes.map(l => `<w:num w:numId="${l.id}"><w:abstractNumId w:val="${l.id}"/></w:num>`).join('')}</w:numbering>`;
    const fichiers = [
      ['[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>` +
        `<Override PartName="/word/document.xml" ContentType="${CT}document.main+xml"/><Override PartName="/word/styles.xml" ContentType="${CT}styles+xml"/><Override PartName="/word/settings.xml" ContentType="${CT}settings+xml"/><Override PartName="/word/numbering.xml" ContentType="${CT}numbering+xml"/>` +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
      ['_rels/.rels', rel(`<Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>`)],
      ['docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(E.fiche.titre)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
      ['word/document.xml', doc],
      ['word/_rels/document.xml.rels', rel(`<Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${R}/settings" Target="settings.xml"/><Relationship Id="rId3" Type="${R}/numbering" Target="numbering.xml"/>${C.rels.join('')}`)],
      ['word/styles.xml', `${XML}<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:kern w:val="2"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="fr-FR" w:eastAsia="fr-FR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableauNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`],
      ['word/settings.xml', `${XML}<w:settings ${W}><w:defaultTabStop w:val="${tw(C.pasTab)}"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/><w:compatSetting w:name="doNotExpandShiftReturn" w:uri="http://schemas.microsoft.com/office/word" w:val="1"/></w:compat></w:settings>`],
      ['word/numbering.xml', numerotation],
      ...C.fichiers
    ];
    const blob = await fabriquerZip(fichiers, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return { blob, remarques: [...C.remarques] };
  }
  return { fabriquer, lireZone };
})();

async function exporterWord() {
  quitterEdition();
  fermerCoulisses();
  bandeau('Préparation du document Word…');
  try {
    const { blob, remarques } = await ExportDocx.fabriquer();
    telecharger(blob, nomPropose('docx'), blob.type);
    bandeau('Document Word téléchargé : « ' + nomPropose('docx') + ' ».' + (remarques.length ? ' À savoir : ' + remarques.join(' ; ') + '.' : ''));
  } catch (e) {
    console.error(e);
    libererPages();
    alerte('Export Word impossible : ' + e.message);
  }
}
