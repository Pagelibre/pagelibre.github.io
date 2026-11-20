// Fonctions ajoutées le 20/11 (suite) : node tests/test_plus2.js <test.emf> <dossier captures>
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { lancer, attendre } = require('./cdp');

const [emfFichier, dossier] = process.argv.slice(2);
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
    const P = s => `<p><span style="font-family:Calibri;font-size:11pt">${s}</span></p>`;
    await edge.eval(`(() => {
      const items = pageCourante().items;
      const t = (id, x, y, w, h, html, extra) => { const o = Object.assign({ id, type: 'texte', forme: 'rect', x, y, w, h, marges: [1, 1, 1, 1], html }, extra || {}); items.push(o); return o; };
      t('st', 15, 15, 80, 30, '${P('Titre de la fiche')}${P('Texte courant')}');
      t('num', 100, 15, 80, 35, '${P('Premier')}${P('Deuxième')}${P('Troisième')}');
      t('tab', 15, 55, 120, 20, '<p data-taquets="40,100d"><span style="font-family:Calibri;font-size:11pt">Nom\\tPrénom\\t12,50</span></p>');
      t('hab', 15, 85, 120, 70, '${Array(16).fill('Le texte passe des deux côtés de la forme placée au milieu du cadre.').map(P).join('')}');
      items.push({ id: 'obst', type: 'forme', forme: 'ellipse', x: 60, y: 100, w: 30, h: 25, fond: { couleur: '#ffc000' }, habillage: 'carre' });
      t('ces', 140, 55, 30, 60, '${P('Installation électrique du disjoncteur différentiel et protection des canalisations.')}', { cesure: true });
      afficherPage();
    })()`);
    await attendre(300);

    /* styles liés */
    await edge.eval(`choisir(['st']); entrerEdition(objetParId('st')); (() => { const p = elementObjet('st').querySelector('p'); const r = document.createRange(); r.selectNodeContents(p); getSelection().removeAllRanges(); getSelection().addRange(r); })(); appliquerStyle(listeStyles().find(s => s.nom === 'Titre 1')); quitterEdition()`);
    await edge.eval(`(() => { modifierStyle('Titre 1'); document.querySelector('#ms-t').value = 30; document.querySelector('#ms-c').value = '#c00000'; document.querySelector('#boite [data-ok]').click(); })()`);
    const st = await edge.eval(`(() => { const s = elementObjet('st').querySelector('p[data-style="Titre 1"] span'); return { taille: s && s.style.fontSize, couleur: s && s.style.color }; })()`);
    verifier(st.taille === '30pt' && /192, 0, 0/.test(st.couleur), `modifier le style met à jour le texte qui l'utilise (${st.taille}, ${st.couleur})`);

    /* numérotation automatique */
    await edge.eval(`choisir(['num']); cmdTexte('puces', 'numeros')`);
    await edge.eval(`(() => { const o = objetParId('num'); const d = document.createElement('div'); d.innerHTML = o.html; d.querySelector('p').remove(); o.html = d.innerHTML; redessinerObjet(o); })()`);
    const nums = await edge.eval(`[...elementObjet('num').querySelectorAll('.puce')].map(p => p.textContent.trim())`);
    verifier(nums.join(' ') === '1. 2.', `numéros recalculés après suppression d'une ligne (${nums.join(' ')})`);

    /* espacement des caractères */
    await edge.eval(`choisir(['st']); espacementCaracteres(2)`);
    verifier(await edge.eval(`/letter-spacing: 2pt/.test(objetParId('st').html)`), 'espacement des caractères');

    /* taquets */
    const tq = await edge.eval(`(() => { const p = elementObjet('tab').querySelector('p'); const t = [...p.querySelectorAll('.tab')]; const k = p.getBoundingClientRect().width / p.offsetWidth * (96 / 25.4);
      const x = s => (s.getBoundingClientRect().right - p.getBoundingClientRect().left) / k; const fin = (() => { const r = document.createRange(); r.selectNodeContents(p); return (r.getBoundingClientRect().right - p.getBoundingClientRect().left) / k; })();
      return { n: t.length, t1: x(t[0]), fin }; })()`);
    verifier(tq.n === 2 && Math.abs(tq.t1 - 40) < 1 && Math.abs(tq.fin - 100) < 1.5, `taquets : « Prénom » à 40 mm (${tq.t1.toFixed(1)}), montant aligné à droite sur 100 mm (${tq.fin.toFixed(1)})`);

    /* habillage des deux côtés */
    const hb = await edge.eval(`(() => { const el = elementObjet('hab'); const esp = el.querySelectorAll('.hab-espace').length;
      const z = el.querySelector('.contenu'), zr = z.getBoundingClientRect(), k = zr.width / z.offsetWidth * (96 / 25.4);
      const o = elementObjet('obst').getBoundingClientRect();
      let gauche = 0, droite = 0, dessus = 0;
      const tw = document.createTreeWalker(z, NodeFilter.SHOW_TEXT);
      for (let t = tw.nextNode(); t; t = tw.nextNode()) { const r = document.createRange(); r.selectNodeContents(t); for (const q of r.getClientRects()) {
        if (q.bottom < o.top || q.top > o.bottom) continue; if (q.right <= o.left + 1) gauche++; else if (q.left >= o.right - 1) droite++; else dessus++; } }
      return { esp, gauche, droite, dessus }; })()`);
    verifier(hb.esp > 0 && hb.gauche > 0 && hb.droite > 0 && hb.dessus === 0, `habillage des deux côtés (${hb.gauche} morceaux à gauche, ${hb.droite} à droite, ${hb.dessus} sur la forme)`);
    await cap('01-texte');

    /* césure */
    const ce = await edge.eval(`({ affiche: elementObjet('ces').textContent.includes('\\u00ad'), modele: objetParId('ces').html.includes('\\u00ad') })`);
    verifier(ce.affiche && !ce.modele, 'césure : coupures à l\'affichage seulement (le texte enregistré reste intact)');
    await edge.eval(`entrerEdition(objetParId('hab'))`);
    verifier(await edge.eval(`!elementObjet('hab').querySelector('.hab-espace') && !elementObjet('hab').textContent.includes('\\u00ad')`), 'en saisie, les ajouts d\'affichage disparaissent');
    await edge.eval(`quitterEdition()`);
    verifier(await edge.eval(`!/hab-espace|class="tab"/.test(objetParId('hab').html + objetParId('tab').html)`), 'rien de l\'affichage n\'est enregistré dans la fiche');

    /* grille, lignes de base */
    await edge.eval(`E.fiche.page.grille = { cols: 3, lignes: 2, espace: 5 }; E.fiche.page.lignesBase = { pas: 12, decalage: 0 }; dessinerGuides()`);
    const gr = await edge.eval(`({ v: document.querySelectorAll('.repere-grille.v').length, b: document.querySelectorAll('.ligne-base').length, mag: (() => { const r = reperesGrille(); return r.v.length; })() })`);
    verifier(gr.v === 6 && gr.b > 30 && gr.mag === 6, `grille de 3 colonnes et ${gr.b} lignes de base affichées`);
    await cap('02-grille');

    /* jeux de couleurs et de polices */
    await edge.eval(`objetParId('obst').fond.couleur = E.fiche.palette[1] = '#4472c4'; E.fiche.palette = ['#000000', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#ffffff']; appliquerJeuCouleurs(JEUX_COULEURS[1][1])`);
    verifier(await edge.eval(`objetParId('obst').fond.couleur === '#077568'`), 'jeu de couleurs : la couleur d\'accent 1 devient le vert CFA');
    await edge.eval(`appliquerJeuPolices('Georgia', 'Verdana')`);
    const jp = await edge.eval(`({ titre: /Georgia/.test(objetParId('st').html), corps: /Verdana/.test(objetParId('num').html) })`);
    verifier(jp.titre && jp.corps, 'jeu de polices : titres en Georgia, texte en Verdana');

    /* reflet, biseau, 3D, diagonale */
    await edge.eval(`choisir(['obst']); surObjetsFormes(o => { o.reflet = { taille: 35 }; o.biseau = 'marque'; o.rot3d = { y: 25 }; }, () => true)`);
    const ef = await edge.eval(`(() => { const el = elementObjet('obst'); return { reflet: !!el.style.webkitBoxReflect, biseau: !!el.querySelector('filter feSpecularLighting'), d3: el.style.transform.includes('rotateY') }; })()`);
    verifier(ef.reflet && ef.biseau && ef.d3, 'reflet, biseau et rotation 3D');
    await edge.eval(`insererTableau(2, 2); quitterEdition(); diagonaleCellules('desc')`);
    verifier(await edge.eval(`[...elementObjet(selection()[0].id).querySelectorAll('td')].every(td => td.style.backgroundImage.includes('linear-gradient'))`), 'cellules coupées en diagonale');
    await cap('03-effets');

    /* image EMF dans une fiche : conversion à l'ouverture */
    const emfZ = zlib.deflateSync(fs.readFileSync(emfFichier)).toString('base64');
    await edge.eval(`(() => { E.fiche.images.emf1 = 'data:image/x-emf;z=1;base64,${emfZ}'; pageCourante().items.push({ id: 'imgEmf', type: 'image', image: 'emf1', x: 140, y: 120, w: 50, h: 32 }); afficherPage(); })()`);
    await edge.eval(`convertirMetafichiers()`);
    await attendre(800);
    verifier(await edge.eval(`E.fiche.images.emf1.startsWith('data:image/png') && !!elementObjet('imgEmf').querySelector('img')`), 'image EMF convertie et affichée');
    await cap('04-emf');

    /* version à jour : une fiche ancienne propose la nouvelle version de l'outil */
    await edge.eval(`E.fiche.titre = 'Fiche test'; E.modifie = false`);
    const vieux = (await edge.eval(`htmlFiche()`)).replace(/const VERSION_EDITEUR = '[^']*'/, "const VERSION_EDITEUR = '2020-01-01T00:00'");
    const fv = path.join(dossier, 'fiche_ancienne.html');
    fs.writeFileSync(fv, vieux);
    await edge.ouvrir('file:///' + fv.replace(/\\/g, '/'));
    await attendre(800);
    verifier(await edge.eval(`!document.querySelector('#bandeau').hidden && document.querySelector('#bandeau').dataset.type === 'version'`), 'fiche ancienne : la mise à jour est proposée');
    await edge.eval(`document.querySelector('#bandeau [data-v]').click()`);
    await attendre(1500);
    const apres = await edge.eval(`({ url: location.href, titre: E.fiche.titre, version: VERSION_EDITEUR })`);
    verifier(/index\.html$/.test(apres.url) && apres.titre === 'Fiche test' && apres.version > '2020', `la fiche s'ouvre dans l'outil à jour (${apres.version})`);

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
