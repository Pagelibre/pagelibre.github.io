/* =====================================================================
   Outils communs aux exports Word et PDF : compression, archive zip,
   tracés, couleurs, images, lecture du texte tel qu'il est affiché
   ===================================================================== */

/* ---------------- octets ---------------- */
const octetsDe = s => new TextEncoder().encode(s);
function base64EnOctets(b64) { const b = atob(b64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function dataURLEnOctets(url) {
  const m = /^data:([^;,]*)((?:;[^;,]*)*),([\s\S]*)$/.exec(url || '');
  if (!m) return null;
  const type = m[1].toLowerCase();
  return { type, octets: /;base64/i.test(m[2]) ? base64EnOctets(m[3].replace(/\s+/g, '')) : octetsDe(decodeURIComponent(m[3])) };
}
async function compresser(octets, format) {
  const flux = new Blob([octets]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
async function decompresser(octets, format) {
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
const TABLE_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = TABLE_CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

// archive zip : fichiers = [[nom, texte ou octets, dejaCompresse]]
async function fabriquerZip(fichiers, type) {
  const morceaux = [], centre = [];
  let pos = 0;
  for (const [nom, contenu, brut] of fichiers) {
    const o = typeof contenu === 'string' ? octetsDe(contenu) : contenu;
    const c = brut ? o : await compresser(o, 'deflate-raw');
    const n = octetsDe(nom), crc = crc32(o), methode = brut ? 0 : 8;
    const commun = dv => { // version, drapeaux (noms en UTF-8), méthode, heure, date (01/01/1980), empreinte, tailles, longueur du nom
      dv.setUint16(0, 20, true); dv.setUint16(2, 0x800, true); dv.setUint16(4, methode, true); dv.setUint16(6, 0, true); dv.setUint16(8, 0x21, true);
      dv.setUint32(10, crc, true); dv.setUint32(14, c.length, true); dv.setUint32(18, o.length, true); dv.setUint16(22, n.length, true); dv.setUint16(24, 0, true);
    };
    const l = new Uint8Array(30), dl = new DataView(l.buffer);
    dl.setUint32(0, 0x04034b50, true);
    commun(new DataView(l.buffer, 4));
    const e = new Uint8Array(46), de = new DataView(e.buffer);
    de.setUint32(0, 0x02014b50, true); de.setUint16(4, 20, true);
    commun(new DataView(e.buffer, 6));
    de.setUint32(42, pos, true);
    morceaux.push(l, n, c);
    centre.push(e, n);
    pos += 30 + n.length + c.length;
  }
  const taille = centre.reduce((t, x) => t + x.length, 0);
  const f = new Uint8Array(22), df = new DataView(f.buffer);
  df.setUint32(0, 0x06054b50, true); df.setUint16(8, fichiers.length, true); df.setUint16(10, fichiers.length, true);
  df.setUint32(12, taille, true); df.setUint32(16, pos, true);
  return new Blob([...morceaux, ...centre, f], { type });
}

/* ---------------- couleurs ---------------- */
let ctxCouleur = null;
const cacheCouleurs = new Map();
// { r, v, b (0-255), a (0-1), hex 'RRGGBB' }, ou null si transparente
function lireCouleur(c) {
  if (!c) return null;
  if (cacheCouleurs.has(c)) return cacheCouleurs.get(c);
  if (!ctxCouleur) { const k = document.createElement('canvas'); k.width = k.height = 1; ctxCouleur = k.getContext('2d', { willReadFrequently: true }); }
  let res = null;
  ctxCouleur.fillStyle = '#000000';
  ctxCouleur.fillStyle = c;
  let s = ctxCouleur.fillStyle, r, v, b, a = 1;
  const m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s);
  if (m) { r = +m[1]; v = +m[2]; b = +m[3]; a = m[4] == null ? 1 : +m[4]; }
  else if (/^#[0-9a-f]{6}$/i.test(s)) { r = parseInt(s.slice(1, 3), 16); v = parseInt(s.slice(3, 5), 16); b = parseInt(s.slice(5, 7), 16); }
  if (r != null && a > 0) res = { r, v, b, a, hex: [r, v, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase() };
  cacheCouleurs.set(c, res);
  return res;
}

/* ---------------- tracés SVG -> segments absolus ---------------- */
// [['M', x, y], ['L', x, y], ['C', x1, y1, x2, y2, x, y], ['Z']] ; les arcs et courbes simples deviennent des courbes de Bézier
function segmentsTrace(d) {
  const jetons = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
  const out = [];
  let i = 0, cmd = '', x = 0, y = 0, x0 = 0, y0 = 0;
  const n = () => +jetons[i++];
  while (i < jetons.length) {
    if (/[a-zA-Z]/.test(jetons[i])) cmd = jetons[i++];
    const rel = cmd === cmd.toLowerCase(), dx = rel ? x : 0, dy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': x = n() + dx; y = n() + dy; x0 = x; y0 = y; out.push(['M', x, y]); cmd = rel ? 'l' : 'L'; break;
      case 'L': x = n() + dx; y = n() + dy; out.push(['L', x, y]); break;
      case 'H': x = n() + dx; out.push(['L', x, y]); break;
      case 'V': y = n() + dy; out.push(['L', x, y]); break;
      case 'C': { const p = [n() + dx, n() + dy, n() + dx, n() + dy, n() + dx, n() + dy]; out.push(['C', ...p]); x = p[4]; y = p[5]; break; }
      case 'Q': { const a = n() + dx, b = n() + dy, c = n() + dx, e = n() + dy; out.push(['C', x + (a - x) * 2 / 3, y + (b - y) * 2 / 3, c + (a - c) * 2 / 3, e + (b - e) * 2 / 3, c, e]); x = c; y = e; break; }
      case 'A': { const rx = n(), ry = n(), phi = n(), g = n(), s = n(), x2 = n() + dx, y2 = n() + dy; arcEnCourbes(out, x, y, rx, ry, phi, g, s, x2, y2); x = x2; y = y2; break; }
      case 'Z': out.push(['Z']); x = x0; y = y0; break;
      default: i++;
    }
  }
  return out;
}
function arcEnCourbes(out, x1, y1, rx, ry, phi, grand, sens, x2, y2) {
  if (!rx || !ry || (x1 === x2 && y1 === y2)) { out.push(['L', x2, y2]); return; }
  rx = Math.abs(rx); ry = Math.abs(ry);
  const f = phi * Math.PI / 180, cf = Math.cos(f), sf = Math.sin(f);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, xp = cf * dx + sf * dy, yp = -sf * dx + cf * dy;
  const l = xp * xp / (rx * rx) + yp * yp / (ry * ry);
  if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
  let k = (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp);
  k = Math.sqrt(Math.max(0, k)) * (!!+grand === !!+sens ? -1 : 1);
  const cxp = k * rx * yp / ry, cyp = -k * ry * xp / rx;
  const cx = cf * cxp - sf * cyp + (x1 + x2) / 2, cy = sf * cxp + cf * cyp + (y1 + y2) / 2;
  const t1 = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx);
  let dt = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx) - t1;
  if (+sens && dt < 0) dt += 2 * Math.PI;
  if (!+sens && dt > 0) dt -= 2 * Math.PI;
  const nb = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-6)), pas = dt / nb, h = 4 / 3 * Math.tan(pas / 4);
  const pt = (c, s) => [cx + rx * cf * c - ry * sf * s, cy + rx * sf * c + ry * cf * s];
  for (let q = 0; q < nb; q++) {
    const a = t1 + q * pas, b = a + pas;
    const p1 = pt(Math.cos(a) - h * Math.sin(a), Math.sin(a) + h * Math.cos(a)), p2 = pt(Math.cos(b) + h * Math.sin(b), Math.sin(b) - h * Math.cos(b)), p3 = pt(Math.cos(b), Math.sin(b));
    out.push(['C', ...p1, ...p2, ...p3]);
  }
}

/* ---------------- images ---------------- */
async function chargerImage(url) { const i = new Image(); i.src = url; await i.decode(); return i; }
function toileVers(c, type, q) { return new Promise(ok => c.toBlob(ok, type || 'image/png', q)); }
const octetsBlob = async b => new Uint8Array(await b.arrayBuffer());
// résolution suffisante pour l'impression, sans dépasser ce que le navigateur accepte
function tailleToile(wmm, hmm, ppp) {
  const k = Math.min(ppp / 25.4, 8000 / Math.max(wmm, hmm, 1));
  return [Math.max(1, Math.round(wmm * k)), Math.max(1, Math.round(hmm * k))];
}
function filtreCSSImage(F) {
  const l = [];
  if (!F) return '';
  if (F.luminosite) l.push(`brightness(${1 + F.luminosite / 100})`);
  if (F.contraste) l.push(`contrast(${1 + F.contraste / 100})`);
  if (F.gris) l.push('grayscale(1)');
  if (F.sepia) l.push('sepia(.8)');
  if (F.delave) l.push('opacity(.45)');
  return l.join(' ');
}
// toile d'une image (avec ses corrections) ; les images vectorielles sont dessinées à la taille utile
async function toileImage(url, filtre, wmm, hmm) {
  const im = await chargerImage(url);
  const c = document.createElement('canvas');
  if (/^data:image\/svg/i.test(url)) [c.width, c.height] = tailleToile(wmm, hmm, 300);
  else { c.width = im.naturalWidth || 1; c.height = im.naturalHeight || 1; }
  const g = c.getContext('2d');
  if (filtre) g.filter = filtre;
  g.drawImage(im, 0, 0, c.width, c.height);
  return c;
}
// dessin SVG (élément) -> toile
async function toileSVG(svg, wmm, hmm, ppp) {
  const s = svg.cloneNode(true);
  const [W, H] = tailleToile(wmm, hmm, ppp || 300);
  s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  s.setAttribute('width', W); s.setAttribute('height', H);
  const im = await chargerImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(s)));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d').drawImage(im, 0, 0, W, H);
  return c;
}
// élément HTML du rendu -> toile, avec une marge (mm) autour pour les effets qui débordent
async function toileElement(el, wmm, hmm, marge, ppp) {
  const css = ($('#css-rendu') || { textContent: '' }).textContent;
  const W = wmm + 2 * marge, H = hmm + 2 * marge, px = 96 / 25.4;
  const [cw, ch] = tailleToile(W, H, ppp || 300), k = cw / (W * px);
  const copieEl = el.cloneNode(true);
  copieEl.style.left = copieEl.style.top = '0';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}"><foreignObject x="0" y="0" width="${W * px}" height="${H * px}" transform="scale(${k})">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${W}mm;height:${H}mm"><style><![CDATA[${css}]]></style><div class="feuille" style="position:absolute;left:${marge}mm;top:${marge}mm;width:${wmm}mm;height:${hmm}mm;background:none;overflow:visible">${new XMLSerializer().serializeToString(copieEl)}</div></div></foreignObject></svg>`;
  const im = await chargerImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  c.getContext('2d').drawImage(im, 0, 0);
  return c;
}

/* ---------------- polices : mesures telles que le navigateur les affiche ---------------- */
const familles = f => (f || '').split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
const POLICE_SYMBOLE = /^(symbol|wingdings( [23])?|webdings|marlett|zapfdingbats)$/i;
// famille réellement utilisée pour un caractère : une police de symboles ne contient pas les lettres grecques Unicode
function famillePour(liste, ch) {
  const u = ch ? ch.codePointAt(0) : 65;
  if (liste.length && POLICE_SYMBOLE.test(liste[0]) && u > 0xff && !(u >= 0xf000 && u <= 0xf0ff)) return liste[1] || 'Times New Roman';
  return liste[0] || 'Times New Roman';
}
const cacheMesures = new Map();
// hauteur de ligne naturelle et position de la ligne de base (en fraction de la taille), mesurées à la taille demandée
function mesuresPolice(famille, gras, italique, taillePx) {
  const cle = [famille, gras, italique, taillePx || 100].join('|');
  if (cacheMesures.has(cle)) return cacheMesures.get(cle);
  const T = taillePx || 100;
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:pre;line-height:normal;';
  d.style.fontFamily = famille; d.style.fontSize = T + 'px'; d.style.fontWeight = gras ? 'bold' : 'normal'; d.style.fontStyle = italique ? 'italic' : 'normal';
  d.innerHTML = '<span>Hg</span><span style="display:inline-block;width:0;height:0"></span>';
  $('#impression').appendChild(d);
  const r = document.createRange(); r.selectNodeContents(d.firstChild);
  const b = r.getBoundingClientRect(), base = d.lastChild.getBoundingClientRect().bottom;
  const res = { ligne: d.getBoundingClientRect().height / T, ascension: (base - b.top) / T, hauteur: b.height / T };
  d.remove();
  cacheMesures.set(cle, res);
  return res;
}

/* ---------------- lecture du texte affiché ---------------- */
const gras = cs => (parseInt(cs.fontWeight, 10) || 400) >= 600;
// style d'un morceau de texte, d'après ce qui est affiché (z = facteur « ajuster le texte »)
function styleTexte(el, z, zone) {
  const cs = getComputedStyle(el);
  const s = { familles: familles(cs.fontFamily), taille: parseFloat(cs.fontSize) * z, gras: gras(cs), italique: cs.fontStyle !== 'normal', couleur: cs.color };
  if (cs.letterSpacing !== 'normal') s.espacement = parseFloat(cs.letterSpacing) * z;
  if (/small-caps/.test(cs.fontVariantCaps)) s.petitesCaps = true;
  if (cs.textTransform === 'uppercase') s.majuscules = true;
  // souligné, barré, surligné, exposant : portés par l'élément ou l'un de ses parents
  for (let p = el; p && p !== zone; p = p.parentElement) {
    const c = getComputedStyle(p);
    const d = c.textDecorationLine || '';
    if (/underline/.test(d)) { s.souligne = true; s.couleurTrait = c.textDecorationColor; s.souligneStyle = c.textDecorationStyle; }
    if (/line-through/.test(d)) { s.barre = true; s.couleurBarre = c.textDecorationColor; }
    if (!s.fond && c.backgroundColor && c.display === 'inline') { const f = lireCouleur(c.backgroundColor); if (f && f.a > 0) s.fond = c.backgroundColor; }
    if (!s.decalage && c.display === 'inline') {
      const v = c.verticalAlign;
      if (v === 'super') s.decalage = 'haut'; else if (v === 'sub') s.decalage = 'bas';
      else { const q = parseFloat(v); if (q) s.decalage = q > 0 ? 'haut' : 'bas'; }
    }
    if (p.tagName === 'A' && p.getAttribute('href')) s.lien = p.getAttribute('href');
  }
  return s;
}
