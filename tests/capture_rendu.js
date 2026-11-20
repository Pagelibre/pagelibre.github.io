// node tests/capture_rendu.js <fichier.pub> <sortie.png> [numPage]
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer } = require('./cdp');

(async () => {
  const [fichier, sortie, numPageArg, zoom] = process.argv.slice(2);
  const numPage = numPageArg === 'tout' ? null : numPageArg;
  const edge = await lancer({ largeur: 1700, hauteur: 1200 });
  try {
    await edge.ouvrir('file:///' + path.resolve(__dirname, 'apercu.html').replace(/\\/g, '/'));
    const b64 = fs.readFileSync(fichier).toString('base64');
    const r = await edge.eval(`afficherPub(${JSON.stringify(b64)}, ${JSON.stringify(path.basename(fichier))}, ${numPage != null ? +numPage : 'null'}, ${zoom ? +zoom : 'null'})`);
    console.log(r);
    await new Promise(ok => setTimeout(ok, 600));
    const dim = await edge.eval(`(() => { const r = document.getElementById('sortie').getBoundingClientRect(); return { w: Math.ceil(r.width), h: Math.ceil(r.height) }; })()`);
    await edge.capture(sortie, { x: 0, y: 0, width: dim.w, height: dim.h });
    if (edge.consoleMsgs.length) console.log(edge.consoleMsgs.join('\n'));
  } finally {
    await edge.fermer();
  }
})().catch(e => { console.error(e); process.exit(1); });
