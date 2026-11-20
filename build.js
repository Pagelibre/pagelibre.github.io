// Assemble PageLibre : node build.js
//  - docs/            : le site publié (GitHub Pages) : application installable (PWA)
//  - dist/PageLibre.html : la même application en un seul fichier, à ouvrir sans Internet
'use strict';
const fs = require('fs');
const path = require('path');

const ici = __dirname;
const S = n => fs.readFileSync(path.join(ici, 'sources', n), 'utf8');
const config = fs.existsSync(path.join(ici, 'config.json')) ? JSON.parse(fs.readFileSync(path.join(ici, 'config.json'), 'utf8')) : {};

// version = date et heure de l'assemblage : cache du service worker et mise à jour des fiches
const d = new Date();
const p2 = n => String(n).padStart(2, '0');
const VERSION = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;

const LOGO = S('web/logo.svg').trim();
const CSS_RENDU = S('rendu.css');
const CSS = S('editeur.css');
const entete = [
  `const VERSION_EDITEUR = '${VERSION}';`,
  `const DEPOT_URL = ${JSON.stringify(config.depot || '')};`,
  `const LIEN_SOUTIEN = ${JSON.stringify(config.soutien || '')};`,
  `const LOGO_SVG = ${JSON.stringify(LOGO)};`
].join('\n');
const JS = entete + '\n' + ['lecteur_pub.js', 'rendu.js', 'metafichier.js', 'icones.js', 'editeur_noyau.js', 'editeur_texte.js', 'editeur_tableau.js',
  'editeur_souris.js', 'editeur_ruban.js', 'editeur_plus.js', 'editeur_plus2.js', 'editeur_plus3.js', 'pwa.js', 'editeur_fichier.js']
  .map(n => `/* ==== ${n} ==== */\n` + S(n)).join('\n');

if (/<\/script/i.test(JS)) throw new Error('Le code contient « </script » : à écrire « <\\/script » pour ne pas casser la page.');
if (/<\/style/i.test(CSS + CSS_RENDU)) throw new Error('Le CSS contient « </style ».');

const page = S('page.html')
  .replace('/*CSSRENDU*/', () => CSS_RENDU)
  .replace('/*CSS*/', () => CSS)
  .replace('/*LOGO*/', () => LOGO)
  .replace('/*JS*/', () => JS);

// site
const docs = path.join(ici, 'docs');
fs.mkdirSync(path.join(docs, 'icons'), { recursive: true });
fs.writeFileSync(path.join(docs, 'index.html'), page, 'utf8');
fs.writeFileSync(path.join(docs, 'sw.js'), S('web/sw.js').replace('/*VERSION*/', VERSION.replace(/[:T]/g, '-')), 'utf8');
for (const f of ['manifest.webmanifest', 'logo.svg', 'confidentialite.html']) fs.copyFileSync(path.join(ici, 'sources', 'web', f), path.join(docs, f));
const icones = path.join(ici, 'sources', 'web', 'icons');
if (fs.existsSync(icones)) for (const f of fs.readdirSync(icones)) fs.copyFileSync(path.join(icones, f), path.join(docs, 'icons', f));
fs.writeFileSync(path.join(docs, '.nojekyll'), '');

// fichier unique
fs.mkdirSync(path.join(ici, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ici, 'dist', 'PageLibre.html'), page, 'utf8');

console.log(`PageLibre ${VERSION} : docs/ (site) et dist/PageLibre.html (${Math.round(page.length / 1024)} Ko)`);
