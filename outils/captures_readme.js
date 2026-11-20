// Captures d'écran du README (modèles génériques uniquement) : node outils/captures_readme.js
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer, attendre } = require('../tests/cdp');

(async () => {
  const sortie = path.join(__dirname, '..', 'captures');
  fs.mkdirSync(sortie, { recursive: true });
  const edge = await lancer({ largeur: 1440, hauteur: 860 });
  const cap = n => edge.capture(path.join(sortie, n));
  try {
    await edge.ouvrir('file:///' + path.resolve(__dirname, '..', 'docs', 'index.html').replace(/\\/g, '/'));
    await attendre(600);
    await edge.eval(`nouveauDepuisModele('tp')`);
    await attendre(800);
    await edge.eval(`(() => { const o = pageCourante().items.find(x => x.type === 'forme' && x.forme === 'rectArrondi'); choisir([o.id]); activerOnglet('format'); })()`);
    await attendre(300);
    await cap('editeur.png');
    await edge.eval(`E.modifie = false; nouveauDepuisModele('affiche'); `);
    await attendre(800);
    await edge.eval(`activerOnglet('insertion')`);
    await attendre(300);
    await cap('affiche.png');
    await edge.eval(`ouvrirCoulisses('nouveau')`);
    await attendre(600);
    await cap('modeles.png');
    console.log('captures écrites dans', sortie);
  } finally { await edge.fermer(); }
})().catch(e => { console.error(e); process.exit(1); });
