// Quatrième série (polices, images, modèles, tablette, accessibilité, PDF, aide) : node tests/test_ajouts.js [dossier captures]
// Sert docs/ sur un petit serveur local (comme GitHub Pages) : l'import de PDF a besoin d'un site web.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { lancer, attendre } = require('./cdp');

const racine = path.resolve(__dirname, '..', 'docs');
const dossier = process.argv[2] || '.';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const serveur = http.createServer((req, rep) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(racine, p.replace(/^\/pagelibre/, ''));
  if (!f.startsWith(racine) || !fs.existsSync(f)) { rep.writeHead(404); rep.end(); return; }
  rep.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(rep);
});

// petit PDF de 2 pages (A4), fabriqué à la main
function pdfEssai() {
  const objs = [];
  const page = (n, c) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${c} 0 R >>`;
  const flux = t => { const s = `BT /F1 36 Tf 72 700 Td (${t}) Tj ET 0 0 1 rg 72 400 200 100 re f`; return `<< /Length ${s.length} >>\nstream\n${s}\nendstream`; };
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objs[4] = page(1, 5); objs[5] = flux('Page un');
  objs[6] = page(2, 7); objs[7] = flux('Page deux');
  let out = '%PDF-1.4\n';
  const pos = [];
  for (let i = 1; i < objs.length; i++) { pos[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const x = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + pos.slice(1).map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return out;
}

(async () => {
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}/pagelibre/`;
  const edge = await lancer({ largeur: 1400, hauteur: 900 });
  let ko = 0;
  const v = (c, m) => { console.log(c ? '  ok  ' : '  ÉCHEC', m); if (!c) ko++; };
  const cliquerOK = () => edge.eval(`document.querySelector('#boite [data-ok]').click()`);
  try {
    await edge.ouvrir(url);
    await attendre(800);

    /* polices intégrées */
    const polices = await edge.eval(`(() => { let n = 0; for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (r.constructor.name === 'CSSFontFaceRule') n++; } catch (e) {} } return n; })()`);
    v(polices === 16, `16 polices libres déclarées (Calibri, Cambria, Arial, Times New Roman × 4 styles) : ${polices}`);
    const charge = await edge.eval(`document.fonts.load('bold 12pt Calibri').then(l => l.length)`);
    v(charge >= 1, 'la police Calibri (ou Carlito) se charge');

    /* images allégées */
    // « photo » : dégradés et grain, opaque (ce que donne un appareil photo)
    await edge.eval(`window.photo = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      const d = g.createImageData(W, H); for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) { const n = Math.random() * 18;
        d.data[i] = 90 + 120 * x / W + n; d.data[i + 1] = 60 + 100 * y / H + n; d.data[i + 2] = 140 + 60 * Math.sin(x / 90) + n; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0); return c.toDataURL('image/png'); }`);
    const img = await edge.eval(`(async () => {
      const brut = photo(3200, 2000);
      const f = new File([await (await fetch(brut)).blob()], 'photo.png', { type: 'image/png' });
      const r = await lireImage(f);
      return { avant: brut.length, apres: r.url.length, w: r.w, h: r.h, type: r.url.slice(5, 15) };
    })()`);
    v(img.w <= 2400 && img.apres < img.avant / 2 && img.type === 'image/jpeg', `photo de 3 200 px : réduite à ${img.w} px, ${Math.round(img.avant / 1024)} Ko → ${Math.round(img.apres / 1024)} Ko (JPEG)`);
    const transp = await edge.eval(`(async () => {
      const c = document.createElement('canvas'); c.width = 3000; c.height = 600;
      const g = c.getContext('2d'); g.fillStyle = '#c00'; g.beginPath(); g.arc(300, 300, 250, 0, 7); g.fill();
      const f = new File([await (await fetch(c.toDataURL('image/png'))).blob()], 'logo.png', { type: 'image/png' });
      const r = await lireImage(f); return r.url.slice(5, 14);
    })()`);
    v(transp === 'image/png' || transp === 'image/web', `image transparente : la transparence est gardée (${transp})`);
    // compression du document
    await edge.eval(`(async () => {
      E.fiche.images.grosse = photo(2400, 1600);
      avant(); pageCourante().items.push({ id: 'imgC', type: 'image', image: 'grosse', x: 20, y: 20, w: 50, h: 33 }); afficherPage(); apres();
    })()`);
    const avantC = await edge.eval(`E.fiche.images.grosse.length`);
    await edge.eval(`compresserImages(150)`);
    await attendre(500);
    const apresC = await edge.eval(`(() => { const o = objetParId('imgC'); return { cle: o.image, n: E.fiche.images[o.image].length }; })()`);
    v(apresC.cle !== 'grosse' && apresC.n < avantC / 10, `Compresser les images (150 ppp, image de 5 cm) : ${Math.round(avantC / 1024)} Ko → ${Math.round(apresC.n / 1024)} Ko`);
    await edge.eval(`annuler()`);
    v(await edge.eval(`objetParId('imgC').image === 'grosse'`), 'Ctrl+Z rend l\'image d\'origine');

    /* modèles */
    for (const m of ['qcm', 'securite', 'sequence', 'planning']) {
      await edge.eval(`E.modifie = false; nouveauDepuisModele('${m}')`);
      await attendre(250);
      const n = await edge.eval(`pageCourante().items.length`);
      v(n >= 2, `modèle « ${m} » : ${n} objets`);
      if (m === 'qcm') await edge.capture(path.join(dossier, 'ajouts-qcm.png'));
    }
    await edge.eval(`E.modifie = false; nouveauDepuisModele('securite')`);
    await attendre(200);
    await edge.eval(`enregistrerCommeModele()`);
    await attendre(150);
    await edge.eval(`document.querySelector('#mm-nom').value = 'Ma fiche sécurité'`);
    await cliquerOK();
    await attendre(600);
    v((await edge.eval(`listeMesModeles().then(l => l.map(m => m.nom))`)).includes('Ma fiche sécurité'), 'fiche enregistrée dans « Mes modèles »');
    await edge.eval(`E.modifie = false; ouvrirCoulisses('nouveau')`);
    await attendre(700);
    v(await edge.eval(`document.querySelectorAll('#mes-modeles [data-mon-modele]').length === 1 && document.querySelectorAll('#modeles-liste .modele').length === 9`), 'Fichier › Nouveau : 9 modèles et 1 modèle personnel, avec aperçus');
    await edge.capture(path.join(dossier, 'ajouts-nouveau.png'));
    await edge.eval(`document.querySelector('#mes-modeles [data-mon-modele]').click()`);
    await attendre(500);
    v(await edge.eval(`E.fiche.titre === 'Ma fiche sécurité' && pageCourante().items.length > 5 && document.querySelector('#coulisses').hidden`), 'le modèle personnel ouvre une nouvelle fiche');

    /* accessibilité */
    const sansNom = await edge.eval(`[...document.querySelectorAll('#ruban button, #barre-titre button, #etat button')].filter(b => b.offsetParent && !b.textContent.trim() && !b.getAttribute('aria-label')).length`);
    v(sansNom === 0, `tous les boutons à icône ont un nom pour les lecteurs d'écran (${sansNom} sans nom)`);
    await edge.eval(`deselectionner(); document.querySelector('#defile').focus()`);
    await edge.touche('Tab', 'Tab');
    await attendre(150);
    const t1 = await edge.eval(`({ sel: E.sel.slice(), annonce: document.querySelector('#annonce').textContent })`);
    await edge.touche('Tab', 'Tab');
    await attendre(150);
    const t2 = await edge.eval(`E.sel.slice()`);
    v(t1.sel.length === 1 && t2.length === 1 && t1.sel[0] !== t2[0] && /sur \d+/.test(t1.annonce), `Tab passe d'un objet à l'autre (annonce : « ${t1.annonce.slice(0, 60)}… »)`);
    await edge.touche('F6', 'F6');
    await attendre(100);
    v(await edge.eval(`!!document.activeElement.closest('#onglets')`), 'F6 : passage au ruban');
    await edge.eval(`(() => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; E.fiche.images.pic = c.toDataURL('image/png');
      avant(); pageCourante().items.push({ id: 'imgA', type: 'image', image: 'pic', x: 100, y: 200, w: 20, h: 20 }); afficherPage(); apres(); choisir(['imgA']); })()`);
    const verif = await edge.eval(`(() => { verifierAccessibilite(); const t = document.querySelector('#boite').textContent; fermerBoite(); return t; })()`);
    v(/Image sans texte de remplacement/.test(verif), 'le vérificateur signale l\'image non décrite');
    await edge.eval(`texteRemplacement()`);
    await attendre(100);
    await edge.eval(`document.querySelector('#alt-texte').value = 'Schéma de câblage'`);
    await cliquerOK();
    await attendre(200);
    v(await edge.eval(`elementObjet('imgA').querySelector('img').alt === 'Schéma de câblage'`), 'texte de remplacement posé sur l\'image affichée');

    /* tablette : un doigt fait défiler, deux doigts zooment (sur une page vide : un doigt sur un objet le déplace) */
    await edge.eval(`E.modifie = false; chargerFiche(ficheVierge(210, 297, 'vide'))`);
    await attendre(300);
    await edge.eval(`definirZoom(2)`);
    await attendre(200);
    const zone = await edge.eval(`(() => { const r = document.querySelector('#defile').getBoundingClientRect(); return { x: r.left + 30, y: r.top + 30, st: document.querySelector('#defile').scrollTop }; })()`);
    const doigt = (type, pts) => edge.envoyer('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
    await doigt('touchStart', [[zone.x, zone.y + 200]]);
    for (let i = 1; i <= 6; i++) await doigt('touchMove', [[zone.x, zone.y + 200 - i * 25]]);
    await doigt('touchEnd', []);
    await attendre(200);
    const st = await edge.eval(`document.querySelector('#defile').scrollTop`);
    v(st > zone.st + 50, `un doigt fait défiler la page (${zone.st} → ${st} px)`);
    const z0 = await edge.eval(`E.zoom`);
    await doigt('touchStart', [[zone.x + 300, zone.y + 300], [zone.x + 400, zone.y + 300]]);
    for (let i = 1; i <= 5; i++) await doigt('touchMove', [[zone.x + 300 - i * 20, zone.y + 300], [zone.x + 400 + i * 20, zone.y + 300]]);
    await doigt('touchEnd', []);
    await attendre(200);
    const z1 = await edge.eval(`E.zoom`);
    v(z1 > z0 * 1.5, `deux doigts écartés zooment (${Math.round(z0 * 100)} % → ${Math.round(z1 * 100)} %)`);
    v(await edge.eval(`document.body.classList.contains('tactile')`), 'au toucher, les poignées s\'agrandissent (mode tactile)');
    await edge.eval(`zoomPage()`);

    /* PDF en fond de page */
    const pdf = pdfEssai();
    await edge.eval(`E.modifie = false; chargerFiche(ficheVierge(210, 297, 'vide'))`);
    await edge.eval(`boiteImportPDF(new File([${JSON.stringify(pdf)}], 'essai.pdf', { type: 'application/pdf' }))`);
    await attendre(2500);
    const boite = await edge.eval(`document.querySelector('#boite').hidden ? '' : document.querySelector('#boite').textContent`);
    v(/2 dans le PDF/.test(boite), 'le PDF est lu par pdf.js (2 pages)' + (boite ? '' : ' : ' + await edge.eval(`document.querySelector('#bandeau').textContent`)));
    if (boite) {
      await cliquerOK();
      await attendre(3000);
      const r = await edge.eval(`({ n: E.fiche.pages.length, fond: E.fiche.pages.every(p => p.items[0] && p.items[0].arrierePlan), w: E.fiche.page.w, cliquable: getComputedStyle(document.querySelector('.objet.fond-page')).pointerEvents })`);
      v(r.n === 2 && r.fond && Math.abs(r.w - 209.9) < 1 && r.cliquable === 'none', `2 pages créées, chacune avec la page du PDF en fond, format A4, fond non cliquable`);
      await edge.capture(path.join(dossier, 'ajouts-pdf.png'));
      await edge.eval(`choisir([]); commande('toutSelectionner')`);
      v(await edge.eval(`E.sel.length === 0`), 'Ctrl+A ne sélectionne pas le fond de page');
    }

    /* aide et nouveautés */
    await edge.touche('F1', 'F1');
    await attendre(200);
    v(await edge.eval(`!document.querySelector('#coulisses').hidden && /Premiers pas/.test(document.querySelector('#coul-contenu').textContent)`), 'F1 ouvre l\'aide');
    await edge.capture(path.join(dossier, 'ajouts-aide.png'));
    await edge.eval(`fermerCoulisses(); localStorage.setItem('pagelibre-version-vue', '1.0.0'); E.modifie = false`);
    await edge.ouvrir(url);
    await attendre(1500);
    v(await edge.eval(`!document.querySelector('#boite').hidden && /Quoi de neuf/.test(document.querySelector('#boite').textContent) && /1\\.1\\.0/.test(document.querySelector('#boite').textContent)`), 'nouvelle version : « Quoi de neuf » s\'affiche une fois');
    await edge.ouvrir(url);
    await attendre(1200);
    v(await edge.eval(`document.querySelector('#boite').hidden`), '… et pas à l\'ouverture suivante');

    const erreurs = edge.consoleMsgs.filter(m => /EXCEPTION|TypeError|ReferenceError|Refused/i.test(m));
    v(!erreurs.length, 'aucune erreur JavaScript ni blocage de sécurité' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) { ko++; console.log('ERREUR', e.message); }
  finally { await edge.fermer(); serveur.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\ntout est bon');
  process.exit(ko ? 1 : 0);
})();
