// Test de bout en bout de l'éditeur dans Edge : node tests/test_editeur.js <fichier.pub> <dossier captures>
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer, attendre } = require('./cdp');

const [fichier, dossier] = process.argv.slice(2);
const URL_EDITEUR = 'file:///' + path.resolve(__dirname, '..', 'docs', 'index.html').replace(/\\/g, '/');
let ok = 0, ko = 0;
function verifier(cond, msg) { if (cond) { ok++; console.log('  ok  ', msg); } else { ko++; console.log('  ÉCHEC', msg); } }

(async () => {
  fs.mkdirSync(dossier, { recursive: true });
  const edge = await lancer({ largeur: 1500, hauteur: 900 });
  const cap = n => edge.capture(path.join(dossier, n + '.png'));
  try {
    await edge.ouvrir(URL_EDITEUR);
    await attendre(500);
    verifier(await edge.eval(`!!document.querySelector('#ruban .panneau.actif')`), 'ruban affiché');
    verifier(await edge.eval(`E.fiche.pages.length === 1`), 'fiche vierge au démarrage');
    await cap('01-demarrage');

    // ouverture du .pub (comme un glisser-déposer)
    const b64 = fs.readFileSync(fichier).toString('base64');
    await edge.eval(`(() => { const b = atob(${JSON.stringify(b64)}); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      ouvrirFichier(new File([u], ${JSON.stringify(path.basename(fichier))})); })()`);
    await attendre(1500);
    const info = await edge.eval(`({ pages: E.fiche.pages.length, objets: pageCourante().items.length, vignettes: document.querySelectorAll('.vignette').length, titre: document.title, elements: document.querySelectorAll('#feuille-hote .calque-objets > .objet').length })`);
    console.log(info);
    verifier(info.pages > 0 && info.vignettes === info.pages, 'pages et vignettes');
    verifier(info.elements === info.objets, 'tous les objets dessinés');
    await cap('02-fiche-ouverte');

    // sélection d'un cadre de texte par un vrai clic
    const cible = await edge.eval(`(() => { const o = pageCourante().items.find(x => x.type === 'texte' && x.w > 30 && x.h > 10 && !x.rot && (x.html || '').replace(/<[^>]+>/g, '').trim().length > 5);
      if (!o) return null; const el = elementObjet(o.id);
      // point au milieu du premier mot du texte
      const t = [...el.querySelectorAll('.contenu span')].find(s => s.textContent.trim().length > 4);
      const r = document.createRange(); r.setStart(t.firstChild, 1); r.setEnd(t.firstChild, 2); const q = r.getBoundingClientRect();
      return { id: o.id, x: q.left + q.width / 2, y: q.top + q.height / 2 }; })()`);
    if (cible) {
      const id = JSON.stringify(cible.id);
      // un seul clic dans le texte place le curseur à l'endroit cliqué
      await edge.eval(`(() => { const o = objetParId(${id}); delete o.groupe; })()`);
      await edge.clic(cible.x, cible.y);
      verifier(await edge.eval(`!!E.edition && E.edition.id === ${id}`), 'un clic dans le texte : saisie directe');
      const caret = await edge.eval(`(() => { const s = getSelection(); const el = elementObjet(${id}); const r = document.createRange(); r.selectNodeContents(el.querySelector('.contenu')); r.setEnd(s.anchorNode, s.anchorOffset);
        return { dans: el.contains(s.anchorNode), avant: r.toString().length, total: el.querySelector('.contenu').textContent.length }; })()`);
      verifier(caret.dans && caret.avant < caret.total, `curseur placé au point cliqué (${caret.avant}/${caret.total} caractères avant)`);
      await cap('03-saisie-directe');
      // glisser dans le texte : sélectionne du texte, ne déplace pas le cadre
      const pos0 = await edge.eval(`(() => { const o = objetParId(${id}); return { x: o.x, y: o.y }; })()`);
      await edge.glisser(cible.x, cible.y, cible.x + 40, cible.y);
      const apresSel = await edge.eval(`(() => { const o = objetParId(${id}); return { x: o.x, texte: getSelection().toString().length }; })()`);
      verifier(apresSel.x === pos0.x && apresSel.texte > 0, `glisser dans le texte sélectionne ${apresSel.texte} caractère(s) sans bouger le cadre`);
      // déplacement par le bord du cadre
      const bord = await edge.eval(`(() => { const b = document.querySelector('.bord-sel.bord-g').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
      await edge.glisser(bord.x, bord.y, bord.x + 60, bord.y + 30);
      const pos1 = await edge.eval(`(() => { const o = objetParId(${id}); return { x: o.x, edition: !!E.edition }; })()`);
      verifier(Math.abs(pos1.x - pos0.x) > 5, `glisser par le bord déplace le cadre (${pos0.x} -> ${pos1.x})`);
      await edge.touche('z', 'KeyZ', 2);
      verifier(await edge.eval(`Math.abs(objetParId(${id}).x - ${pos0.x}) < 0.01`), 'Ctrl+Z annule le déplacement');
      // pointeur : texte au milieu, croix fléchée près du bord
      const curseurs = await edge.eval(`(() => { const el = elementObjet(${id}); const r = el.getBoundingClientRect();
        const ev = (x, y) => { const e = new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }); el.querySelector('.contenu').dispatchEvent(e); return el.style.cursor; };
        return { milieu: ev(r.left + r.width / 2, r.top + r.height / 2), bord: ev(r.left + 1, r.top + r.height / 2) }; })()`);
      verifier(curseurs.milieu === 'text' && curseurs.bord === 'move', `forme du pointeur (milieu : ${curseurs.milieu}, bord : ${curseurs.bord})`);
      // saisie
      await edge.eval(`deselectionner()`);
      await edge.clic(cible.x, cible.y);
      await edge.taper(' TEST');
      await edge.touche('Escape');
      verifier(await edge.eval(`objetParId(${id}).html.includes('TEST') && E.sel[0] === ${id} && !E.edition`), 'texte saisi, Échap laisse le cadre sélectionné');
      await cap('04-texte');
      // un cadre groupé : le premier clic choisit le groupe, le suivant écrit dans le cadre
      const g = await edge.eval(`(() => {
        for (const o of pageCourante().items.filter(x => x.groupe && x.type === 'texte' && x.w > 20 && x.h > 8 && !x.rot)) {
          const el = elementObjet(o.id), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
          const dessus = document.elementFromPoint(x, y);
          if (dessus && el.contains(dessus)) return { id: o.id, x, y };
        }
        return null; })()`);
      if (g) {
        await edge.eval(`deselectionner()`);
        await edge.clic(g.x, g.y);
        verifier(await edge.eval(`!E.edition && E.sel.length > 1 && groupeEntier(selection())`), 'cadre groupé : 1er clic = tout le groupe');
        await edge.clic(g.x, g.y);
        verifier(await edge.eval(`!!E.edition && E.edition.id === ${JSON.stringify(g.id)}`), 'cadre groupé : 2e clic = saisie dans le cadre');
        await edge.touche('Escape');
      }
    }

    // insertion d'une zone de texte par dessin
    await edge.eval(`allerPage(0); demarrerModeDessin({ type: 'texte' })`);
    const r = await edge.eval(`(() => { const r = E.feuille.getBoundingClientRect(); return { x: r.left + 40, y: r.top + 40 }; })()`);
    await edge.glisser(r.x, r.y, r.x + 200, r.y + 60);
    verifier(await edge.eval(`!!E.edition && objetParId(E.edition.id).type === 'texte'`), 'zone de texte dessinée et en saisie');
    await edge.taper('Bonjour PageLibre');
    await edge.eval(`cmdTexte('gras')`);
    await edge.touche('Escape');
    verifier(await edge.eval(`selection()[0] && selection()[0].html.includes('Bonjour')`), 'texte de la nouvelle zone');

    // tableau
    await edge.eval(`insererTableau(3, 4)`);
    verifier(await edge.eval(`selection()[0].type === 'tableau' && selection()[0].tableau.cellules.length === 12`), 'tableau 3 x 4 inséré');
    await edge.eval(`insLigne(true); insColonne(true)`);
    verifier(await edge.eval(`(() => { const t = selection()[0].tableau; return t.lignes.length === 4 && t.cols.length === 5 && t.cellules.length === 20; })()`), 'ajout ligne + colonne');
    await edge.touche('Escape');
    await cap('05-tableau');

    // onglets
    for (const o of ['insertion', 'creation', 'affichage']) { await edge.eval(`activerOnglet('${o}')`); await attendre(80); await cap('06-onglet-' + o); }
    await edge.eval(`activerOnglet('accueil')`);

    // enregistrement : HTML autonome qui se rouvre
    const html = await edge.eval(`htmlFiche()`);
    const fiche2 = await edge.eval(`(() => { const f = extraireFicheHTML(htmlFiche()); return { pages: f.pages.length, objets: f.pages[0].items.length }; })()`);
    verifier(html.length > 100000 && fiche2.pages === info.pages, `fiche enregistrée en HTML (${Math.round(html.length / 1024)} Ko) et relisible`);
    const fichierSauve = path.join(dossier, 'fiche_enregistree.html');
    fs.writeFileSync(fichierSauve, html);
    await edge.eval(`E.modifie = false`); // sinon la page demande « Quitter sans enregistrer ? »
    await edge.ouvrir('file:///' + fichierSauve.replace(/\\/g, '/'));
    await attendre(1200);
    const re = await edge.eval(`({ pages: E.fiche.pages.length, objets: E.fiche.pages[0].items.length, titre: E.fiche.titre })`);
    verifier(re.pages === fiche2.pages && re.objets === fiche2.objets, `fiche rouverte depuis le fichier enregistré (${re.titre})`);
    await cap('07-fiche-rouverte');

    // coulisses
    await edge.eval(`ouvrirCoulisses('ouvrir')`);
    await attendre(100);
    await cap('08-fichier-ouvrir');
    await edge.eval(`fermerCoulisses()`);

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
