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

// polices libres aux mêmes mesures que les polices Office, déclarées sous le nom d'origine :
// la police installée est prise si elle existe (local), sinon la police libre intégrée.
// Une fiche s'affiche donc pareil sur tous les ordinateurs, et dans les PDF et les images exportées.
const POLICES_LIBRES = [
  ['Carlito', 'Calibri', { '400normal': ['Calibri', 'Calibri'], '700normal': ['Calibri Bold', 'Calibri-Bold'], '400italic': ['Calibri Italic', 'Calibri-Italic'], '700italic': ['Calibri Bold Italic', 'Calibri-BoldItalic'] }],
  ['Caladea', 'Cambria', { '400normal': ['Cambria', 'Cambria'], '700normal': ['Cambria Bold', 'Cambria-Bold'], '400italic': ['Cambria Italic', 'Cambria-Italic'], '700italic': ['Cambria Bold Italic', 'Cambria-BoldItalic'] }],
  ['Arimo', 'Arial', { '400normal': ['Arial', 'ArialMT'], '700normal': ['Arial Bold', 'Arial-BoldMT'], '400italic': ['Arial Italic', 'Arial-ItalicMT'], '700italic': ['Arial Bold Italic', 'Arial-BoldItalicMT'] }],
  ['Tinos', 'Times New Roman', { '400normal': ['Times New Roman', 'TimesNewRomanPSMT'], '700normal': ['Times New Roman Bold', 'TimesNewRomanPS-BoldMT'], '400italic': ['Times New Roman Italic', 'TimesNewRomanPS-ItalicMT'], '700italic': ['Times New Roman Bold Italic', 'TimesNewRomanPS-BoldItalicMT'] }]
];
function cssPolices() {
  const dossier = path.join(ici, 'sources', 'polices');
  const regles = [];
  for (const [libre, origine, locales] of POLICES_LIBRES) {
    for (const style of ['normal', 'italic']) for (const poids of ['400', '700']) {
      // Arimo est une police « variable » : un seul fichier par style pour les deux graisses
      const f = [`${libre}-${style}-${poids}.woff2`, `${libre}-${style}-400.woff2`].map(n => path.join(dossier, n)).find(fs.existsSync);
      const donnees = fs.readFileSync(f).toString('base64');
      const [l1, l2] = locales[poids + style];
      regles.push(`@font-face{font-family:'${origine}';font-style:${style};font-weight:${poids};font-display:swap;src:local('${l1}'),local('${l2}'),url(data:font/woff2;base64,${donnees}) format('woff2')}`);
    }
  }
  return `/* Polices libres intégrées (${POLICES_LIBRES.map(p => p[0] + ' pour ' + p[1]).join(', ')}).\n` + fs.readFileSync(path.join(dossier, 'LICENCE.txt'), 'utf8').replace(/\*\//g, '* /') + '\n*/\n' + regles.join('\n') + '\n';
}
const CSS_RENDU = cssPolices() + S('rendu.css');
const CSS = S('editeur.css');
// numéro de version lisible (1.1.0…) : celui de depot/package.json
// (dossier de travail : depot/package.json ; dépôt public : package.json à la racine)
const fichierPaquet = [path.join(ici, 'depot', 'package.json'), path.join(ici, 'package.json')].find(fs.existsSync);
const VERSION_NOM = JSON.parse(fs.readFileSync(fichierPaquet, 'utf8')).version;
const entete = [
  `const VERSION_EDITEUR = '${VERSION}';`,
  `const VERSION_NOM = '${VERSION_NOM}';`,
  `const DEPOT_URL = ${JSON.stringify(config.depot || '')};`,
  `const LIEN_SOUTIEN = ${JSON.stringify(config.soutien || '')};`,
  `const LOGO_SVG = ${JSON.stringify(LOGO)};`
].join('\n');
const JS = entete + '\n' + ['securite.js', 'lecteur_pub.js', 'rendu.js', 'metafichier.js', 'icones.js', 'editeur_noyau.js', 'editeur_texte.js', 'editeur_tableau.js',
  'editeur_souris.js', 'editeur_ruban.js', 'editeur_plus.js', 'editeur_plus2.js', 'editeur_plus3.js', 'nouveautes.js', 'editeur_plus4.js', 'editeur_motifs.js', 'editeur_plus5.js', 'pwa.js', 'editeur_fichier.js']
  .map(n => `/* ==== ${n} ==== */\n` + S(n)).join('\n');

// contrôle de syntaxe : une apostrophe oubliée rendrait toute l'application muette (déjà arrivé) ; on n'écrit rien dans ce cas
try { new (require('vm').Script)(JS, { filename: 'PageLibre' }); } catch (e) { console.error(String(e.stack).split('\n').slice(0, 4).join('\n')); throw new Error('Code invalide, rien n\'est assemblé : ' + e.message); }
if (/<\/script/i.test(JS)) throw new Error('Le code contient « </script » : à écrire « <\\/script » pour ne pas casser la page.');
if (/<\/style/i.test(CSS + CSS_RENDU)) throw new Error('Le CSS contient « </style ».');

let page = S('page.html')
  .replace('/*CSSRENDU*/', () => CSS_RENDU)
  .replace('/*CSS*/', () => CSS)
  .replace('/*LOGO*/', () => LOGO)
  .replace('/*JS*/', () => JS)
  .replace(/\r\n/g, '\n'); // le navigateur ramène les fins de ligne à \n avant de calculer l'empreinte

// règle de sécurité (CSP) : seul le code de PageLibre s'exécute, identifié par son empreinte SHA-256 ;
// pas de code dans les attributs (onclick…), aucun chargement depuis Internet (images, polices : intégrées).
const blocs = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (blocs.length !== 1) throw new Error('Un seul bloc <script> exécutable attendu, trouvé : ' + blocs.length);
const empreinte = require('crypto').createHash('sha256').update(blocs[0], 'utf8').digest('base64');
const CSP = [
  "default-src 'self'", `script-src 'self' 'sha256-${empreinte}'`, "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self' data: blob:", "worker-src 'self' blob:",
  "media-src 'self' data: blob:", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'", "manifest-src 'self'"
].join('; ');
page = page.replace('/*CSP*/', CSP);

// site
const docs = path.join(ici, 'docs');
fs.mkdirSync(path.join(docs, 'icons'), { recursive: true });
fs.writeFileSync(path.join(docs, 'index.html'), page, 'utf8');
fs.writeFileSync(path.join(docs, 'sw.js'), S('web/sw.js').replace('/*VERSION*/', VERSION.replace(/[:T]/g, '-')), 'utf8');
for (const f of ['manifest.webmanifest', 'logo.svg', 'confidentialite.html']) fs.copyFileSync(path.join(ici, 'sources', 'web', f), path.join(docs, f));
fs.copyFileSync(path.join(ici, 'sources', 'polices', 'LICENCE.txt'), path.join(docs, 'licence-polices.txt'));
// lecteur de PDF (pdf.js de Mozilla, Apache 2.0) : chargé à la demande par le site
fs.cpSync(path.join(ici, 'sources', 'vendor'), path.join(docs, 'vendor'), { recursive: true });
const icones = path.join(ici, 'sources', 'web', 'icons');
if (fs.existsSync(icones)) for (const f of fs.readdirSync(icones)) fs.copyFileSync(path.join(icones, f), path.join(docs, 'icons', f));
fs.writeFileSync(path.join(docs, '.nojekyll'), '');

// fichier unique
fs.mkdirSync(path.join(ici, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ici, 'dist', 'PageLibre.html'), page, 'utf8');

console.log(`PageLibre ${VERSION_NOM} (${VERSION}) : docs/ (site) et dist/PageLibre.html (${Math.round(page.length / 1024)} Ko)`);
