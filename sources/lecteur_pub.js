/* =====================================================================
   Lecteur de fichiers .pub (format des versions 2003 à 2019)
   Transforme un .pub en « fiche » (modèle JSON de l'éditeur).
   Format décodé par analyse de fichiers d'essai (nov. 2026), pour l'interopérabilité :
   - conteneur OLE (CFB) : flux Contents (mise en page), Quill (texte),
     Escher (formes et images) ;
   - unités : EMU (360 000 par cm) ; le modèle de l'éditeur est en mm.
   ===================================================================== */
(function (racine) {
  'use strict';

  const FIN = 0xFFFFFFFA;
  const EMU_MM = 36000;
  const EMU_PT = 12700;

  /* ---------------------------------------------------------------
     1. Conteneur OLE (Compound File Binary)
     --------------------------------------------------------------- */
  function lireCFB(entree) {
    const u8 = entree instanceof Uint8Array ? entree : new Uint8Array(entree);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    for (let i = 0; i < 8; i++) {
      if (u8[i] !== sig[i]) throw new Error("Ce fichier n'est pas un fichier .pub lisible.");
    }
    const ss = 1 << dv.getUint16(30, true);
    const mss = 1 << dv.getUint16(32, true);
    const nfat = dv.getUint32(44, true);
    const debutRep = dv.getUint32(48, true);
    const seuil = dv.getUint32(56, true);
    const debutMiniFat = dv.getUint32(60, true);
    let sDifat = dv.getUint32(68, true);
    const nDifat = dv.getUint32(72, true);
    const posSecteur = n => (n + 1) * ss;

    let difat = [];
    for (let i = 0; i < 109; i++) difat.push(dv.getUint32(76 + i * 4, true));
    for (let k = 0; k < nDifat && sDifat < FIN; k++) {
      const o = posSecteur(sDifat), par = ss / 4;
      for (let i = 0; i < par - 1; i++) difat.push(dv.getUint32(o + i * 4, true));
      sDifat = dv.getUint32(o + (par - 1) * 4, true);
    }
    difat = difat.filter(x => x < FIN).slice(0, nfat);
    const fat = new Uint32Array(difat.length * ss / 4);
    let fi = 0;
    for (const s of difat) {
      const o = posSecteur(s);
      for (let i = 0; i < ss / 4; i++) fat[fi++] = o + i * 4 + 4 <= u8.length ? dv.getUint32(o + i * 4, true) : 0xFFFFFFFE;
    }
    function chaine(debut, taille) {
      const liste = [];
      let n = debut, garde = 0;
      while (n < FIN && garde++ <= fat.length) { liste.push(n); n = fat[n]; }
      const out = new Uint8Array(liste.length * ss);
      liste.forEach((s, i) => {
        const o = posSecteur(s);
        out.set(u8.subarray(o, Math.min(o + ss, u8.length)), i * ss);
      });
      return taille != null ? out.subarray(0, Math.min(taille, out.length)) : out;
    }
    let minifat = new Uint32Array(0);
    if (debutMiniFat < FIN) {
      const b = chaine(debutMiniFat);
      minifat = new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + (b.length & ~3)));
    }
    const rep = chaine(debutRep);
    const rdv = new DataView(rep.buffer, rep.byteOffset, rep.byteLength);
    const entrees = [];
    for (let i = 0; i * 128 + 128 <= rep.length; i++) {
      const o = i * 128;
      const nl = rdv.getUint16(o + 64, true);
      let nom = '';
      for (let k = 0; k + 1 < nl - 1 && k < 64; k += 2) nom += String.fromCharCode(rdv.getUint16(o + k, true));
      entrees.push({
        nom, type: rep[o + 66],
        g: rdv.getUint32(o + 68, true), d: rdv.getUint32(o + 72, true), enfant: rdv.getUint32(o + 76, true),
        debut: rdv.getUint32(o + 116, true), taille: rdv.getUint32(o + 120, true)
      });
    }
    const racineE = entrees[0];
    const miniFlux = racineE && racineE.debut < FIN ? chaine(racineE.debut, racineE.taille) : new Uint8Array(0);
    function miniChaine(debut, taille) {
      const out = new Uint8Array(taille);
      let n = debut, pos = 0, garde = 0;
      while (n < FIN && pos < taille && garde++ <= minifat.length) {
        const o = n * mss;
        const morceau = miniFlux.subarray(o, o + Math.min(mss, taille - pos));
        out.set(morceau, pos); pos += morceau.length;
        n = minifat[n];
      }
      return out;
    }
    const chemins = new Map();
    const vus = new Set();
    (function parcourir(i, prefixe) {
      if (i >= FIN || i >= entrees.length || vus.has(i)) return;
      vus.add(i);
      const e = entrees[i];
      parcourir(e.g, prefixe);
      const p = prefixe + e.nom;
      chemins.set(p, e);
      if (e.type === 1) parcourir(e.enfant, p + '/');
      parcourir(e.d, prefixe);
    })(racineE ? racineE.enfant : FIN, '');

    return {
      chemins: [...chemins.keys()],
      lire(chemin) {
        const e = chemins.get(chemin);
        if (!e || e.type !== 2) return null;
        return e.taille < seuil ? miniChaine(e.debut, e.taille) : chaine(e.debut, e.taille);
      }
    };
  }

  /* ---------------------------------------------------------------
     2. Blocs « Contents » / styles Quill (id, type, données)
     --------------------------------------------------------------- */
  const FIXE = {
    0x78: 0, 0x05: 0, 0x08: 0, 0x0a: 0, 0x10: 2, 0x12: 2, 0x18: 2, 0x1a: 2, 0x07: 2,
    0x20: 4, 0x22: 4, 0x58: 4, 0x68: 4, 0x70: 4, 0xb8: 4, 0x28: 8, 0x38: 16, 0x48: 24
  };

  function vue(u8) { return new DataView(u8.buffer, u8.byteOffset, u8.byteLength); }

  function bloc(dv, o, fin) {
    if (o + 2 > fin) return null;
    const id = dv.getUint8(o), type = dv.getUint8(o + 1);
    if (type in FIXE) {
      const n = FIXE[type];
      if (o + 2 + n > fin) return null;
      let val = null;
      if (n === 2) val = dv.getUint16(o + 2, true);
      else if (n === 4) val = dv.getUint32(o + 2, true);
      return { id, type, off: o + 2, fin: o + 2 + n, val, varia: false };
    }
    if (!(type & 0x80) || o + 6 > fin) return null;
    const len = dv.getUint32(o + 2, true);
    if (len < 4 || o + 2 + len > fin) return null;
    return { id, type, off: o + 2, fin: o + 2 + len, val: null, varia: true };
  }

  function sousBlocs(dv, b) {
    const out = [];
    let o = b.off + 4;
    while (o < b.fin - 1) {
      const s = bloc(dv, o, b.fin);
      if (!s || s.fin <= o) break;
      out.push(s);
      o = s.fin;
    }
    return out;
  }

  function carte(liste) {
    const m = new Map();
    for (const b of liste) if (!m.has(b.id)) m.set(b.id, b);
    return m;
  }

  function blocsA(dv, off) {
    const len = dv.getUint32(off, true);
    return sousBlocs(dv, { off, fin: Math.min(off + len, dv.byteLength) });
  }

  const s32 = v => (v == null ? 0 : v | 0);

  function chaineBloc(dv, b) {
    let s = '';
    for (let o = b.off + 4; o + 1 < b.fin; o += 2) {
      const c = dv.getUint16(o, true);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  /* ---------------------------------------------------------------
     3. Flux Contents : répertoire des « chunks »
     --------------------------------------------------------------- */
  function lireRepertoire(dv) {
    const t = dv.getUint32(0x1a, true);
    const chunks = [];
    let o = t + 4;
    const fin = dv.byteLength;
    for (let k = 0; k < 8 && o < fin - 1; k++) {
      const b = bloc(dv, o, fin);
      if (!b) break;
      if (b.type === 0x90) {
        let p = b.off + 4;
        while (p < b.fin - 1) {
          const e = bloc(dv, p, b.fin);
          if (!e) break;
          const ref = { seq: chunks.length, type: null, off: null, parent: null };
          if (e.type === 0x88) {
            for (const s of sousBlocs(dv, e)) {
              if (s.id === 2) ref.type = s.val;
              else if (s.id === 4) ref.off = s.val;
              else if (s.id === 5) ref.parent = s.val;
            }
          }
          chunks.push(ref);
          p = e.fin;
        }
      }
      o = b.fin;
    }
    return chunks;
  }

  /* ---------------------------------------------------------------
     4. Escher : formes, ancres, propriétés, images
     --------------------------------------------------------------- */
  function enregistrements(dv, debut, fin) {
    const out = [];
    let i = debut;
    while (i + 8 <= fin) {
      const vi = dv.getUint16(i, true), type = dv.getUint16(i + 2, true), len = dv.getUint32(i + 4, true);
      if (i + 8 + len > fin) break;
      out.push({ ver: vi & 0xF, inst: vi >> 4, type, off: i + 8, len });
      i += 8 + len;
    }
    return out;
  }

  function lireFOPT(u8, dv, r, props) {
    let complexe = r.off + r.inst * 6;
    for (let i = 0; i < r.inst; i++) {
      const pid = dv.getUint16(r.off + i * 6, true);
      const val = dv.getUint32(r.off + i * 6 + 2, true);
      const id = pid & 0x3fff;
      const p = { val };
      if (pid & 0x8000) {
        p.data = u8.subarray(complexe, Math.min(complexe + val, r.off + r.len));
        complexe += val;
      }
      if (!(id in props)) props[id] = p;
    }
  }

  function lireKV(dv, off, len) {
    if (len < 4) return null;
    const n = dv.getUint32(off, true);
    if (n !== len) return null;
    const m = {};
    for (let o = 4; o + 6 <= n; o += 6) m[dv.getUint16(off + o, true)] = dv.getUint32(off + o + 2, true);
    return m;
  }

  function lireEscher(stm, delay, pageW, pageH) {
    const dv = vue(stm);
    const formes = new Map();       // seq Contents -> forme Escher
    const tableaux = new Map();     // seq tableau -> {fond, cellules, bords}
    const blips = [];

    // BStore (catalogue des images)
    for (const r of enregistrements(dv, 0, dv.byteLength)) {
      if (r.type !== 0xF000) continue;
      for (const r2 of enregistrements(dv, r.off, r.off + r.len)) {
        if (r2.type !== 0xF001) continue;
        for (const f of enregistrements(dv, r2.off, r2.off + r2.len)) {
          if (f.type !== 0xF007) continue;
          blips.push({ btWin: stm[f.off], taille: dv.getUint32(f.off + 20, true), off: dv.getUint32(f.off + 28, true) });
        }
      }
      break;
    }

    function lireForme(r) {
      const f = { props: {}, rect: null };
      for (const s of enregistrements(dv, r.off, r.off + r.len)) {
        if (s.type === 0xF00A) { f.spid = dv.getUint32(s.off, true); f.flags = dv.getUint32(s.off + 4, true); f.stype = s.inst; }
        else if (s.type === 0xF00B || s.type === 0xF122) lireFOPT(stm, dv, s, f.props);
        else if (s.type === 0xF009) f.groupe = [0, 4, 8, 12].map(k => dv.getInt32(s.off + k, true));
        else if (s.type === 0xF00F) f.enfant = [0, 4, 8, 12].map(k => dv.getInt32(s.off + k, true));
        else if (s.type === 0xF010) {
          const kv = lireKV(dv, s.off, s.len);
          if (kv) f.ancre = kv;
          else if (s.len >= 16) f.ancreRect = [0, 4, 8, 12].map(k => dv.getInt32(s.off + k, true));
        }
        else if (s.type === 0xF011) { const kv = lireKV(dv, s.off, s.len); if (kv) f.seq = kv[0x6801]; }
      }
      return f;
    }

    // transfo : coordonnées du repère courant -> EMU page (origine en haut à gauche)
    function rectPage(f, transfo) {
      let r = null;
      if (f.enfant && transfo) {
        const [x1, y1, x2, y2] = f.enfant;
        r = { x: transfo.ax + (x1 - transfo.gx) * transfo.sx, y: transfo.ay + (y1 - transfo.gy) * transfo.sy,
              w: (x2 - x1) * transfo.sx, h: (y2 - y1) * transfo.sy };
      } else if (f.ancre && (0x2001 in f.ancre)) {
        const a = f.ancre;
        const x1 = s32(a[0x2001]), y1 = s32(a[0x2002]), x2 = s32(a[0x2003]), y2 = s32(a[0x2004]);
        r = { x: x1 + pageW / 2, y: y1 + pageH / 2, w: x2 - x1, h: y2 - y1 };
      } else if (f.ancreRect) {
        const [x1, y1, x2, y2] = f.ancreRect;
        r = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      return r;
    }

    let ordreZ = 0; // ordre d'apparition dans Escher = ordre de superposition
    // rotations : groupes tournés qui contiennent la forme, du plus intérieur au plus extérieur ({ cx, cy, a })
    function parcourirGroupe(r, transfo, rotations) {
      let rotationsEnfants = rotations || [];
      const enfants = enregistrements(dv, r.off, r.off + r.len);
      let transfoEnfants = transfo;
      enfants.forEach((e, i) => {
        if (e.type === 0xF004) {
          const f = lireForme(e);
          const estGroupe = i === 0 && !!f.groupe;
          // la forme du groupe se place dans le repère du parent, les enfants dans celui du groupe
          f.rect = rectPage(f, estGroupe ? transfo : transfoEnfants);
          f.rotations = estGroupe ? (rotations || []) : rotationsEnfants;
          f.ordre = ++ordreZ;
          if (estGroupe) {
            // forme du groupe lui-même : définit le repère des enfants
            const g = f.groupe;
            const gw = g[2] - g[0], gh = g[3] - g[1];
            if (f.rect && gw && gh) {
              let rg = f.rect;
              // groupe tourné : comme pour une forme, l'ancre est le cadre tourné entre 45° et 135° (ou 225°-315°) ;
              // les enfants sont placés dans le cadre non tourné, puis tournent autour du centre du groupe
              let a = f.props[4] ? (f.props[4].val | 0) / 65536 % 360 : 0;
              if (a < 0) a += 360;
              if (a) {
                const cx = rg.x + rg.w / 2, cy = rg.y + rg.h / 2;
                if ((a >= 45 && a < 135) || (a >= 225 && a < 315)) rg = { x: cx - rg.h / 2, y: cy - rg.w / 2, w: rg.h, h: rg.w };
                rotationsEnfants = [{ cx, cy, a }, ...(rotations || [])];
              }
              transfoEnfants = { ax: rg.x, ay: rg.y, gx: g[0], gy: g[1], sx: rg.w / gw, sy: rg.h / gh };
            } else {
              transfoEnfants = null; // groupe racine : les enfants ont une ancre propre
            }
          }
          if (f.ancre && (0x6802 in f.ancre)) {
            const a = f.ancre, t = a[0x6802];
            if (!tableaux.has(t)) tableaux.set(t, { fond: null, cellules: new Map(), bords: [] });
            const T = tableaux.get(t);
            if (0x2001 in a) {
              T.bords.push({ sens: a[0x2001], r1: a[0x2004] || 0, c1: a[0x2005] || 0, r2: a[0x2006] || 0, c2: a[0x2007] || 0, props: f.props });
            } else T.cellules.set(a[0x2003] || 0, f.props);
          } else if (f.seq != null) {
            formes.set(f.seq, f);
          }
        } else if (e.type === 0xF003) {
          parcourirGroupe(e, transfoEnfants, rotationsEnfants);
        }
      });
    }

    for (const r of enregistrements(dv, 0, dv.byteLength)) void r; // (validation)
    // Les DgContainer sont séparés par des octets de remplissage : on les cherche.
    for (let o = 0; o + 8 <= stm.length; o++) {
      if (stm[o] === 0x0f && stm[o + 1] === 0x00 && stm[o + 2] === 0x02 && stm[o + 3] === 0xf0) {
        const len = dv.getUint32(o + 4, true);
        if (o + 8 + len > stm.length) continue;
        for (const r of enregistrements(dv, o + 8, o + 8 + len)) {
          if (r.type === 0xF003) parcourirGroupe(r, null);
        }
        o += 7 + len;
      }
    }

    // Images
    const ddv = delay ? vue(delay) : null;
    function image(pib) {
      const b = blips[pib - 1];
      if (!b || !ddv || b.off + 8 > delay.length) return null;
      const inst = ddv.getUint16(b.off, true) >> 4, type = ddv.getUint16(b.off + 2, true), len = ddv.getUint32(b.off + 4, true);
      const deb = b.off + 8, fin = Math.min(deb + len, delay.length);
      const deuxUID = inst & 1;
      const types = { 0xF01D: 'image/jpeg', 0xF01E: 'image/png', 0xF01F: 'image/bmp', 0xF029: 'image/tiff', 0xF01A: 'emf', 0xF01B: 'wmf', 0xF01C: 'pict' };
      const mime = types[type];
      if (!mime) return null;
      if (mime === 'emf' || mime === 'wmf' || mime === 'pict') {
        const h = deb + 16 * (deuxUID ? 2 : 1);
        return { mime, compresse: delay[h + 32] === 0, data: delay.subarray(h + 34, fin), taille: ddv.getUint32(h, true) };
      }
      const d = deb + 16 * (deuxUID ? 2 : 1) + 1;
      let data = delay.subarray(d, fin);
      if (mime === 'image/bmp') {
        // DIB -> BMP : ajouter l'en-tête de fichier
        const dib = vue(data);
        const hs = dib.getUint32(0, true), bits = dib.getUint16(14, true), clr = dib.getUint32(32, true);
        const pal = bits <= 8 ? (clr || (1 << bits)) * 4 : (dib.getUint32(16, true) === 3 ? 12 : 0);
        const bmp = new Uint8Array(14 + data.length);
        const bv = vue(bmp);
        bmp[0] = 0x42; bmp[1] = 0x4D;
        bv.setUint32(2, bmp.length, true); bv.setUint32(10, 14 + hs + pal, true);
        bmp.set(data, 14);
        data = bmp;
      }
      return { mime, data };
    }

    return { formes, tableaux, image, nbImages: blips.length };
  }

  /* ---------------------------------------------------------------
     5. Quill : texte, histoires, styles, polices, couleurs
     --------------------------------------------------------------- */
  function lireQuill(q) {
    const dv = vue(q);
    const index = [];
    let L = 0x18, garde = 0;
    while (L && L + 8 <= q.length && garde++ < 64) {
      const n = dv.getUint16(L + 2, true), suivant = dv.getUint32(L + 4, true);
      for (let i = 0; i < n; i++) {
        const o = L + 8 + 24 * i;
        if (o + 24 > q.length) break;
        index.push({
          nom: String.fromCharCode(q[o + 2], q[o + 3], q[o + 4], q[o + 5]),
          id: dv.getUint16(o + 6, true), off: dv.getUint32(o + 16, true), len: dv.getUint32(o + 20, true)
        });
      }
      L = suivant !== 0xffffffff && suivant > L ? suivant : 0;
    }
    const tous = nom => index.filter(e => e.nom === nom);
    const un = nom => tous(nom)[0];

    const T = un('TEXT');
    let texte = '';
    if (T) for (let o = T.off; o + 1 < T.off + T.len; o += 2) texte += String.fromCharCode(dv.getUint16(o, true));
    const baseTexte = T ? T.off : 0;

    // histoires : identifiants (SYID) et longueurs (STRS)
    const histoires = new Map();
    const S = un('SYID'), R = un('STRS');
    if (S && R) {
      const n = dv.getUint32(S.off + 4, true);
      const m = dv.getUint32(R.off, true);
      let pos = 0;
      for (let i = 0; i < Math.min(n, m); i++) {
        const id = dv.getUint32(S.off + 8 + i * 4, true);
        const len = dv.getUint32(R.off + 12 + i * 4, true);
        histoires.set(id, { index: i, debut: pos, fin: pos + len });
        pos += len;
      }
    } else if (texte) histoires.set(0, { index: 0, debut: 0, fin: texte.length });

    // cellules de tableau : TCD (id = index de l'histoire)
    const cellulesTexte = new Map();
    for (const e of tous('TCD ')) {
      const n = dv.getUint32(e.off, true);
      const fins = [];
      for (let i = 0; i <= n && e.off + 12 + i * 4 + 4 <= e.off + e.len; i++) fins.push(dv.getUint32(e.off + 12 + i * 4, true));
      cellulesTexte.set(e.id, fins);
    }

    // polices
    const polices = [];
    const F = un('FONT');
    if (F) {
      const n = dv.getUint32(F.off + 4, true);
      for (let i = 0; i < n; i++) {
        const o = F.off + 20 + dv.getUint32(F.off + 20 + i * 4, true);
        if (o + 2 > F.off + F.len) { polices.push('Times New Roman'); continue; }
        const nc = dv.getUint16(o, true);
        let s = '';
        for (let k = 0; k < nc; k++) s += String.fromCharCode(dv.getUint16(o + 2 + k * 2, true));
        polices.push(s);
      }
    }

    // couleurs du texte (PL)
    const couleursTexte = [];
    const P = un('PL  ');
    if (P) {
      const n = dv.getUint32(P.off, true);
      let o = P.off + 12;
      for (let i = 0; i < n && o + 4 <= P.off + P.len; i++) {
        const len = dv.getUint32(o, true);
        let c = 0;
        for (const b of sousBlocs(dv, { off: o, fin: o + len })) if (b.id === 1) { c = b.val; break; }
        couleursTexte.push(c);
        o += len;
      }
    }

    // pages de propriétés FDPC (caractères) et FDPP (paragraphes)
    function pagesProps(nom) {
      const runs = [];
      for (const e of tous(nom).sort((a, b) => a.id - b.id)) {
        const n = dv.getUint16(e.off, true);
        for (let i = 0; i < n; i++) {
          const fin = (dv.getUint32(e.off + 8 + i * 4, true) - baseTexte) / 2;
          const so = dv.getUint16(e.off + 8 + n * 4 + i * 2, true);
          const blocs = so ? blocsA(dv, e.off + so) : [];
          runs.push({ fin, blocs });
        }
      }
      runs.sort((a, b) => a.fin - b.fin);
      return runs;
    }
    const runsCar = pagesProps('FDPC');
    const runsPar = pagesProps('FDPP');

    // style par défaut (STSH 1 : premier style de la feuille)
    let defCar = [], defPar = [];
    const st = tous('STSH').find(e => e.id === 1);
    if (st) {
      try {
        // u32 len, u32 nb, ... puis styles : on prend le premier style de caractères trouvé
        const nb = dv.getUint32(st.off + 4, true);
        const deb = st.off + 8 + nb * 4 + 12;
        void deb;
        // recherche simple : premier bloc 0x0c (taille) suivi d'une table de polices
        for (let o = st.off + 8; o < st.off + st.len - 6; o++) {
          if (q[o] === 0x0c && q[o + 1] === 0x22) {
            // remonte au début du style (u32 longueur)
            for (let d = o - 4; d >= st.off; d--) {
              const l = dv.getUint32(d, true);
              if (l >= 6 && d + l <= st.off + st.len && d + 4 === o) { defCar = blocsA(dv, d); break; }
            }
            break;
          }
        }
      } catch (e) { /* style par défaut facultatif */ }
    }

    return { texte, histoires, cellulesTexte, polices, couleursTexte, runsCar, runsPar, defCar, defPar, dv };
  }

  /* ---------------------------------------------------------------
     6. Interprétation des styles
     --------------------------------------------------------------- */
  function couleurRGB(v, palette) {
    if (v == null) return null;
    if ((v >>> 24) === 0x08) {
      const i = v & 0xff;
      return palette[i] || '#000000';
    }
    if ((v >>> 24) > 0x08) return null;
    const r = v & 0xff, g = (v >> 8) & 0xff, b = (v >> 16) & 0xff;
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function styleCaractere(dv, blocs, Q, palette) {
    const s = {};
    const ids = new Map();
    for (const b of blocs) if (!ids.has(b.id)) ids.set(b.id, b);
    if (ids.has(0x0c)) s.taille = Math.round(ids.get(0x0c).val / EMU_PT * 2) / 2;
    // 0x02 / 0x03 : gras, italique. 0x37 / 0x38 sont leurs équivalents pour les écritures complexes : 0x37 seul n'est jamais gras
    // (4 cas sur 4 dans le PDF de référence, nov. 2026) ; 0x38 traité de même par analogie
    if (ids.has(0x02)) s.gras = true;
    if (ids.has(0x03)) s.italique = true;
    if (ids.has(0x1e) && (ids.get(0x1e).val & 0xff)) s.souligne = true;
    // 0x13 sans valeur : petites capitales (« application » en 12 pt gras s'affiche APPLICATION, plus petit que
    // des majuscules de 12 pt : vu sur un PDF de Publisher, nov. 2026) ; 0x12 et 0x3e valent 1036 : la langue (français)
    if (ids.has(0x13) && ids.get(0x13).val == null) s.petitesCapitales = true;
    if (ids.has(0x24)) {
      const b = ids.get(0x24);
      const entrees = b.varia ? sousBlocs(dv, b) : [];
      let idx = null;
      const e0 = entrees.find(e => e.id === 0) || entrees[0];
      if (e0 && e0.varia) {
        const f = sousBlocs(dv, e0).find(x => x.type === 0x18);
        if (f) idx = f.val;
      }
      if (idx != null && Q.polices[idx]) s.police = Q.polices[idx];
    }
    let ci = null;
    for (const k of [0x44, 0x2e]) {
      if (ids.has(k) && ci == null) {
        const b = ids.get(k);
        if (b.varia) { const x = sousBlocs(dv, b).find(y => y.type === 0x22 || y.type === 0x20); if (x) ci = x.val; }
        else ci = b.val;
      }
    }
    if (ci != null && Q.couleursTexte[ci] != null) s.couleur = couleurRGB(Q.couleursTexte[ci], palette);
    if (ids.has(0x2f)) { const v = ids.get(0x2f).val; if (v === 1) s.exposant = true; else if (v === 2) s.indice = true; }
    // 0x0f : position du caractère, octet bas 1 = exposant, 2 = indice (le « i » de xi, ni : vu sur un .pub de statistique, nov. 2026)
    if (ids.has(0x0f) && ids.get(0x0f).val != null) { const v = ids.get(0x0f).val & 0xff; if (v === 1) s.exposant = true; else if (v === 2) s.indice = true; }
    return s;
  }

  const ALIGN = { 0: 'left', 1: 'right', 2: 'center', 3: 'justify', 6: 'justify' };

  function styleParagraphe(dv, blocs) {
    const s = {};
    const ids = new Map();
    for (const b of blocs) if (!ids.has(b.id)) ids.set(b.id, b);
    if (ids.has(0x04)) s.align = ALIGN[ids.get(0x04).val & 0xff] || 'left';
    if (ids.has(0x0c)) s.retrait1 = s32(ids.get(0x0c).val) / EMU_MM;
    if (ids.has(0x0d)) s.retraitG = s32(ids.get(0x0d).val) / EMU_MM;
    if (ids.has(0x0e)) s.retraitD = s32(ids.get(0x0e).val) / EMU_MM;
    if (ids.has(0x12)) s.avant = ids.get(0x12).val / EMU_PT;
    if (ids.has(0x13)) s.apres = ids.get(0x13).val / EMU_PT;
    if (ids.has(0x34)) {
      const v = ids.get(0x34).val;
      // bit 2 : en « sp » (interlignes simples), 1 sp = 914 400 (vérifié sur le PDF de trame de base :
      // 0x129A82 = 1,33 sp) ; bit 1 : en points (EMU)
      if (v & 2) s.interligne = Math.round((v & ~3) / 914400 * 1000) / 1000;
      else if (v & 1) s.interligneP = Math.round((v & ~3) / EMU_PT * 10) / 10;
    }
    // 0x32 : taquets de tabulation du paragraphe (0x28 : liste ; 0 : position en EMU). Alignement : seul « à gauche » a été vu.
    if (ids.has(0x32) && ids.get(0x32).varia) {
      const liste = sousBlocs(dv, ids.get(0x32)).find(x => x.id === 0x28 && x.varia);
      if (liste) {
        const pos = [];
        for (const e of sousBlocs(dv, liste)) {
          const p0 = e.varia ? sousBlocs(dv, e).find(x => x.id === 0) : null;
          if (p0 && p0.val > 0) pos.push(Math.round(p0.val / EMU_MM * 100) / 100);
        }
        if (pos.length) s.taquets = pos;
      }
    }
    if (ids.has(0x57) && ids.get(0x57).varia) {
      const l = sousBlocs(dv, ids.get(0x57));
      const c = l.find(x => x.id === 1);
      s.puce = c ? c.val : 0x2022;
    }
    return s;
  }

  /* ---------------------------------------------------------------
     7. Texte -> HTML
     --------------------------------------------------------------- */
  const echapper = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function cssCar(s, base) {
    const st = [];
    const police = s.police || base.police;
    if (police) st.push(`font-family:'${police.replace(/'/g, '')}'`);
    const taille = s.taille || base.taille;
    if (taille) st.push(`font-size:${taille}pt`);
    if (s.gras) st.push('font-weight:bold');
    if (s.italique) st.push('font-style:italic');
    if (s.souligne) st.push('text-decoration:underline');
    if (s.petitesCapitales) st.push('font-variant:small-caps');
    if (s.couleur && s.couleur !== '#000000') st.push(`color:${s.couleur}`);
    // exposants et indices : 0,65 × la taille du texte, décalés de 0,44 (haut) ou 0,15 (bas), mesuré sur le PDF
    if (s.exposant || s.indice) st.push(`font-size:${Math.round((taille || 10) * 6.5) / 10}pt`, `vertical-align:${s.exposant ? 0.68 : -0.23}em`, 'line-height:0');
    return st.join(';');
  }

  // hauteur de ligne naturelle des polices courantes (en fraction de la taille), pour les paragraphes à interligne réglé (0x34)
  const RATIO_POLICE = { 'calibri': 1.221, 'calibri light': 1.221, 'cambria': 1.172, 'arial': 1.149, 'arial black': 1.41, 'arial narrow': 1.149, 'times new roman': 1.15,
    'verdana': 1.215, 'tahoma': 1.207, 'georgia': 1.136, 'segoe ui': 1.33, 'comic sans ms': 1.394, 'trebuchet ms': 1.161, 'courier new': 1.133,
    'impact': 1.219, 'garamond': 1.12, 'century gothic': 1.226, 'book antiqua': 1.17, 'bookman old style': 1.17, 'franklin gothic medium': 1.134, 'candara': 1.221, 'corbel': 1.221, 'constantia': 1.221 };
  // pas des lignes à interligne simple (en fraction de la taille), LU dans les .pub : la hauteur de texte des cellules (0x9) moins
  // les marges donne 1,059 sur 700 cellules et 1,043 en gras sur 158 (confirmé par le PDF ; le navigateur donne 1,15).
  // Aucune règle générale trouvée : Matura MT suit les mesures Windows (1,331), pas Times.
  // N'ajouter ici que des polices mesurées ainsi ; les autres gardent la hauteur naturelle du navigateur.
  const PAS_MESURE = { 'times new roman': [1.059, 1.043] };
  const ratioPolice = n => RATIO_POLICE[(n || '').toLowerCase()] || 1.15;

  function cssPar(p, police, taille, gras) {
    const st = [];
    if (p.align && p.align !== 'left') st.push(`text-align:${p.align}`);
    if (p.retraitG) st.push(`margin-left:${+p.retraitG.toFixed(2)}mm`);
    if (p.retraitD) st.push(`margin-right:${+p.retraitD.toFixed(2)}mm`);
    if (p.retrait1) st.push(`text-indent:${+p.retrait1.toFixed(2)}mm`);
    if (p.avant) st.push(`margin-top:${+p.avant.toFixed(1)}pt`);
    if (p.apres) st.push(`margin-bottom:${+p.apres.toFixed(1)}pt`);
    // format .pub : interligne = sp × 1,2 × hauteur naturelle de la police (mesuré sur un PDF imprimé depuis l'application d'origine)
    if (p.interligne) {
      st.push(`line-height:${+(p.interligne * 1.2 * ratioPolice(police)).toFixed(3)}`);
      // la ligne « vide » du paragraphe compte aussi : même taille que son texte
      if (taille) st.push(`font-size:${taille}pt`);
    }
    if (p.interligneP) st.push(`line-height:${+p.interligneP.toFixed(1)}pt`);
    // interligne simple : pas mesuré si on le connaît ; la ligne d'appui du paragraphe prend la police et la taille de son texte
    if (!p.interligne && !p.interligneP) {
      const pas = PAS_MESURE[(police || '').toLowerCase()];
      if (pas) st.push(`line-height:${pas[gras ? 1 : 0]}`);
      if (police) st.push(`font-family:'${police.replace(/'/g, '')}'`);
      if (taille) st.push(`font-size:${taille}pt`);
    }
    return st.join(';');
  }

  function fabriqueTexte(Q, palette) {
    const dv = Q.dv;
    const cacheC = new Map(), cacheP = new Map();
    const base = styleCaractere(dv, Q.defCar, Q, palette);
    if (!base.police) base.police = Q.polices[0] || 'Times New Roman';
    if (!base.taille) base.taille = 10;

    function runA(runs, pos) {
      // premier run dont la fin dépasse pos
      let lo = 0, hi = runs.length - 1, r = -1;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (runs[m].fin > pos) { r = m; hi = m - 1; } else lo = m + 1;
      }
      return r;
    }
    function sCar(i) {
      if (i < 0) return {};
      if (!cacheC.has(i)) cacheC.set(i, styleCaractere(dv, Q.runsCar[i].blocs, Q, palette));
      return cacheC.get(i);
    }
    function sPar(i) {
      if (i < 0) return {};
      if (!cacheP.has(i)) cacheP.set(i, styleParagraphe(dv, Q.runsPar[i].blocs));
      return cacheP.get(i);
    }

    // HTML d'un intervalle [debut, fin) du texte global
    function html(debut, fin) {
      const t = Q.texte;
      let out = '';
      let p = debut;
      while (p < fin) {
        let q = t.indexOf('\r', p);
        if (q < 0 || q >= fin) q = fin;
        const ps = sPar(runA(Q.runsPar, Math.max(p, q === fin ? p : q)));
        let contenu = '';
        let tailleMax = 0;
        let sDom = null, nDom = -1; // style du plus long morceau du paragraphe (et non du premier caractère, souvent une puce)
        let i = p;
        while (i < q) {
          const ri = runA(Q.runsCar, i);
          const fr = ri >= 0 ? Math.min(Q.runsCar[ri].fin, q) : q;
          const finRun = fr > i ? fr : q;
          const s = sCar(ri);
          tailleMax = Math.max(tailleMax, s.taille || base.taille);
          let morceau = t.slice(i, finRun)
            .replace(/[\u0000-\u0008\u000c\u000e-\u001f]/g, '');
          morceau = echapper(morceau).replace(/\u000b/g, '<br>');
          const nm = morceau.replace(/s/g, '').length;
          if (nm > nDom) { nDom = nm; sDom = s; }
          if (morceau) contenu += `<span style="${cssCar(s, base)}">${morceau}</span>`;
          i = finRun;
        }
        // caractère de fin de paragraphe : donne la taille d'une ligne vide
        const sFin = sCar(runA(Q.runsCar, q < fin ? q : Math.max(p, q - 1)));
        if (!contenu) contenu = `<span style="${cssCar(sFin, base)}"><br></span>`;
        let puce = '';
        if (ps.puce) {
          const c = ps.puce;
          const car = c < 0x100 ? `<span style="font-family:Wingdings">${echapper(String.fromCharCode(c))}</span>` : echapper(String.fromCharCode(c));
          puce = `<span class="puce" contenteditable="false" style="${cssCar(sFin, base)}">${car} </span>`;
        }
        const s0 = sDom || sCar(runA(Q.runsCar, p));
        out += `<p${ps.taquets ? ` data-taquets="${ps.taquets.join(';')}"` : ''} style="${cssPar(ps, s0.police || base.police, s0.taille || base.taille, s0.gras)}">${puce}${contenu}</p>`;
        p = q + 1;
        if (q === fin) break;
      }
      return out;
    }
    return { html, base };
  }

  /* ---------------------------------------------------------------
     8. Construction de la fiche
     --------------------------------------------------------------- */
  function enBase64(u8) {
    if (typeof Buffer !== 'undefined' && typeof window === 'undefined') return Buffer.from(u8).toString('base64');
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  const mm = emu => Math.round(emu / EMU_MM * 100) / 100;

  function lirePub(entree, options) {
    options = options || {};
    const cfb = lireCFB(entree);
    const contents = cfb.lire('Contents');
    if (!contents) throw new Error('Fichier .pub incomplet : flux « Contents » absent.');
    const quill = cfb.lire('Quill/QuillSub/CONTENTS');
    const stm = cfb.lire('Escher/EscherStm');
    const delay = cfb.lire('Escher/EscherDelayStm');
    const avertissements = [];

    const dv = vue(contents);
    const chunks = lireRepertoire(dv);
    const B = new Map();
    const blocsDe = seq => {
      if (!B.has(seq)) {
        const c = chunks[seq];
        B.set(seq, c && c.off != null && c.off + 4 <= dv.byteLength ? carte(blocsA(dv, c.off)) : new Map());
      }
      return B.get(seq);
    };
    const liste = b => (b && b.varia ? sousBlocs(dv, b).map(x => x.val) : []);

    const docRef = chunks.find(c => c.type === 0x44);
    if (!docRef) throw new Error('Structure du document introuvable (version du format .pub non prise en charge ?).');
    const doc = blocsDe(docRef.seq);
    let pageW = 21 * 360000 / 10 * 10, pageH = 29.7 * 360000;
    pageW = 7560000; pageH = 10692000;
    if (doc.has(0x12)) {
      const t = sousBlocs(dv, doc.get(0x12));
      const w = t.find(x => x.id === 1), h = t.find(x => x.id === 2);
      if (w && h) { pageW = w.val; pageH = h.val; }
    }

    // palette des couleurs du jeu de couleurs
    const palette = ['#000000'];
    const palRef = doc.has(0x22) ? doc.get(0x22).val : null;
    if (palRef != null && chunks[palRef]) {
      const pb = blocsDe(palRef);
      if (pb.has(0x2)) {
        sousBlocs(dv, pb.get(0x2)).forEach((e, i) => {
          if (e.varia) {
            const c = sousBlocs(dv, e).find(x => x.id === 1);
            if (c) palette[i] = couleurRGB(c.val & 0xffffff, []);
          }
        });
      }
    }
    if (!palette[0]) palette[0] = '#000000';

    const E = stm ? lireEscher(stm, delay, pageW, pageH) : { formes: new Map(), tableaux: new Map(), image: () => null };
    const Q = quill ? lireQuill(quill) : null;
    const TX = Q ? fabriqueTexte(Q, palette) : null;

    const images = {};
    let nImg = 0;
    const cacheImg = new Map();
    function refImage(pib) {
      if (cacheImg.has(pib)) return cacheImg.get(pib);
      const im = E.image(pib);
      let ref = null;
      if (im && im.mime.startsWith('image/')) {
        ref = 'img' + (++nImg);
        images[ref] = `data:${im.mime};base64,${enBase64(im.data)}`;
      } else if (im && (im.mime === 'emf' || im.mime === 'wmf')) {
        // dessin vectoriel Windows : l'éditeur le convertit en PNG à l'ouverture
        ref = 'img' + (++nImg);
        images[ref] = `data:image/x-${im.mime}${im.compresse ? ';z=1' : ''};base64,${enBase64(im.data)}`;
      } else if (im) {
        avertissements.push(`Image au format ${im.mime.toUpperCase()} non affichable (remplacée par un cadre gris).`);
      }
      cacheImg.set(pib, ref);
      return ref;
    }

    const P = f => (f && f.props) || {};
    const val = (props, id, def) => (id in props ? props[id].val : def);

    // couleur « calculée » d'Office (octet haut 0x10) : couleur de fond ou de contour de la forme, assombrie ou éclaircie
    function couleurCalculee(v, props) {
      if ((v >>> 24) !== 0x10) return couleurRGB(v, palette);
      const base = couleurRGB(val(props, (v & 0xff) === 0xf0 ? 0x181 : 0x1c0, 0), palette) || '#000000';
      const op = (v >> 8) & 0xf, k = ((v >> 16) & 0xff) / 255;
      return '#' + [1, 3, 5].map(i => { const x = parseInt(base.slice(i, i + 2), 16); return Math.round(op === 1 ? x * k : op === 2 ? 255 - (255 - x) * k : x).toString(16).padStart(2, '0'); }).join('');
    }
    // ombre portée (0x23F : bit 1 = ombre, bit 17 = valeur définie ; décalage 0x205 / 0x206 en EMU ; couleur 0x201)
    function ombrePortee(props) {
      const b = val(props, 0x23f, 0);
      if (!(b & 0x20000) || !(b & 2)) return null;
      const type = val(props, 0x200, 0);
      if (type !== 0) return null; // ombres en perspective, doubles… : non reprises
      return { dx: mm(s32(val(props, 0x205, 25400))), dy: mm(s32(val(props, 0x206, 25400))), flou: 0, couleur: couleurCalculee(val(props, 0x201, 0x808080), props) || '#808080' };
    }
    function remplissage(props) {
      const bool = val(props, 0x1bf, null);
      let plein = true;
      if (bool != null && (bool & 0x100000)) plein = !!(bool & 0x10);
      if (!plein) return null;
      const typeF = val(props, 0x180, 0);
      const c1 = couleurRGB(val(props, 0x181, 0xffffff), palette);
      if (c1 == null) return null;
      const o = val(props, 0x182, 0x10000) / 0x10000;
      const r = { couleur: c1 };
      if (o < 0.999) r.opacite = Math.round(o * 100) / 100;
      if (typeF >= 4 && typeF <= 7) {
        r.degrade = couleurRGB(val(props, 0x183, 0xffffff), palette) || '#ffffff';
        r.angle = (s32(val(props, 0x18b, 0)) / 0x10000) || 0;
      }
      if (typeF === 3 || typeF === 2) {
        const pib = val(props, 0x186, 0);
        if (pib) { const ref = refImage(pib); if (ref) r.image = ref; }
      }
      // motif (hachures…) : petite image répétée, couleur de premier plan 0x181 et d'arrière-plan 0x183
      if (typeF === 1) {
        const pib = val(props, 0x186, 0);
        const ref = pib ? refImage(pib) : null;
        if (ref) { r.motif = ref; r.fondMotif = couleurRGB(val(props, 0x183, 0xffffff), palette) || '#ffffff'; }
      }
      return r;
    }

    function trait(props, defaut) {
      const bool = val(props, 0x1ff, null);
      let actif = defaut;
      if (bool != null && (bool & 0x80000)) actif = !!(bool & 0x8);
      if (!actif) return null;
      const c = couleurRGB(val(props, 0x1c0, 0), palette);
      if (c == null) return null;
      const t = { couleur: c, epaisseur: Math.round(val(props, 0x1cb, 9525) / EMU_PT * 100) / 100 };
      const tir = val(props, 0x1ce, 0);
      if (tir) t.tirets = tir;
      const fd = val(props, 0x1d0, 0), ff = val(props, 0x1d1, 0);
      if (fd) t.flecheDebut = fd;
      if (ff) t.flecheFin = ff;
      return t;
    }

    // Formes « à formules » (formes Office 2007 enregistrées en .pub : secteur, arc…) : les points peuvent renvoyer
    // à des guides calculés (0x156, 8 octets chacun : opération + 3 paramètres) à partir des valeurs d'ajustement
    // (0x147…0x150, angles en degrés × 65 536). Décodé sur les secteurs d'un diagramme circulaire (nov. 2026).
    function guides(props, cadre) {
      const adj = []; for (let k = 0; k < 10; k++) adj.push(s32(val(props, 0x147 + k, 0)));
      const g = [];
      const p = props[0x156] && props[0x156].data && props[0x156].data.length >= 6 && vue(props[0x156].data).getUint16(4, true) === 8 ? props[0x156]
        : props[0x155] && props[0x155].data && props[0x155].data.length >= 6 && vue(props[0x155].data).getUint16(4, true) === 8 ? props[0x155] : null;
      const ref = r => (r >= 0x140 && r <= 0x143 ? cadre[r - 0x140] : r >= 0x147 && r <= 0x150 ? adj[r - 0x147] : r >= 0x400 && r < 0x400 + g.length ? g[r - 0x400] : r === 0x4f7 || r === 0x4f8 || r === 0x4f9 ? 1 : 0);
      if (p) {
        const d = vue(p.data), n = d.getUint16(0, true);
        const deg = a => a / 65536 * Math.PI / 180;
        for (let i = 0; i < n && 6 + i * 8 + 8 <= p.data.length; i++) {
          const o = 6 + i * 8, sgf = d.getUint16(o, true);
          const prm = [1, 2, 3].map((k, j) => { const v = d.getUint16(o + k * 2, true); return sgf & (0x2000 << j) ? ref(v) : (v << 16 >> 16); });
          const [a, b, c] = prm;
          let r = 0;
          switch (sgf & 0x1fff) {
            case 0: r = a + b - c; break;
            case 1: r = c ? a * b / c : 0; break;
            case 2: r = (a + b) / 2; break;
            case 3: r = Math.abs(a); break;
            case 4: r = Math.min(a, b); break;
            case 5: r = Math.max(a, b); break;
            case 6: r = a > 0 ? b : c; break;
            case 7: r = Math.sqrt(a * a + b * b + c * c); break;
            case 8: r = Math.atan2(b, a) * 180 / Math.PI * 65536; break;
            case 9: r = a * Math.sin(deg(b)); break;
            case 10: r = a * Math.cos(deg(b)); break;
            case 11: r = a * Math.cos(Math.atan2(c, b)); break;
            case 12: r = a * Math.sin(Math.atan2(c, b)); break;
            case 13: r = Math.sqrt(Math.max(0, a)); break;
            case 14: r = a + b * 65536 - c * 65536; break;
            case 15: r = c ? b * Math.sqrt(Math.max(0, 1 - (a / c) * (a / c))) : 0; break;
            case 16: r = a * Math.tan(deg(b)); break;
            default: r = 0;
          }
          g.push(r);
        }
      }
      return g;
    }
    function geometrie(props) {
      const v = props[0x145], s = props[0x146];
      if (!v || !v.data) return null;
      const d = vue(v.data);
      if (v.data.length < 6) return null;
      const n = d.getUint16(0, true), cb = d.getUint16(4, true);
      const cadre = [val(props, 0x140, 0), val(props, 0x141, 0), val(props, 0x142, 21600), val(props, 0x143, 21600)];
      const G = guides(props, cadre);
      // coordonnée qui renvoie à un guide : bit de poids fort + numéro du guide
      const coord = (x, bits) => { const u = bits === 32 ? x >>> 0 : x & 0xffff, haut = bits === 32 ? 0x80000000 : 0x8000; if (u & haut) { const k = u & (haut - 1); if (k < G.length) return Math.round(G[k]); } return x; };
      const pts = [];
      for (let i = 0; i < n; i++) {
        const o = 6 + i * (cb === 0xfff0 ? 4 : cb);
        if (cb === 0xfff0 || cb === 4) { if (o + 4 > v.data.length) break; pts.push([coord(d.getInt16(o, true), 16), coord(d.getInt16(o + 2, true), 16)]); }
        else { if (o + 8 > v.data.length) break; pts.push([coord(d.getInt32(o, true), 32), coord(d.getInt32(o + 4, true), 32)]); }
      }
      const segs = [];
      if (s && s.data && s.data.length >= 6) {
        const sd = vue(s.data);
        const ns = sd.getUint16(0, true);
        for (let i = 0; i < ns && 6 + i * 2 + 2 <= s.data.length; i++) segs.push(sd.getUint16(6 + i * 2, true));
      }
      return { pts, segs, cadre };
    }

    let compteur = 0;
    const nouvelId = () => 'o' + (++compteur);

    function cadreBase(f, ch) {
      const r = f.rect;
      if (!r) return null;
      const props = P(f);
      let rot = (s32(val(props, 0x0004, 0)) / 0x10000) % 360;
      if (rot < 0) rot += 360;
      let x = r.x, y = r.y, w = r.w, h = r.h;
      if (w < 0) { x += w; w = -w; }
      if (h < 0) { y += h; h = -h; }
      // Escher : entre 45° et 135° (ou 225°-315°), l'ancre est le cadre tourné
      if ((rot >= 45 && rot < 135) || (rot >= 225 && rot < 315)) {
        const cx = x + w / 2, cy = y + h / 2;
        [w, h] = [h, w];
        x = cx - w / 2; y = cy - h / 2;
      }
      // rotation des groupes : le centre tourne autour de celui du groupe, et la forme tourne d'autant
      let rotGroupe = 0;
      for (const g of f.rotations || []) {
        const c = Math.cos(g.a * Math.PI / 180), s = Math.sin(g.a * Math.PI / 180);
        const dx = x + w / 2 - g.cx, dy = y + h / 2 - g.cy;
        x = g.cx + dx * c - dy * s - w / 2; y = g.cy + dx * s + dy * c - h / 2;
        rotGroupe += g.a;
      }
      const o = { id: nouvelId(), x: mm(x), y: mm(y), w: mm(w), h: mm(h), _z: f.ordre || 0 };
      if (rot) o.rot = Math.round(rot * 100) / 100;
      if (f.flags & 0x40) o.miroirH = true;
      if (f.flags & 0x80) o.miroirV = true;
      // Office tourne la forme puis la retourne ; l'affichage retourne puis tourne : un retournement dans un seul sens
      // inverse donc le sens de rotation (vérifié sur un secteur de diagramme circulaire, nov. 2026)
      if (o.rot && !o.miroirH !== !o.miroirV) o.rot = Math.round((360 - rot) % 360 * 100) / 100;
      if (rotGroupe) { const r2 = Math.round(((o.rot || 0) + rotGroupe) % 360 * 100) / 100; if (r2) o.rot = r2; else delete o.rot; }
      void ch;
      return o;
    }

    function marges(props) {
      return [0x81, 0x82, 0x83, 0x84].map(k => mm(val(props, k, 91440 * (k === 0x82 || k === 0x84 ? 0.5 : 1))));
    }

    function texteHistoire(id) {
      if (!Q || id == null || !Q.histoires.has(id)) return null;
      const h = Q.histoires.get(id);
      return TX.html(h.debut, h.fin);
    }

    function construireTableau(seq, ch, f, o) {
      const tb = ch;
      const nl = tb.has(0x66) ? tb.get(0x66).val : 1, nc = tb.has(0x67) ? tb.get(0x67).val : 1;
      const dims = tb.has(0x6d) ? sousBlocs(dv, tb.get(0x6d)).map(e => {
        const s = sousBlocs(dv, e);
        const t = s.find(x => x.id === 2);
        return t ? t.val : 0;
      }) : [];
      let cols = dims.slice(0, nc).map(mm), lignes = dims.slice(nc, nc + nl).map(mm);
      const sc = cols.reduce((a, b) => a + b, 0) || 1, sl = lignes.reduce((a, b) => a + b, 0) || 1;
      if (cols.length !== nc) cols = Array(nc).fill(o.w / nc);
      else cols = cols.map(c => Math.round(c * o.w / sc * 100) / 100);
      if (lignes.length !== nl) lignes = Array(nl).fill(o.h / nl);
      else lignes = lignes.map(c => Math.round(c * o.h / sl * 100) / 100);

      // cellules (ordre du texte)
      let defCells = [];
      const refCel = tb.has(0x6b) ? tb.get(0x6b).val : null;
      if (refCel != null) {
        const cb = blocsDe(refCel);
        if (cb.has(0x2)) {
          defCells = sousBlocs(dv, cb.get(0x2)).map(e => {
            const m = carte(sousBlocs(dv, e));
            const g = k => (m.has(k) ? m.get(k).val : 0);
            return { r1: g(1), r2: g(2), c1: g(3), c2: g(4), marges: [0xa, 0xb, 0xc, 0xd].map(k => (m.has(k) ? mm(m.get(k).val) : 1)), sens: g(6), vertical: g(7) };
          });
        }
      }
      if (defCells.length !== nl * nc && !defCells.length) {
        for (let r = 0; r < nl; r++) for (let c = 0; c < nc; c++) defCells.push({ r1: r, r2: r, c1: c, c2: c });
      }
      // texte des cellules
      const idTexte = tb.has(0x27) ? tb.get(0x27).val : null;
      let textes = [];
      if (Q && idTexte != null && Q.histoires.has(idTexte)) {
        const h = Q.histoires.get(idTexte);
        const fins = Q.cellulesTexte.get(h.index);
        if (fins && fins.length) {
          let deb = h.debut;
          for (const fz of fins) {
            const fa = Math.min(h.debut + fz, h.fin);
            textes.push(TX.html(deb, fa));
            deb = fa + 1;
          }
        } else {
          textes.push(TX.html(h.debut, h.fin));
        }
      }
      const tinfo = E.tableaux.get(seq) || { fond: null, cellules: new Map(), bords: [] };
      const fondT = tinfo.fond ? remplissage(tinfo.fond) : null;
      const cellules = defCells.map((c, i) => {
        const cel = { l: c.r1, c: c.c1, nl: c.r2 - c.r1 + 1, nc: c.c2 - c.c1 + 1, html: textes[i] || '<p><br></p>' };
        // 0x7 : alignement vertical de la cellule (1 = milieu ; 2 = bas, par analogie avec les zones de texte)
        if (c.vertical === 1) cel.vertical = 'milieu'; else if (c.vertical === 2) cel.vertical = 'bas';
        if (c.marges && defCells[0] && c.marges.join() !== defCells[0].marges.join()) cel.marges = c.marges;
        if (c.sens === 2) cel.sensTexte = 'haut-bas';
        else if (c.sens === 1) cel.sensTexte = 'bas-haut';
        const pc = tinfo.cellules.get(i);
        const fc = pc ? remplissage(pc) : null;
        if (fc) cel.fond = fc.couleur;
        return cel;
      });
      // Bordures : segments de la grille, dessinés dans le format .pub comme des
      // rectangles pleins (couleur = remplissage, épaisseur = 0x1cb).
      for (const b of tinfo.bords) {
        const fb = remplissage(b.props);
        if (!fb) continue;
        const s = { c: fb.couleur, e: Math.round(val(b.props, 0x1cb, 9525) / EMU_PT * 100) / 100 };
        for (const cel of cellules) {
          if (b.sens === 1) {
            if (cel.c + cel.nc <= b.c1 || cel.c >= b.c2) continue;
            if (cel.l === b.r1) (cel.bords = cel.bords || {}).h = s;
            if (cel.l + cel.nl === b.r1) (cel.bords = cel.bords || {}).b = s;
          } else {
            if (cel.l + cel.nl <= b.r1 || cel.l >= b.r2) continue;
            if (cel.c === b.c1) (cel.bords = cel.bords || {}).g = s;
            if (cel.c + cel.nc === b.c1) (cel.bords = cel.bords || {}).d = s;
          }
        }
      }
      o.type = 'tableau';
      o.cesure = true;
      o.tableau = { cols, lignes, cellules, marges: (defCells[0] && defCells[0].marges) || [1, 1, 1, 1] };
      if (fondT) o.tableau.fond = fondT.couleur;
      return o;
    }

    const FORMES = {
      1: 'rect', 2: 'rectArrondi', 3: 'ellipse', 4: 'losange', 5: 'triangle', 6: 'triangleRect', 7: 'parallelogramme',
      8: 'trapeze', 9: 'hexagone', 10: 'octogone', 11: 'plus', 12: 'etoile5', 13: 'flecheD', 15: 'pentagone', 20: 'ligne',
      32: 'ligne', 33: 'ligne', 34: 'ligne', 38: 'ligne', 55: 'chevron', 56: 'pentagone', 61: 'bulleRect', 62: 'bulleRectArrondi',
      63: 'bulleEllipse', 66: 'flecheG', 67: 'flecheB', 68: 'flecheH', 69: 'flecheGD', 70: 'flecheHB', 96: 'sourire',
      97: 'parchemin', 98: 'parchemin', 106: 'nuage', 109: 'rect', 176: 'rectArrondi', 183: 'soleil', 184: 'lune', 187: 'etoile4',
      188: 'vague', 64: 'vague', 65: 'coinPlie', 16: 'cube', 22: 'cylindre', 23: 'anneau', 92: 'etoile24', 58: 'etoile8',
      59: 'etoile16', 60: 'etoile32', 71: 'etoile5', 72: 'explosion', 73: 'eclair', 74: 'coeur', 76: 'croix', 110: 'losange',
      202: 'rect', 75: 'rect', 201: 'rect', 136: 'rect', 0: 'libre'
    };

    // ---- une forme (et ses enfants s'il s'agit d'un groupe) ----
    function construire(seq, groupe, sortie) {
      const c = chunks[seq];
      if (!c) return;
      const ch = blocsDe(seq);
      const f = E.formes.get(seq);
      if (c.type === 0x30) {
        const g = groupe || ('g' + seq);
        for (const k of liste(ch.get(0x15))) construire(k, g, sortie);
        return;
      }
      if (!f) return;
      const o = cadreBase(f, ch);
      if (!o) return;
      if (groupe) o.groupe = groupe;
      const props = P(f);

      if (c.type === 0x10) { sortie.push(construireTableau(seq, ch, f, o)); return; }

      // WordArt
      if (props[0xc0] && props[0xc0].data) {
        const d = props[0xc0].data;
        let t = '';
        for (let i = 0; i + 1 < d.length; i += 2) { const k = d[i] | (d[i + 1] << 8); if (!k) break; t += String.fromCharCode(k); }
        let police = 'Arial';
        if (props[0xc5] && props[0xc5].data) {
          const e = props[0xc5].data; police = '';
          for (let i = 0; i + 1 < e.length; i += 2) { const k = e[i] | (e[i + 1] << 8); if (!k) break; police += String.fromCharCode(k); }
        }
        const gb = val(props, 0xff, 0);
        o.type = 'wordart';
        o.wordart = { texte: t, police, gras: !!(gb & 0x20), italique: !!(gb & 0x10) };
        const fr = remplissage(props);
        o.wordart.couleur = fr ? fr.couleur : '#000000';
        const tr = trait(props, false);
        if (tr) o.wordart.contour = tr;
        sortie.push(o);
        return;
      }

      const pib = val(props, 0x104, 0);
      const idTexte = ch.has(0x27) ? ch.get(0x27).val : (0x80 in props ? props[0x80].val : null);
      // forme inconnue mais décrite par ses points (formes Office 2007 : secteur…) : tracée comme forme libre
      const forme = FORMES[f.stype] || (props[0x145] && props[0x146] ? 'libre' : 'rect');

      if (pib) {
        o.type = 'image';
        const ref = refImage(pib);
        o.image = ref;
        const crop = [0x101, 0x100, 0x102, 0x103].map(k => s32(val(props, k, 0)) / 0x10000);
        // ordre stocké : haut, bas, gauche, droite
        const [bas, haut, gauche, droite] = crop;
        if (haut || bas || gauche || droite) o.rognage = [haut, droite, bas, gauche].map(v => Math.round(v * 10000) / 10000);
        const tr = trait(props, false);
        if (tr) o.trait = tr;
        // fond de l'image (équations sur fond blanc) : seulement s'il est demandé explicitement
        if ((val(props, 0x1bf, 0) & 0x100010) === 0x100010) { const fi = remplissage(props); if (fi && fi.couleur) o.fond = { couleur: fi.couleur }; }
        const omI = ombrePortee(props);
        if (omI) o.ombre = omI;
        sortie.push(o);
        return;
      }

      o.type = idTexte != null && Q && Q.histoires.has(idTexte) ? 'texte' : 'forme';
      o.forme = forme === 'libre' ? 'libre' : forme;
      if (forme === 'libre') {
        const g = geometrie(props);
        if (g && g.pts.length) o.geometrie = g; else o.forme = 'rect';
      }
      if (forme === 'ligne') {
        o.type = 'ligne';
        const tr = trait(props, true);
        o.trait = tr || { couleur: '#000000', epaisseur: 0.75 };
        sortie.push(o);
        return;
      }
      const adj = val(props, 0x147, null);
      if (adj != null) o.ajust = s32(adj);
      const fr = remplissage(props);
      // format .pub : une zone de texte sans indication n'est pas remplie
      if (fr && !(f.stype === 202 && val(props, 0x1bf, null) == null)) o.fond = fr;
      const tr = trait(props, f.stype !== 202);
      if (tr) o.trait = tr;
      const om = ombrePortee(props);
      if (om) o.ombre = om;
      if (o.type === 'texte') {
        o.html = texteHistoire(idTexte);
        o._histoire = idTexte;
        // l'application d'origine coupe les mots par défaut (27 coupures sur le PDF d'une fiche de 32 pages, nov. 2026 ;
        // aucun réglage par zone trouvé dans le fichier) : le bouton Césure permet de la retirer
        o.cesure = true;
        o.marges = marges(props);
        const anc = val(props, 0x87, 0);
        o.vertical = anc === 1 || anc === 4 ? 'milieu' : anc === 2 || anc === 5 ? 'bas' : 'haut';
        const flux = val(props, 0x88, 0);
        if (flux === 1 || flux === 5) o.sensTexte = 'haut-bas';
        else if (flux === 2) o.sensTexte = 'bas-haut';
      }
      sortie.push(o);
    }

    // ---- pages ----
    const pagesRefs = liste(doc.get(0x2));
    const maitresUtilises = new Set();
    const infos = pagesRefs.map(seq => {
      const pb = blocsDe(seq);
      const maitre = pb.has(0xd) ? pb.get(0xd).val : null;
      if (maitre != null) maitresUtilises.add(maitre);
      return { seq, type: chunks[seq] && chunks[seq].type, pb, maitre, formes: liste(pb.get(0x2)) };
    });
    const maitres = {};
    const pages = [];
    for (const inf of infos) {
      if (inf.type !== 0x43) continue;
      const items = [];
      for (const s of inf.formes) construire(s, null, items);
      items.sort((a, b) => a._z - b._z);
      for (const o of items) delete o._z;
      if (maitresUtilises.has(inf.seq)) {
        maitres['m' + inf.seq] = { id: 'm' + inf.seq, items };
      } else if (inf.maitre != null || items.length) {
        pages.push({ id: 'p' + inf.seq, maitre: inf.maitre != null ? 'm' + inf.maitre : null, items });
      }
    }
    // cadres chaînés : dans le format .pub, les zones de texte liées partagent la même histoire
    // de texte. Le texte complet va au premier cadre ; l'éditeur le répartit à l'ouverture.
    const parHistoire = new Map();
    for (const p of [...pages, ...Object.values(maitres)]) for (const o of p.items) {
      if (o._histoire == null) continue;
      if (!parHistoire.has(o._histoire)) parHistoire.set(o._histoire, []);
      parHistoire.get(o._histoire).push(o);
      delete o._histoire;
    }
    for (const liste of parHistoire.values()) {
      if (liste.length < 2) continue;
      liste[0].htmlComplet = liste[0].html;
      liste.forEach((o, i) => {
        if (i) { o.precedent = liste[i - 1].id; o.html = ''; }
        if (i < liste.length - 1) o.suivant = liste[i + 1].id;
      });
    }

    // pages vides en fin de document (pages techniques) : on les retire
    while (pages.length > 1 && !pages[pages.length - 1].items.length) pages.pop();
    if (!pages.length) pages.push({ id: 'p1', maitre: null, items: [] });

    // tabulation par défaut du document (bloc document, 0x15, en EMU) : environ 10 mm dans les fiches françaises
    const tabDoc = doc.has(0x15) ? doc.get(0x15).val : null;
    const tabulation = tabDoc > 36000 && tabDoc < 3600000 ? Math.round(tabDoc / EMU_MM * 100) / 100 : null;

    // titre
    let titre = options.nom || 'Fiche';
    titre = titre.replace(/\.pub$/i, '');

    return {
      format: 'pagelibre', version: 1, titre,
      page: Object.assign({ w: mm(pageW), h: mm(pageH) }, tabulation ? { tabulation } : {}),
      palette, images, maitres, pages,
      avertissements: [...new Set(avertissements)]
    };
  }

  const api = { lirePub, lireCFB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.LecteurPub = api;
})(typeof window !== 'undefined' ? window : globalThis);
