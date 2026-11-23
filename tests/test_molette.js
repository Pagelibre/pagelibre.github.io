// Zoom à la molette : node tests/test_molette.js
'use strict';
const path = require('path');
const { lancer, attendre } = require('./cdp');
const URL_EDITEUR = 'file:///' + path.resolve(__dirname, '..', 'docs', 'index.html').replace(/\\/g, '/');

(async () => {
  const edge = await lancer({ largeur: 1400, hauteur: 800 });
  let ko = 0;
  const v = (c, m) => { console.log(c ? '  ok  ' : '  ÉCHEC', m); if (!c) ko++; };
  try {
    await edge.ouvrir(URL_EDITEUR);
    await attendre(1500); // polices et mise en page terminées (machine lente : GitHub)
    const molette = async (x, y, dy, mod) => {
      await edge.envoyer('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy, modifiers: mod || 0 });
      await attendre(350);
    };
    const pts = await edge.eval(`(() => { const f = E.feuille.getBoundingClientRect(), d = document.querySelector('#defile').getBoundingClientRect(), v = document.querySelector('#liste-pages').getBoundingClientRect(), r = document.querySelector('#regle-h').getBoundingClientRect();
      return { page: [f.left + f.width / 2, f.top + f.height / 2], gris: [d.left + 20, d.top + 20], volet: [v.left + 50, v.top + 50], regle: [r.left + 200, r.top + 10] }; })()`);
    for (const [nom, [x, y]] of Object.entries(pts)) {
      const z0 = await edge.eval('E.zoom');
      await molette(x, y, -120, 2); // Ctrl + molette vers le haut
      const z1 = await edge.eval('E.zoom');
      v(z1 > z0, `Ctrl+molette sur ${nom} : ${Math.round(z0 * 100)} % → ${Math.round(z1 * 100)} %`);
    }
    const z0 = await edge.eval('E.zoom');
    await molette(pts.page[0], pts.page[1], -120, 0);
    const z1 = await edge.eval('E.zoom'), s = await edge.eval(`document.querySelector('#defile').scrollTop`);
    v(Math.abs(z1 - z0) < 1e-9, `molette seule : défile sans zoomer (zoom ${Math.round(z1 * 100)} %, défilement ${s})`);
    await edge.eval(`E.options.zoomMolette = true; appliquerOptions()`);
    await molette(pts.page[0], pts.page[1], -120, 0);
    const z2 = await edge.eval('E.zoom');
    v(z2 > z1, `option « zoom avec la molette seule » : ${Math.round(z1 * 100)} % → ${Math.round(z2 * 100)} %`);
    await molette(pts.page[0], pts.page[1], 120, 0);
    v(await edge.eval('E.zoom') < z2, 'molette vers le bas : zoom arrière');
    await edge.eval(`E.options.zoomMolette = false; appliquerOptions(); zoomPage()`);
    const z3 = await edge.eval('E.zoom');
    await edge.touche('+', 'NumpadAdd', 2);
    v(await edge.eval('E.zoom') > z3, 'Ctrl + plus : zoom avant du document');
    v(await edge.eval('document.querySelector("#barre-titre").getBoundingClientRect().height') === 32, "l'interface elle-même n'a pas été agrandie");
    console.log('  zoom du navigateur :', await edge.eval('Math.round(devicePixelRatio * 100) + " %"'));
  } finally { await edge.fermer(); }
  process.exit(ko ? 1 : 0);
})();
