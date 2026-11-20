// Fabrique les icônes PNG de l'application à partir des logos SVG : node outils/fabriquer_icones.js
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer } = require('../tests/cdp');

(async () => {
  const web = path.join(__dirname, '..', 'sources', 'web');
  fs.mkdirSync(path.join(web, 'icons'), { recursive: true });
  const edge = await lancer({ largeur: 600, hauteur: 600 });
  try {
    await edge.ouvrir('about:blank');
    for (const [svg, nom, taille] of [['logo.svg', 'icon-192.png', 192], ['logo.svg', 'icon-512.png', 512], ['logo-maskable.svg', 'maskable-512.png', 512]]) {
      const src = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(web, svg)).toString('base64');
      const png = await edge.eval(`(async () => { const i = new Image(); i.src = ${JSON.stringify(src)}; await i.decode();
        const c = document.createElement('canvas'); c.width = c.height = ${taille}; c.getContext('2d').drawImage(i, 0, 0, ${taille}, ${taille});
        return c.toDataURL('image/png').split(',')[1]; })()`);
      fs.writeFileSync(path.join(web, 'icons', nom), Buffer.from(png, 'base64'));
      console.log('écrit', nom);
    }
  } finally { await edge.fermer(); }
})().catch(e => { console.error(e); process.exit(1); });
