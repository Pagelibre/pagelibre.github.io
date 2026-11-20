// node tests/sonde_dom.js <fichier.pub> <numPage> "<expression JS>"
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer } = require('./cdp');
(async () => {
  const [fichier, numPage, expr] = process.argv.slice(2);
  const edge = await lancer({ largeur: 1700, hauteur: 1200 });
  try {
    await edge.ouvrir('file:///' + path.resolve(__dirname, 'apercu.html').replace(/\\/g, '/'));
    const b64 = fs.readFileSync(fichier).toString('base64');
    await edge.eval(`afficherPub(${JSON.stringify(b64)}, ${JSON.stringify(path.basename(fichier))}, ${+numPage})`);
    console.log(JSON.stringify(await edge.eval(expr), null, 1));
  } finally { await edge.fermer(); }
})().catch(e => { console.error(e); process.exit(1); });
