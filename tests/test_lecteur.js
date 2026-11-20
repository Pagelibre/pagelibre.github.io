// Test du lecteur .pub : node tests/test_lecteur.js <fichier.pub>... [--json dossier]
'use strict';
const fs = require('fs');
const path = require('path');
const { lirePub } = require('../sources/lecteur_pub.js');

const args = process.argv.slice(2);
const iJson = args.indexOf('--json');
const dossierJson = iJson >= 0 ? args.splice(iJson, 2)[1] : null;
let echecs = 0;
for (const f of args) {
  const nom = path.basename(f);
  try {
    const t0 = Date.now();
    const fiche = lirePub(fs.readFileSync(f), { nom });
    const parType = {};
    let nb = 0;
    const tout = [...fiche.pages, ...Object.values(fiche.maitres)];
    for (const p of tout) for (const o of p.items) { parType[o.type] = (parType[o.type] || 0) + 1; nb++; }
    console.log(`OK  ${nom} : page ${fiche.page.w}x${fiche.page.h} mm, ${fiche.pages.length} page(s), ` +
      `${Object.keys(fiche.maitres).length} maître(s), ${nb} objets ${JSON.stringify(parType)}, ` +
      `${Object.keys(fiche.images).length} images, ${Date.now() - t0} ms`);
    if (fiche.avertissements.length) console.log('    avertissements :', fiche.avertissements);
    // contrôles de cohérence
    for (const p of fiche.pages) for (const o of p.items) {
      for (const k of ['x', 'y', 'w', 'h']) if (!Number.isFinite(o[k])) throw new Error(`${o.id} : ${k} invalide`);
      if (o.type === 'image' && !o.image) console.log('    image manquante', o.id);
    }
    if (dossierJson) {
      fs.mkdirSync(dossierJson, { recursive: true });
      fs.writeFileSync(path.join(dossierJson, nom.replace(/\.pub$/i, '.json')), JSON.stringify(fiche, (k, v) => (k === 'images' ? Object.keys(v) : v), 1));
    }
  } catch (e) {
    echecs++;
    console.log(`ERR ${nom} : ${e.stack}`);
  }
}
process.exit(echecs ? 1 : 0);
