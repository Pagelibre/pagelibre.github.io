/* =====================================================================
   Lecture des images vectorielles Windows (EMF et WMF) -> image PNG.
   Les fichiers .pub contiennent souvent des cliparts dans ces formats,
   que les navigateurs n'affichent pas. On rejoue les ordres de dessin GDI
   dans un canvas. Couvert : traits, polygones, courbes, rectangles,
   ellipses, chemins, texte, images bitmap (DIB), transformations.
   ===================================================================== */
(function (racine) {
  'use strict';

  const coul = v => `rgb(${v & 0xff},${(v >> 8) & 0xff},${(v >> 16) & 0xff})`;

  /* ---------- image bitmap (DIB) ---------- */
  async function dib(u8, off, len) {
    const dv = new DataView(u8.buffer, u8.byteOffset + off, Math.min(len, u8.length - off));
    const hs = dv.getUint32(0, true);
    let w, h, bpp, comp = 0, clrUsed = 0;
    if (hs === 12) { w = dv.getUint16(4, true); h = dv.getInt16(6, true); bpp = dv.getUint16(10, true); }
    else { w = dv.getInt32(4, true); h = dv.getInt32(8, true); bpp = dv.getUint16(14, true); comp = dv.getUint32(16, true); clrUsed = dv.getUint32(32, true); }
    if (comp === 4 || comp === 5) {
      const b = new Blob([u8.subarray(off + hs, off + len)], { type: comp === 4 ? 'image/jpeg' : 'image/png' });
      return createImageBitmap(b);
    }
    const basHaut = h > 0;
    h = Math.abs(h);
    if (!w || !h || w > 8000 || h > 8000) return null;
    const nPal = bpp <= 8 ? (clrUsed || (1 << bpp)) : 0;
    const palOff = hs + (comp === 3 && hs === 40 ? 12 : 0);
    const pal = [];
    for (let i = 0; i < nPal; i++) { const o = palOff + i * (hs === 12 ? 3 : 4); pal.push([dv.getUint8(o + 2), dv.getUint8(o + 1), dv.getUint8(o)]); }
    let bits = palOff + nPal * (hs === 12 ? 3 : 4);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const px = img.data;
    const ligne = Math.ceil(w * bpp / 32) * 4;
    const pose = (x, y, r, g, b, a) => { const yy = basHaut ? h - 1 - y : y, i = (yy * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
    if (comp === 1 && bpp === 8) {
      // RLE8
      let x = 0, y = 0, o = bits;
      while (o + 1 < dv.byteLength && y < h) {
        const n = dv.getUint8(o), v = dv.getUint8(o + 1); o += 2;
        if (n) { for (let k = 0; k < n && x < w; k++, x++) { const p = pal[v] || [0, 0, 0]; pose(x, y, p[0], p[1], p[2], 255); } }
        else if (v === 0) { x = 0; y++; }
        else if (v === 1) break;
        else if (v === 2) { x += dv.getUint8(o); y += dv.getUint8(o + 1); o += 2; }
        else { for (let k = 0; k < v && x < w; k++, x++) { const p = pal[dv.getUint8(o + k)] || [0, 0, 0]; pose(x, y, p[0], p[1], p[2], 255); } o += v + (v & 1); }
      }
    } else {
      for (let y = 0; y < h; y++) {
        const r0 = bits + y * ligne;
        if (r0 + ligne > dv.byteLength + 3) break;
        for (let x = 0; x < w; x++) {
          let r = 0, g = 0, b = 0, a = 255;
          if (bpp === 24) { const o = r0 + x * 3; b = dv.getUint8(o); g = dv.getUint8(o + 1); r = dv.getUint8(o + 2); }
          else if (bpp === 32) { const o = r0 + x * 4; b = dv.getUint8(o); g = dv.getUint8(o + 1); r = dv.getUint8(o + 2); }
          else if (bpp === 16) { const v = dv.getUint16(r0 + x * 2, true); r = ((v >> 10) & 31) * 8; g = ((v >> 5) & 31) * 8; b = (v & 31) * 8; }
          else {
            const parOctet = 8 / bpp, o = r0 + Math.floor(x / parOctet);
            const dec = (parOctet - 1 - (x % parOctet)) * bpp;
            const i = (dv.getUint8(o) >> dec) & ((1 << bpp) - 1);
            [r, g, b] = pal[i] || [0, 0, 0];
          }
          pose(x, y, r, g, b, a);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ---------- état GDI commun ---------- */
  function etatInitial() {
    return {
      wox: 0, woy: 0, wex: 1, wey: 1, vox: 0, voy: 0, vex: 1, vey: 1, mode: 1,
      monde: [1, 0, 0, 1, 0, 0],
      stylo: { couleur: '#000', largeur: 0, nul: false }, pinceau: { couleur: '#fff', nul: false },
      police: { hauteur: 12, gras: false, italique: false, nom: 'Arial', angle: 0 },
      texte: '#000', alignTexte: 0, remplissage: 'evenodd', cx: 0, cy: 0
    };
  }

  /* ---------- EMF ---------- */
  async function emf(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (dv.getUint32(0, true) !== 1 || dv.getUint32(40, true) !== 0x464D4520) throw new Error('EMF invalide');
    let bl = dv.getInt32(8, true), bt = dv.getInt32(12, true), br = dv.getInt32(16, true), bb = dv.getInt32(20, true);
    const fr = [24, 28, 32, 36].map(o => dv.getInt32(o, true));
    const devW = dv.getInt32(72, true), devH = dv.getInt32(76, true), mmW = dv.getInt32(80, true), mmH = dv.getInt32(84, true);
    const pxmm = mmW ? devW / mmW : 3.78, pymm = mmH ? devH / mmH : 3.78;
    if (br <= bl || bb <= bt) { bl = fr[0] / 100 * pxmm; bt = fr[1] / 100 * pymm; br = fr[2] / 100 * pxmm; bb = fr[3] / 100 * pymm; }
    const W = br - bl + 1, H = bb - bt + 1;
    const k = Math.min(4, 1600 / Math.max(W, H, 1));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
    const ctx = c.getContext('2d');
    let S = etatInitial();
    const pile = [];
    const objets = [];
    let chemin = false, dessins = 0, emfPlus = false;

    // coordonnées logiques -> pixels du canvas
    function pageVersDevice() {
      if (S.mode === 1) return [1, 1, S.vox - S.wox, S.voy - S.woy];
      if (S.mode === 7 || S.mode === 8) { const sx = S.vex / (S.wex || 1), sy = S.vey / (S.wey || 1); return [sx, sy, S.vox - S.wox * sx, S.voy - S.woy * sy]; }
      const u = { 2: 0.1, 3: 0.01, 4: 0.254, 5: 0.0254, 6: 25.4 / 1440 }[S.mode] || 1;
      return [u * pxmm, -u * pymm, S.vox - S.wox * u * pxmm, S.voy + S.woy * u * pymm];
    }
    function matrice() {
      const [a, b, cc, d, e, f] = S.monde, [sx, sy, tx, ty] = pageVersDevice();
      return [k * sx * a, k * sy * b, k * sx * cc, k * sy * d, k * (sx * e + tx - bl), k * (sy * f + ty - bt)];
    }
    function appliquer() { const m = matrice(); ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); }
    function echelleLigne() { const m = matrice(); return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }
    function versDevice(x, y) { const m = matrice(); return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
    function peindre(remplir, tracer) {
      if (chemin) return;
      dessins++;
      appliquer();
      if (remplir && !S.pinceau.nul) { ctx.fillStyle = S.pinceau.couleur; ctx.fill(S.remplissage); }
      if (tracer && !S.stylo.nul) {
        ctx.strokeStyle = S.stylo.couleur;
        ctx.lineWidth = S.stylo.largeur > 0 ? S.stylo.largeur : 1 / echelleLigne();
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
    const pts16 = (o, n) => { const p = []; for (let i = 0; i < n; i++) p.push([dv.getInt16(o + i * 4, true), dv.getInt16(o + i * 4 + 2, true)]); return p; };
    const pts32 = (o, n) => { const p = []; for (let i = 0; i < n; i++) p.push([dv.getInt32(o + i * 8, true), dv.getInt32(o + i * 8 + 4, true)]); return p; };
    function trace(p, fermer, bezier, suite) {
      // « suite » : on part du point courant (…TO) ; sinon le 1er point est un départ
      if (!chemin) { ctx.beginPath(); if (suite) ctx.moveTo(S.cx, S.cy); }
      if (!p.length) return;
      let i = 0;
      if (!suite) { ctx.moveTo(p[0][0], p[0][1]); i = 1; }
      if (bezier) { for (; i + 2 < p.length; i += 3) ctx.bezierCurveTo(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], p[i + 2][0], p[i + 2][1]); }
      else for (; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      if (fermer) ctx.closePath();
      const der = p[p.length - 1];
      S.cx = der[0]; S.cy = der[1];
    }
    function rect(o) { return [dv.getInt32(o, true), dv.getInt32(o + 4, true), dv.getInt32(o + 8, true), dv.getInt32(o + 12, true)]; }
    function stock(ih) {
      const i = ih & 0x7fffffff;
      if (i <= 5) return { t: 'b', couleur: ['#fff', '#c0c0c0', '#808080', '#404040', '#000', null][i], nul: i === 5 };
      if (i <= 8) return { t: 'p', couleur: i === 6 ? '#fff' : '#000', largeur: 0, nul: i === 8 };
      return { t: 'f', hauteur: 12, nom: 'Arial' };
    }
    function texte(x, y, s) {
      if (!s) return;
      dessins++;
      const [dx, dy] = versDevice(x, y);
      const m = matrice();
      const echY = Math.sqrt(m[2] * m[2] + m[3] * m[3]);
      const hpx = Math.max(1, Math.abs(S.police.hauteur) * echY * (S.police.hauteur > 0 ? 0.82 : 1));
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(dx, dy);
      if (S.police.angle) ctx.rotate(-S.police.angle * Math.PI / 1800);
      ctx.font = `${S.police.italique ? 'italic ' : ''}${S.police.gras ? 'bold ' : ''}${hpx}px "${S.police.nom}"`;
      ctx.fillStyle = S.texte;
      const a = S.alignTexte;
      ctx.textAlign = (a & 6) === 6 ? 'center' : (a & 2) ? 'right' : 'left';
      ctx.textBaseline = (a & 24) === 24 ? 'alphabetic' : (a & 8) ? 'bottom' : 'top';
      ctx.fillText(s, 0, 0);
      ctx.restore();
    }

    let o = 0;
    for (let garde = 0; o + 8 <= dv.byteLength && garde < 200000; garde++) {
      const type = dv.getUint32(o, true), taille = dv.getUint32(o + 4, true);
      if (taille < 8 || o + taille > dv.byteLength) break;
      const p = o + 8;
      // le repère doit être en place AVANT de construire le chemin
      if (type !== 33 && type !== 34) appliquer();
      switch (type) {
        case 14: o = dv.byteLength; continue; // EOF
        case 9: S.wex = dv.getInt32(p, true); S.wey = dv.getInt32(p + 4, true); break;
        case 10: S.wox = dv.getInt32(p, true); S.woy = dv.getInt32(p + 4, true); break;
        case 11: S.vex = dv.getInt32(p, true); S.vey = dv.getInt32(p + 4, true); break;
        case 12: S.vox = dv.getInt32(p, true); S.voy = dv.getInt32(p + 4, true); break;
        case 17: S.mode = dv.getUint32(p, true); break;
        case 19: S.remplissage = dv.getUint32(p, true) === 2 ? 'nonzero' : 'evenodd'; break;
        case 22: S.alignTexte = dv.getUint32(p, true); break;
        case 24: S.texte = coul(dv.getUint32(p, true)); break;
        case 33: pile.push(JSON.parse(JSON.stringify(S))); ctx.save(); break;
        case 34: { const n = Math.abs(dv.getInt32(p, true)) || 1; for (let i = 0; i < n && pile.length; i++) { S = pile.pop(); ctx.restore(); } break; }
        case 35: S.monde = [0, 4, 8, 12, 16, 20].map(d => dv.getFloat32(p + d, true)); break;
        case 36: {
          const x = [0, 4, 8, 12, 16, 20].map(d => dv.getFloat32(p + d, true)), mode = dv.getUint32(p + 24, true);
          const mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3], A[4] * B[0] + A[5] * B[2] + B[4], A[4] * B[1] + A[5] * B[3] + B[5]];
          if (mode === 1) S.monde = [1, 0, 0, 1, 0, 0]; else if (mode === 2) S.monde = mul(x, S.monde); else if (mode === 3) S.monde = mul(S.monde, x); else S.monde = x;
          break;
        }
        case 37: { const ih = dv.getUint32(p, true), ob = ih & 0x80000000 ? stock(ih) : objets[ih]; if (ob) { if (ob.t === 'p') S.stylo = ob; else if (ob.t === 'b') S.pinceau = ob; else if (ob.t === 'f') S.police = ob; } break; }
        case 38: objets[dv.getUint32(p, true)] = { t: 'p', nul: dv.getUint32(p + 4, true) === 5, largeur: dv.getInt32(p + 8, true), couleur: coul(dv.getUint32(p + 16, true)) }; break;
        case 95: objets[dv.getUint32(p, true)] = { t: 'p', nul: (dv.getUint32(p + 20, true) & 0xf) === 5, largeur: dv.getUint32(p + 24, true), couleur: coul(dv.getUint32(p + 32, true)) }; break;
        case 39: objets[dv.getUint32(p, true)] = { t: 'b', nul: dv.getUint32(p + 4, true) === 1, couleur: coul(dv.getUint32(p + 8, true)) }; break;
        case 82: {
          let nom = '';
          for (let i = 0; i < 32; i++) { const ch = dv.getUint16(p + 4 + 28 + i * 2, true); if (!ch) break; nom += String.fromCharCode(ch); }
          objets[dv.getUint32(p, true)] = { t: 'f', hauteur: dv.getInt32(p + 4, true) || 12, angle: dv.getInt32(p + 12, true), gras: dv.getInt32(p + 20, true) >= 600, italique: !!dv.getUint8(p + 24), nom: nom || 'Arial' };
          break;
        }
        case 40: delete objets[dv.getUint32(p, true)]; break;
        case 27: S.cx = dv.getInt32(p, true); S.cy = dv.getInt32(p + 4, true); if (chemin) ctx.moveTo(S.cx, S.cy); break;
        case 54: {
          const x = dv.getInt32(p, true), y = dv.getInt32(p + 4, true);
          if (!chemin) { ctx.beginPath(); ctx.moveTo(S.cx, S.cy); }
          ctx.lineTo(x, y); S.cx = x; S.cy = y;
          peindre(false, true);
          break;
        }
        case 43: case 42: case 44: {
          const [l, t, r, b] = rect(p);
          if (!chemin) ctx.beginPath();
          if (type === 43) ctx.rect(l, t, r - l, b - t);
          else if (type === 42) ctx.ellipse((l + r) / 2, (t + b) / 2, Math.abs(r - l) / 2, Math.abs(b - t) / 2, 0, 0, Math.PI * 2);
          else { const rx = dv.getInt32(p + 16, true) / 2, ry = dv.getInt32(p + 20, true) / 2; ctx.roundRect ? ctx.roundRect(l, t, r - l, b - t, Math.min(rx, ry)) : ctx.rect(l, t, r - l, b - t); }
          peindre(true, true);
          break;
        }
        case 45: case 46: case 47: { // arc, corde, part de camembert
          const [l, t, r, b] = rect(p), cx = (l + r) / 2, cy = (t + b) / 2, rx = Math.abs(r - l) / 2, ry = Math.abs(b - t) / 2;
          const a1 = Math.atan2(dv.getInt32(p + 20, true) - cy, dv.getInt32(p + 16, true) - cx), a2 = Math.atan2(dv.getInt32(p + 28, true) - cy, dv.getInt32(p + 24, true) - cx);
          if (!chemin) ctx.beginPath();
          if (type === 47) ctx.moveTo(cx, cy);
          ctx.ellipse(cx, cy, rx, ry, 0, a1, a2, true);
          if (type !== 45) ctx.closePath();
          peindre(type !== 45, true);
          break;
        }
        case 86: case 87: case 85: case 88: case 89: case 3: case 4: case 2: case 5: case 6: {
          const n = dv.getUint32(p + 16, true);
          const p16 = type >= 85;
          const pts = p16 ? pts16(p + 20, n) : pts32(p + 20, n);
          const fermer = type === 86 || type === 3, bez = type === 85 || type === 88 || type === 2 || type === 5, suite = type === 88 || type === 89 || type === 5 || type === 6;
          trace(pts, fermer, bez, suite);
          peindre(fermer, true);
          break;
        }
        case 91: case 90: case 8: case 7: {
          const np = dv.getUint32(p + 16, true);
          const p16 = type >= 90;
          let q = p + 24 + np * 4;
          if (!chemin) ctx.beginPath();
          for (let i = 0; i < np; i++) {
            const n = dv.getUint32(p + 24 + i * 4, true);
            const pts = p16 ? pts16(q, n) : pts32(q, n);
            q += n * (p16 ? 4 : 8);
            if (!pts.length) continue;
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
            if (type === 91 || type === 8) ctx.closePath();
          }
          peindre(type === 91 || type === 8, true);
          break;
        }
        case 118: { // GRADIENTFILL : dégradés
          const nv = dv.getUint32(p + 16, true), ng = dv.getUint32(p + 20, true), mode = dv.getUint32(p + 24, true);
          const V = [];
          for (let i = 0; i < nv; i++) {
            const q = p + 28 + i * 16;
            V.push({ x: dv.getInt32(q, true), y: dv.getInt32(q + 4, true), c: `rgb(${dv.getUint16(q + 8, true) >> 8},${dv.getUint16(q + 10, true) >> 8},${dv.getUint16(q + 12, true) >> 8})` });
          }
          const q0 = p + 28 + nv * 16;
          for (let i = 0; i < ng; i++) {
            if (mode === 2) {
              // triangle : dégradé linéaire du 1er sommet vers le milieu des deux autres
              const [a, b, cc] = [0, 4, 8].map(d => V[dv.getUint32(q0 + i * 12 + d, true)]);
              if (!a || !b || !cc) continue;
              const g = ctx.createLinearGradient(a.x, a.y, (b.x + cc.x) / 2, (b.y + cc.y) / 2);
              g.addColorStop(0, a.c); g.addColorStop(1, b.c);
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(cc.x, cc.y); ctx.closePath();
              ctx.fillStyle = g; ctx.fill();
            } else {
              const a = V[dv.getUint32(q0 + i * 8, true)], b = V[dv.getUint32(q0 + i * 8 + 4, true)];
              if (!a || !b) continue;
              const g = mode === 0 ? ctx.createLinearGradient(a.x, 0, b.x, 0) : ctx.createLinearGradient(0, a.y, 0, b.y);
              g.addColorStop(0, a.c); g.addColorStop(1, b.c);
              ctx.fillStyle = g; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
            }
          }
          dessins++;
          break;
        }
        case 71: case 72: case 74: case 75: { // régions : FILLRGN, FRAMERGN, PAINTRGN, découpe
          const debut = type === 75 ? p + 8 : type === 74 ? p + 20 : type === 71 ? p + 24 : p + 32;
          const n = dv.getUint32(debut + 8, true);
          const rects = [];
          for (let i = 0; i < n && debut + 32 + i * 16 + 16 <= o + taille; i++) rects.push(rect(debut + 32 + i * 16));
          if (type === 75) {
            if (dv.getUint32(p + 4, true) === 5 || !n) break; // RGN_COPY sans région : on ne peut pas « déclipper »
            ctx.beginPath(); for (const [l, t, r, b] of rects) ctx.rect(l, t, r - l, b - t);
            ctx.setTransform(k, 0, 0, k, -bl * k, -bt * k); ctx.clip();
            break;
          }
          const ob = type === 74 ? S.pinceau : objets[dv.getUint32(p + 20, true)] || (dv.getUint32(p + 20, true) & 0x80000000 ? stock(dv.getUint32(p + 20, true)) : null);
          ctx.setTransform(k, 0, 0, k, -bl * k, -bt * k); // les régions sont en unités de l'appareil
          ctx.beginPath(); for (const [l, t, r, b] of rects) ctx.rect(l, t, r - l, b - t);
          if (ob && !ob.nul) { if (type === 72) { ctx.strokeStyle = ob.couleur; ctx.lineWidth = 1; ctx.stroke(); } else { ctx.fillStyle = ob.couleur; ctx.fill(); } }
          dessins++;
          break;
        }
        case 70: if (dv.getUint32(p + 4, true) === 0x2B464D45) emfPlus = true; break; // commentaire EMF+
        case 59: chemin = true; ctx.beginPath(); break;
        case 60: chemin = false; break;
        case 61: ctx.closePath(); break;
        case 62: case 63: case 64: chemin = false; peindre(type !== 64, type !== 62); break;
        case 68: chemin = false; ctx.beginPath(); break;
        case 67: appliquer(); ctx.clip(S.remplissage); chemin = false; break;
        case 30: { const [l, t, r, b] = rect(p); appliquer(); ctx.beginPath(); ctx.rect(l, t, r - l, b - t); ctx.clip(); break; }
        case 84: { // EXTTEXTOUTW
          const x = dv.getInt32(p + 28, true), y = dv.getInt32(p + 32, true), n = dv.getUint32(p + 36, true), os = dv.getUint32(p + 40, true);
          let s = '';
          for (let i = 0; i < n && o + os + i * 2 + 1 < dv.byteLength; i++) s += String.fromCharCode(dv.getUint16(o + os + i * 2, true));
          texte(x, y, s);
          break;
        }
        case 81: case 76: case 77: { // STRETCHDIBITS, BITBLT, STRETCHBLT
          let xd, yd, cxd, cyd, offBmi, cbBmi, offBits, cbBits;
          if (type === 81) {
            xd = dv.getInt32(p + 16, true); yd = dv.getInt32(p + 20, true);
            offBmi = dv.getUint32(p + 40, true); cbBmi = dv.getUint32(p + 44, true); offBits = dv.getUint32(p + 48, true); cbBits = dv.getUint32(p + 52, true);
            cxd = dv.getInt32(p + 64, true); cyd = dv.getInt32(p + 68, true);
          } else {
            xd = dv.getInt32(p + 16, true); yd = dv.getInt32(p + 20, true); cxd = dv.getInt32(p + 24, true); cyd = dv.getInt32(p + 28, true);
            offBmi = dv.getUint32(p + 76, true); cbBmi = dv.getUint32(p + 80, true); offBits = dv.getUint32(p + 84, true); cbBits = dv.getUint32(p + 88, true);
          }
          appliquer();
          if (!cbBmi) { if (!S.pinceau.nul) { ctx.fillStyle = S.pinceau.couleur; ctx.fillRect(xd, yd, cxd, cyd); } break; }
          // en-tête et pixels peuvent être séparés : on les recolle
          const tout = new Uint8Array(cbBmi + cbBits);
          tout.set(u8.subarray(o + offBmi, o + offBmi + cbBmi), 0);
          tout.set(u8.subarray(o + offBits, o + offBits + cbBits), cbBmi);
          try { const im = await dib(tout, 0, tout.length); if (im) { ctx.drawImage(im, xd, yd, cxd, cyd); dessins++; } } catch (e) { /* image illisible : ignorée */ }
          break;
        }
        default: break;
      }
      o += taille;
    }
    // fichier « EMF+ seul » (dessin moderne sans équivalent EMF) : rien de lisible ici
    if (!dessins && emfPlus) throw new Error('EMF+');
    return c;
  }

  /* ---------- police Symbol → caractères Unicode ----------
     L'éditeur d'équations (Équation 3.0, MathType) écrit Σ, σ, ×, ≤… avec la police Symbol, où « å » vaut Σ.
     On les traduit en vrais caractères : ils s'affichent alors partout, même sans la police Symbol. */
  const SYMBOL = (() => {
    const t = {};
    const grec = 'ΑΒΧΔΕΦΓΗΙϑΚΛΜΝΟΠΘΡΣΤΥςΩΞΨΖ', grecMin = 'αβχδεφγηιϕκλμνοπθρστυϖωξψζ';
    for (let i = 0; i < 26; i++) { t[65 + i] = grec[i]; t[97 + i] = grecMin[i]; }
    Object.assign(t, { 0x22: '∀', 0x24: '∃', 0x27: '∋', 0x2A: '∗', 0x2D: '−', 0x40: '≅', 0x5C: '∴', 0x5E: '⊥', 0x60: '‾',
      0xA1: 'ϒ', 0xA2: '′', 0xA3: '≤', 0xA4: '⁄', 0xA5: '∞', 0xA6: 'ƒ', 0xA7: '♣', 0xA8: '♦', 0xA9: '♥', 0xAA: '♠', 0xAB: '↔', 0xAC: '←', 0xAD: '↑', 0xAE: '→', 0xAF: '↓',
      0xB0: '°', 0xB1: '±', 0xB2: '″', 0xB3: '≥', 0xB4: '×', 0xB5: '∝', 0xB6: '∂', 0xB7: '•', 0xB8: '÷', 0xB9: '≠', 0xBA: '≡', 0xBB: '≈', 0xBC: '…', 0xBD: '⏐', 0xBE: '⎯', 0xBF: '↵',
      0xC0: 'ℵ', 0xC1: 'ℑ', 0xC2: 'ℜ', 0xC3: '℘', 0xC4: '⊗', 0xC5: '⊕', 0xC6: '∅', 0xC7: '∩', 0xC8: '∪', 0xC9: '⊃', 0xCA: '⊇', 0xCB: '⊄', 0xCC: '⊂', 0xCD: '⊆', 0xCE: '∈', 0xCF: '∉',
      0xD0: '∠', 0xD1: '∇', 0xD2: '®', 0xD3: '©', 0xD4: '™', 0xD5: '∏', 0xD6: '√', 0xD7: '⋅', 0xD8: '¬', 0xD9: '∧', 0xDA: '∨', 0xDB: '⇔', 0xDC: '⇐', 0xDD: '⇑', 0xDE: '⇒', 0xDF: '⇓',
      0xE0: '◊', 0xE1: '〈', 0xE2: '®', 0xE3: '©', 0xE4: '™', 0xE5: '∑', 0xE6: '⎛', 0xE7: '⎜', 0xE8: '⎝', 0xE9: '⎡', 0xEA: '⎢', 0xEB: '⎣', 0xEC: '⎧', 0xED: '⎨', 0xEE: '⎩', 0xEF: '⎪',
      0xF1: '〉', 0xF2: '∫', 0xF3: '⌠', 0xF4: '⎮', 0xF5: '⌡', 0xF6: '⎞', 0xF7: '⎟', 0xF8: '⎠', 0xF9: '⎤', 0xFA: '⎥', 0xFB: '⎦', 0xFC: '⎫', 0xFD: '⎬', 0xFE: '⎭' });
    return t;
  })();
  const estSymbol = nom => /^symbol$/i.test(nom || '');
  function versUnicodeSymbol(octets) { let s = ''; for (const b of octets) s += SYMBOL[b] || String.fromCharCode(b); return s; }

  /* ---------- WMF ---------- */
  // cible : { w, h } (mm) du cadre où l'image est affichée. Comme Windows, on dessine aux proportions du cadre :
  // les positions suivent le cadre, mais les caractères gardent leur forme (pas de texte étiré).
  async function wmf(u8, cible) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let o = 0, bbox = null;
    if (dv.getUint32(0, true) === 0x9AC6CDD7) { bbox = [6, 8, 10, 12].map(d => dv.getInt16(d, true)); o = 22; }
    const hw = dv.getUint16(o + 2, true);
    o += hw * 2;
    const S = etatInitial();
    S.wex = bbox ? bbox[2] - bbox[0] : 1000; S.wey = bbox ? bbox[3] - bbox[1] : 1000;
    S.wox = bbox ? bbox[0] : 0; S.woy = bbox ? bbox[1] : 0;
    // sans en-tête de taille (cas des équations) : la taille du dessin est donnée par son premier SetWindowExt/Org
    if (!bbox) {
      for (let q = o, n = 0; q + 6 <= dv.byteLength && n < 400; n++) {
        const t = dv.getUint32(q, true) * 2, fn = dv.getUint16(q + 4, true);
        if (t < 6 || fn === 0) break;
        if (fn === 0x020C) { S.wey = dv.getInt16(q + 6, true); S.wex = dv.getInt16(q + 8, true); break; }
        if (fn === 0x020B) { S.woy = dv.getInt16(q + 6, true); S.wox = dv.getInt16(q + 8, true); }
        q += t;
      }
    }
    const W = Math.abs(S.wex) || 1, H = Math.abs(S.wey) || 1;
    const ratio = cible && cible.w > 0 && cible.h > 0 ? cible.w / cible.h : W / H;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(ratio >= 1 ? 1600 : 1600 * ratio)); c.height = Math.max(1, Math.round(ratio >= 1 ? 1600 / ratio : 1600));
    const ctx = c.getContext('2d');
    const objets = [];
    const pile = [];
    const ajouter = ob => { let i = 0; while (objets[i]) i++; objets[i] = ob; };
    const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder('windows-1252') : null;
    let St = S;
    function appliquer() {
      const sx = c.width / (St.wex || 1), sy = c.height / (St.wey || 1);
      ctx.setTransform(sx, 0, 0, sy, -St.wox * sx, -St.woy * sy);
    }
    function peindre(remplir, tracer) {
      appliquer();
      if (remplir && !St.pinceau.nul) { ctx.fillStyle = St.pinceau.couleur; ctx.fill(St.remplissage); }
      if (tracer && !St.stylo.nul) {
        ctx.strokeStyle = St.stylo.couleur;
        const e = Math.abs(c.width / (St.wex || 1));
        ctx.lineWidth = St.stylo.largeur > 0 ? St.stylo.largeur : 1 / e;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
    for (let garde = 0; o + 6 <= dv.byteLength && garde < 200000; garde++) {
      const taille = dv.getUint32(o, true) * 2, f = dv.getUint16(o + 4, true), p = o + 6;
      if (taille < 6 || f === 0) break;
      const i16 = d => dv.getInt16(p + d, true);
      appliquer();
      switch (f) {
        case 0x020B: St.woy = i16(0); St.wox = i16(2); break;
        case 0x020C: St.wey = i16(0); St.wex = i16(2); break;
        case 0x0106: St.remplissage = i16(0) === 2 ? 'nonzero' : 'evenodd'; break;
        case 0x012E: St.alignTexte = dv.getUint16(p, true); break;
        case 0x0209: St.texte = coul(dv.getUint32(p, true)); break;
        case 0x001E: pile.push(JSON.parse(JSON.stringify(St))); break;
        case 0x0127: if (pile.length) St = pile.pop(); break;
        case 0x02FA: ajouter({ t: 'p', nul: (dv.getUint16(p, true) & 0xf) === 5, largeur: i16(2), couleur: coul(dv.getUint32(p + 6, true)) }); break;
        case 0x02FC: ajouter({ t: 'b', nul: dv.getUint16(p, true) === 1, couleur: coul(dv.getUint32(p + 2, true)) }); break;
        case 0x02FB: {
          let nom = '';
          for (let i = 0; i < 32 && p + 18 + i < o + taille; i++) { const ch = dv.getUint8(p + 18 + i); if (!ch) break; nom += String.fromCharCode(ch); }
          ajouter({ t: 'f', hauteur: i16(0) || 12, angle: i16(4), gras: i16(8) >= 600, italique: !!dv.getUint8(p + 10), nom: nom || 'Arial' });
          break;
        }
        case 0x00F7: case 0x01F9: case 0x0142: case 0x06FF: ajouter({ t: 'x' }); break;
        case 0x012D: { const ob = objets[dv.getUint16(p, true)]; if (ob) { if (ob.t === 'p') St.stylo = ob; else if (ob.t === 'b') St.pinceau = ob; else if (ob.t === 'f') St.police = ob; } break; }
        case 0x01F0: objets[dv.getUint16(p, true)] = null; break;
        case 0x0214: St.cy = i16(0); St.cx = i16(2); break;
        case 0x0213: { const y = i16(0), x = i16(2); ctx.beginPath(); ctx.moveTo(St.cx, St.cy); ctx.lineTo(x, y); St.cx = x; St.cy = y; peindre(false, true); break; }
        case 0x0324: case 0x0325: {
          const n = i16(0);
          ctx.beginPath();
          for (let i = 0; i < n; i++) { const x = i16(2 + i * 4), y = i16(4 + i * 4); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          if (f === 0x0324) ctx.closePath();
          peindre(f === 0x0324, true);
          break;
        }
        case 0x0538: {
          const np = i16(0);
          let q = 2 + np * 2;
          ctx.beginPath();
          for (let i = 0; i < np; i++) {
            const n = i16(2 + i * 2);
            for (let j = 0; j < n; j++) { const x = i16(q + j * 4), y = i16(q + j * 4 + 2); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
            ctx.closePath();
            q += n * 4;
          }
          peindre(true, true);
          break;
        }
        case 0x041B: case 0x0418: case 0x061C: {
          const d0 = f === 0x061C ? 4 : 0;
          const b = i16(d0), r = i16(d0 + 2), t = i16(d0 + 4), l = i16(d0 + 6);
          ctx.beginPath();
          if (f === 0x041B) ctx.rect(l, t, r - l, b - t);
          else if (f === 0x0418) ctx.ellipse((l + r) / 2, (t + b) / 2, Math.abs(r - l) / 2, Math.abs(b - t) / 2, 0, 0, Math.PI * 2);
          else ctx.roundRect ? ctx.roundRect(l, t, r - l, b - t, Math.min(Math.abs(i16(0)), Math.abs(i16(2))) / 2) : ctx.rect(l, t, r - l, b - t);
          peindre(true, true);
          break;
        }
        case 0x0521: case 0x0A32: {
          let x, y, n, so;
          if (f === 0x0521) { n = i16(0); so = p + 2; const pad = n + (n & 1); y = i16(2 + pad); x = i16(4 + pad); }
          else { y = i16(0); x = i16(2); n = i16(4); const opt = dv.getUint16(p + 6, true); so = p + 8 + (opt & 6 ? 8 : 0); }
          const octets = u8.subarray(so, so + n);
          const symbole = estSymbol(St.police.nom);
          const s = symbole ? versUnicodeSymbol(octets) : dec ? dec.decode(octets) : String.fromCharCode(...octets);
          // espacement de chaque caractère (ExtTextOut), en unités logiques, s'il est fourni
          const finTexte = so + n + (n & 1);
          const ecarts = f === 0x0A32 && finTexte + n * 2 <= o + taille ? Array.from({ length: n }, (_, i) => dv.getInt16(finTexte + i * 2, true)) : null;
          appliquer();
          const m = ctx.getTransform();
          const dx = m.a * x + m.c * y + m.e, dy = m.b * x + m.d * y + m.f;
          // hauteur de police : échelle verticale ; la largeur suit (comme GDI avec une largeur de police nulle)
          const hpx = Math.max(1, Math.abs(St.police.hauteur) * Math.abs(m.d) * (St.police.hauteur > 0 ? 0.82 : 1));
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, dx, dy);
          if (St.police.angle) ctx.rotate(-St.police.angle * Math.PI / 1800);
          const famille = symbole ? '"Times New Roman", "Cambria Math", "Segoe UI Symbol", serif' : `"${St.police.nom}"`;
          ctx.font = `${St.police.italique ? 'italic ' : ''}${St.police.gras ? 'bold ' : ''}${hpx}px ${famille}`;
          ctx.fillStyle = St.texte;
          const a = St.alignTexte;
          ctx.textAlign = (a & 6) === 6 ? 'center' : (a & 2) ? 'right' : 'left';
          ctx.textBaseline = (a & 24) === 24 ? 'alphabetic' : (a & 8) ? 'bottom' : 'top';
          if (ecarts && ctx.textAlign === 'left' && s.length === n && n > 1) {
            let cx = 0;
            for (let i = 0; i < n; i++) { ctx.fillText(s[i], cx, 0); cx += ecarts[i] * Math.abs(m.a); }
          } else ctx.fillText(s, 0, 0);
          ctx.restore();
          break;
        }
        case 0x0F43: case 0x0B41: case 0x0940: {
          let dyy, dxx, dh, dw, dibOff;
          if (f === 0x0F43) { dh = i16(14); dw = i16(16); dyy = i16(18); dxx = i16(20); dibOff = p + 22; }
          else if (f === 0x0B41) { dh = i16(12); dw = i16(14); dyy = i16(16); dxx = i16(18); dibOff = p + 20; }
          else { dh = i16(8); dw = i16(10); dyy = i16(12); dxx = i16(14); dibOff = p + 16; }
          appliquer();
          try { const im = await dib(u8, dibOff, o + taille - dibOff); if (im) ctx.drawImage(im, dxx, dyy, dw, dh); } catch (e) { /* ignorée */ }
          break;
        }
        default: break;
      }
      o += taille;
    }
    return c;
  }

  async function inflate(u8) {
    const ds = new DecompressionStream('deflate');
    const flux = new Blob([u8]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(flux).arrayBuffer());
  }

  // data:image/x-emf[;z=1];base64,… -> data:image/png;base64,…
  // cible (facultatif) : { w, h } en mm, taille du cadre où l'image est affichée
  async function versPNG(url, cible) {
    const m = /^data:image\/x-(emf|wmf)(;z=1)?;base64,(.*)$/.exec(url);
    if (!m) return null;
    const bin = atob(m[3]);
    let u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    if (m[2]) u8 = await inflate(u8);
    const c = m[1] === 'emf' ? await emf(u8) : await wmf(u8, cible);
    return c.toDataURL('image/png');
  }

  racine.LecteurMeta = { versPNG, emf, wmf };
})(typeof window !== 'undefined' ? window : globalThis);
