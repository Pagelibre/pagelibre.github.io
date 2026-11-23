// Exports Word et PDF, habillages : node tests/test_exports.js
// Le PDF produit est relu par pdf.js (celui de l'import de PDF) ; le Word est décompressé et contrôlé.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { lancer, attendre } = require('./cdp');

const racine = path.resolve(__dirname, '..', 'docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const serveur = http.createServer((req, rep) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(racine, p.replace(/^\/pagelibre/, ''));
  if (!f.startsWith(racine) || !fs.existsSync(f)) { rep.writeHead(404); rep.end(); return; }
  rep.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(rep);
});

// lecture d'une archive zip : { nom: Buffer }
function lireZip(b) {
  const res = {};
  let p = b.lastIndexOf(Buffer.from([0x50, 0x4b, 5, 6]));
  const nb = b.readUInt16LE(p + 10);
  p = b.readUInt32LE(p + 16);
  for (let i = 0; i < nb; i++) {
    const meth = b.readUInt16LE(p + 10), comp = b.readUInt32LE(p + 20), taille = b.readUInt32LE(p + 24), ln = b.readUInt16LE(p + 28), le = b.readUInt16LE(p + 30), lc = b.readUInt16LE(p + 32), off = b.readUInt32LE(p + 42);
    const nom = b.slice(p + 46, p + 46 + ln).toString('utf8');
    const deb = off + 30 + b.readUInt16LE(off + 26) + b.readUInt16LE(off + 28);
    const d = b.slice(deb, deb + comp);
    res[nom] = meth ? zlib.inflateRawSync(d) : d;
    if (res[nom].length !== taille) throw new Error('taille de ' + nom);
    p += 46 + ln + le + lc;
  }
  return res;
}

const s = (t, k) => `<span style="font-family:'Calibri';font-size:11pt;${k || ''}">${t}</span>`;
const p = (t, k, a) => `<p ${a || ''} style="${k || ''}">${t}</p>`;
const lorem = 'Le tableau électrique regroupe les protections de chaque circuit de l’installation. Chaque départ est protégé par un disjoncteur dont le calibre dépend de la section des conducteurs. ';
const B = { c: '#000000', e: 1 }, bords = { h: B, b: B, g: B, d: B };
const FICHE = {
  titre: 'Essai d’export', page: { w: 210, h: 297, marges: [12.7, 12.7, 12.7, 12.7] },
  images: { i1: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2P8z8Dwn4GBgYGJAQoAHxcCAk+Uzr4AAAAASUVORK5CYII=' },
  maitres: { m1: { id: 'm1', nom: 'A', items: [{ id: 'n1', type: 'texte', forme: 'rect', x: 15, y: 283, w: 180, h: 8, html: p(s('Page <span class="champ-page" data-champ="page" contenteditable="false">#</span>')) }] } },
  pages: [
    { id: 'p1', maitre: 'm1', items: [
      { id: 'a1', type: 'texte', forme: 'rect', x: 15, y: 20, w: 80, h: 40, trait: { couleur: '#000000', epaisseur: 1 }, html: p(s('Gras', 'font-weight:bold') + s(' souligné', 'text-decoration:underline') + s(' <a href="https://example.org/">lien</a>')) + p('<span class="puce" contenteditable="false">• </span>' + s('Une puce'), 'margin-left:6mm;text-indent:-6mm') },
      { id: 'a2', type: 'texte', forme: 'rect', x: 110, y: 20, w: 40, h: 15, rot: 60, fond: { couleur: '#e2efda' }, html: p(s('Texte tourné')) },
      { id: 'a3', type: 'image', x: 15, y: 70, w: 30, h: 20, image: 'i1', alt: 'Carré de couleur' },
      { id: 'a4', type: 'forme', forme: 'etoile5', x: 60, y: 70, w: 30, h: 30, fond: { couleur: '#ffc000', degrade: '#c00000', angle: 0 } },
      { id: 'a5', type: 'forme', forme: 'rect', x: 100, y: 70, w: 30, h: 20, fond: { couleur: '#c00000', fondMotif: '#ffffff', points: '0102040810204080' }, ombre: { dx: 1, dy: 1, flou: 1 } },
      { id: 'a6', type: 'ligne', x: 15, y: 110, w: 60, h: 0, trait: { couleur: '#000000', epaisseur: 1, flecheFin: 1 } },
      { id: 'a7', type: 'tableau', x: 15, y: 120, w: 80, h: 20, tableau: { cols: [40, 40], lignes: [10, 10], marges: [1, 1, 1, 1], cellules: [{ l: 0, c: 0, nl: 1, nc: 2, html: p(s('Cellule fusionnée')), bords, fond: '#ffff00' }, { l: 1, c: 0, nl: 1, nc: 1, html: p(s('Gauche')), bords }, { l: 1, c: 1, nl: 1, nc: 1, html: p(s('Droite')), bords, vertical: 'milieu' }] } },
      { id: 'a8', type: 'wordart', x: 110, y: 120, w: 60, h: 15, wordart: { texte: 'Titre', police: 'Arial', gras: true, couleur: '#c00000' } },
      { id: 'a9', type: 'texte', forme: 'rect', x: 15, y: 150, w: 60, h: 12, html: p(`<span style="font-family:'Police Inconnue XYZ', 'Comic Sans MS', cursive;font-size:11pt">Autre police</span>`) },
      { id: 'b1', type: 'forme', forme: 'rect', x: 110, y: 150, w: 20, h: 20, fond: { couleur: '#5b9bd5' }, groupe: 'g1' },
      { id: 'b2', type: 'forme', forme: 'secteur', angles: [0, 90], x: 120, y: 150, w: 20, h: 20, fond: { couleur: '#70ad47' }, groupe: 'g1' },
      { id: 'b3', type: 'texte', forme: 'rect', x: 15, y: 180, w: 45, h: 40, cesure: true, html: p(s('Les responsabilités professionnelles des installateurs nécessitent organisation, anticipation et documentation.')) }
    ] },
    { id: 'p2', maitre: 'm1', items: [
      { id: 'c1', type: 'texte', forme: 'rect', x: 15, y: 20, w: 180, h: 70, html: p(s(lorem.repeat(5))) },
      { id: 'c2', type: 'image', x: 85, y: 32, w: 36, h: 24, image: 'i1', habillage: 'carre' },
      { id: 'c3', type: 'texte', forme: 'rect', x: 105, y: 100, w: 90, h: 60, html: p(s(lorem.repeat(2))) },
      { id: 'c4', type: 'forme', forme: 'ellipse', x: 150, y: 112, w: 40, h: 30, fond: { couleur: '#ffc000' }, habillage: 'serre' },
      { id: 'c5', type: 'texte', forme: 'rect', x: 15, y: 170, w: 180, h: 50, colonnes: 3, html: p(s(lorem.repeat(3))) }
    ] }
  ]
};

(async () => {
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  const url = process.env.PAGELIBRE_URL || `http://127.0.0.1:${serveur.address().port}/pagelibre/`;
  const edge = await lancer({ largeur: 1400, hauteur: 900 });
  let ko = 0;
  const v = (c, m) => { console.log(c ? '  ok  ' : '  ÉCHEC', m); if (!c) ko++; };
  try {
    await edge.ouvrir(url);
    for (let i = 0; i < 60 && !(await edge.eval(`document.readyState === 'complete' && typeof E !== 'undefined' && !!E.fiche`)); i++) await attendre(250);
    await attendre(500);
    await edge.eval(`(() => { E.modifie = false; chargerFiche(${JSON.stringify(FICHE)}); })()`);
    await attendre(600);

    /* --- habillages --- */
    await edge.eval('allerPage(1)');
    await attendre(500);
    const chevauche = await edge.eval(`(() => {
      const res = {};
      for (const [txt, obj] of [['c1', 'c2'], ['c3', 'c4']]) {
        const o = objetParId(obj), f = E.feuille.getBoundingClientRect(), k = f.width / E.fiche.page.w;
        const ct = elementObjet(txt).querySelector('.contenu'), g = document.createRange();
        let touche = 0, lignes = new Set();
        const tw = document.createTreeWalker(ct, NodeFilter.SHOW_TEXT);
        for (let t = tw.nextNode(); t; t = tw.nextNode()) for (let i = 0; i < t.length; i++) {
          if (!t.nodeValue[i].trim()) continue;
          g.setStart(t, i); g.setEnd(t, i + 1);
          const b = g.getBoundingClientRect(), x = ((b.left + b.right) / 2 - f.left) / k, y = ((b.top + b.bottom) / 2 - f.top) / k;
          const dx = (x - o.x - o.w / 2) / (o.w / 2), dy = (y - o.y - o.h / 2) / (o.h / 2);
          if (o.forme === 'ellipse' ? dx * dx + dy * dy < 1 : Math.abs(dx) < 1 && Math.abs(dy) < 1) touche++;
          if (Math.abs(dy) < 1) lignes.add(Math.round(y));
        }
        res[obj] = [touche, lignes.size];
      }
      return res; })()`);
    v(chevauche.c2[0] === 0 && chevauche.c2[1] >= 4, `habillage des deux côtés : aucune lettre sur l'image, sur toutes les lignes (${chevauche.c2})`);
    v(chevauche.c4[0] === 0 && chevauche.c4[1] >= 5, `habillage serré autour d'une ellipse : aucune lettre dessus (${chevauche.c4})`);

    /* --- Word --- */
    const enBase64 = mod => `(async () => { const r = await ${mod}; const u = await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(r.blob); }); return JSON.stringify({ u: u.split(',')[1], remarques: r.remarques, infos: r.infos }); })()`;
    const w = JSON.parse(await edge.eval(enBase64('ExportDocx.fabriquer()')));
    const z = lireZip(Buffer.from(w.u, 'base64'));
    v(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/settings.xml', 'word/numbering.xml'].every(n => z[n]), 'Word : archive complète');
    const xmls = Object.keys(z).filter(n => /\.(xml|rels)$/.test(n));
    const bons = await edge.eval(`(() => ${JSON.stringify(xmls.map(n => z[n].toString('utf8')))}.every(t => !new DOMParser().parseFromString(t, 'application/xml').querySelector('parsererror')))()`);
    v(bons, 'Word : tous les fichiers XML sont bien formés');
    const doc = z['word/document.xml'].toString('utf8'), rels = z['word/_rels/document.xml.rels'].toString('utf8');
    const ids = [...new Set([...doc.matchAll(/r:(?:embed|id)="(rId\d+)"/g)].map(m => m[1]))];
    v(ids.length > 1 && ids.every(i => rels.includes(`Id="${i}"`)), `Word : images et liens tous rattachés (${ids.length})`);
    v([...rels.matchAll(/Target="(media\/[^"]+)"/g)].every(m => z['word/' + m[1]]), 'Word : toutes les images sont dans l’archive');
    v((doc.match(/<w:tbl>/g) || []).length === 1 && /<w:gridSpan w:val="2"\/>/.test(doc), 'Word : vrai tableau, cellule fusionnée');
    v((doc.match(/pageBreakBefore/g) || []).length === 1, 'Word : 2 pages');
    v(/<w:b\/>/.test(doc) && /<w:u w:val="single"\/>/.test(doc) && /<w:numPr>/.test(doc) && /<w:hyperlink/.test(doc), 'Word : gras, souligné, vraie puce, lien');
    v(/rot="3600000"/.test(doc) && /<wpg:wgp>/.test(doc) && /prst="pie"/.test(doc) && /<a:custGeom>/.test(doc) && /<a:gradFill/.test(doc) && /<a:tile /.test(doc), 'Word : rotation, groupe, secteur, étoile, dégradé, hachures');
    v(/linkedTxbx/.test(doc), 'Word : colonnes en zones liées');
    v(/instrText[^>]*> PAGE </.test(doc) && /descr="Carré de couleur"/.test(doc), 'Word : numéro de page, texte de remplacement');
    const noms = [...doc.matchAll(/<(?:wp:docPr|wps:cNvPr|pic:cNvPr) id="(\d+)"/g)].map(m => m[1]);
    v(noms.length > 10, `Word : ${noms.length} objets nommés`);

    /* --- PDF --- */
    for (const [nom, opt] of [['PDF', '{}'], ['PDF avec traits de coupe', '{ coupe: true }']]) {
      const r = JSON.parse(await edge.eval(enBase64(`ExportPDF.fabriquer(null, ${opt})`)));
      const b = Buffer.from(r.u, 'base64'), t = b.toString('latin1');
      const x = +/startxref\n(\d+)\n%%EOF\s*$/.exec(t)[1];
      const entrees = [...t.slice(x).matchAll(/^(\d{10}) 00000 n/gm)].map(m => +m[1]);
      v(t.startsWith('%PDF-1.7') && entrees.length > 10 && entrees.every((o, i) => t.slice(o, o + 20).startsWith(`${i + 1} 0 obj`)), `${nom} : table des objets exacte (${entrees.length})`);
      v(r.infos.vectoriel > 1000 && r.infos.polices.length >= 2, `${nom} : texte vectoriel (${r.infos.vectoriel} lettres, ${r.infos.polices.length} polices ; en image : ${r.infos.bitmap})`);
      const lu = await edge.eval(`(async () => {
        const lib = await chargerPdfJs();
        const d = await lib.getDocument({ data: Uint8Array.from(atob(${JSON.stringify(r.u)}), c => c.charCodeAt(0)) }).promise;
        const out = { n: d.numPages, textes: [], alt: '', liens: 0 };
        for (let i = 1; i <= d.numPages; i++) {
          const p = await d.getPage(i);
          out.textes.push((await p.getTextContent()).items.map(q => q.str).join(''));
          out.liens += (await p.getAnnotations()).filter(a => a.url).length;
          out.alt += JSON.stringify(await p.getStructTree());
          out.boite = p.view;
          const c = document.createElement('canvas'), vp = p.getViewport({ scale: 0.5 });
          c.width = vp.width; c.height = vp.height;
          await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          if (i === 1) { const m = ${opt === '{}' ? 0 : 10}, k = 0.5 * 72 / 25.4; const px = (a, b) => [...c.getContext('2d').getImageData((a + m) * k, (b + m) * k, 1, 1).data].slice(0, 3); out.px = [px(75, 88), px(55, 125), px(2, 2), px(113, 160)]; }
        }
        return out; })()`);
      v(lu.n === 2, `${nom} : 2 pages relues par pdf.js`);
      const t1 = lu.textes[0].replace(/\s+/g, ' ');
      v(['Gras', 'souligné', 'Une puce', 'Texte tourné', 'Cellule fusionnée', 'Droite', 'Titre', 'Autre police', 'Page 1'].every(q => t1.includes(q)), `${nom} : tous les textes se retrouvent (recherche, copie)`);
      v(/-/.test(t1.slice(t1.indexOf('Les responsa') - 1)) && !/­/.test(t1), `${nom} : traits d’union de fin de ligne`);
      v(lu.liens === 1 && /Carré de couleur/.test(lu.alt) && /"Table"/.test(lu.alt), `${nom} : lien actif, image décrite, tableau balisé`);
      v(lu.px[0][0] > 180 && lu.px[0][2] < 120 && lu.px[1][2] < 60 && lu.px[2].every(q => q > 250) && lu.px[3][2] > 180, `${nom} : couleurs au bon endroit (${lu.px.map(q => q.join(',')).join(' ; ')})`);
      const larg = opt === '{}' ? 210 : 230;
      v(Math.abs(lu.boite[2] - larg * 72 / 25.4) < 0.1, `${nom} : format ${larg} mm`);
      if (opt !== '{}') v(/\/TrimBox/.test(t) && /\/BleedBox/.test(t), `${nom} : rogne et fond perdu indiqués`);
    }

    /* --- boutons --- */
    await edge.eval(`window.__tel = []; telecharger = (c, n) => window.__tel.push(n); document.querySelector('.qa[data-cmd="exporterPDF"]').click()`);
    await attendre(2500);
    await edge.eval(`ouvrirCoulisses('exporter'); document.querySelector('[data-ex="word"]').click()`);
    await attendre(1500);
    const tel = await edge.eval('window.__tel');
    v(tel.length === 2 && /\.pdf$/.test(tel[0]) && /\.docx$/.test(tel[1]), `boutons PDF et Word : ${tel.join(', ')}`);
    v(await edge.eval(`document.querySelector('#impression').innerHTML === '' && objetParId('c1') != null && !E.modifie`), 'le document n’est pas modifié par les exports');
    const er = edge.consoleMsgs.filter(m => /EXCEPTION|Uncaught/i.test(m));
    v(!er.length, 'aucune erreur ' + er.slice(0, 2).join(' '));
  } catch (e) { ko++; console.error(e); } finally { await edge.fermer(); serveur.close(); }
  console.log(ko ? `${ko} échec(s)` : 'Exports : tout est bon');
  process.exit(ko ? 1 : 0);
})();
