// Fidélité de l'affichage des anciennes fiches (défauts relevés sur une fiche de statistique, nov. 2026) :
// node tests/test_fidelite.js
// - traits horizontaux et verticaux (hauteur ou largeur nulle) : visibles ;
// - équations (image WMF sans en-tête de taille) : dessinées aux proportions du cadre, « 150 » entier, Σ de la police Symbol ;
// - « page entière » : toute la page tient dans la zone de travail.
'use strict';
const path = require('path');
const { lancer, attendre } = require('./cdp');
const URL_EDITEUR = 'file:///' + path.resolve(__dirname, '..', 'docs', 'index.html').replace(/\\/g, '/');

// petite image WMF comme celles de l'éditeur d'équations : pas d'en-tête de taille, dessin de 3 200 × 1 088 unités
function wmfEquation() {
  const recs = [];
  const rec = (fn, mots) => { const b = Buffer.alloc(6 + mots.length); b.writeUInt32LE((6 + mots.length) / 2, 0); b.writeUInt16LE(fn, 4); mots.copy(b, 6); recs.push(b); };
  const i16 = (...v) => { const b = Buffer.alloc(v.length * 2); v.forEach((x, i) => b.writeInt16LE(x, i * 2)); return b; };
  const police = (h, nom) => { const b = Buffer.alloc(50); b.writeInt16LE(h, 0); b.writeInt16LE(400, 8); b.write(nom, 18, 'latin1'); return b; };
  rec(0x012E, i16(24, 0));            // SetTextAlign : ligne de base
  rec(0x020B, i16(0, 0));             // SetWindowOrg
  rec(0x020C, i16(1088, 3200));       // SetWindowExt (y, x)
  rec(0x02FB, police(-384, 'Times New Roman'));
  rec(0x012D, i16(0));
  rec(0x0A32, Buffer.concat([i16(1011, 2541, 3, 0), Buffer.from('150\0', 'latin1'), i16(192, 192, 192)]));
  rec(0x02FB, police(-576, 'Symbol'));
  rec(0x012D, i16(1));
  rec(0x0A32, Buffer.concat([i16(497, 699, 1, 0), Buffer.from([0xE5, 0])]));
  rec(0x0000, Buffer.alloc(0));
  const corps = Buffer.concat(recs);
  const tete = Buffer.alloc(18);
  tete.writeUInt16LE(1, 0); tete.writeUInt16LE(9, 2); tete.writeUInt16LE(0x0300, 4);
  tete.writeUInt32LE((18 + corps.length) / 2, 6); tete.writeUInt16LE(2, 10); tete.writeUInt32LE(28, 12);
  return 'data:image/x-wmf;base64,' + Buffer.concat([tete, corps]).toString('base64');
}

(async () => {
  const edge = await lancer({ largeur: 1300, hauteur: 800 });
  let ko = 0;
  const v = (c, m) => { console.log(c ? '  ok  ' : '  ÉCHEC', m); if (!c) ko++; };
  try {
    await edge.ouvrir(URL_EDITEUR);
    await attendre(600);

    /* traits de hauteur ou de largeur nulle */
    await edge.eval(`E.modifie = false; chargerFiche(normaliserFiche({ titre: 'traits', page: { w: 210, h: 297 }, pages: [{ id: 'p1', items: [
      { id: 'h', type: 'ligne', forme: 'ligne', x: 20, y: 50, w: 150, h: 0, trait: { couleur: '#000000', epaisseur: 0.75, flecheFin: 1 } },
      { id: 'v', type: 'ligne', forme: 'ligne', x: 40, y: 60, w: 0, h: 20, trait: { couleur: '#000000', epaisseur: 2 } },
      { id: 'p', type: 'ligne', forme: 'ligne', x: 20, y: 90, w: 150, h: 0, trait: { couleur: '#000000', epaisseur: 0.5, tirets: 6 } }] }] }))`);
    await attendre(400);
    const traits = await edge.eval(`['h', 'v', 'p'].map(id => { const r = elementObjet(id).querySelector('line').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })`);
    v(traits[0][0] > 200 && traits[1][1] > 30 && traits[2][0] > 200, `traits horizontal, vertical et pointillé visibles (${JSON.stringify(traits)} px)`);
    const pix = await edge.eval(`(async () => {
      const f = await pageEnPNG(E.feuille, 96); const im = await createImageBitmap(f);
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const ligne = y => { const d = g.getImageData(0, Math.round(y / 25.4 * 96), c.width, 1).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++; return n; };
      return [ligne(50), ligne(90)]; })()`);
    v(pix[0] > 300 && pix[1] > 100, `les traits sont aussi dans l'export en image (${pix[0]} et ${pix[1]} points noirs)`);

    /* équation WMF */
    const r = await edge.eval(`(async () => {
      const png = await LecteurMeta.versPNG(${JSON.stringify(wmfEquation())}, { w: 58.12, h: 16.72 });
      const im = new Image(); im.src = png; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      // zone du « 50 » de 150 : entre 85 % et 97 % de la largeur
      let droite = 0, gauche = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const a = d[(y * c.width + x) * 4 + 3]; if (a > 128) { if (x > c.width * 0.85 && x < c.width * 0.97) droite++; if (x < c.width * 0.35) gauche++; } }
      return { w: c.width, h: c.height, droite, gauche };
    })()`);
    v(Math.abs(r.w / r.h - 58.12 / 16.72) < 0.05, `équation dessinée aux proportions de son cadre (${r.w} × ${r.h})`);
    v(r.droite > 500, `« 150 » entier, non coupé au bord (${r.droite} points dans la zone du « 50 »)`);
    v(r.gauche > 500, `Σ (police Symbol) dessiné (${r.gauche} points)`);

    /* secteur (arc), motif, ombre, tabulation du document, tableau (hauteur de ligne, milieu, marges), césure */
    await edge.eval(`E.modifie = false; chargerFiche(normaliserFiche({ titre: 'formes', page: { w: 210, h: 297, tabulation: 10 },
      images: { mo: 'data:image/bmp;base64,' + btoa(String.fromCharCode(0x42,0x4d,0x5e,0,0,0,0,0,0,0,0x3e,0,0,0,0x28,0,0,0,8,0,0,0,8,0,0,0,1,0,1,0,0,0,0,0,32,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,0,0x80,0,0,0,0x40,0,0,0,0x20,0,0,0,0x10,0,0,0,8,0,0,0,4,0,0,0,2,0,0,0,1,0,0,0)) },
      pages: [{ id: 'p1', items: [
      { id: 'sec', type: 'forme', forme: 'libre', x: 20, y: 20, w: 40, h: 40, fond: { couleur: '#000000', motif: 'mo', fondMotif: '#ffffff' }, trait: { couleur: '#000000', epaisseur: 1 }, ombre: { dx: 1.41, dy: 1.41, flou: 0, couleur: '#808080' },
        geometrie: { pts: [[0, 0], [21600, 21600], [10800, 21600], [21600, 10800], [10800, 10800]], segs: [41732, 1, 24577, 32768], cadre: [0, 0, 21600, 21600] } },
      { id: 'tx', type: 'texte', forme: 'rect', x: 20, y: 80, w: 160, h: 20, marges: [1, 1, 1, 1], html: '<p style="line-height:1.059;font-family:Times New Roman;font-size:14pt"><span style="font-family:Times New Roman;font-size:14pt">	<b id="x">Mot</b></span></p>' },
      { id: 'tab', type: 'tableau', x: 20, y: 120, w: 60, h: 11.92, tableau: { cols: [30, 30], lignes: [5.96, 5.96], marges: [1.02, 1.02, 1.02, 1.02], cellules: [0, 1, 2, 3].map(i => ({ l: i >> 1, c: i & 1, nl: 1, nc: 1, vertical: 'milieu', html: '<p style="line-height:1.059;font-family:Times New Roman;font-size:10pt"><span style="font-family:Times New Roman;font-size:10pt">294</span></p>', bords: { h: { c: '#000000', e: 0.75 }, b: { c: '#000000', e: 0.75 }, g: { c: '#000000', e: 0.75 }, d: { c: '#000000', e: 0.75 } } })) } }
      ] }] }))`);
    await attendre(500);
    const fo = await edge.eval(`(() => { const k = 96 / 25.4 * E.zoom, s = elementObjet('sec'), p = s.querySelector('svg > g > path'); const tx = elementObjet('tx'), b = tx.querySelector('b').getBoundingClientRect(), c = tx.querySelector('.contenu').getBoundingClientRect();
      return { d: p.getAttribute('d'), motif: s.querySelectorAll('pattern path').length, fill: p.getAttribute('fill'), ombre: s.style.filter, tab: +((b.left - c.left) / k).toFixed(1), ligne: +(elementObjet('tab').querySelector('tr').getBoundingClientRect().height / k).toFixed(2), va: getComputedStyle(elementObjet('tab').querySelector('td')).verticalAlign }; })()`);
    v(/A/.test(fo.d) && /L/.test(fo.d) && /Z/.test(fo.d), 'secteur : arc, rayon et fermeture (' + fo.d.slice(0, 60) + ')');
    v(fo.motif === 1 && /url/.test(fo.fill), 'remplissage à motif (hachures) recoloré');
    v(/drop-shadow/.test(fo.ombre), 'ombre portée');
    v(Math.abs(fo.tab - 10) < 0.3, `tabulation par défaut du document : ${fo.tab} mm (attendu 10)`);
    v(Math.abs(fo.ligne - 5.96) < 0.15 && fo.va === 'middle', `ligne de tableau à sa hauteur : ${fo.ligne} mm (attendu 5,96), texte au milieu`);
    v(await edge.eval(`Rendu.coupuresMot('indicateurs').length > 0`), 'césure disponible');

    /* page entière */
    await edge.eval(`zoomPage()`);
    await attendre(300);
    const z = await edge.eval(`(() => { const d = document.querySelector('#defile').getBoundingClientRect(), f = E.feuille.getBoundingClientRect(); return { haut: Math.round(f.top - d.top), bas: Math.round(d.bottom - f.bottom) }; })()`);
    v(z.haut >= 0 && z.bas >= 0, `page entière : toute la page est visible (marge haute ${z.haut} px, basse ${z.bas} px)`);

    /* vignettes : aperçu entier, avec une vraie barre de défilement (ce que les autres tests ne voient pas) */
    const edge2 = await lancer({ largeur: 1300, hauteur: 800, barres: true });
    try {
      await edge2.ouvrir(URL_EDITEUR);
      await attendre(800);
      await edge2.eval(`E.modifie = false; chargerFiche(normaliserFiche({ titre: 'v', page: { w: 210, h: 297 }, pages: Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, items: [] })) }))`);
      await attendre(600);
      const vg = await edge2.eval(`(() => { const l = document.querySelector('#liste-pages'), m = l.querySelector('.mini'), f = m.querySelector('.feuille').getBoundingClientRect(), r = m.getBoundingClientRect(), L = l.getBoundingClientRect();
        return { barre: l.offsetWidth - l.clientWidth, depasse: +(f.right - r.right).toFixed(1), ratio: +(r.width / r.height).toFixed(3), dansListe: r.right <= L.left + l.clientWidth + 0.5 }; })()`);
      v(vg.barre > 0 && vg.depasse <= 0.5 && Math.abs(vg.ratio - 210 / 297) < 0.01 && vg.dansListe, `vignette entière avec une barre de défilement de ${vg.barre} px (dépassement ${vg.depasse} px, proportions ${vg.ratio})`);
    } finally { await edge2.fermer(); }

    const erreurs = edge.consoleMsgs.filter(m => /EXCEPTION|TypeError|ReferenceError/i.test(m));
    v(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) { ko++; console.log('ERREUR', e.message); }
  finally { await edge.fermer(); }
  console.log(ko ? `\n${ko} échec(s)` : '\ntout est bon');
  process.exit(ko ? 1 : 0);
})();
