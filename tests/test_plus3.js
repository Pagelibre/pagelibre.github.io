// Dernière série : node tests/test_plus3.js <trame de base.pub> <dossier captures>
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer, attendre } = require('./cdp');

const [pubTrame, dossier] = process.argv.slice(2);
const URL_EDITEUR = 'file:///' + path.resolve(__dirname, '..', 'docs', 'index.html').replace(/\\/g, '/');
let ok = 0, ko = 0;
function verifier(c, m) { if (c) { ok++; console.log('  ok  ', m); } else { ko++; console.log('  ÉCHEC', m); } }

(async () => {
  fs.mkdirSync(dossier, { recursive: true });
  const edge = await lancer({ largeur: 1500, hauteur: 900 });
  const cap = n => edge.capture(path.join(dossier, n + '.png'));
  try {
    await edge.ouvrir(URL_EDITEUR);
    await attendre(500);

    /* interligne : comparaison avec le PDF imprimé par l'application d'origine */
    const b64 = fs.readFileSync(pubTrame).toString('base64');
    await edge.eval(`(() => { const b = atob(${JSON.stringify(b64)}); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); ouvrirFichier(new File([u], 'trame de base.pub')); })()`);
    await attendre(1500);
    await edge.eval(`allerPage(5)`);
    const il = await edge.eval(`(() => { const td = [...document.querySelectorAll('#feuille-hote td')].find(t => /Inter/.test(t.textContent)); const s = [...td.querySelectorAll('span')];
      const k = E.feuille.getBoundingClientRect().width / E.feuille.offsetWidth * 96 / 25.4; const bas = e => { const r = document.createRange(); r.selectNodeContents(e); return r.getClientRects()[0].bottom; };
      return (bas(s[1]) - bas(s[0])) / k; })()`);
    verifier(Math.abs(il - 5.54) < 0.15, `interligne « Inter. / Diff. » : ${il.toFixed(2)} mm (PDF de référence : 5,54 mm)`);

    /* nouvelle fiche pour les essais */
    await edge.eval(`chargerFiche(ficheVierge(210, 297, 'Essais'))`);
    await attendre(300);
    const P = s => `<p><span style="font-family:Calibri;font-size:11pt">${s}</span></p>`;
    await edge.eval(`(() => {
      const items = pageCourante().items;
      items.push({ id: 'hs', type: 'texte', forme: 'rect', x: 15, y: 20, w: 120, h: 80, marges: [1, 1, 1, 1], html: '${Array(14).fill('Le texte suit la forme de cette étoile posée au milieu du cadre de texte.').map(P).join('')}' });
      items.push({ id: 'et', type: 'forme', forme: 'etoile5', x: 55, y: 35, w: 40, h: 40, fond: { couleur: '#ffc000' }, habillage: 'serre', distanceHabillage: 1 });
      items.push({ id: 'tq', type: 'texte', forme: 'rect', x: 15, y: 110, w: 120, h: 20, marges: [1, 1, 1, 1], html: '<p data-taquets="60c,100v"><span style="font-family:Calibri;font-size:11pt">Article\\tMilieu\\t125,50</span></p><p data-taquets="60c,100v"><span style="font-family:Calibri;font-size:11pt">Article long\\tAu centre\\t7,25</span></p>' });
      items.push({ id: 'cl', type: 'texte', forme: 'rect', x: 145, y: 23.3, w: 50, h: 60, marges: [1, 1, 1, 1], surLignesBase: true, html: '${P('Première ligne calée')}${P('Deuxième ligne')}${P('Troisième')}' });
      E.fiche.page.lignesBase = { pas: 14, decalage: 0 };
      afficherPage();
    })()`);
    await attendre(300);

    /* habillage serré : le texte s'approche plus près qu'avec le rectangle */
    const ecart = async () => edge.eval(`(() => { const el = elementObjet('hs'), et = elementObjet('et').getBoundingClientRect(); const k = E.feuille.getBoundingClientRect().width / E.feuille.offsetWidth * 96 / 25.4;
      let sur = 0, pres = 0; const z = el.querySelector('.contenu'); const tw = document.createTreeWalker(z, NodeFilter.SHOW_TEXT);
      for (let t = tw.nextNode(); t; t = tw.nextNode()) { const r = document.createRange(); r.selectNodeContents(t); for (const q of r.getClientRects()) { if (q.bottom < et.top || q.top > et.bottom) continue;
        // morceaux de texte situés DANS le rectangle de l'étoile (possible seulement en habillage serré)
        if (q.right > et.left + 2 && q.left < et.right - 2) pres++; } }
      return pres; })()`);
    const serre = await ecart();
    await edge.eval(`objetParId('et').habillage = 'carre'; afficherPage()`);
    const carre = await ecart();
    verifier(serre > carre, `habillage serré : ${serre} morceaux de texte dans le cadre de l'étoile, contre ${carre} en habillage carré`);
    await edge.eval(`objetParId('et').habillage = 'serre'; afficherPage()`);
    await cap('01-serre');

    /* taquets centré et décimal */
    const tq = await edge.eval(`(() => { const el = elementObjet('tq'); const ps = el.querySelectorAll('p'); const k = E.feuille.getBoundingClientRect().width / E.feuille.offsetWidth * 96 / 25.4;
      const res = []; for (const p of ps) { const g = p.getBoundingClientRect().left; const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); const morceaux = [];
        for (let t = tw.nextNode(); t; t = tw.nextNode()) if (!t.parentElement.classList.contains('tab') && t.nodeValue.trim()) morceaux.push(t);
        const r = document.createRange(); r.selectNodeContents(morceaux[1]); const q = r.getBoundingClientRect();
        const t3 = morceaux[2]; const i = t3.nodeValue.indexOf(','); const r2 = document.createRange(); r2.setStart(t3, i); r2.setEnd(t3, i + 1);
        res.push({ centre: ((q.left + q.right) / 2 - g) / k, virgule: (r2.getBoundingClientRect().left - g) / k }); } return res; })()`);
    verifier(tq.every(x => Math.abs(x.centre - 60) < 1 && Math.abs(x.virgule - 100) < 1), `taquets : texte centré sur 60 mm (${tq.map(x => x.centre.toFixed(1)).join(' / ')}), virgules alignées sur 100 mm (${tq.map(x => x.virgule.toFixed(1)).join(' / ')})`);

    /* calage sur les lignes de base */
    const cl = await edge.eval(`(() => { const el = elementObjet('cl'); const k = E.feuille.getBoundingClientRect().width / E.feuille.offsetWidth * 96 / 25.4; const top = E.feuille.getBoundingClientRect().top;
      const pas = 14 * 25.4 / 72, org = E.fiche.page.marges[0];
      return [...el.querySelectorAll('p')].map(p => { const m = document.createElement('span'); m.style.cssText = 'display:inline-block;width:0;height:0'; p.insertBefore(m, p.firstChild); const y = (m.getBoundingClientRect().bottom - top) / k; m.remove();
        const d = ((y - org) % pas + pas) % pas; return Math.min(d, pas - d); }); })()`);
    verifier(cl.every(d => d < 0.3), `lignes de texte posées sur les lignes de base (écarts ${cl.map(d => d.toFixed(2)).join(', ')} mm)`);
    await cap('02-taquets-calage');

    /* profondeur 3D, diagonale à deux textes */
    await edge.eval(`choisir(['et']); surObjetsFormes(o => { o.extrusion = { p: 2.5, couleur: '#7f7f7f' }; }, () => true)`);
    verifier(await edge.eval(`(elementObjet('et').style.filter.match(/drop-shadow/g) || []).length >= 10`), 'profondeur 3D (épaisseur dessinée)');
    await edge.eval(`insererTableau(2, 3); quitterEdition(); diagonaleCellules('desc')`);
    const tid = await edge.eval(`selection()[0].id`);
    await edge.eval(`(() => { const o = objetParId(${JSON.stringify(tid)}); entrerEdition(o); const td = elementObjet(o.id).querySelector('td'); td.querySelector('.diag-haut').innerHTML = '<p><span>Haut</span></p>'; td.querySelector('.diag-bas').innerHTML = '<p><span>Bas</span></p>'; quitterEdition(); })()`);
    verifier(await edge.eval(`(() => { const c = objetParId(${JSON.stringify(tid)}).tableau.cellules[0]; return /Haut/.test(c.html2) && /Bas/.test(c.html); })()`), 'cellule en diagonale : un texte dans chaque triangle');
    await cap('03-effets');

    /* export PNG */
    const png = await edge.eval(`(async () => { const z = await preparerPages([0], false); const b = await pageEnPNG(z.querySelector('.feuille'), 150); libererPages(); return { taille: b.size, type: b.type }; })()`);
    verifier(png.type === 'image/png' && png.taille > 20000, `export de la page en PNG (${Math.round(png.taille / 1024)} Ko)`);

    /* impression pour imprimeur */
    const pl = await edge.eval(`(async () => { const z = await preparerPages([0], true); const p = z.querySelector('.planche'); const r = { w: p.style.width, h: p.style.height, traits: p.children.length - 1 }; libererPages(); return r; })()`);
    verifier(pl.w === '230mm' && pl.h === '317mm' && pl.traits === 8, `planche d'imprimeur : ${pl.w} x ${pl.h}, ${pl.traits} traits de coupe`);

    /* modèles */
    for (const cle of ['tp', 'evaluation', 'procedure', 'affiche', 'attestation']) {
      await edge.eval(`E.modifie = false; nouveauDepuisModele('${cle}')`);
      await attendre(300);
      const n = await edge.eval(`({ n: pageCourante().items.length, el: document.querySelectorAll('#feuille-hote .calque-objets > .objet').length, titre: E.fiche.titre })`);
      verifier(n.n > 3 && n.el === n.n, `modèle « ${n.titre} » (${n.n} objets)`);
      if (cle === 'tp') await cap('04-modele-tp');
    }
    await edge.eval(`ouvrirCoulisses('nouveau')`);
    await attendre(300);
    verifier(await edge.eval(`document.querySelectorAll('#modeles-liste .modele').length === Object.keys(MODELES).length && Object.keys(MODELES).length >= 9`), 'Fichier › Nouveau : tous les modèles (9) avec aperçu');
    await cap('05-nouveau');

    const erreurs = edge.consoleMsgs.filter(m => /EXCEPTION|Error/i.test(m));
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) {
    ko++;
    console.log('ERREUR', e.message);
    console.log(edge.consoleMsgs.join('\n'));
  } finally { await edge.fermer(); }
  console.log(`\n${ok} réussis, ${ko} échecs`);
  process.exit(ko ? 1 : 0);
})();
