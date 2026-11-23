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

    /* page entière */
    await edge.eval(`zoomPage()`);
    await attendre(300);
    const z = await edge.eval(`(() => { const d = document.querySelector('#defile').getBoundingClientRect(), f = E.feuille.getBoundingClientRect(); return { haut: Math.round(f.top - d.top), bas: Math.round(d.bottom - f.bottom) }; })()`);
    v(z.haut >= 0 && z.bas >= 0, `page entière : toute la page est visible (marge haute ${z.haut} px, basse ${z.bas} px)`);

    const erreurs = edge.consoleMsgs.filter(m => /EXCEPTION|TypeError|ReferenceError/i.test(m));
    v(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) { ko++; console.log('ERREUR', e.message); }
  finally { await edge.fermer(); }
  console.log(ko ? `\n${ko} échec(s)` : '\ntout est bon');
  process.exit(ko ? 1 : 0);
})();
