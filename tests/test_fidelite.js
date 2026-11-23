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

    /* ce qui vient d'un .pub survit aux fonctions : enregistrer, rouvrir, copier ailleurs, césure, exposant, tabulation */
    const s1 = await edge.eval(`(() => { const j = JSON.parse(jsonFiche()); return !!(j.images && j.images.mo) && !!E.fiche.images.mo; })()`);
    v(s1, 'hachures gardées à l\'enregistrement');
    const s2 = await edge.eval(`(() => { choisir(['sec']); copier(); E.modifie = false; chargerFiche(ficheVierge(210, 297, 'autre')); collerInterne(); const o = pageCourante().items[0]; return !!(o && o.fond && o.fond.motif && E.fiche.images[o.fond.motif]); })()`);
    v(s2, 'forme hachurée collée dans un autre document : le motif suit');
    const s3 = await edge.eval(`(() => { E.fiche.page.tabulation = 10; pageCourante().items.push({ id: 'tb2', type: 'tableau', x: 20, y: 120, w: 60, h: 10, cesure: true, tableau: { cols: [60], lignes: [10], marges: [1, 1, 1, 1], cellules: [{ l: 0, c: 0, nl: 1, nc: 1, html: '<p>a</p>' }] } },
      { id: 'tx2', type: 'texte', forme: 'rect', x: 20, y: 60, w: 100, h: 20, marges: [1, 1, 1, 1], html: '<p><span style="font-size:14pt">1</span><span style="font-size:9.1pt;vertical-align:0.68em;line-height:0">er</span></p>' }); afficherPage();
      choisir(['tb2']); basculerCesure(); const sans = !objetParId('tb2').cesure; basculerCesure(); const avec = !!objetParId('tb2').cesure;
      choisir(['tx2']); boiteTabulations(); const def = +document.querySelector('#bt-tab').value; document.querySelector('#bt-tab').value = '12.7'; document.querySelector('#boite [data-ok]').click(); const tab = objetParId('tx2').tabulation;
      entrerEdition(objetParId('tx2')); const z = elementObjet('tx2').querySelector('.contenu'), sp = z.querySelectorAll('span')[1], r = document.createRange(); r.selectNodeContents(sp); const se = getSelection(); se.removeAllRanges(); se.addRange(r); positionTexte('superscript'); const va = sp.style.verticalAlign, fs2 = sp.style.fontSize; quitterEdition();
      return { sans, avec, def, tab, va, fs2 }; })()`);
    v(s3.sans && s3.avec, 'bouton Césure actif sur un tableau');
    v(s3.def === 10 && s3.tab === 12.7, `tabulation : part de celle du document (${s3.def}), et 12,7 peut y être choisi (${s3.tab})`);
    v(s3.va === '' && s3.fs2 === '14pt', `Exposant retire un exposant venu d'un .pub (${s3.fs2})`);

    /* bouton Motif : formes, zones de texte, cellules ; annuler, enregistrer, rouvrir */
    await edge.eval(`E.modifie = false; chargerFiche(normaliserFiche({ titre: 'm', page: { w: 210, h: 297 }, pages: [{ id: 'p1', items: [
      { id: 'f1', type: 'forme', forme: 'rect', x: 20, y: 20, w: 40, h: 30, fond: { couleur: '#ffff00', opacite: 0.5 } },
      { id: 't1', type: 'tableau', x: 20, y: 70, w: 60, h: 20, tableau: { cols: [30, 30], lignes: [20], marges: [1, 1, 1, 1], cellules: [0, 1].map(i => ({ l: 0, c: i, nl: 1, nc: 1, html: '<p>a</p>' })) } }] }] }))`);
    await attendre(300);
    const m1 = await edge.eval(`(() => { choisir(['f1']); const b = document.querySelector('#ruban [data-cmd="motif"]'); commande('motif'); const n = document.querySelectorAll('#mo-grille [data-m]').length, uniq = new Set(MOTIFS.map(m => m.points)).size, vides = MOTIFS.filter(m => !/^[0-9a-f]{16}$/.test(m.points) || /^0+$|^f+$/.test(m.points)).map(m => m.nom);
      document.querySelector('#mo-grille [data-m="1"]').click(); document.querySelector('#mo-1').value = '#ff0000'; document.querySelector('#boite [data-ok]').click(); const o = objetParId('f1'), p = elementObjet('f1').querySelector('pattern path');
      return { bouton: !!b, n, uniq, total: MOTIFS.length, vides, fond: o.fond, rouge: p && p.getAttribute('fill') }; })()`);
    v(m1.bouton && m1.n === m1.total && m1.uniq === m1.total && !m1.vides.length, `bouton Motif : ${m1.n} motifs, tous différents ${m1.vides.join()}`);
    v(m1.rouge === '#ff0000' && m1.fond.opacite === 0.5, 'motif posé sur la forme, couleur choisie, transparence gardée');
    await edge.capture(path.join(require('os').tmpdir(), 'motif-forme.png'));
    const m2 = await edge.eval(`(() => { const r = {}; annuler(); r.annule = !objetParId('f1').fond.points; refaire(); r.refait = !!objetParId('f1').fond.points;
      choisir(['t1']); entrerEdition(objetParId('t1')); E.celluleActive = 1; commande('motifCellules'); document.querySelector('#mo-grille [data-m="20"]').click(); document.querySelector('#boite [data-ok]').click(); const c = objetParId('t1').tableau.cellules; r.cel = !!(c[1].motif && !c[0].motif); r.css = getComputedStyle(elementObjet('t1').querySelectorAll('td')[1]).backgroundImage.startsWith('url("data:image/svg');
      const j = JSON.parse(jsonFiche()); E.modifie = false; chargerFiche(normaliserFiche(j)); r.rouvert = !!objetParId('f1').fond.points && !!objetParId('t1').tableau.cellules[1].motif && !!elementObjet('f1').querySelector('pattern path');
      choisir(['f1']); commande('motif'); document.querySelector('#mo-aucun').checked = true; document.querySelector('#boite [data-ok]').click(); r.retire = !objetParId('f1').fond.points && !elementObjet('f1').querySelector('pattern'); return r; })()`);
    v(m2.annule && m2.refait, 'motif : annuler et rétablir');
    v(m2.cel && m2.css, 'motif sur une seule cellule de tableau');
    v(m2.rouvert, 'motifs gardés après enregistrement et réouverture');
    v(m2.retire, 'motif retiré');

    /* petites capitales, secteur, bordure décorative, groupe retourné, retrait de bordure */
    await edge.eval(`E.modifie = false; chargerFiche(normaliserFiche({ titre: 'x', page: { w: 210, h: 297 }, pages: [{ id: 'p1', items: [
      { id: 's1', type: 'forme', forme: 'secteur', x: 20, y: 20, w: 40, h: 40, angles: [0, 90], fond: { couleur: '#ff0000' } },
      { id: 'b1', type: 'texte', forme: 'rect', x: 20, y: 80, w: 80, h: 40, marges: [1, 1, 1, 1], trait: { couleur: '#000000', epaisseur: 2 }, html: '<p><span style="font-size:14pt">Bonjour tout le monde</span></p>' },
      { id: 'g1', type: 'forme', forme: 'triangle', x: 120, y: 20, w: 10, h: 10, rot: 30, groupe: 'g', fond: { couleur: '#00ff00' } },
      { id: 'g2', type: 'forme', forme: 'rect', x: 150, y: 40, w: 20, h: 10, groupe: 'g', fond: { couleur: '#0000ff' } }] }] }))`);
    await attendre(300);
    const n1 = await edge.eval(`(() => { const r = {}; choisir(['s1']); r.d = elementObjet('s1').querySelector('path').getAttribute('d'); r.poignees = document.querySelectorAll('.p-angle').length; commande('anglesSecteur'); document.querySelector('#se-a').value = '0'; document.querySelector('#se-p').value = '75'; document.querySelector('#boite [data-ok]').click(); r.angles = objetParId('s1').angles.join();
      const p = document.querySelector('.p-angle[data-poignee="angle1"]').getBoundingClientRect(); r.x = p.left + p.width / 2; r.y = p.top + p.height / 2; const f = elementObjet('s1').getBoundingClientRect(); r.cx = f.left + f.width / 2; r.bas = f.bottom; return r; })()`);
    v(/^M20 20L40 20A20 20 0 0 1 20 40Z$/.test(n1.d) && n1.poignees === 2 && n1.angles === '0,270', `secteur : tracé, 2 poignées, boîte des angles (${n1.angles})`);
    await edge.glisser(n1.x, n1.y, n1.cx, n1.bas + 20);
    const n2 = await edge.eval(`({ a: objetParId('s1').angles.join(), apresAnnul: (annuler(), objetParId('s1').angles.join()) })`);
    v(n2.a === '0,90' && n2.apresAnnul === '0,270', `secteur : poignée jaune tirée (${n2.a}), annulable (${n2.apresAnnul})`);
    const n3 = await edge.eval(`(() => { const r = {}; r.pad = parseFloat(getComputedStyle(elementObjet('b1').querySelector('.cadre-texte')).paddingLeft) / (96 / 25.4); choisir(['b1']); commande('petitesCapitales'); r.pc = /small-caps/.test(objetParId('b1').html) && /small-caps/.test(elementObjet('b1').querySelector('.contenu').innerHTML); commande('petitesCapitales'); r.pc2 = /small-caps/.test(elementObjet('b1').querySelector('.contenu').innerHTML);
      choisir(['b1']); commande('bordureDeco'); r.n = document.querySelectorAll('#bd-grille [data-b]').length; document.querySelector('#bd-grille [data-b="b4"]').click(); document.querySelector('#bd-c').value = '#bf9000'; document.querySelector('#bd-e').value = '12'; document.querySelector('#boite [data-ok]').click(); r.img = elementObjet('b1').querySelectorAll('.bordure-deco image').length; r.pad2 = parseFloat(getComputedStyle(elementObjet('b1').querySelector('.cadre-texte')).paddingLeft) / (96 / 25.4);
      document.querySelector('#boite').hidden || fermerBoite(); choisir(['b1']); commande('bordureDeco'); r.coul = document.querySelector('#bd-c').value; r.ep = +document.querySelector('#bd-e').value; fermerBoite(); const j = JSON.parse(jsonFiche()); r.sauve = Object.keys(j.images).filter(k => /^bd-/.test(k)).length; E.modifie = false; chargerFiche(normaliserFiche(j)); r.rouvert = elementObjet('b1').querySelectorAll('.bordure-deco image').length; return r; })()`);
    v(Math.abs(n3.pad - 1.71) < 0.05, `texte en retrait de la bordure (${n3.pad.toFixed(2)} mm, attendu 1,71)`);
    v(n3.pc && !n3.pc2, 'petites capitales : posées, puis retirées');
    v(n3.n === 12 && n3.img > 40 && Math.abs(n3.pad2 - 5.23) < 0.1 && n3.sauve === 8 && n3.rouvert === n3.img, `bordure décorative : ${n3.img} dessins, gardée après réouverture`);
    v(n3.coul === '#bf9000' && n3.ep === 12, 'bordure décorative : la boîte reprend sa couleur et son épaisseur');
    const n4 = await edge.eval(`(() => { choisir(['g1', 'g2']); retourner('h'); const a = objetParId('g1'), b = objetParId('g2'); const r = [a.x > b.x, a.rot, !!a.miroirH, !!b.miroirH]; retourner('h'); r.push(Math.abs(objetParId('g1').x - 120) < 0.05, objetParId('g1').rot); return r; })()`);
    v(n4[0] && n4[1] === 330 && n4[2] && n4[3] && n4[4] && n4[5] === 30, 'groupe retourné d\'un bloc, deux fois = retour au départ');

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
