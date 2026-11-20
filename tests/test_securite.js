// Sécurité des documents ouverts : node tests/test_securite.js
// Ouvre un document .pagelibre piégé (code caché dans le texte, les images, les styles, le titre)
// et vérifie que rien ne s'exécute ni ne part sur Internet, et que le texte, lui, est gardé.
'use strict';
const path = require('path');
const { lancer, attendre } = require('./cdp');
const URL_EDITEUR = 'file:///' + path.resolve(__dirname, '..', 'docs', 'index.html').replace(/\\/g, '/');

const PIEGE = `<p>Texte gardé<img src=x onerror="window.__p1=1"></p><svg onload="window.__p2=1"><circle r=5></circle></svg>
<p><a href="javascript:window.__p3=1" id="lien-piege">lien piégé</a> <a href="https://exemple.org/" onclick="window.__p7=1">lien sûr</a></p>
<p style="background:url(https://exemple.invalid/espion.png);color:#c00">style</p><iframe srcdoc="&lt;script&gt;parent.__p4=1&lt;/script&gt;"></iframe>
<p id="boite" name="E">écrasement</p><style>body{display:none}</style><script>window.__p8=1<\/script>`;

const fiche = {
  format: 'pagelibre', application: 'PageLibre', titre: 'Piège <img src=x onerror="window.__p6=1">',
  page: { w: 210, h: 297 },
  images: { bon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', espion: 'https://exemple.invalid/a.png', code: 'javascript:window.__p9=1' },
  styles: [{ nom: 'Piège', police: `x'"><img src=x onerror="window.__p5=1">`, taille: 12, couleur: 'red;background:url(https://exemple.invalid/s.png)' }],
  pages: [{ id: 'p1', items: [
    { id: 't1', type: 'texte', x: 20, y: 20, w: 150, h: 80, html: PIEGE },
    { id: 'i1', type: 'image', x: 20, y: 110, w: 30, h: 30, image: 'bon' },
    { id: 'i2', type: 'image', x: 60, y: 110, w: 30, h: 30, image: 'espion' },
    { id: 'i3', type: 'image', x: 100, y: 110, w: 30, h: 30, image: 'code' },
    { id: 'tb', type: 'tableau', x: 20, y: 150, w: 100, h: 20, tableau: { cols: [50, 50], lignes: [20], cellules: [
      { l: 0, c: 0, html: '<p>cellule<img src=x onerror="window.__p10=1"></p>' }, { l: 0, c: 1, html: '<p>ok</p>' }] } }
  ] }]
};

(async () => {
  const edge = await lancer({ largeur: 1300, hauteur: 850 });
  let ko = 0;
  const v = (c, m) => { console.log(c ? '  ok  ' : '  ÉCHEC', m); if (!c) ko++; };
  const requetes = [];
  try {
    await edge.envoyer('Network.enable');
    edge.surEvenement('Network.requestWillBeSent', p => requetes.push(p.request.url));
    await edge.ouvrir(URL_EDITEUR);
    await attendre(600);
    const csp = await edge.eval(`(document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || ''`);
    v(/script-src 'self' 'sha256-/.test(csp) && /object-src 'none'/.test(csp), 'la page déclare sa règle de sécurité (CSP)');
    v(await edge.eval(`typeof E === 'object' && !!document.querySelector('#ruban .panneau')`), 'l\'application démarre malgré la règle (empreinte du code juste)');
    // la règle bloque à elle seule un code glissé dans un attribut
    await edge.eval(`document.body.insertAdjacentHTML('beforeend', '<img src="x-inexistant" onerror="window.__csp=1">')`);
    await attendre(300);
    v(await edge.eval(`window.__csp === undefined`), 'CSP : un code placé dans un attribut onerror est bloqué');

    await edge.eval(`ouvrirFichier(new File([${JSON.stringify(JSON.stringify(fiche))}], 'piege.pagelibre'))`);
    await attendre(1200);
    v(await edge.eval(`E.fiche.titre.indexOf('<') < 0 && pageCourante().items.length === 5`), 'le document piégé s\'ouvre (5 objets), titre sans balise');
    const html = await edge.eval(`E.fiche.pages[0].items[0].html`);
    v(/Texte gardé/.test(html) && /lien sûr/.test(html) && /lien piégé/.test(html), 'le texte est gardé');
    v(!/onerror|onload|onclick|<script|<iframe|<svg|<style|javascript:|exemple\.invalid|id="boite"|name=/i.test(html), 'code, cadres, adresses espionnes et identifiants retirés du texte');
    v(/href="https:\/\/exemple\.org\/"/.test(html) && /rel="noopener noreferrer"/.test(html), 'le lien sûr est gardé (ouverture dans un nouvel onglet)');
    v(await edge.eval(`!('espion' in E.fiche.images) && !('code' in E.fiche.images) && ('bon' in E.fiche.images)`), 'images : seules les images intégrées sont gardées');
    v(await edge.eval(`!/onerror/.test(E.fiche.pages[0].items[4].tableau.cellules[0].html) && /cellule/.test(E.fiche.pages[0].items[4].tableau.cellules[0].html)`), 'cellules de tableau nettoyées');
    v(await edge.eval(`!/[<>"']/.test(E.fiche.styles[0].police) && E.fiche.styles[0].couleur === '#000000'`), 'styles : police et couleur nettoyées');
    // on parcourt les vues qui affichent des données du document
    await edge.eval(`document.querySelector('[data-onglet="accueil"]').click()`);
    await edge.eval(`(() => { const b = document.querySelector('[data-menu="styles"]'); if (b) b.click(); })()`);
    await attendre(300);
    await edge.eval(`fermerMenu(); ouvrirCoulisses('infos')`);
    await attendre(200);
    await edge.eval(`fermerCoulisses(); E.sel = ['t1']; entrerEdition(objetParId('t1'))`).catch(() => {});
    await attendre(300);
    await edge.eval(`quitterEdition()`);
    await attendre(300);
    const p = await edge.eval(`[1,2,3,4,5,6,7,8,9,10].filter(i => window['__p' + i] !== undefined)`);
    v(p.length === 0, 'aucun code du document ne s\'est exécuté' + (p.length ? ' : pièges ' + p.join(', ') : ''));
    v(await edge.eval(`document.querySelectorAll('#feuille-hote [onerror],#feuille-hote [onload],#feuille-hote [onclick],#feuille-hote iframe,#feuille-hote script').length === 0`), 'la page affichée ne contient aucun attribut ni élément actif');
    v(await edge.eval(`document.querySelector('#boite') && document.querySelector('#boite').classList.contains('boite')`), 'les éléments de l\'application ne sont pas remplacés par ceux du document');
    // enregistrement : le document sauvegardé reste propre
    // (le titre est du texte simple, toujours affiché comme tel : ses mots restent, sans les balises)
    // (idem pour un nom de police : sans guillemets ni balises, il ne peut pas sortir de la mise en forme)
    const doc = JSON.parse(await edge.eval(`jsonFiche()`));
    doc.titre = ''; (doc.styles || []).forEach(s => { s.police = ''; });
    const json = JSON.stringify(doc);
    const reste = json.match(/.{0,60}(onerror|javascript:|exemple\.invalid).{0,60}/);
    v(!reste, 'le document réenregistré est propre' + (reste ? ' : ' + reste[0] : ''));
    v(!requetes.some(u => /exemple\.invalid/.test(u)), `aucune requête vers une adresse espionne (${requetes.length} requêtes observées)`);
    const erreurs = edge.consoleMsgs.filter(m => /EXCEPTION|TypeError|ReferenceError/i.test(m));
    v(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) { ko++; console.log('ERREUR', e.message); }
  finally { await edge.fermer(); }
  console.log(ko ? `\n${ko} échec(s)` : '\ntout est bon');
  process.exit(ko ? 1 : 0);
})();
