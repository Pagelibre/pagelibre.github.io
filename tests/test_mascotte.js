// Mascotte du bandeau bleu : réactions, discrétion, coût en calcul : node tests/test_mascotte.js [dossier captures]
'use strict';
const path = require('path');
const { lancer, attendre } = require('./cdp');
const URL_EDITEUR = 'file:///' + path.resolve(__dirname, '..', 'docs', 'index.html').split(path.sep).join('/');
const dossier = process.argv[2];
let ok = 0, ko = 0;
function verifier(c, m) { if (c) { ok++; console.log('  ok  ', m); } else { ko++; console.log('  ÉCHEC', m); } }

(async () => {
  const e = await lancer({ largeur: 1400, hauteur: 900 });
  const etat = () => e.eval('MASCOTTE.etat');
  // part du temps occupée par la page (en %)
  const temps = async ms => {
    const t = async () => (await e.envoyer('Performance.getMetrics')).metrics.find(m => m.name === 'TaskDuration').value;
    const a = await t();
    await attendre(ms);
    return (await t() - a) / ms * 1e5;
  };
  try {
    await e.ouvrir(URL_EDITEUR);
    await attendre(600);
    await e.envoyer('Performance.enable');
    const couvre = largeur => e.eval(`(async () => {
      $('#indic-sauvegarde').textContent = 'Document téléchargé : « Un nom de fichier vraiment très long pour essayer.pagelibre » (dossier Téléchargements)';
      $('#bouton-installer').hidden = false;
      await new Promise(r => requestAnimationFrame(r));
      const r = $('#mascotte').getBoundingClientRect(), ruban = $('#ruban').getBoundingClientRect();
      const libres = ['#indic-sauvegarde', '#bouton-installer', '#titre-doc', '#onglets-contexte', '#onglets .onglet:nth-of-type(5)'].every(s => { const b = $(s).getBoundingClientRect(); return b.right <= r.left + 1; });
      const clic = document.elementFromPoint(r.left + 20, r.top + 45);
      $('#indic-sauvegarde').textContent = ''; $('#bouton-installer').hidden = true;
      return { dans: r.top >= 0 && r.bottom <= ruban.top + 0.5 && r.right <= innerWidth, libres, traverse: !clic.closest('#mascotte'), visible: r.width > 0 }; })()`);
    for (const l of [1400, 1000]) {
      await e.envoyer('Emulation.setDeviceMetricsOverride', { width: l, height: 900, deviceScaleFactor: 1, mobile: false });
      await attendre(150);
      const p = await couvre();
      verifier(p.visible && p.dans && p.libres && p.traverse, `fenêtre de ${l} px : dans le bandeau bleu, sans couvrir ni titre, ni message, ni bouton, ni onglet`);
    }
    await e.envoyer('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
    await attendre(150);
    verifier(await e.eval(`$('#mascotte').offsetHeight === 0 && !mascotteVisible()`), 'fenêtre de 900 px : elle laisse la place');
    await e.envoyer('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
    await attendre(150);
    await e.eval(`mascotte('repos')`);
    verifier(['repos', 'cligne'].includes(await etat()), 'au repos à l’ouverture');
    if (dossier) await e.capture(path.join(dossier, 'mascotte.png'));

    /* réactions */
    await e.eval(`(() => { const o = { id: 'zt', type: 'texte', forme: 'rect', x: 30, y: 30, w: 100, h: 40, marges: [1, 1, 1, 1], html: '<p><span style="font-family:Calibri;font-size:12pt">Bonjour</span></p>' }; avant(); pageCourante().items.push(o); redessinerObjet(o); apres(); choisir(['zt']); })()`);
    verifier(await etat() === 'regarde', 'regarde la page quand on choisit un objet');
    const r = await e.eval(`(() => { const b = elementObjet('zt').getBoundingClientRect(); return [b.left + 40, b.top + 12]; })()`);
    await e.clic(r[0], r[1], 2);
    await e.taper('a');
    verifier(await etat() === 'ecrit', 'prend des notes pendant la frappe');
    if (dossier) { await attendre(600); await e.capture(path.join(dossier, 'mascotte-ecrit.png')); }
    // la mascotte ne ralentit pas la frappe
    const frappe = async () => { const t = Date.now(); for (let i = 0; i < 150; i++) await e.envoyer('Input.insertText', { text: 'b' }); return (Date.now() - t) / 150; };
    await frappe();
    const avec = await frappe();
    await e.eval(`MASCOTTE.el.hidden = true`);
    const sans = await frappe();
    await e.eval(`MASCOTTE.el.hidden = false`);
    verifier(avec < sans + 4, `frappe : ${avec.toFixed(1)} ms par lettre avec la mascotte, ${sans.toFixed(1)} sans`);
    await e.eval(`mascotte('repos')`);
    await e.taper('c');
    await attendre(2300);
    verifier(['repos', 'cligne'].includes(await etat()), 'range son crayon quand on s’arrête');
    await e.eval(`quitterEdition(); choisir(['zt']); supprimerSelection()`);
    verifier(await etat() === 'surpris', 'surprise quand on supprime');
    await e.eval('annuler()');
    verifier(await etat() === 'oups', 'désolée quand on annule');
    await e.eval(`marquerEnregistre('essai')`);
    verifier(await etat() === 'fier', 'fière quand on enregistre');
    await e.eval(`mascotte('repos'); $('#mascotte').click()`);
    verifier(await etat() === 'coucou', 'salue quand on clique dessus');

    /* scènes du bandeau : elle marche, reste dans son couloir, et s'arrête net si on écrit */
    await e.eval(`mascotte('repos'); MASCOTTE.prochaine = 0; MASCOTTE.SCENES_ESSAI = MASCOTTE.SCENES; MASCOTTE.SCENES = [() => [['va', 0], ['geste', 'gauche']], () => [['va', 0], ['geste', 'gauche']]]; suiteMascotte()`);
    const xs = [];
    for (let k = 0; k < 5; k++) { await attendre(300); xs.push(await e.eval(`$('#mascotte .m-perso').getBoundingClientRect().left - $('#mascotte').getBoundingClientRect().left`)); }
    if (dossier) await e.capture(path.join(dossier, 'mascotte-marche.png'), { x: 1100, y: 0, width: 300, height: 64 });
    verifier(await etat() === 'marche' && xs[4] < xs[0] - 20 && xs.every(v => v >= 0 && v <= 132), `se promène (${xs.map(v => Math.round(v)).join(', ')})`);
    const marche = await temps(1200);
    const ici = await e.eval(`(() => { const a = $('#mascotte .m-perso').getBoundingClientRect().left; mascotte('ecrit'); const b = $('#mascotte .m-perso').getBoundingClientRect().left; return [a, b, MASCOTTE.suite.length]; })()`);
    verifier(Math.abs(ici[0] - ici[1]) < 3 && ici[2] === 0 && await etat() === 'ecrit', `s'arrête sur place quand on écrit (écart ${Math.abs(ici[0] - ici[1]).toFixed(1)} px) ; calcul en marchant : ${marche.toFixed(1)} %`);
    await e.eval(`mascotte('repos'); MASCOTTE.prochaine = 0; MASCOTTE.SCENES = [() => [['y', 60], ['attend', 900], ['y', 0]], () => [['y', 60], ['attend', 900], ['y', 0]]]; suiteMascotte()`);
    await attendre(700);
    const cache = await e.eval(`$('#mascotte .m-perso').getBoundingClientRect().top >= $('#ruban').getBoundingClientRect().top - 1`);
    await e.eval(`mascotte('coucou')`);
    await attendre(400);
    verifier(cache && await e.eval(`Math.abs($('#mascotte .m-perso').getBoundingClientRect().bottom - $('#ruban').getBoundingClientRect().top) < 1`), 'cache-cache derrière le ruban, et revient dès qu’on l’appelle');
    // toutes les scènes vont au bout et finissent dans le couloir
    for (let k = 0; k < 5; k++) {
      await e.eval(`mascotte('repos'); MASCOTTE.VITESSE = 600; MASCOTTE.SCENES = [MASCOTTE.SCENES_ESSAI[${k}], MASCOTTE.SCENES_ESSAI[${k}]]; MASCOTTE.prochaine = 0; suiteMascotte()`);
      for (let t = 0; t < 60 && await e.eval(`MASCOTTE.suite.length || !['repos', 'cligne'].includes(MASCOTTE.etat)`); t++) await attendre(200);
      const fin = await e.eval(`[MASCOTTE.x, MASCOTTE.y, MASCOTTE.etat]`);
      verifier(fin[0] >= 0 && fin[0] <= 132 && fin[1] === 0 && ['repos', 'cligne'].includes(fin[2]), `scène ${k + 1} : va au bout (${fin.join(', ')})`);
    }
    await e.eval(`MASCOTTE.VITESSE = 38; MASCOTTE.SCENES = MASCOTTE.SCENES_ESSAI; MASCOTTE.prochaine = Date.now() + 1e7; mascotte('repos')`);

    /* sans rien faire : bâille, s'endort, puis plus aucun calcul ; se réveille à la première action */
    await e.eval(`MASCOTTE.dernier = Date.now() - 61000; MASCOTTE.baille = false; suiteMascotte()`);
    verifier(await etat() === 'baille', 'bâille après une minute');
    await e.eval(`MASCOTTE.dernier = Date.now() - 181000; suiteMascotte()`);
    verifier(await etat() === 'dort', 's’endort après trois minutes');
    if (dossier) { await attendre(1200); await e.capture(path.join(dossier, 'mascotte-dort.png')); }
    await e.eval(`MASCOTTE.dernier = Date.now() - 500000; MASCOTTE.el.dataset.geste = 'respire'; suiteMascotte()`);
    await attendre(300);
    const fige = await e.eval(`(() => [MASCOTTE.el.getAnimations({ subtree: true }).length, MASCOTTE.el.dataset.geste])()`);
    const minuteur = await e.eval('MASCOTTE.minuteur');
    await attendre(6000);
    verifier(fige[0] === 0 && fige[1] === '' && await e.eval(`MASCOTTE.minuteur === ${minuteur} && MASCOTTE.el.dataset.geste === ''`), 'endormie depuis longtemps : plus aucun mouvement ni minuteur');
    await e.clic(700, 600);
    verifier(await etat() !== 'dort', 'se réveille à la première action');

    /* masquer : choix retenu ; coût au repos */
    await e.eval(`E.options.mascotte = false; appliquerOptions()`);
    verifier(await e.eval(`$('#mascotte').offsetHeight`) === 0 && /"mascotte":false/.test(await e.eval(`localStorage.getItem('pagelibre-options')`)), 'se masque, et le choix est retenu');
    await attendre(500);
    const sansM = await temps(12000);
    await e.eval(`E.options.mascotte = true; appliquerOptions()`);
    await attendre(500);
    const avecM = await temps(12000);
    verifier(avecM - sansM < 1, `temps de calcul au repos : ${avecM.toFixed(2)} % avec, ${sansM.toFixed(2)} % sans`);
    // elle est recréée à l'ouverture, jamais rangée dans le document
    verifier(!/<div id="mascotte"/.test(await e.eval(`htmlFiche().replace(/<script>[^]*?<.script>/g, '')`)), 'absente du document enregistré');
    verifier(!e.consoleMsgs.some(m => /EXCEPTION/.test(m)), 'aucune erreur');
    if (e.consoleMsgs.length) console.log(e.consoleMsgs.slice(0, 5).join('\n'));
  } finally { await e.fermer(); }
  console.log(`\n${ok} réussis, ${ko} échecs`);
  process.exit(ko ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
