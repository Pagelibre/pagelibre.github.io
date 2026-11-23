// Application installable : node tests/test_pwa.js
// Sert docs/ sur un petit serveur local, puis vérifie manifeste, installabilité,
// service worker, fonctionnement hors connexion et format .pagelibre.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { lancer, attendre } = require('./cdp');

const racine = path.resolve(__dirname, '..', 'docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let ok = 0, ko = 0;
function verifier(c, m) { if (c) { ok++; console.log('  ok  ', m); } else { ko++; console.log('  ÉCHEC', m); } }

const serveur = http.createServer((req, rep) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(racine, p.replace(/^\/pagelibre/, ''));
  if (!f.startsWith(racine) || !fs.existsSync(f)) { rep.writeHead(404); rep.end(); return; }
  rep.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(rep);
});

(async () => {
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  // comme sur GitHub Pages : l'application est dans un sous-dossier
  // (variable PAGELIBRE_URL=https://michto-p.github.io/pagelibre/ : contrôle du site réellement en ligne)
  const url = process.env.PAGELIBRE_URL || `http://127.0.0.1:${serveur.address().port}/pagelibre/`;
  const edge = await lancer({ largeur: 1400, hauteur: 850 });
  try {
    await edge.ouvrir(url);
    await attendre(1500);
    verifier(await edge.eval(`performance.getEntriesByType('navigation')[0].type`) === 'navigate', 'première visite : la page ne se recharge pas toute seule');
    const man = await edge.envoyer('Page.getAppManifest');
    verifier(man.url && !man.errors.length, `manifeste lu sans erreur (${man.url.replace(url, '')})`);
    let inst = null;
    try { inst = await edge.envoyer('Page.getInstallabilityErrors'); } catch (e) { inst = null; }
    verifier(inst && !inst.installabilityErrors.length, 'application installable' + (inst && inst.installabilityErrors.length ? ' : ' + JSON.stringify(inst.installabilityErrors) : ''));
    // attentes par sondage (et non durées fixes) : le test reste fiable sur une machine lente (GitHub)
    const jusqua = async (expr, ms = 8000) => { for (let t = 0; t < ms; t += 200) { try { if (await edge.eval(expr)) return true; } catch (e) { /* page en cours de chargement */ } await attendre(200); } return false; };
    await edge.eval(`navigator.serviceWorker.ready.then(() => true)`);
    // le cache est rempli à l'installation : on attend que le service worker soit actif
    await jusqua(`navigator.serviceWorker.getRegistration().then(r => !!(r && r.active && r.active.state === 'activated'))`);
    await edge.ouvrir(url);
    verifier(await jusqua(`!!navigator.serviceWorker.controller`), 'service worker actif (mise en cache faite)');
    // hors connexion : on coupe le serveur et le réseau
    serveur.close();
    await edge.envoyer('Network.enable');
    await edge.envoyer('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await edge.ouvrir(url);
    verifier(await jusqua(`typeof E === 'object' && !!document.querySelector('#ruban .panneau.actif')`), 'l\'application s\'ouvre hors connexion');
    verifier(await edge.eval(`EN_LIGNE && formatParDefaut() === 'pagelibre'`), 'en ligne, le format proposé est .pagelibre');
    // format .pagelibre : enregistrer puis rouvrir
    const ret = await edge.eval(`(async () => {
      nouveauDepuisModele('tp'); await new Promise(r => setTimeout(r, 300));
      const n = pageCourante().items.length, json = jsonFiche();
      E.modifie = false; chargerFiche(ficheVierge(210, 297, 'vide'));
      ouvrirFichier(new File([json], 'essai.pagelibre'));
      await new Promise(r => setTimeout(r, 500));
      return { avant: n, apres: pageCourante().items.length, app: JSON.parse(json).application };
    })()`);
    verifier(ret.app === 'PageLibre' && ret.avant === ret.apres && ret.avant > 3, `document .pagelibre enregistré puis rouvert (${ret.apres} objets)`);
    await edge.eval(`ouvrirCoulisses('apropos')`);
    await attendre(200);
    verifier(await edge.eval(`/GNU GPL version 3/.test(document.querySelector('#coul-contenu').textContent) && /pas affilié à Microsoft/.test(document.querySelector('#coul-contenu').textContent)`), 'page À propos : licence et mention de non-affiliation');
    await edge.capture(path.join(process.argv[2] || '.', 'pwa-apropos.png'));
    const erreurs = edge.consoleMsgs.filter(m => /EXCEPTION|Error/i.test(m) && !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(m));
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) {
    ko++;
    console.log('ERREUR', e.message);
  } finally {
    await edge.fermer();
    try { serveur.close(); } catch (e) { /* déjà fermé */ }
  }
  console.log(`\n${ok} réussis, ${ko} échecs`);
  process.exit(ko ? 1 : 0);
})();
