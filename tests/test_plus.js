// Mise en page de la fenêtre et fonctions avancées : node tests/test_plus.js <trame.pub> <dossier captures>
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer, attendre } = require('./cdp');

const [fichier, dossier] = process.argv.slice(2);
const URL_EDITEUR = 'file:///' + path.resolve(__dirname, '..', 'docs', 'index.html').replace(/\\/g, '/');
let ok = 0, ko = 0;
function verifier(c, m) { if (c) { ok++; console.log('  ok  ', m); } else { ko++; console.log('  ÉCHEC', m); } }

(async () => {
  fs.mkdirSync(dossier, { recursive: true });
  // fenêtre basse, comme un écran de portable
  const edge = await lancer({ largeur: 1400, hauteur: 700 });
  const cap = n => edge.capture(path.join(dossier, n + '.png'));
  try {
    await edge.ouvrir(URL_EDITEUR);
    await attendre(400);
    const b64 = fs.readFileSync(fichier).toString('base64');
    await edge.eval(`(() => { const b = atob(${JSON.stringify(b64)}); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      ouvrirFichier(new File([u], ${JSON.stringify(path.basename(fichier))})); })()`);
    await attendre(1500);

    /* --- fenêtre : pas de débordement, défilement, page stable --- */
    const geo = await edge.eval(`(() => { const z = document.querySelector('#zone').getBoundingClientRect(), e = document.querySelector('#etat').getBoundingClientRect();
      return { zoneBas: z.bottom, etatHaut: e.top, hauteurFenetre: innerHeight, bas: document.querySelector('#app').getBoundingClientRect().bottom }; })()`);
    verifier(geo.zoneBas <= geo.etatHaut + 1 && geo.bas <= geo.hauteurFenetre + 1, `la zone de travail ne recouvre pas la barre d'état (${Math.round(geo.zoneBas)} ≤ ${Math.round(geo.etatHaut)})`);
    await edge.eval(`definirZoom(1.5)`);
    await attendre(100);
    const def = await edge.eval(`(() => { const d = document.querySelector('#defile'); return { sh: d.scrollHeight, ch: d.clientHeight }; })()`);
    verifier(def.sh > def.ch + 50, `la zone défile quand la page est plus grande (${def.sh} > ${def.ch})`);
    await edge.eval(`zoomPage()`);
    const oy = [];
    for (let i = 0; i < 5; i++) { await edge.eval(`allerPage(${i % 3})`); await attendre(60); oy.push(await edge.eval(`Math.round(E.oy)`)); }
    verifier(new Set(oy).size <= 2 && Math.abs(oy[0] - oy[4]) <= 1, `la page ne glisse plus en changeant de page (${oy.join(', ')})`);
    await cap('01-fenetre-basse');

    /* --- rognage à la souris --- */
    await edge.eval(`allerPage(0)`);
    const img = await edge.eval(`(() => { const o = pageCourante().items.find(x => x.type === 'image' && x.w > 20 && !x.rot); choisir([o.id]); basculerRognage();
      const h = document.querySelector('.poignee-rog.r-e').getBoundingClientRect(); return { id: o.id, w: o.w, x: h.left + h.width / 2, y: h.top + h.height / 2 }; })()`);
    await edge.glisser(img.x, img.y, img.x - 25, img.y);
    const rog = await edge.eval(`(() => { const o = objetParId(${JSON.stringify(img.id)}); return { w: o.w, r: o.rognage }; })()`);
    verifier(rog.w < img.w && rog.r && rog.r[1] > 0, `rognage à la souris (largeur ${img.w} → ${rog.w}, rognage droit ${rog.r && rog.r[1]})`);
    await cap('02-rognage');
    await edge.touche('Escape');
    verifier(await edge.eval(`!E.rognage`), 'Échap termine le rognage');

    /* --- guides de règle --- */
    const r = await edge.eval(`(() => { const r = document.querySelector('#regle-h').getBoundingClientRect(), f = E.feuille.getBoundingClientRect(); return { x: f.left + 100, y: r.top + 10, y2: f.top + 120 }; })()`);
    await edge.glisser(r.x, r.y, r.x, r.y2);
    verifier(await edge.eval(`(E.fiche.page.guides || []).length === 1 && E.fiche.page.guides[0].sens === 'h'`), 'guide tiré depuis la règle');

    /* --- cadres chaînés --- */
    await edge.eval(`(() => {
      const long = Array.from({ length: 30 }, (_, i) => '<p><span style="font-family:Calibri;font-size:11pt">Ligne ' + (i + 1) + ' du texte qui doit continuer dans le cadre suivant.</span></p>').join('');
      const a = { id: 'tA', type: 'texte', forme: 'rect', x: 20, y: 20, w: 60, h: 30, marges: [1, 1, 1, 1], html: long };
      const b = { id: 'tB', type: 'texte', forme: 'rect', x: 100, y: 20, w: 60, h: 60, marges: [1, 1, 1, 1], html: '' };
      pageCourante().items.push(a, b); redessinerObjet(a); redessinerObjet(b);
      choisir(['tA']); creerLien(); terminerLien(b);
    })()`);
    const ch = await edge.eval(`(() => { const a = objetParId('tA'), b = objetParId('tB'); const t = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
      return { a: t(a.html).length, b: t(b.html).length, total: t(a.htmlComplet).length, lie: a.suivant === 'tB' }; })()`);
    verifier(ch.lie && ch.a > 0 && ch.b > 0 && Math.abs(ch.a + ch.b - ch.total) <= 2, `le texte continue dans le cadre suivant (${ch.a} + ${ch.b} / ${ch.total} caractères)`);
    await cap('03-chainage');

    /* --- page maître et numéros de page --- */
    await edge.eval(`numerosDePage('bas-centre')`);
    const num = await edge.eval(`(() => { allerPage(1); const s = E.feuille.querySelector('.calque-maitre .champ-page'); return s ? s.textContent : null; })()`);
    verifier(num === '2', `numéro de page affiché sur la page 2 (« ${num} »)`);
    await edge.eval(`entrerModeMaitre()`);
    verifier(await edge.eval(`!!E.modeMaitre && document.querySelector('.onglet[data-onglet="maitre"]') !== null`), 'mode page maître ouvert');
    await cap('04-page-maitre');
    await edge.eval(`quitterModeMaitre()`);
    verifier(await edge.eval(`!E.modeMaitre && E.fiche.pages.length === 6`), 'retour aux pages');

    /* --- rechercher / remplacer --- */
    await edge.eval(`allerPage(0); panneauRecherche(true); document.querySelector('#rr-quoi').value = 'cadre suivant'; document.querySelector('#rr-par').value = 'cadre d\\'à côté'; actionRecherche('tout')`);
    const rr = await edge.eval(`document.querySelector('#rr-etat').textContent`);
    verifier(/30 remplacement/.test(rr), `remplacer tout (${rr})`);
    await edge.eval(`document.querySelector('#panneau-recherche').hidden = true`);

    /* --- styles, lettrine, colonnes, effets, habillage --- */
    await edge.eval(`choisir(['tA']); appliquerStyle(STYLES_BASE[1])`);
    verifier(await edge.eval(`objetParId('tA').htmlComplet.includes('Calibri Light') || objetParId('tA').html.includes('Calibri Light')`), 'style « Titre 1 » appliqué');
    await edge.eval(`choisir(['tB']); colonnes(2); surObjetsFormes(o => { o.ombre = copie(OMBRES.douce); }, () => true)`);
    verifier(await edge.eval(`(() => { const el = elementObjet('tB'); return el.querySelector('.contenu').style.columnCount === '2' && el.style.filter.includes('drop-shadow'); })()`), 'deux colonnes et ombre douce');
    await edge.eval(`(() => { const o = { id: 'tC', type: 'texte', forme: 'rect', x: 20, y: 120, w: 90, h: 50, marges: [1, 1, 1, 1], html: Array(12).fill('<p><span style="font-family:Calibri;font-size:11pt">Texte qui contourne la forme posée dessus.</span></p>').join('') };
      const f = { id: 'fC', type: 'forme', forme: 'ellipse', x: 30, y: 130, w: 25, h: 20, fond: { couleur: '#ffc000' }, habillage: 'carre' };
      pageCourante().items.push(o, f); redessinerObjet(o); redessinerObjet(f); apres(); })()`);
    verifier(await edge.eval(`!!elementObjet('tC').querySelector('.habillage')`), 'habillage : le texte contourne la forme');
    await cap('05-styles-habillage');

    /* --- ajuster le texte --- */
    await edge.eval(`choisir(['tC']); surObjetsFormes(o => { o.ajuster = 'reduire'; }, o => o.type === 'texte')`);
    verifier(await edge.eval(`(objetParId('tC').ajustement || 1) < 1`), `réduire le texte dépassant (zoom ${await edge.eval(`objetParId('tC').ajustement`)})`);

    /* --- pinceau --- */
    await edge.eval(`choisir(['fC']); prendrePinceau(); appliquerPinceauObjet(objetParId('tB'))`);
    verifier(await edge.eval(`objetParId('tB').fond && objetParId('tB').fond.couleur === '#ffc000'`), 'pinceau : le remplissage est recopié');

    /* --- tableau : style et colonnes à la souris --- */
    await edge.eval(`insererTableau(3, 3); styleTableau('entete-bandes'); quitterEdition()`);
    const tb = await edge.eval(`(() => { const o = selection()[0]; majSelectionUI(); const s = document.querySelector('.sep-col').getBoundingClientRect(); return { id: o.id, c0: o.tableau.cols[0], x: s.left + s.width / 2, y: s.top + s.height / 2, fond: o.tableau.cellules.find(c => c.l === 0).fond }; })()`);
    await edge.glisser(tb.x, tb.y, tb.x + 30, tb.y);
    const c1 = await edge.eval(`objetParId(${JSON.stringify(tb.id)}).tableau.cols[0]`);
    verifier(tb.fond === '#1f4e79' && c1 > tb.c0 + 3, `style de tableau et largeur de colonne à la souris (${tb.c0} → ${c1} mm)`);
    await cap('06-tableau');

    /* --- blocs, deux pages, corrections d'image --- */
    await edge.eval(`blocConstruction('calendrier')`);
    verifier(await edge.eval(`selection()[0].type === 'tableau' && selection()[0].tableau.cols.length === 7`), 'bloc calendrier inséré');
    await edge.eval(`E.options.deuxPages = true; appliquerOptions(); allerPage(1)`);
    verifier(await edge.eval(`!!document.querySelector('#scene > .feuille-voisine')`), 'affichage deux pages côte à côte');
    await cap('07-deux-pages');
    await edge.eval(`E.options.deuxPages = false; appliquerOptions(); allerPage(0)`);

    /* --- tout reste enregistrable --- */
    const re = await edge.eval(`(() => { const f = extraireFicheHTML(htmlFiche()); return f.pages.length === 6 && f.pages[0].items.some(o => o.suivant) && f.page.guides.length === 1; })()`);
    verifier(re, 'enregistrement : chaînage, guides et pages conservés');
    for (const o of ['accueil', 'insertion', 'creation']) { await edge.eval(`activerOnglet('${o}')`); await attendre(60); await cap('08-onglet-' + o); }
    await edge.eval(`choisir(['tA']); activerOnglet('format')`); await attendre(60); await cap('09-onglet-format');

    const erreurs = edge.consoleMsgs.filter(m => /EXCEPTION|Error/i.test(m));
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) {
    ko++;
    console.log('ERREUR', e.message);
    console.log(edge.consoleMsgs.join('\n'));
  } finally {
    await edge.fermer();
  }
  console.log(`\n${ok} réussis, ${ko} échecs`);
  process.exit(ko ? 1 : 0);
})();
