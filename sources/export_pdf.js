/* =====================================================================
   PDF en un clic, sans fenêtre d'impression, sans serveur ni Internet.
   Textes, formes, traits et tableaux restent vectoriels ; les images sont reprises telles quelles.
   Chaque lettre est posée là où le navigateur l'affiche (mesurée), avec :
   1. la police installée, si la personne autorise la lecture des polices de l'ordinateur ;
   2. sinon la police libre intégrée (Calibri, Cambria, Arial, Times New Roman) ;
   3. sinon le dessin de la ligne en haute définition, avec un texte invisible par-dessus
      (on peut toujours chercher et copier).
   ===================================================================== */

/* ---------------- lecture d'une police (TrueType / OpenType / WOFF / TTC) ---------------- */
const PoliceSFNT = (() => {
  async function tablesWOFF(u) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), n = dv.getUint16(12), t = {};
    for (let i = 0; i < n; i++) {
      const p = 44 + i * 20, nom = String.fromCharCode(...u.subarray(p, p + 4)), off = dv.getUint32(p + 4), comp = dv.getUint32(p + 8), taille = dv.getUint32(p + 12);
      const brut = u.slice(off, off + comp);
      t[nom] = comp < taille ? await decompresser(brut, 'deflate') : brut;
    }
    return t;
  }
  function tablesSFNT(u, off) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), n = dv.getUint16(off + 4), t = {};
    for (let i = 0; i < n; i++) { const p = off + 12 + i * 16; t[String.fromCharCode(...u.subarray(p, p + 4))] = u.subarray(dv.getUint32(p + 8), dv.getUint32(p + 8) + dv.getUint32(p + 12)); }
    return t;
  }
  const vue = u => new DataView(u.buffer, u.byteOffset, u.byteLength);
  function nomPS(t) {
    if (!t.name) return '';
    const d = vue(t.name), n = d.getUint16(2), base = d.getUint16(4);
    for (let i = 0; i < n; i++) {
      const p = 6 + i * 12;
      if (d.getUint16(p + 6) !== 6) continue;
      const pl = d.getUint16(p), l = d.getUint16(p + 8), o = base + d.getUint16(p + 10);
      let s = '';
      if (pl === 3 || pl === 0) for (let k = 0; k < l; k += 2) s += String.fromCharCode(d.getUint16(o + k)); else for (let k = 0; k < l; k++) s += String.fromCharCode(d.getUint8(o + k));
      if (s) return s;
    }
    return '';
  }
  function lireCmap(t) {
    const d = vue(t.cmap), n = d.getUint16(2);
    let mieux = null, note = -1, symbole = false;
    for (let i = 0; i < n; i++) {
      const pl = d.getUint16(4 + i * 8), en = d.getUint16(6 + i * 8), off = d.getUint32(8 + i * 8), f = d.getUint16(off);
      if (![0, 4, 6, 12].includes(f)) continue;
      const v = pl === 3 && en === 10 ? 5 : pl === 0 && f === 12 ? 4 : pl === 3 && en === 1 ? 3 : pl === 0 ? 2 : pl === 3 && en === 0 ? 1.5 : pl === 1 ? 1 : 0;
      if (v > note) { note = v; mieux = { off, f }; symbole = pl === 3 && en === 0; }
    }
    if (!mieux) return { gid: () => 0, symbole: false };
    const o = mieux.off;
    let fn;
    if (mieux.f === 12) {
      const ng = d.getUint32(o + 12);
      fn = c => { let lo = 0, hi = ng - 1; while (lo <= hi) { const m = (lo + hi) >> 1, p = o + 16 + m * 12; if (c < d.getUint32(p)) hi = m - 1; else if (c > d.getUint32(p + 4)) lo = m + 1; else return d.getUint32(p + 8) + c - d.getUint32(p); } return 0; };
    } else if (mieux.f === 4) {
      const sx = d.getUint16(o + 6) / 2, fin = o + 14, deb = fin + sx * 2 + 2, del = deb + sx * 2, dec = del + sx * 2;
      fn = c => {
        if (c > 0xffff) return 0;
        for (let i = 0; i < sx; i++) {
          if (c > d.getUint16(fin + i * 2)) continue;
          const s = d.getUint16(deb + i * 2);
          if (c < s) return 0;
          const r = d.getUint16(dec + i * 2);
          if (!r) return (c + d.getUint16(del + i * 2)) & 0xffff;
          const p = dec + i * 2 + r + (c - s) * 2;
          if (p + 2 > t.cmap.length) return 0;
          const g = d.getUint16(p);
          return g ? (g + d.getUint16(del + i * 2)) & 0xffff : 0;
        }
        return 0;
      };
    } else if (mieux.f === 6) { const s = d.getUint16(o + 6), nb = d.getUint16(o + 8); fn = c => (c >= s && c < s + nb ? d.getUint16(o + 10 + (c - s) * 2) : 0); }
    else fn = c => (c < 256 ? d.getUint8(o + 6 + c) : 0);
    return { gid: fn, symbole };
  }

  // octets d'un fichier de police -> { gid(c), largeur(gid), … }, ou null si elle ne peut pas être intégrée
  async function lire(u, postscript) {
    const dv = vue(u), sig = dv.getUint32(0);
    let t = null;
    if (sig === 0x774F4646) t = await tablesWOFF(u);
    else if (sig === 0x74746366) { // collection : on prend la police demandée
      const n = dv.getUint32(8);
      for (let i = 0; i < n; i++) { const q = tablesSFNT(u, dv.getUint32(12 + i * 4)); if (!t || nomPS(q) === postscript) { t = q; if (nomPS(q) === postscript) break; } }
    } else if (sig === 0x00010000 || sig === 0x4F54544F || sig === 0x74727565) t = tablesSFNT(u, 0);
    if (!t || !t.head || !t.hhea || !t.hmtx || !t.maxp || !t.cmap || t.fvar || !(t.glyf && t.loca || t['CFF '])) return null;
    const os2 = t['OS/2'] && vue(t['OS/2']);
    const fsType = os2 ? os2.getUint16(8) : 0;
    if ((fsType & 0x000F) === 0x0002 || (fsType & 0x0200)) return null; // l'auteur de la police interdit de l'intégrer
    const head = vue(t.head), hhea = vue(t.hhea), hmtx = vue(t.hmtx), post = t.post && vue(t.post);
    const em = head.getUint16(18), nh = hhea.getUint16(34), ng = vue(t.maxp).getUint16(4);
    const cm = lireCmap(t), cache = new Map();
    const P = {
      tables: t, em, ng, nh, sansSousEnsemble: (fsType & 0x0100) !== 0, cff: !t.glyf, nom: (nomPS(t) || 'Police').replace(/[^A-Za-z0-9-]/g, ''), octets: u,
      gid(c) {
        if (cache.has(c)) return cache.get(c);
        let g = cm.gid(c);
        if (!g && cm.symbole && c < 0x100) g = cm.gid(0xf000 + c);
        if (g >= ng) g = 0;
        cache.set(c, g);
        return g;
      },
      largeur: g => hmtx.getUint16(Math.min(g, nh - 1) * 4) / em,
      ascension: hhea.getInt16(4) / em, descente: hhea.getInt16(6) / em,
      bbox: [0, 1, 2, 3].map(i => Math.round(head.getInt16(36 + i * 2) / em * 1000)),
      italique: post ? post.getInt32(4) / 65536 : 0,
      soulignePos: post ? post.getInt16(8) / em : -0.1, souligneEp: post ? post.getInt16(10) / em : 0.05
    };
    if (P.sansSousEnsemble && !P.cff) P.entiere = true;
    return P;
  }

  // police réduite aux glyphes utilisés (mêmes numéros)
  function reduire(P, gids) {
    const t = P.tables, loca = vue(t.loca), long = vue(t.head).getInt16(50);
    const pos = g => (long ? loca.getUint32(g * 4) : loca.getUint16(g * 2) * 2);
    const garder = new Set([0, ...gids]), file = [...garder], glyf = vue(t.glyf);
    while (file.length) { // glyphes composés : garder leurs morceaux
      const g = file.pop(), a = pos(g), b = pos(g + 1);
      if (b - a < 10 || glyf.getInt16(a) >= 0) continue;
      let p = a + 10, fl;
      do {
        fl = glyf.getUint16(p);
        const c = glyf.getUint16(p + 2);
        if (!garder.has(c)) { garder.add(c); file.push(c); }
        p += 4 + (fl & 1 ? 4 : 2) + (fl & 8 ? 2 : fl & 0x40 ? 4 : fl & 0x80 ? 8 : 0);
      } while (fl & 0x20);
    }
    const nb = Math.max(...garder) + 1;
    let total = 0;
    for (const g of garder) total += (pos(g + 1) - pos(g) + 3) & ~3;
    const nglyf = new Uint8Array(total), nloca = new Uint8Array((nb + 1) * 4), dl = vue(nloca);
    let p = 0;
    for (let g = 0; g < nb; g++) { dl.setUint32(g * 4, p); if (garder.has(g)) { const a = pos(g), b = pos(g + 1); nglyf.set(t.glyf.subarray(a, b), p); p += (b - a + 3) & ~3; } }
    dl.setUint32(nb * 4, p);
    const nh = Math.min(P.nh, nb);
    const head = t.head.slice(), hhea = t.hhea.slice(), maxp = t.maxp.slice();
    vue(head).setInt16(50, 1); vue(hhea).setUint16(34, nh); vue(maxp).setUint16(4, nb);
    const hmtx = t.hmtx.slice(0, nh * 4 + Math.max(0, nb - nh) * 2);
    const tb = { 'cvt ': t['cvt '], fpgm: t.fpgm, glyf: nglyf, head, hhea, hmtx, loca: nloca, maxp, prep: t.prep };
    return assembler(tb);
  }
  function assembler(tb) {
    const noms = Object.keys(tb).filter(k => tb[k]).sort(), n = noms.length;
    let taille = 12 + n * 16;
    const off = {};
    for (const k of noms) { off[k] = taille; taille += (tb[k].length + 3) & ~3; }
    const u = new Uint8Array(taille), d = vue(u);
    const e = Math.floor(Math.log2(n));
    d.setUint32(0, 0x00010000); d.setUint16(4, n); d.setUint16(6, 16 << e); d.setUint16(8, e); d.setUint16(10, n * 16 - (16 << e));
    noms.forEach((k, i) => {
      const p = 12 + i * 16, v = tb[k];
      for (let c = 0; c < 4; c++) u[p + c] = k.charCodeAt(c);
      let s = 0;
      for (let q = 0; q < v.length; q += 4) s = (s + (((v[q] << 24) | ((v[q + 1] || 0) << 16) | ((v[q + 2] || 0) << 8) | (v[q + 3] || 0)) >>> 0)) >>> 0;
      d.setUint32(p + 4, s); d.setUint32(p + 8, off[k]); d.setUint32(p + 12, v.length);
      u.set(v, off[k]);
    });
    return u;
  }
  return { lire, reduire };
})();

/* ---------------- export PDF ---------------- */
const ExportPDF = (() => {
  const PX = 25.4 / 96, PT = 72 / 25.4;
  const n = v => { const s = (Math.round(v * 10000) / 10000).toString(); return /e/.test(s) ? '0' : s; };
  let C = null;

  /* ---- écriture du fichier ---- */
  function nouveau() {
    const c = { objets: [], remarques: new Set(), images: new Map(), etats: new Map(), polices: [], cachePolices: new Map(), bitmap: 0, vectoriel: 0, fig: new Map() };
    c.reserver = () => c.objets.push(null);
    c.objet = (contenu, no) => { const k = no || c.reserver(); c.objets[k - 1] = contenu; return k; };
    c.flux = async (dict, octets, opt = {}) => {
      const o = typeof octets === 'string' ? octetsDe(octets) : octets;
      const z = opt.brut ? o : await compresser(o, 'deflate');
      return c.objet({ dict: `${dict}${opt.brut ? '' : ' /Filter /FlateDecode'} /Length ${z.length}`, octets: z }, opt.no);
    };
    c.remarque = t => c.remarques.add(t);
    return c;
  }
  function ecrire(racine, infos) {
    const morceaux = [], pos = [];
    let t = 0;
    const ajout = x => { const u = typeof x === 'string' ? octetsDe(x) : x; morceaux.push(u); t += u.length; };
    ajout('%PDF-1.7\n'); ajout(new Uint8Array([37, 226, 227, 207, 211, 10]));
    C.objets.forEach((o, i) => {
      pos.push(t);
      if (typeof o === 'string') ajout(`${i + 1} 0 obj\n${o}\nendobj\n`);
      else { ajout(`${i + 1} 0 obj\n<< ${o.dict} >>\nstream\n`); ajout(o.octets); ajout('\nendstream\nendobj\n'); }
    });
    const x = t;
    ajout(`xref\n0 ${pos.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join(''));
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    ajout(`trailer\n<< /Size ${pos.length + 1} /Root ${racine} 0 R /Info ${infos} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${x}\n%%EOF\n`);
    return new Blob(morceaux, { type: 'application/pdf' });
  }
  const texteHexa = s => '<FEFF' + [...Array(s.length).keys()].map(i => s.charCodeAt(i).toString(16).padStart(4, '0')).join('') + '>';

  /* ---- page en cours ---- */
  function nouvellePage() { return { ops: [], res: { XObject: new Map(), Font: new Map(), ExtGState: new Map(), Pattern: new Map(), Shading: new Map() }, annots: [], balises: [], no: C.reserver(), m: [1, 0, 0, 1, 0, 0] }; }
  const op = s => C.page.ops.push(s);
  const res = (genre, prefixe, no) => { const m = C.page.res[genre]; if (!m.has(no)) m.set(no, prefixe + no); return m.get(no); };
  // matrice courante (repère de l'objet -> page en mm, y vers le bas)
  const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  function pousser(m) { C.pile.push(C.page.m); op('q'); if (m) { op(m.map(n).join(' ') + ' cm'); C.page.m = mul(m, C.page.m); } }
  function tirer() { op('Q'); C.page.m = C.pile.pop(); }
  const rotation = (deg, cx, cy) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, cx - cx * c + cy * s, cy - cx * s - cy * c]; };
  function couleur(c, trait) { const k = lireCouleur(c); if (!k) return null; op(`${n(k.r / 255)} ${n(k.v / 255)} ${n(k.b / 255)} ${trait ? 'RG' : 'rg'}`); return k; }
  function opacite(a) {
    if (a == null || a >= 0.999) return;
    const k = n(a);
    if (!C.etats.has(k)) C.etats.set(k, C.objet(`<< /Type /ExtGState /ca ${k} /CA ${k} >>`));
    op(`/${res('ExtGState', 'G', C.etats.get(k))} gs`);
  }
  function tracer(segs) { for (const s of segs) op(s[0] === 'M' ? `${n(s[1])} ${n(s[2])} m` : s[0] === 'L' ? `${n(s[1])} ${n(s[2])} l` : s[0] === 'C' ? `${s.slice(1).map(n).join(' ')} c` : 'h'); }
  const rect = (x, y, w, h) => op(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re`);

  /* ---- structure (lecteurs d'écran) : paragraphes, tableaux, images décrites ; le reste est décoratif ---- */
  function element(type, parent, alt) { const e = { type, parent, enfants: [], alt, no: C.reserver() }; if (parent) parent.enfants.push(e); C.structure.push(e); return e; }
  async function baliser(type, fn, opt = {}) {
    if (C.dansBalise) return fn();
    if (type) {
      const e = element(type, opt.parent || C.document, opt.alt);
      e.page = C.page; e.mcid = C.page.balises.length;
      C.page.balises.push(e);
      op('/' + type + ' << /MCID ' + e.mcid + ' >> BDC');
    } else op('/Artifact BMC');
    C.dansBalise = true;
    try { await fn(); } finally { C.dansBalise = false; op('EMC'); }
  }
  function ecrireStructure() {
    const racine = C.reserver();
    for (const e of C.structure) {
      const k = e.mcid != null ? String(e.mcid) : '[' + e.enfants.map(q => q.no + ' 0 R').join(' ') + ']';
      C.objet('<< /Type /StructElem /S /' + e.type + ' /P ' + (e.parent ? e.parent.no : racine) + ' 0 R' + (e.page ? ' /Pg ' + e.page.no + ' 0 R' : '') + ' /K ' + k + (e.alt ? ' /Alt ' + texteHexa(e.alt) : '') + ' >>', e.no);
    }
    const nums = C.toutesPages.map((p, i) => i + ' [' + p.balises.map(e => e.no + ' 0 R').join(' ') + ']').join(' ');
    return C.objet('<< /Type /StructTreeRoot /K ' + C.document.no + ' 0 R /ParentTree << /Nums [' + nums + '] >> /ParentTreeNextKey ' + C.toutesPages.length + ' >>', racine);
  }

  /* ---- images ---- */
  // lignes filtrées comme dans un PNG : se compriment bien mieux
  function filtrer(u, W, H, bpp) {
    const pas = W * bpp, out = new Uint8Array((pas + 1) * H);
    for (let y = 0; y < H; y++) {
      const a = y * pas, o = y * (pas + 1);
      let s1 = 0, s2 = 0, s0 = 0;
      for (let i = 0; i < pas; i += 3) { const v = u[a + i], g = i >= bpp ? u[a + i - bpp] : 0, h = y ? u[a + i - pas] : 0; s0 += v < 128 ? v : 256 - v; const d1 = (v - g) & 255, d2 = (v - h) & 255; s1 += d1 < 128 ? d1 : 256 - d1; s2 += d2 < 128 ? d2 : 256 - d2; }
      const f = s1 < s2 ? (s0 <= s1 ? 0 : 1) : (s0 <= s2 ? 0 : 2);
      out[o] = f;
      for (let i = 0; i < pas; i++) out[o + 1 + i] = (u[a + i] - (f === 1 ? (i >= bpp ? u[a + i - bpp] : 0) : f === 2 ? (y ? u[a + i - pas] : 0) : 0)) & 255;
    }
    return out;
  }
  const predicteur = (W, bpp) => ` /DecodeParms << /Predictor 15 /Colors ${bpp} /BitsPerComponent 8 /Columns ${W} >>`;
  async function imageDeToile(c) {
    const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    let alpha = false, gris = true;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] !== 255) alpha = true; if (d[i] !== d[i + 1] || d[i] !== d[i + 2]) gris = false; if (alpha && !gris) break; }
    const bpp = gris ? 1 : 3, rvb = new Uint8Array(W * H * bpp), a = alpha ? new Uint8Array(W * H) : null;
    for (let i = 0, j = 0, k = 0; i < d.length; i += 4, k++) { rvb[j++] = d[i]; if (!gris) { rvb[j++] = d[i + 1]; rvb[j++] = d[i + 2]; } if (a) a[k] = d[i + 3]; }
    let masque = '';
    if (a) masque = ` /SMask ${await C.flux(`/Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceGray /BitsPerComponent 8${predicteur(W, 1)}`, filtrer(a, W, H, 1))} 0 R`;
    return C.flux(`/Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /Device${gris ? 'Gray' : 'RGB'} /BitsPerComponent 8${masque}${predicteur(W, bpp)}`, filtrer(rvb, W, H, bpp));
  }
  // JPEG repris sans perte (sauf couleurs d'imprimerie ou photo tournée par ses réglages)
  function lireJPEG(u) {
    const d = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let p = 2, orientation = 1;
    while (p + 9 < u.length) {
      if (u[p] !== 0xFF) return null;
      const m = u[p + 1];
      if (m === 0xFF) { p++; continue; }
      const l = d.getUint16(p + 2);
      if (m === 0xE1 && u[p + 4] === 0x45 && u[p + 5] === 0x78) { // Exif : orientation
        const t = p + 10, le = u[t] === 0x49;
        try { let q = t + d.getUint32(t + 4, le); const nb = d.getUint16(q, le); q += 2; for (let i = 0; i < nb; i++) if (d.getUint16(q + i * 12, le) === 0x112) orientation = d.getUint16(q + i * 12 + 8, le); } catch (e) { /* sans importance */ }
      }
      if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) return { h: d.getUint16(p + 5), w: d.getUint16(p + 7), nc: u[p + 9], bits: u[p + 4], orientation };
      p += 2 + l;
    }
    return null;
  }
  function lirePNG(u) {
    const d = new DataView(u.buffer, u.byteOffset, u.byteLength), idat = [];
    let p = 8, i = null, plte = null;
    while (p + 8 <= u.length) {
      const l = d.getUint32(p), t = String.fromCharCode(...u.subarray(p + 4, p + 8)), v = u.subarray(p + 8, p + 8 + l);
      if (t === 'IHDR') i = { w: d.getUint32(p + 8), h: d.getUint32(p + 12), bits: v[8], type: v[9], entrelace: v[12] };
      else if (t === 'PLTE') plte = v;
      else if (t === 'tRNS') return null;
      else if (t === 'IDAT') idat.push(v);
      else if (t === 'IEND') break;
      p += 12 + l;
    }
    if (!i || i.entrelace || ![0, 2, 3].includes(i.type) || i.bits > 8 || (i.type === 3 && !plte)) return null;
    const z = new Uint8Array(idat.reduce((s, x) => s + x.length, 0));
    let q = 0;
    for (const x of idat) { z.set(x, q); q += x.length; }
    return Object.assign(i, { plte, z });
  }
  // image du document -> objet PDF
  async function imageXO(url, filtre, wmm, hmm) {
    const cle = url.length + '|' + url.slice(-200) + '|' + url.slice(0, 80) + '|' + (filtre || '') + (/^data:image\/svg/i.test(url) ? Math.round(wmm) + 'x' + Math.round(hmm) : '');
    if (C.images.has(cle)) return C.images.get(cle);
    const fabriquer = async () => {
      const d = dataURLEnOctets(url);
      if (d && !filtre && /jpe?g/.test(d.type)) {
        const j = lireJPEG(d.octets);
        if (j && j.bits === 8 && (j.nc === 1 || j.nc === 3) && j.orientation === 1) return C.flux(`/Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /Device${j.nc === 1 ? 'Gray' : 'RGB'} /BitsPerComponent 8 /Filter /DCTDecode`, d.octets, { brut: true });
      }
      if (d && !filtre && d.type === 'image/png') {
        const g = lirePNG(d.octets);
        if (g) {
          const nc = g.type === 2 ? 3 : 1;
          const ec = g.type === 3 ? `[/Indexed /DeviceRGB ${g.plte.length / 3 - 1} <${[...g.plte].map(b => b.toString(16).padStart(2, '0')).join('')}>]` : g.type === 2 ? '/DeviceRGB' : '/DeviceGray';
          return C.flux(`/Type /XObject /Subtype /Image /Width ${g.w} /Height ${g.h} /ColorSpace ${ec} /BitsPerComponent ${g.bits} /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${nc} /BitsPerComponent ${g.bits} /Columns ${g.w} >>`, g.z, { brut: true });
        }
      }
      return imageDeToile(await toileImage(url, filtre, wmm, hmm));
    };
    let no = null;
    try { no = await fabriquer(); } catch (e) { console.warn('Image non reprise', e); C.remarque('une image n’a pas pu être reprise'); }
    C.images.set(cle, no);
    return no;
  }
  const poserImage = (no, x, y, w, h) => { if (no) op(`q ${n(w)} 0 0 ${n(-h)} ${n(x)} ${n(y + h)} cm /${res('XObject', 'X', no)} Do Q`); };

  /* ---- remplissages et traits ---- */
  function motifPDF(points, f, dx, dy) {
    const k = 0.264583, m = mul([k, 0, 0, k, dx, dy], mul(C.page.m, C.base));
    const c1 = lireCouleur(f.fondMotif || '#ffffff') || { r: 255, v: 255, b: 255 }, c2 = lireCouleur(f.couleur || '#000000') || { r: 0, v: 0, b: 0 };
    let s = `${n(c1.r / 255)} ${n(c1.v / 255)} ${n(c1.b / 255)} rg 0 0 8 8 re f ${n(c2.r / 255)} ${n(c2.v / 255)} ${n(c2.b / 255)} rg `;
    for (let y = 0; y < 8; y++) { const o = parseInt(points.slice(y * 2, y * 2 + 2), 16); for (let x = 0; x < 8; x++) if (o & (128 >> x)) { let l = 1; while (x + l < 8 && o & (128 >> (x + l))) l++; s += `${x} ${y} ${l} 1 re `; x += l; } }
    const no = C.reserver();
    C.attente.push(C.flux(`/Type /Pattern /PatternType 1 /PaintType 1 /TilingType 1 /BBox [0 0 8 8] /XStep 8 /YStep 8 /Resources << >> /Matrix [${m.map(n).join(' ')}]`, s + 'f', { no }));
    return res('Pattern', 'P', no);
  }
  function ombrageDegrade(f) {
    const a = (f.angle || 0) * Math.PI / 180, sx = Math.sin(a) / 2, sy = Math.cos(a) / 2;
    const v = c => { const k = lireCouleur(c) || { r: 0, v: 0, b: 0 }; return `[${n(k.r / 255)} ${n(k.v / 255)} ${n(k.b / 255)}]`; };
    return res('Shading', 'S', C.objet(`<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [${n(0.5 - sx)} ${n(0.5 - sy)} ${n(0.5 + sx)} ${n(0.5 + sy)}] /Extend [true true] /Function << /FunctionType 2 /Domain [0 1] /C0 ${v(f.couleur)} /C1 ${v(f.degrade)} /N 1 >> >>`));
  }
  function boiteSegs(segs) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const pt = (x, y) => { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); };
    let px = 0, py = 0;
    for (const s of segs) {
      if (s[0] === 'C') { // extrêmes réels de la courbe
        for (const [a, b, c, d, axe] of [[px, s[1], s[3], s[5], 0], [py, s[2], s[4], s[6], 1]]) for (let t = 0; t <= 1; t += 0.05) { const u = 1 - t, v = u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; if (axe) pt(x1 === Infinity ? px : x1, v); else pt(v, y1 === Infinity ? py : y1); }
        px = s[5]; py = s[6];
      } else if (s[0] !== 'Z') { px = s[1]; py = s[2]; pt(px, py); }
    }
    return [x1, y1, Math.max(0.01, x2 - x1), Math.max(0.01, y2 - y1)];
  }
  async function remplir(segs, f) {
    if (!f) return;
    const pts = Rendu.pointsMotif(f, E.fiche);
    op('q'); opacite(f.opacite);
    if (pts) { op(`/Pattern cs /${motifPDF(pts, f, 0, 0)} scn`); tracer(segs); op('f'); }
    else if (f.image && E.fiche.images[f.image] || f.degrade) {
      const [x, y, w, h] = boiteSegs(segs);
      tracer(segs); op('W n');
      if (f.image && E.fiche.images[f.image]) poserImage(await imageXO(E.fiche.images[f.image], '', w, h), x, y, w, h);
      else op(`${n(w)} 0 0 ${n(h)} ${n(x)} ${n(y)} cm /${ombrageDegrade(f)} sh`);
    } else { const k = couleur(f.couleur); if (k) { if (k.a < 1) opacite(k.a * (f.opacite == null ? 1 : f.opacite)); tracer(segs); op('f'); } }
    op('Q');
  }
  const TIRETS = { 1: [4, 3], 2: [1, 1], 3: [4, 1, 1, 1], 4: [4, 1, 1, 1, 1, 1], 5: [1, 1], 6: [3, 1], 7: [8, 3], 8: [8, 3, 1, 3], 9: [8, 3, 1, 3, 1, 3], 10: [3, 1] };
  function tracerTrait(segs, t) {
    if (!t) return;
    const ep = Math.max(t.epaisseur * Rendu.PT_MM, 0.05);
    op('q');
    const k = couleur(t.couleur, true);
    if (k) {
      opacite(k.a);
      op(`${n(ep)} w 4 M${t.tirets && TIRETS[t.tirets] ? ` [${TIRETS[t.tirets].map(v => n(v * ep)).join(' ')}] 0 d` : ''}`);
      tracer(segs); op('S');
      // flèches : triangle de 4 épaisseurs, pointe à l'extrémité
      const traits = segs.filter(s => s[0] !== 'Z');
      const fleche = (x, y, dx, dy) => {
        const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, u = 4 * ep / 10;
        const q = (a, b) => `${n(x + (ux * a - uy * b) * u)} ${n(y + (uy * a + ux * b) * u)}`;
        couleur(t.couleur);
        op(`${q(-9, -5)} m ${q(1, 0)} l ${q(-9, 5)} l f`);
      };
      const fin = s => s.slice(-2);
      if (traits.length > 1) {
        if (t.flecheFin) { const s = traits[traits.length - 1], [x, y] = fin(s), [a, b] = s[0] === 'C' ? [s[3], s[4]] : fin(traits[traits.length - 2]); fleche(x, y, x - a, y - b); }
        if (t.flecheDebut) { const [x, y] = fin(traits[0]), s = traits[1], [a, b] = s[0] === 'C' ? [s[1], s[2]] : fin(s); fleche(x, y, x - a, y - b); }
      }
    }
    op('Q');
  }
  function segmentsObjet(o) {
    if (o.type === 'ligne') return [['M', 0, 0], ['L', o.w, o.h]];
    return segmentsTrace(Rendu.chemin(o));
  }
  // repère de la forme : coin de l'objet, retournée si besoin
  const repereForme = o => [o.miroirH ? -1 : 1, 0, 0, o.miroirV ? -1 : 1, o.x + (o.miroirH ? o.w : 0), o.y + (o.miroirV ? o.h : 0)];
  async function forme(o, avecFond) {
    const segs = segmentsObjet(o);
    pousser(repereForme(o));
    if (avecFond) await remplir(segs, o.fond);
    tracerTrait(segs, o.trait);
    tirer();
  }

  /* ---- polices ---- */
  async function preparerPolices(opt) {
    // polices libres intégrées
    const css = ($('#css-rendu') || { textContent: '' }).textContent;
    C.integrees = [...css.matchAll(/@font-face\{font-family:'([^']+)';font-style:(\w+);font-weight:(\d+);[^}]*url\(data:font\/woff;base64,([^)]+)\)/g)].map(m => ({ famille: m[1].toLowerCase(), italique: m[2] === 'italic', gras: +m[3] >= 600, b64: m[4] }));
    // polices installées (avec l'autorisation de la personne)
    C.locales = null;
    if (opt.locales) { C.locales = new Map(); for (const f of opt.locales) { const k = f.family.toLowerCase(); if (!C.locales.has(k)) C.locales.set(k, []); C.locales.get(k).push(f); const kc = f.fullName.toLowerCase(); if (!C.locales.has(kc)) C.locales.set(kc, [f]); } }
  }
  // police d'une famille : { P, fauxGras, fauxItalique } ou null
  async function police(famille, grasV, ital) {
    const cle = [famille.toLowerCase(), grasV, ital].join('|');
    if (C.cachePolices.has(cle)) return C.cachePolices.get(cle);
    const chercher = async () => {
      const l = C.locales && C.locales.get(famille.toLowerCase());
      if (l) {
        const styl = f => ({ g: /bold|gras|black|heavy|semibold|demi/i.test(f.style), i: /italic|oblique|italique|cursiv/i.test(f.style), c: /light|thin|semi|medium|condensed|narrow|black/i.test(f.style) });
        const note = f => { const s = styl(f); return (s.g === grasV ? 0 : 4) + (s.i === ital ? 0 : 2) + (s.c ? 1 : 0); };
        for (const f of [...l].sort((a, b) => note(a) - note(b))) {
          const s = styl(f);
          if ((s.g && !grasV) || (s.i && !ital)) break;
          try { const P = await PoliceSFNT.lire(await octetsBlob(await f.blob()), f.postscriptName); if (P) return { P, fauxGras: grasV && !s.g, fauxItalique: ital && !s.i }; } catch (e) { console.warn('police', famille, e); }
        }
      }
      const q = C.integrees.filter(f => f.famille === famille.toLowerCase()), f = q.find(x => x.gras === grasV && x.italique === ital);
      if (f) { f.P = f.P || await PoliceSFNT.lire(base64EnOctets(f.b64)); if (f.P) { if (f.gras && !/bold/i.test(f.P.nom)) f.P.nom = f.P.nom.replace(/-?Regular/, '') + '-Bold'; return { P: f.P }; } }
      return null;
    };
    const r = await chercher();
    C.cachePolices.set(cle, r);
    return r;
  }
  function refPolice(P) {
    if (!P.ref) { P.ref = { no: C.reserver(), gids: new Map() }; C.polices.push(P); }
    return res('Font', 'F', P.ref.no);
  }
  const hexa4 = v => v.toString(16).padStart(4, '0').toUpperCase();
  function cmapUnicode(couples) {
    const u16 = s => [...Array(s.length).keys()].map(i => hexa4(s.charCodeAt(i))).join('');
    let s = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n';
    for (let i = 0; i < couples.length; i += 100) { const l = couples.slice(i, i + 100); s += `${l.length} beginbfchar\n${l.map(([g, t]) => `<${hexa4(g)}> <${u16(t)}>`).join('\n')}\nendbfchar\n`; }
    return s + 'endcmap CMapName currentdict /CMap defineresource pop end end';
  }
  async function ecrirePolices() {
    let k = 0;
    for (const P of C.polices) {
      const gids = [...P.ref.gids.keys()].sort((a, b) => a - b);
      const prefixe = [...Array(6).keys()].map(i => String.fromCharCode(65 + (((k * 7919 + gids.length * 31 + i * 17) >> (i * 2)) % 26))).join('');
      k++;
      let nom = P.nom, fichier;
      if (P.cff) fichier = `/FontFile3 ${await C.flux('/Subtype /OpenType', P.octets)} 0 R`;
      else { const o = P.entiere ? P.octets : PoliceSFNT.reduire(P, gids); if (!P.entiere) nom = prefixe + '+' + nom; fichier = `/FontFile2 ${await C.flux(`/Length1 ${o.length}`, o)} 0 R`; }
      const e = v => Math.round(v * 1000);
      const desc = C.objet(`<< /Type /FontDescriptor /FontName /${nom} /Flags 4 /FontBBox [${P.bbox.join(' ')}] /ItalicAngle ${n(P.italique)} /Ascent ${e(P.ascension)} /Descent ${e(P.descente)} /CapHeight ${e(P.ascension * 0.75)} /StemV 80 ${fichier} >>`);
      const w = gids.map(g => `${g} [${e(P.largeur(g))}]`).join(' ');
      const cid = C.objet(`<< /Type /Font /Subtype /CIDFontType${P.cff ? 0 : 2} /BaseFont /${nom} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /DW 1000 /W [${w}]${P.cff ? '' : ' /CIDToGIDMap /Identity'} >>`);
      const tu = await C.flux('', cmapUnicode(gids.map(g => [g, P.ref.gids.get(g)])));
      C.objet(`<< /Type /Font /Subtype /Type0 /BaseFont /${nom} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${tu} 0 R >>`, P.ref.no);
    }
    // police invisible : sert à chercher et copier le texte des lignes dessinées
    if (C.invisible) {
      const l = [...C.invisible.codes.entries()];
      for (let b = 0; b < C.invisible.nos.length; b++) {
        const part = l.slice(b * 255, b * 255 + 255);
        const tu = await C.flux('', cmapUnicode(part.map(([t], i) => [i + 1, t])).replace(/<0000> <FFFF>/, '<00> <FF>').replace(/<00([0-9A-F]{2})> </g, '<$1> <'));
        const vide = await C.flux('', '1000 0 0 0 0 0 d1');
        C.objet(`<< /Type /Font /Subtype /Type3 /FontBBox [0 0 0 0] /FontMatrix [0.001 0 0 0.001 0 0] /FirstChar 1 /LastChar ${part.length} /Widths [${part.map(() => 1000).join(' ')}] /CharProcs << /v ${vide} 0 R >> /Encoding << /Type /Encoding /Differences [1 ${part.map(() => '/v').join(' ')}] >> /Resources << >> /ToUnicode ${tu} 0 R >>`, C.invisible.nos[b]);
      }
    }
  }
  // texte invisible, caractère par caractère (étiré à la largeur affichée)
  function texteInvisible(car) {
    if (!C.invisible) C.invisible = { codes: new Map(), nos: [] };
    const I = C.invisible;
    for (const c of car) {
      if (!I.codes.has(c.t)) I.codes.set(c.t, I.codes.size);
      const k = I.codes.get(c.t), b = Math.floor(k / 255);
      while (I.nos.length <= b) I.nos.push(C.reserver());
      const a = c.angle * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), L = Math.max(c.l, 0.05), T = c.taille;
      op(`q BT 3 Tr /${res('Font', 'F', I.nos[b])} 1 Tf ${n(L * cs)} ${n(L * sn)} ${n(T * sn)} ${n(-T * cs)} ${n(c.x)} ${n(c.y)} Tm <${(k % 255 + 1).toString(16).padStart(2, "0")}> Tj ET Q`);
    }
  }

  /* ---- texte affiché : relevé caractère par caractère ---- */
  // zone : élément .contenu ; f : rectangle de la feuille ; renvoie { lignes : morceaux de même style sur une ligne, liens, fonds }
  function releverTexte(ct, f) {
    const z = parseFloat(ct.style.zoom) || 1;
    const vert = ct.closest('.sens-haut-bas') ? 90 : ct.closest('.sens-bas-haut') ? 270 : 0;
    const morceaux = [], liens = [];
    const tw = document.createTreeWalker(ct, NodeFilter.SHOW_TEXT), g = document.createRange(), styles = new Map();
    const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('fr', { granularity: 'grapheme' }) : null;
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const par = t.parentElement;
      if (par.closest('.habillage,.hab-espace') || !t.nodeValue) continue;
      let s = styles.get(par);
      if (!s) {
        s = styleTexte(par, z, ct);
        s.css = getComputedStyle(par).fontFamily;
        const m = mesuresPolice(s.css, s.gras, s.italique, s.taille);
        s.asc = m.ascension * s.taille; s.haut = m.hauteur * s.taille;
        styles.set(par, s);
      }
      let cour = null;
      const car = seg ? [...seg.segment(t.nodeValue)].map(q => [q.index, q.segment]) : [...t.nodeValue].reduce((a, ch) => (a.push([a.p = (a.p || 0), ch]), a.p += ch.length, a), []);
      for (let i = 0; i < car.length; i++) {
        const [k, ch] = car[i];
        if (ch === '\t' || ch === '\n' || ch === '\r') { cour = null; continue; }
        g.setStart(t, k); g.setEnd(t, k + ch.length);
        const l = g.getClientRects();
        let b = null;
        for (const q of l) if (q.width > 0.01 && q.height > 0.01) b = q;
        let texte = ch;
        if (ch === '\u00ad') { // césure : le trait d'union n'est affiché qu'en fin de ligne
          const suite = car[i + 1];
          if (!cour || !suite) continue;
          g.setStart(t, suite[0]); g.setEnd(t, suite[0] + suite[1].length);
          // en fin de ligne, le navigateur compte aussi le trait d'union dans le caractère suivant : c'est le dernier rectangle qui vaut
          const q = [...g.getClientRects()].reverse().find(r => r.width > 0.01);
          const autre = q && (vert ? Math.abs(q.left - cour.ref.left) > q.width * 0.5 : Math.abs(q.top - cour.ref.top) > q.height * 0.5);
          if (!autre) continue;
          texte = '-';
          if (!b || (vert ? Math.abs(b.left - cour.ref.left) > b.width * 0.5 : Math.abs(b.top - cour.ref.top) > b.height * 0.5)) b = vert ? { left: cour.ref.left, right: cour.ref.right, width: cour.ref.width, height: s.taille * 0.33, top: vert === 90 ? cour.ref.bottom : cour.ref.top - s.taille * 0.33, bottom: vert === 90 ? cour.ref.bottom + s.taille * 0.33 : cour.ref.top } : { left: cour.ref.right, right: cour.ref.right + s.taille * 0.33, width: s.taille * 0.33, top: cour.ref.top, bottom: cour.ref.bottom, height: cour.ref.height };
        }
        if (!b) continue;
        // position de la ligne de base et début du caractère, en mm dans la page
        const asc = s.asc;
        let x, y, l0;
        if (vert === 90) { x = b.right - asc; y = b.top; l0 = b.height; }
        else if (vert === 270) { x = b.left + asc; y = b.bottom; l0 = b.height; }
        else { x = b.left; y = b.top + asc; l0 = b.width; }
        if (s.petitesCaps || s.majuscules) { const M = texte.toLocaleUpperCase('fr'); if (M !== texte) texte = M; }
        const q = { t: texte, x: (x - f.left) * PX, y: (y - f.top) * PX, l: l0 * PX, petite: s.petitesCaps && texte !== ch };
        const meme = cour && cour.s === s && (vert ? Math.abs(b.left - cour.ref.left) < 0.6 : Math.abs(b.top - cour.ref.top) < 0.6) && (vert === 90 ? b.top >= cour.ref.top : vert === 270 ? b.top <= cour.ref.top : b.left >= cour.ref.left - 0.01);
        if (!meme) { cour = { s, car: [], angle: vert, rects: [] }; morceaux.push(cour); }
        cour.ref = b;
        cour.car.push(q);
        cour.rects.push([(b.left - f.left) * PX, (b.top - f.top) * PX, (b.right - f.left) * PX, (b.bottom - f.top) * PX]);
      }
    }
    for (const a of ct.querySelectorAll('a[href]')) if (/^(https?:|mailto:)/i.test(a.getAttribute('href'))) for (const r of a.getClientRects()) liens.push([a.getAttribute('href'), (r.left - f.left) * PX, (r.top - f.top) * PX, (r.right - f.left) * PX, (r.bottom - f.top) * PX]);
    return { morceaux, liens };
  }

  // choisit, pour chaque caractère, la police qui le contient
  async function choisirPolice(s, ch) {
    const c = ch.codePointAt(0);
    s.essais = s.essais || new Map();
    if (s.essais.has(ch)) return s.essais.get(ch);
    let r = null;
    if ([...ch].length === 1) {
      for (const f of s.familles) { const p = await police(f, s.gras, s.italique); if (p && p.P.gid(c)) { r = p; break; } if (!p && !POLICE_SYMBOLE.test(f)) { if (C.locales && !C.locales.has(f.toLowerCase())) continue; break; } }
      if (!r && C.locales) for (const f of ['Times New Roman', 'Segoe UI Symbol', 'Cambria Math', 'Segoe UI', 'Arial']) { const p = await police(f, s.gras, s.italique); if (p && p.P.gid(c)) { r = Object.assign({ secours: true }, p); break; } }
    }
    s.essais.set(ch, r);
    return r;
  }

  async function ecrireMorceau(m) {
    const s = m.s, T = s.taille * PX, a = m.angle * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const coul = C.ombreTexte || s.couleur;
    const k = lireCouleur(coul);
    if (!k) return;
    if (s.fond && !C.ombreTexte) { const r = m.rects, x1 = Math.min(...r.map(q => q[0])), y1 = Math.min(...r.map(q => q[1])), x2 = Math.max(...r.map(q => q[2])), y2 = Math.max(...r.map(q => q[3])); op('q'); couleur(s.fond); rect(x1, y1, x2 - x1, y2 - y1); op('f Q'); }
    op('q');
    couleur(coul);
    opacite(k.a);
    // suites de caractères dessinables avec la même police
    // petites capitales : même taille pour tout le morceau, d'après la largeur affichée (0,7 quand le navigateur les fabrique)
    let reduit = 0.7;
    if (s.petitesCaps) {
      let la = 0, lv = 0;
      for (const c of m.car) if (c.petite) { const p = await choisirPolice(s, c.t); if (p) { la += p.P.largeur(p.P.gid(c.t.codePointAt(0))) * T; lv += c.l - (s.espacement || 0) * PX; } }
      if (la) { const r = lv / la; reduit = Math.abs(r - 0.7) < 0.04 ? 0.7 : Math.max(0.5, Math.min(1, r)); }
    }
    const lots = [];
    for (const c of m.car) {
      const p = await choisirPolice(s, c.t);
      let taille = T, ok = !!p;
      if (p) {
        const la = p.P.largeur(p.P.gid(c.t.codePointAt(0)));
        const esp = (s.espacement || 0) * PX;
        if (c.petite) taille = reduit * T;
        // police de secours : seulement si c'est bien celle que le navigateur a prise (même largeur)
        else if (p.secours && Math.abs(la * T - (c.l - esp)) > 0.04 * T) ok = false;
      }
      const d = lots[lots.length - 1];
      if (d && d.p === (ok ? p : null) && Math.abs(d.taille - taille) < 0.02 * T) d.car.push(c); else lots.push({ p: ok ? p : null, taille, car: [c] });
    }
    for (const lot of lots) {
      if (!lot.p) { if (lot.car.some(c => c.t.trim())) await texteDessine(m, lot.car); continue; }
      const P = lot.p.P, t = lot.taille, inc = lot.p.fauxItalique ? Math.tan(20 * Math.PI / 180) : 0;
      let tj = '', prec = null;
      const F = refPolice(P);
      for (const c of lot.car) {
        const u = c.t.codePointAt(0), g = P.gid(u);
        if (!P.ref.gids.has(g)) P.ref.gids.set(g, c.t);
        if (prec) { const av = cs * (c.x - prec.c.x) + sn * (c.y - prec.c.y), e = (P.largeur(prec.g) * t - av) / t * 1000; if (Math.abs(e) > 0.4) tj += `>${n(Math.round(e * 10) / 10)}<`; }
        tj += hexa4(g);
        prec = { c, g };
      }
      const c0 = lot.car[0];
      const style = lot.p.fauxGras ? `2 Tr ${n(t * 0.03)} w ` : '';
      if (style) couleur(coul, true);
      op(`BT ${style}/${F} 1 Tf ${n(t * cs)} ${n(t * sn)} ${n(t * (sn + inc * cs))} ${n(-t * cs + inc * t * sn)} ${n(c0.x)} ${n(c0.y)} Tm [<${tj}>] TJ ET`);
      C.vectoriel += lot.car.length;
    }
    // souligné, barré
    if ((s.souligne || s.barre) && m.car.length) {
      const p = lots[0].p && lots[0].p.P, c0 = m.car[0], c1 = m.car[m.car.length - 1], L = cs * (c1.x - c0.x) + sn * (c1.y - c0.y) + c1.l;
      const ligne = (dec, ep, c) => { op('q'); couleur(C.ombreTexte || c || coul, true); op(`${n(ep)} w ${n(c0.x - sn * dec)} ${n(c0.y + cs * dec)} m ${n(c0.x - sn * dec + cs * L)} ${n(c0.y + cs * dec + sn * L)} l S Q`); };
      const ep = Math.max(0.1, (p ? p.souligneEp : 0.05) * T);
      if (s.souligne) { const d = Math.max(0.09, p ? -p.soulignePos : 0.1) * T; ligne(d, ep, s.couleurTrait); if (s.souligneStyle === 'double') ligne(d + 2 * ep, ep, s.couleurTrait); }
      if (s.barre) ligne(-0.26 * T, ep, s.couleurBarre);
    }
    op('Q');
  }
  // police non disponible : les lettres dessinées par le navigateur, en 600 ppp, et le texte invisible par-dessus
  async function texteDessine(m, car) {
    const s = m.s, T = s.taille * PX, a = m.angle * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), c0 = car[0];
    const pos = c => cs * (c.x - c0.x) + sn * (c.y - c0.y);
    const L = pos(car[car.length - 1]) + car[car.length - 1].l, M = T * 0.5, W = L + 2 * M, H = T * 2.1, base = T * 1.35;
    const k = Math.min(600 / 25.4, 6000 / Math.max(W, H)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(W * k)); c.height = Math.max(1, Math.ceil(H * k));
    const g = c.getContext('2d');
    g.font = `${s.italique ? 'italic ' : ''}${s.gras ? 'bold ' : ''}${T * k}px ${s.css}`;
    g.fillStyle = '#000';
    for (const q of car) if (q.t.trim()) { if (q.petite) { g.save(); g.font = `${s.italique ? 'italic ' : ''}${s.gras ? 'bold ' : ''}${T * 0.7 * k}px ${s.css}`; } g.fillText(q.t, (M + pos(q)) * k, base * k); if (q.petite) g.restore(); }
    const d = g.getImageData(0, 0, c.width, c.height).data, al = new Uint8Array(c.width * c.height);
    for (let i = 0; i < al.length; i++) al[i] = d[i * 4 + 3];
    const sm = await C.flux(`/Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceGray /BitsPerComponent 8${predicteur(c.width, 1)}`, filtrer(al, c.width, c.height, 1));
    const kc = lireCouleur(C.ombreTexte || s.couleur);
    const no = await C.flux(`/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /SMask ${sm} 0 R`, new Uint8Array([kc.r, kc.v, kc.b]));
    // repère de la ligne : origine au premier caractère
    op(`q ${n(cs)} ${n(sn)} ${n(-sn)} ${n(cs)} ${n(c0.x)} ${n(c0.y)} cm`);
    poserImage(no, -M, -base, c.width / k, c.height / k);
    op('Q');
    if (!C.ombreTexte) texteInvisible(car.map(q => Object.assign({ taille: T, angle: m.angle }, q)));
    C.bitmap += car.length;
  }
  async function ecrireTexte(ct, f, invisible, parent) {
    if (ct.textContent.trim()) await baliser('P', () => ecrireTexteNu(ct, f, invisible), { parent });
  }
  async function ecrireTexteNu(ct, f, invisible) {
    const { morceaux, liens } = releverTexte(ct, f);
    for (const m of morceaux) {
      if (invisible) texteInvisible(m.car.map(q => Object.assign({ taille: m.s.taille * PX, angle: m.angle }, q)));
      else await ecrireMorceau(m);
    }
    for (const [u, x1, y1, x2, y2] of C.ombreTexte ? [] : liens) {
      const M = mul(C.page.m, C.base), pt = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => [x * M[0] + y * M[2] + M[4], x * M[1] + y * M[3] + M[5]]);
      const xs = pt.map(p => p[0]), ys = pt.map(p => p[1]);
      C.page.annots.push(C.objet(`<< /Type /Annot /Subtype /Link /Rect [${n(Math.min(...xs))} ${n(Math.min(...ys))} ${n(Math.max(...xs))} ${n(Math.max(...ys))}] /Border [0 0 0] /A << /S /URI /URI ${'(' + u.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, c => encodeURIComponent(c)) + ')'} >> >>`));
    }
  }

  /* ---- tableaux ---- */
  async function tableau(o, el, f) {
    const T = o.tableau, t = el.querySelector(':scope > table.tab');
    if (!t) return;
    const boite = td => { const r = td.getBoundingClientRect(); return [(r.left - f.left) * PX, (r.top - f.top) * PX, r.width * PX, r.height * PX]; };
    const tds = [...t.querySelectorAll('td[data-cellule]')].map(td => ({ td, c: T.cellules[+td.dataset.cellule], b: boite(td) }));
    const elTable = element('Table', C.document), rangs = new Map();
    const celluleDe = c => { if (!rangs.has(c.l)) rangs.set(c.l, element('TR', elTable)); return element('TD', rangs.get(c.l)); };
    op('/Artifact BMC');
    for (const { c, b: [x, y, w, h] } of tds) {
      const fond = c.fond || T.fond;
      if (fond && lireCouleur(fond)) { op('q'); opacite(lireCouleur(fond).a); couleur(fond); rect(x, y, w, h); op('f Q'); }
      if (c.motif && /^[0-9a-f]{16}$/i.test(c.motif.points || '')) { op(`q /Pattern cs /${motifPDF(c.motif.points, c.motif, x, y)} scn`); rect(x, y, w, h); op('f Q'); }
      if (c.diagonale) { op('q'); couleur(c.diagonale.c || '#000000', true); op(`${n(Math.max(c.diagonale.e || 0.75, 0.25) * 0.67 * 2 * PX)} w ${n(x)} ${n(c.diagonale.sens === 'asc' ? y + h : y)} m ${n(x + w)} ${n(c.diagonale.sens === 'asc' ? y : y + h)} l S Q`); }
    }
    op('EMC');
    for (const { td, c, b: [x, y, w, h] } of tds) {
      const cellule = celluleDe(c);
      const deborde = [...td.querySelectorAll(':scope > .contenu')].some(c => { const g = document.createRange(); g.selectNodeContents(c); const q = g.getBoundingClientRect(), r = td.getBoundingClientRect(); return q.right > r.right + 1 || q.bottom > r.bottom + 1 || q.left < r.left - 1; });
      if (deborde) { op('q'); rect(x, y, w, h); op('W n'); }
      for (const ct of td.querySelectorAll(':scope > .contenu')) await ecrireTexte(ct, f, false, cellule);
      if (deborde) op('Q');
    }
    // bordures : les plus épaisses par-dessus
    const l = [];
    for (const { c, b: [x, y, w, h] } of tds) {
      const b = c.bords || {};
      if (b.h) l.push([b.h, x, y, x + w, y, 1]); if (b.b) l.push([b.b, x, y + h, x + w, y + h, 1]);
      if (b.g) l.push([b.g, x, y, x, y + h, 0]); if (b.d) l.push([b.d, x + w, y, x + w, y + h, 0]);
    }
    l.sort((p, q) => p[0].e - q[0].e);
    op('/Artifact BMC');
    for (const [b, x1, y1, x2, y2] of l) { const e = Math.max(b.e * Rendu.PT_MM, 0.1); op('q'); couleur(b.c, true); op(`2 J ${n(e)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S Q`); }
    op('EMC');
  }

  /* ---- WordArt ---- */
  async function wordart(o, el) {
    const W = o.wordart, svg = el.querySelector(':scope > .svg-wordart'), t = svg.querySelector('text');
    const fg = /^(.+) Bold$/i.exec(W.police || '');
    let p = null;
    for (const [f, g] of [[W.police || '', !!W.gras], ...(fg ? [[fg[1], true]] : [])]) if (f && !p) p = await police(f, g, !!W.italique);
    const car = [...W.texte];
    if (!p || car.some(c => c.trim() && !p.P.gid(c.codePointAt(0)))) {
      // police non disponible : dessin en haute définition
      const M = 6, no = await imageDeToile(await toileElement(el, o.w, o.h, M, 300));
      poserImage(no, o.x - M, o.y - M, o.w + 2 * M, o.h + 2 * M);
      const larg = o.w / Math.max(1, car.length);
      texteInvisible(car.map((c, i) => ({ t: c, x: o.x + i * larg, y: o.y + o.h * 0.8, l: larg, taille: o.h * 0.95, angle: 0 })));
      C.bitmap += car.length;
      return;
    }
    const P = p.P, T = o.h * 0.95, F = refPolice(P);
    const nat = car.reduce((s, c) => s + P.largeur(P.gid(c.codePointAt(0))), 0) * T || 1, kx = o.w / nat;
    let h = '';
    for (const c of car) { const g = P.gid(c.codePointAt(0)); if (!P.ref.gids.has(g)) P.ref.gids.set(g, c); h += hexa4(g); }
    const inc = p.fauxItalique ? 0.36 : 0;
    const bt = (tr, extra) => op(`BT ${extra || ''}${tr} Tr /${F} 1 Tf ${n(T * kx)} 0 ${n(inc * T * kx)} ${n(-T)} ${n(o.x)} ${n(o.y + o.h * 0.8)} Tm <${h}> Tj ET`);
    void t;
    if (W.degrade) {
      op('q'); bt(7);
      // le dégradé va du haut au bas du texte, comme à l'écran
      op(`${n(o.w)} 0 0 ${n(T * (P.ascension - P.descente))} ${n(o.x)} ${n(o.y + o.h * 0.8 - T * P.ascension)} cm /${ombrageDegrade({ couleur: W.couleur || '#000000', degrade: W.degrade, angle: 0 })} sh Q`);
    } else { op('q'); couleur(W.couleur || '#000000'); if (p.fauxGras) { couleur(W.couleur || '#000000', true); bt(2, `${n(T * 0.03)} w `); } else bt(0); op('Q'); }
    if (W.contour) { op('q'); couleur(W.contour.couleur, true); bt(1, `${n(Math.max((W.contour.epaisseur || 0.75) * Rendu.PT_MM, 0.05))} w `); op('Q'); }
    C.vectoriel += car.length;
  }

  /* ---- effets qui ne sont pas vectoriels (ombres floues, reflets, reliefs, 3D) ---- */
  const px3 = v => v * 96 / 25.4;
  // ombre, profondeur : dessin de l'objet passé dans le filtre, puis on retire l'objet lui-même
  async function imageEffets(o, el) {
    const marge = 4 + (o.ombre ? Math.max(Math.abs(o.ombre.dx), Math.abs(o.ombre.dy)) + 3 * (o.ombre.flou || 0) : 0) + (o.extrusion ? o.extrusion.p : 0);
    const copieEl = el.cloneNode(true);
    copieEl.style.filter = ''; copieEl.style.webkitBoxReflect = '';
    const A = await toileElement(copieEl, o.w, o.h, marge, 200), k = A.width / (o.w + 2 * marge);
    const B = document.createElement('canvas');
    B.width = A.width; B.height = A.height;
    const g = B.getContext('2d');
    g.filter = (el.style.filter || 'none').replace(/(-?[\d.]+)mm/g, (m, v) => (v * k).toFixed(2) + 'px');
    g.drawImage(A, 0, 0);
    g.filter = 'none';
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(A, 0, 0);
    poserImage(await imageDeToile(B), o.x - marge, o.y - marge, o.w + 2 * marge, o.h + 2 * marge);
  }
  async function reflet(o, el) {
    const copieEl = el.cloneNode(true);
    copieEl.style.filter = ''; copieEl.style.webkitBoxReflect = '';
    const A = await toileElement(copieEl, o.w, o.h, 0, 200), g = A.getContext('2d');
    const t = (o.reflet.taille || 45) / 100, gr = g.createLinearGradient(0, 0, 0, A.height);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(Math.max(0, 1 - t), 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${o.reflet.opacite || 0.5})`);
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = gr; g.fillRect(0, 0, A.width, A.height);
    const no = await imageDeToile(A), y = o.y + o.h + (o.reflet.ecart != null ? o.reflet.ecart : 0.5);
    op(`q ${n(o.w)} 0 0 ${n(o.h)} ${n(o.x)} ${n(y)} cm /${res('XObject', 'X', no)} Do Q`); // retournée : l'image n'est pas redressée
  }

  /* ---- objets ---- */
  async function objet(o, el, f) {
    const transfo = el.dataset.transfo || '';
    if (o.rot) pousser(rotation(o.rot, o.x + o.w / 2, o.y + o.h / 2));
    if (o.rot3d) {
      // rotation 3D : tout l'objet en image, texte invisible par-dessus
      const M = 15, c = el.cloneNode(true);
      c.style.transform = transfo.replace(/rotate\([^)]*\)/, '');
      await baliser(o.alt ? 'Figure' : '', async () => poserImage(await imageDeToile(await toileElement(c, o.w, o.h, M, 300)), o.x - M, o.y - M, o.w + 2 * M, o.h + 2 * M), { alt: o.alt });
      for (const ct of el.querySelectorAll('.contenu')) await ecrireTexte(ct, f, true);
    } else {
      const plat = o.fond || o.trait || o.type === 'forme', netteSimple = o.ombre && !o.ombre.flou && !o.extrusion && (o.type === 'forme' || o.type === 'texte') && plat && !o.bordure && !(o.fond && o.fond.opacite != null) && (o.fond || !el.querySelector('.contenu'));
      const effets = o.ombre || o.extrusion || o.reflet;
      if (effets) op('/Artifact BMC');
      if (netteSimple) { // ombre nette d'une forme pleine : la même forme, décalée
        const c = o.ombre.couleur || 'rgba(0,0,0,.45)';
        const k = lireCouleur(c) || { a: 1 };
        op('q'); opacite(k.a);
        await forme(Object.assign({}, o, { x: o.x + o.ombre.dx, y: o.y + o.ombre.dy, fond: o.fond ? { couleur: c.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)') } : null, trait: o.trait ? Object.assign({}, o.trait, { couleur: c.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)') }) : null }), true);
        op('Q');
      } else if (o.ombre || o.extrusion) await imageEffets(o, el);
      if (o.reflet) await reflet(o, el);
      if (effets) op('EMC');
      switch (o.type) {
        case 'image': await baliser(o.alt ? 'Figure' : '', () => image(o), { alt: o.alt }); break;
        case 'ligne': await baliser('', () => forme(o, false)); break;
        case 'tableau': await tableau(o, el, f); break;
        case 'wordart': await baliser('P', () => wordart(o, el)); break;
        default: await texteOuForme(o, el, f);
      }
      if (o.biseau && (o.type === 'image' || o.type === 'tableau')) {
        const b = el.querySelector(':scope > .biseau');
        if (b) { const c = el.cloneNode(false); c.style.filter = ''; c.appendChild(b.cloneNode(true)); await baliser('', async () => poserImage(await imageDeToile(await toileElement(c, o.w, o.h, 0, 200)), o.x, o.y, o.w, o.h)); }
      }
    }
    if (o.rot) tirer();
  }
  async function image(o) {
    if (o.fond && o.fond.couleur && lireCouleur(o.fond.couleur)) { op('q'); couleur(o.fond.couleur); rect(o.x, o.y, o.w, o.h); op('f Q'); }
    const src = o.image && E.fiche.images[o.image];
    if (src && !/^data:image\/x-/.test(src)) {
      const [ha, dr, ba, ga] = o.rognage || [0, 0, 0, 0], lw = (1 - ga - dr) || 1, lh = (1 - ha - ba) || 1;
      const W = o.w / lw, H = o.h / lh, x = o.x - ga * W, y = o.y - ha * H;
      const no = await imageXO(src, filtreCSSImage(o.filtres), W, H);
      pousser(null);
      if (ha || dr || ba || ga) { rect(o.x, o.y, o.w, o.h); op('W n'); }
      if (o.miroirH || o.miroirV) op(`${o.miroirH ? -1 : 1} 0 0 ${o.miroirV ? -1 : 1} ${n(o.miroirH ? 2 * (x + W / 2) : 0)} ${n(o.miroirV ? 2 * (y + H / 2) : 0)} cm`);
      poserImage(no, x, y, W, H);
      tirer();
    }
    if (o.trait) await forme(Object.assign({}, o, { type: 'forme', forme: 'rect', fond: null, miroirH: false, miroirV: false }), false);
  }
  async function texteOuForme(o, el, f) {
    await baliser(o.alt && !o.html ? 'Figure' : '', () => dessinForme(o, el), { alt: o.alt });
    const cadre = el.querySelector(':scope > .cadre-texte'), ct = cadre && cadre.querySelector(':scope > .contenu');
    if (ct) {
      const coupe = cadre.classList.contains('colonnes');
      if (coupe) { op('q'); rect(o.x, o.y, o.w, o.h); op('W n'); }
      await ecrireTexte(ct, f);
      if (coupe) op('Q');
    }
  }
  async function dessinForme(o, el) {
    const svg = el.querySelector(':scope > .svg-forme:not(.bordure-deco)');
    if (o.biseau && o.fond && svg) {
      // relief : la forme en image, le texte reste du texte
      const c = el.cloneNode(false), M = 2;
      c.style.filter = ''; c.style.webkitBoxReflect = '';
      c.appendChild(svg.cloneNode(true));
      poserImage(await imageDeToile(await toileElement(c, o.w, o.h, M, 300)), o.x - M, o.y - M, o.w + 2 * M, o.h + 2 * M);
    } else if (o.fond || o.trait || o.type === 'forme') await forme(o.bordure ? Object.assign({}, o, { trait: null }) : o, true);
    const deco = el.querySelector(':scope > .bordure-deco');
    if (deco) for (const im of deco.querySelectorAll('image')) {
      const v = a => +im.getAttribute(a);
      poserImage(await imageXO(im.getAttribute('href'), '', v('width'), v('height')), o.x + v('x'), o.y + v('y'), v('width'), v('height'));
    }
  }

  /* ---- document ---- */
  async function fabriquer(indices, opt = {}) {
    C = nouveau();
    C.attente = [];
    C.pile = [];
    C.structure = []; C.toutesPages = [];
    C.document = element('Document', null);
    let locales = null;
    if (opt.polices !== false) locales = await policesInstallees(opt.polices === true);
    await preparerPolices({ locales });
    const P = E.fiche.page, coupe = !!opt.coupe, M = coupe ? 10 : 0, FP = 3;
    const L = P.w + 2 * M, H = P.h + 2 * M;
    C.base = [PT, 0, 0, -PT, M * PT, (H - M) * PT];
    const tout = indices || E.fiche.pages.map((p, i) => i);
    const racinePages = C.reserver(), pages = [];
    for (const i of tout) {
      const page = E.fiche.pages[i];
      const z = await preparerPages([i], false), feuille = z.querySelector(':scope > .feuille');
      $$('.objet', feuille).forEach(e => { e.dataset.transfo = e.style.transform; e.style.transform = 'none'; });
      const f = feuille.getBoundingClientRect();
      C.page = nouvellePage();
      C.toutesPages.push(C.page);
      op('q ' + C.base.map(n).join(' ') + ' cm');
      if (coupe) { op('q'); rect(-FP, -FP, P.w + 2 * FP, P.h + 2 * FP); op('W n'); }
      if (P.fond && lireCouleur(P.fond) && lireCouleur(P.fond).hex !== 'FFFFFF') { op('/Artifact BMC q'); couleur(P.fond); rect(coupe ? -FP : 0, coupe ? -FP : 0, P.w + (coupe ? 2 * FP : 0), P.h + (coupe ? 2 * FP : 0)); op('f Q EMC'); }
      const voir = async (objs, calque) => { const els = [...calque.children]; for (let k = 0; k < objs.length; k++) await objet(objs[k], els[k], f); };
      const m = page.maitre && E.fiche.maitres && E.fiche.maitres[page.maitre];
      if (m && m.items.length) await voir(m.items, feuille.querySelector(':scope > .calque-maitre'));
      await voir(page.items, feuille.querySelector(':scope > .calque-objets'));
      if (coupe) {
        op('Q /Artifact BMC 0 0 0 RG 0.1 w');
        const ec = FP + 1, l = 5;
        for (const x of [0, P.w]) op(`${n(x)} ${n(-ec)} m ${n(x)} ${n(-ec - l)} l S ${n(x)} ${n(P.h + ec)} m ${n(x)} ${n(P.h + ec + l)} l S`);
        for (const y of [0, P.h]) op(`${n(-ec)} ${n(y)} m ${n(-ec - l)} ${n(y)} l S ${n(P.w + ec)} ${n(y)} m ${n(P.w + ec + l)} ${n(y)} l S`);
        op('EMC');
      }
      op('Q');
      libererPages();
      const contenu = await C.flux('', C.page.ops.join('\n'));
      const r = Object.entries(C.page.res).filter(([, v]) => v.size).map(([g, v]) => `/${g} << ${[...v].map(([no, nom]) => `/${nom} ${no} 0 R`).join(' ')} >>`).join(' ');
      const b = (a) => `[${[a, a, L - a, H - a].map(v => n(v * PT)).join(' ')}]`;
      pages.push(C.objet(`<< /Type /Page /Parent ${racinePages} 0 R /MediaBox [0 0 ${n(L * PT)} ${n(H * PT)}]${coupe ? ` /TrimBox ${b(M)} /BleedBox ${b(M - FP)}` : ''} /Resources << ${r} >> /Contents ${contenu} 0 R /StructParents ${C.toutesPages.length - 1} /Tabs /S${C.page.annots.length ? ` /Annots [${C.page.annots.map(a => a + ' 0 R').join(' ')}]` : ''} >>`, C.page.no));
      if (opt.progres) opt.progres(pages.length, tout.length);
    }
    await Promise.all(C.attente);
    await ecrirePolices();
    C.objet(`<< /Type /Pages /Kids [${pages.map(p => p + ' 0 R').join(' ')}] /Count ${pages.length} >>`, racinePages);
    const racine = C.objet(`<< /Type /Catalog /Pages ${racinePages} 0 R /Lang (fr-FR) /MarkInfo << /Marked true >> /StructTreeRoot ${ecrireStructure()} 0 R /ViewerPreferences << /DisplayDocTitle true >> >>`);
    const d = new Date(), p2 = v => String(v).padStart(2, '0');
    const infos = C.objet(`<< /Title ${texteHexa(E.fiche.titre || 'Document')} /Producer ${texteHexa('PageLibre ' + VERSION_NOM)} /CreationDate (D:${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}) >>`);
    const r = { blob: ecrire(racine, infos), remarques: [...C.remarques], infos: { vectoriel: C.vectoriel, bitmap: C.bitmap, polices: C.polices.map(x => x.nom), locales: locales ? locales.length : 0 } };
    return r;
  }
  // familles utilisées par le document
  function famillesDocument() {
    const s = new Set(['Times New Roman']);
    const voir = h => { for (const m of (h || '').matchAll(/font-family:\s*([^;"]+)/g)) familles(m[1].replace(/&quot;/g, '"')).forEach(f => s.add(f)); };
    for (const p of [...E.fiche.pages, ...Object.values(E.fiche.maitres || {})]) for (const o of p.items) { voir(o.html); if (o.wordart) s.add(o.wordart.police); if (o.tableau) o.tableau.cellules.forEach(c => { voir(c.html); voir(c.html2); }); }
    return [...s].filter(Boolean);
  }
  // polices de l'ordinateur : jamais demandées si le document n'utilise que les polices intégrées
  async function policesInstallees(forcer) {
    if (!window.queryLocalFonts) return null;
    try {
      const st = navigator.permissions ? await navigator.permissions.query({ name: 'local-fonts' }).catch(() => null) : null;
      if (st && st.state === 'denied') return null;
      const css = ($('#css-rendu') || { textContent: '' }).textContent;
      const inconnues = famillesDocument().filter(f => !css.includes(`font-family:'${f}'`) && !['serif', 'sans-serif', 'monospace'].includes(f));
      if (!forcer && !(st && st.state === 'granted') && !inconnues.length) return null;
      return await window.queryLocalFonts();
    } catch (e) { return null; }
  }
  return { fabriquer };
})();

async function exporterPDF(coupe) {
  quitterEdition();
  fermerCoulisses();
  bandeau('Préparation du PDF…');
  try {
    const { blob, remarques, infos } = await ExportPDF.fabriquer(null, { coupe: !!coupe, progres: (k, t) => { const s = $('#bandeau span'); if (s && t > 3) s.textContent = `Préparation du PDF : page ${k} sur ${t}…`; } });
    telecharger(blob, nomPropose('pdf'), blob.type);
    mascotte('montre');
    bandeau('PDF téléchargé : « ' + nomPropose('pdf') + ' ».' + (infos.bitmap ? ' Une partie du texte est en image haute définition, faute d’accès à sa police : acceptez la lecture des polices installées quand le navigateur la demande.' : '') + (remarques.length ? ' À savoir : ' + remarques.join(' ; ') + '.' : ''));
  } catch (e) {
    console.error(e);
    libererPages();
    alerte('PDF impossible : ' + e.message + ' Utilisez Imprimer, imprimante « Enregistrer au format PDF ».');
  }
}

/* ---------------- boutons ---------------- */
Object.assign(ICONES, {
  pdf16: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5h6.5L13 5v9.5H3z" fill="none" stroke="#fff" stroke-width="1.2"/><path d="M9.3 1.6V5.2H13" fill="none" stroke="#fff"/><text x="8" y="12.2" font-size="5.4" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">PDF</text></svg>',
  word: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 3h13l6 6v20H7z" fill="#fff" stroke="#555"/><path d="M20 3v6h6" fill="none" stroke="#555"/><rect x="3" y="15" width="22" height="9" rx="1" fill="#23405e"/><text x="14" y="22" font-size="6.4" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">DOCX</text></svg>'
});
Object.assign(COMMANDES, { exporterPDF: () => exporterPDF(false), exporterWord });
