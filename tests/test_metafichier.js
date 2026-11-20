// Lecture EMF / WMF : node tests/test_metafichier.js <test.emf> <sortie.png>
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { lancer } = require('./cdp');

// WMF construit à la main : fenêtre 400 x 260, rectangle orange, ellipse bleue, triangle vert, texte rouge
function wmfTest() {
  const recs = [];
  const rec = (fn, mots) => recs.push({ fn, mots });
  const u32 = v => [v & 0xffff, v >>> 16];
  rec(0x020B, [0, 0]);                         // SETWINDOWORG (y, x)
  rec(0x020C, [260, 400]);                     // SETWINDOWEXT (y, x)
  rec(0x02FC, [0, ...u32(0x0000C0FF), 0]);     // brosse orange -> objet 0
  rec(0x012D, [0]);
  rec(0x02FA, [0, 6, 0, ...u32(0x00804000)]);  // stylo bleu foncé -> objet 1
  rec(0x012D, [1]);
  rec(0x041B, [180, 380, 20, 20]);             // RECTANGLE (bas, droite, haut, gauche)
  rec(0x02FC, [0, ...u32(0x00D07020), 0]);     // brosse bleue -> objet 2
  rec(0x012D, [2]);
  rec(0x0418, [160, 200, 50, 60]);             // ELLIPSE
  rec(0x02FC, [0, ...u32(0x0030A030), 0]);     // brosse verte -> objet 3
  rec(0x012D, [3]);
  rec(0x0324, [3, 230, 160, 300, 40, 370, 160]); // POLYGON
  const nom = Buffer.from('Arial\0\0\0', 'latin1');
  const police = [(-28) & 0xffff, 0, 0, 0, 700, 0, 0, 0, 0];
  for (let i = 0; i < nom.length; i += 2) police.push(nom[i] | (nom[i + 1] << 8));
  rec(0x02FB, police);                         // police -> objet 4
  rec(0x012D, [4]);
  rec(0x0209, u32(0x000000C0));                // couleur du texte
  const s = Buffer.from('Prise 16 A', 'latin1');
  const mots = [s.length];
  for (let i = 0; i < s.length; i += 2) mots.push(s[i] | ((s[i + 1] || 0) << 8));
  mots.push(210, 30);                          // y, x
  rec(0x0521, mots);                           // TEXTOUT
  rec(0x0000, []);
  const corps = [];
  for (const r of recs) { const t = 3 + r.mots.length; corps.push(...u32(t), r.fn, ...r.mots); }
  const entete = [1, 9, 0x300, ...u32(9 + corps.length), 5, ...u32(20), 0];
  const place = [0xCDD7, 0x9AC6, 0, 0, 0, 400, 260, 96, 0, 0, 0];
  const tout = [...place, ...entete, ...corps];
  const b = Buffer.alloc(tout.length * 2);
  tout.forEach((v, i) => b.writeUInt16LE(v & 0xffff, i * 2));
  return b;
}

(async () => {
  const [emfFichier, sortie] = process.argv.slice(2);
  const emf = fs.readFileSync(emfFichier);
  const emfZ = zlib.deflateSync(emf); // comme dans les .pub : compressé
  const wmf = wmfTest();
  const edge = await lancer({ largeur: 900, hauteur: 400 });
  let ko = 0;
  try {
    await edge.ouvrir('file:///' + path.resolve(__dirname, 'apercu.html').replace(/\\/g, '/'));
    const r = await edge.eval(`(async () => {
      const a = await LecteurMeta.versPNG('data:image/x-emf;z=1;base64,${emfZ.toString('base64')}');
      const b = await LecteurMeta.versPNG('data:image/x-wmf;base64,${wmf.toString('base64')}');
      const s = document.getElementById('sortie');
      s.innerHTML = '<img id=e style="width:400px;border:1px solid #ccc;background:#fff"> <img id=w style="width:400px;border:1px solid #ccc;background:#fff">';
      document.getElementById('e').src = a; document.getElementById('w').src = b;
      await Promise.all([...s.querySelectorAll('img')].map(i => i.decode()));
      // contrôle des couleurs au centre des formes
      const pixel = (url, x, y) => new Promise(ok => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); ok([...g.getImageData(Math.round(x * i.width), Math.round(y * i.height), 1, 1).data].slice(0, 3)); }; i.src = url; });
      return { emf: [await pixel(a, 0.33, 0.4), await pixel(a, 0.75, 0.5), await pixel(a, 0.12, 0.5)], wmf: [await pixel(b, 0.33, 0.4), await pixel(b, 0.75, 0.5), await pixel(b, 0.12, 0.5)] };
    })()`);
    const proche = (p, q) => p.every((v, i) => Math.abs(v - q[i]) < 40);
    for (const t of ['emf', 'wmf']) {
      const [ell, tri, rect] = r[t];
      const ok = proche(ell, [32, 112, 208]) && proche(tri, [48, 160, 48]) && proche(rect, [255, 192, 0]);
      console.log(ok ? '  ok  ' : '  ÉCHEC', `${t.toUpperCase()} redessiné (ellipse ${ell}, triangle ${tri}, rectangle ${rect})`);
      if (!ok) ko++;
    }
    await edge.capture(sortie, { x: 0, y: 0, width: 830, height: 300 });
    if (edge.consoleMsgs.length) console.log(edge.consoleMsgs.join('\n'));
  } finally { await edge.fermer(); }
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
