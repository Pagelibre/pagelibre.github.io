// Dessine la mascotte (l'avocat) : node outils/dessiner_mascotte.js
// Une seule source pour les logos (logo.svg, logo-petit.svg, logo-maskable.svg) et pour la mascotte animée (mascotte.svg).
// Ensuite : node outils/fabriquer_icones.js (icônes PNG), puis node build.js.
'use strict';
const fs = require('fs');
const path = require('path');
const web = path.join(__dirname, '..', 'sources', 'web');

const VERT = '#4c7a34', VERT2 = '#3c6329', BLEU = '#23405e', BRUN = '#33251c', PECHE = '#ffd9b8';

/* ---------------- morceaux (repère 64 × 64) ---------------- */
const pied = x => `<path d="M${x} 58.500v3" stroke="${VERT2}" stroke-width="4" stroke-linecap="round"/>`;
const pieds = pied(26.5) + pied(37.5);
const corps = `<path d="M32 9.5C24.6 9.5 21.8 16 20.3 23 18.8 29.6 12.5 34.6 12.5 43.6 12.5 53.6 21 60 32 60s19.5-6.4 19.5-16.4c0-9-6.3-14-7.8-20.6C42.2 16 39.4 9.5 32 9.5z" fill="${VERT}"/>
<path d="M32 12.6c-5.4 0-7.6 5.2-9 11.3-1.6 7-7.5 11.4-7.5 19.5 0 8.3 7 13.6 16.5 13.6s16.5-5.3 16.5-13.6c0-8.100-5.9-12.5-7.5-19.5-1.4-6.1-3.6-11.3-9-11.3z" fill="#a9cf5a"/>
<path d="M32 15c-4 0-5.7 4.3-7 9.6-1.7 7.3-7.2 11.3-7.2 18.7 0 7 6 11.5 14.2 11.5s14.2-4.5 14.2-11.5c0-7.4-5.5-11.4-7.2-18.7C37.7 19.3 36 15 32 15z" fill="#eaf3b4"/>`;
const noyau = `<circle cx="32" cy="46.3" r="7" fill="#9a5f33"/><path d="M27.6 44.6a5 5 0 0 1 3.6-3.3" fill="none" stroke="#d3a06f" stroke-width="1.7" stroke-linecap="round"/>`;
const joues = `<ellipse cx="23.3" cy="34" rx="2.4" ry="1.5" fill="#f79a93"/><ellipse cx="40.7" cy="34" rx="2.4" ry="1.5" fill="#f79a93"/>`;
const yeux = `<ellipse cx="26.4" cy="29.5" rx="2.5" ry="2.9" fill="${BRUN}"/><ellipse cx="37.6" cy="29.5" rx="2.5" ry="2.9" fill="${BRUN}"/><circle cx="27.3" cy="28.3" r="1" fill="#fff"/><circle cx="38.5" cy="28.3" r="1" fill="#fff"/><circle cx="25.7" cy="30.9" r=".5" fill="#fff"/><circle cx="36.9" cy="30.9" r=".5" fill="#fff"/>`;
const sourire = `<path d="M28.3 32q3.7 5.6 7.4 0z" fill="#e2574f" stroke="${BRUN}" stroke-width="1.1" stroke-linejoin="round"/>`;

// fiche mise en page, centrée sur 0,0 (14 × 17,6)
const fiche = `<path d="M-7-7.2a1.6 1.6 0 0 1 1.6-1.6H2.6L7-4.5V7.2a1.6 1.6 0 0 1-1.6 1.6H-5.400A1.6 1.6 0 0 1-7 7.2z" fill="#fff" stroke="${BLEU}" stroke-width="1.2" stroke-linejoin="round"/><path d="M2.6-8.800v2.900a1.400 1.400 0 0 0 1.4 1.4H7z" fill="#c9d8e8" stroke="${BLEU}" stroke-width="1.2" stroke-linejoin="round"/><rect x="-4.6" y="-6" width="5" height="4.400" rx=".7" fill="#f2b705"/>`;
const lignesFiche = `<path d="M2.600-1.900h2M-4.300 1h8.600M-4.300 3.800h8.600M-4.300 6.400h4" stroke="${BLEU}" stroke-width="1.300" stroke-linecap="round"/>`;
// crayon, main en 0,0, pointe vers le bas
const crayon = `<path d="M-2.4-10.5h4.8V6h-4.8z" fill="#f2b705"/><path d="M.2-10.5h2.2V6H.2z" fill="#d99a00"/><path d="M-2.4-13.600a1.300 1.300 0 0 1 1.3-1.3h2.2a1.300 1.300 0 0 1 1.3 1.3v1.6h-4.8z" fill="#f28f8a"/><path d="M-2.4-12h4.8v1.700h-4.8z" fill="#cfd6dd"/><path d="M-2.4 6h4.800L0 11.8z" fill="#e8b673"/><path d="M-.9 9.700H.9L0 11.8z" fill="${BRUN}"/>`;
const bras = d => `<path d="${d}" fill="none" stroke="${VERT}" stroke-width="3.8" stroke-linecap="round"/>`;
// main : paume ronde et pouce posé devant l'objet, détachés du bras par un filet plus sombre
const main = (x, y, dx, dy) => `<g transform="translate(${x} ${y})"><path d="M0 0L${dx} ${dy}" stroke="${VERT2}" stroke-width="3.5" stroke-linecap="round"/><circle r="3.1" fill="${VERT2}"/><path d="M0 0L${dx} ${dy}" stroke="#629a45" stroke-width="2.3" stroke-linecap="round"/><circle r="2.5" fill="#629a45"/></g>`;

/* ---------------- pose de base : la fiche d'une main, le crayon de l'autre ---------------- */
// le bras part du flanc, remonte, et la main tient la fiche par le bas
const brasFiche = bras('M13.2 44.8C9 47.4 5.6 43.600 7.900 38.400') + `<g transform="translate(6.6 27.6) rotate(-8) scale(1.1)">${fiche}${lignesFiche}</g>` + main(8.2, 37.8, 0.5, -3.6);
const brasCrayon = bras('M50.8 44.8C54.600 47.200 57.600 44.200 56.600 39.800') + `<g transform="translate(56.800 37.600) rotate(16)">${crayon}</g>` + main(56.5, 39.2, -2.7, -1.2);
const debout = pieds + corps + noyau + joues + yeux + sourire + brasFiche + brasCrayon;

/* ---------------- logos ---------------- */
const tuile = `<rect width="64" height="64" rx="14" fill="${PECHE}"/>`;
const yeuxP = `<ellipse cx="25.6" cy="29.5" rx="3.3" ry="3.8" fill="${BRUN}"/><ellipse cx="38.4" cy="29.5" rx="3.3" ry="3.8" fill="${BRUN}"/><circle cx="26.8" cy="28" r="1.35" fill="#fff"/><circle cx="39.6" cy="28" r="1.35" fill="#fff"/><path d="M27.8 33.4q4.2 6.2 8.4 0z" fill="#e2574f" stroke="${BRUN}" stroke-width="1.5" stroke-linejoin="round"/><ellipse cx="21.8" cy="35.3" rx="2.700" ry="1.8" fill="#f79a93"/><ellipse cx="42.2" cy="35.3" rx="2.700" ry="1.8" fill="#f79a93"/>`;
const svg = (c, vb = '0 0 64 64', attr = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${attr}>${c}</svg>`;
const D = `<g transform="translate(32 33) scale(.9) translate(-30.7 -36.5)">${debout}</g>`;

/* ---------------- mascotte animée : mêmes morceaux, rangés par pose et par expression ---------------- */
const g = (c, d) => `<g class="${c}">${d}</g>`;
const trait = (d, e = 1.3) => `<path d="${d}" fill="none" stroke="${BRUN}" stroke-width="${e}" stroke-linecap="round" stroke-linejoin="round"/>`;
const etoile = (x, y, r) => `<path transform="translate(${x} ${y}) scale(${r})" d="M0-1Q.15-.15 1 0 .15.15 0 1-.15.15-1 0-.15-.15 0-1z" fill="#f2b705"/>`;
const visage = joues +
  g('m-e m-yeux', g('m-cligne', yeux)) +
  g('m-e m-ronds', `<circle cx="26.4" cy="29.2" r="3.4" fill="${BRUN}"/><circle cx="37.6" cy="29.2" r="3.4" fill="${BRUN}"/><circle cx="27.5" cy="27.7" r="1.3" fill="#fff"/><circle cx="38.7" cy="27.7" r="1.3" fill="#fff"/>`) +
  g('m-e m-joyeux', trait('M23.9 30.6q2.5-4 5 0M35.1 30.6q2.500-4 5 0', 1.7)) +
  g('m-e m-clos', trait('M23.9 29.4q2.5 2.700 5 0M35.1 29.4q2.500 2.700 5 0', 1.6)) +
  g('m-b m-sourire', sourire) +
  g('m-b m-oh', `<ellipse cx="32" cy="35" rx="1.7" ry="2.1" fill="#e2574f" stroke="${BRUN}" stroke-width="1.1"/>`) +
  g('m-b m-baille', `<ellipse cx="32" cy="35" rx="2.8" ry="3.4" fill="#8d2f2a" stroke="${BRUN}" stroke-width="1.1"/><path d="M30.1 36.5q1.9-1.5 3.8 0-.5 1.3-1.9 1.4-1.4-.1-1.9-1.4z" fill="#f28f8a"/>`) +
  g('m-b m-petite', trait('M30.4 34.2q1.6 1.5 3.200 0', 1.2)) +
  g('m-b m-oups', trait('M28.800 34.600q1.100-1.500 2.200 0t2.200 0 2.200 0', 1.2));
const poses =
  g('m-p m-debout', g('m-bras-fiche', brasFiche) + g('m-bras-crayon', brasCrayon)) +
  // prend des notes : la fiche devant lui, le crayon qui écrit (trois temps)
  g('m-p m-ecrit', bras('M14.4 43.600C14.600 48.600 17.600 51 21.400 50.600') + `<g transform="translate(30.500 48.500) rotate(-5)">${fiche}<path class="m-l1" d="M-4.300 1h8.600" stroke="${BLEU}" stroke-width="1.300" stroke-linecap="round"/><path class="m-l2" d="M-4.300 3.800h8.600" stroke="${BLEU}" stroke-width="1.300" stroke-linecap="round"/></g>` + main(22.4, 50.6, 3, -0.8) +
    g('m-main-ecrit', bras('M49.6 43.600C51 47.600 49 50 45.200 48.300') + `<g transform="translate(43.200 46.200) rotate(42) scale(.82)">${crayon}</g>` + main(44.2, 47.4, -2.6, -1.6))) +
  // dort, la fiche en couverture
  g('m-p m-dort', `<g transform="translate(32 50) rotate(90) scale(1.050 1.450)">${'<path d="M-4.8-7.500a1.300 1.300 0 0 1 1.300-1.300H5.700a1.300 1.300 0 0 1 1.300 1.300v15a1.300 1.300 0 0 1-1.300 1.300h-9.200a1.300 1.300 0 0 1-1.300-1.300z" fill="#fff" stroke="' + BLEU + '" stroke-width="1" stroke-linejoin="round"/><path d="M-1.500-5.800v11.600M1.300-5.800v11.600M4.100-5.800v7" stroke="#b9c8d8" stroke-width="1" stroke-linecap="round"/>'}</g>` +
    bras('M14.600 43.600Q16.400 46.600 20.600 45.800') + bras('M49.400 43.600Q47.600 46.600 43.400 45.800') + main(21.6, 45.9, 1.2, 2.2) + main(42.4, 45.9, -1.2, 2.2) +
    `<g transform="translate(31.6 12.6) rotate(6) scale(.95)"><path d="M-8.600 5.200C-8-3.500-2-8.500 5-8.600 10-8.600 13.500-5 14.800.6 10.500-2.500 9.300-.5 8.700 5.200z" fill="#4a7fb5"/><path d="M-2.500-5.300q3.600 3.300 3.700 9.700M3.800-8.300q2.600 2.500 2.300 5.600" fill="none" stroke="#7fa9d3" stroke-width="1.500"/><rect x="-10" y="3.200" width="20" height="4.200" rx="2.100" fill="#fff" stroke="#c9d8e8" stroke-width=".7"/><circle cx="14.800" cy="1.600" r="2.300" fill="#fff" stroke="#c9d8e8" stroke-width=".7"/></g>`);
const z = (x, y, t) => `<path transform="translate(${x} ${y}) scale(${t})" d="M0 0H4L0 5H4" fill="none" stroke="#5b7fa3" stroke-width="${(1.5 / t).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const effets =
  g('m-x m-zzz', z(47.500, 17, 0.8) + z(52.500, 10.500, 1) + z(58, 3.500, 1.2)) +
  g('m-x m-eclats', etoile(47.5, 12, 3.6) + etoile(16.500, 13, 2.8) + etoile(53.5, 20, 2.200)) +
  g('m-x m-goutte', `<path d="M45.800 17.500q3.600 4.700 0 6.300-3.600-1.600 0-6.300z" fill="#7cc4ef" stroke="#4a90c2" stroke-width=".6"/>`) +
  g('m-x m-larme', `<path d="M41.600 31.200q1.500 2 0 2.700-1.500-.700 0-2.700z" fill="#7cc4ef"/>`);
const mascotte = g('m-tout', g('m-pied-g', pied(26.5)) + g('m-pied-d', pied(37.5)) + corps + noyau + g('m-visage', visage) + poses) + effets;

/* ---------------- écriture ---------------- */
// chiffres sans zéros inutiles ni retours à la ligne
const propre = t => t.replace(/(\d*\.\d*?[1-9])0+(?=[^\d.])/g, '$1').replace(/\n\s*/g, '');
const sorties = {
  'logo.svg': svg(tuile + D),
  'logo-petit.svg': svg(tuile + `<g transform="translate(32 32) scale(1.12) translate(-32 -34.75)">${corps}${noyau}${yeuxP}</g>`),
  'logo-maskable.svg': svg(`<rect width="64" height="64" fill="${PECHE}"/><g transform="translate(32 32) scale(.8) translate(-32 -32)">${D}</g>`),
  // sur le bandeau bleu : verts un peu plus clairs, « Zzz » clairs
  'mascotte.svg': svg(mascotte.split(VERT).join('#6a9f45').split(VERT2).join('#55873a').split('#5b7fa3').join('#dbe8f6'), '-6 1 76 63', ' aria-hidden="true"')
};
for (const [n, c] of Object.entries(sorties)) { fs.writeFileSync(path.join(web, n), propre(c) + '\n'); console.log('écrit', n, propre(c).length, 'octets'); }
