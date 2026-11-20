/* =====================================================================
   Rendu d'une fiche (modèle JSON) en éléments HTML/SVG.
   Toutes les dimensions du modèle sont en millimètres.
   ===================================================================== */
(function (racine) {
  'use strict';

  const PT_MM = 25.4 / 72;
  const NS = 'http://www.w3.org/2000/svg';
  let compteurDef = 0;

  const f2 = v => +(+v).toFixed(3);

  /* ---------------- géométrie des formes ---------------- */
  function etoile(w, h, n, rInt) {
    const cx = w / 2, cy = h / 2;
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const r = i % 2 ? rInt : 1;
      d += (i ? 'L' : 'M') + f2(cx + Math.cos(a) * cx * r) + ' ' + f2(cy + Math.sin(a) * cy * r);
    }
    return d + 'Z';
  }

  function rectArrondi(w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    return `M${f2(r)} 0H${f2(w - r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(w)} ${f2(r)}V${f2(h - r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(w - r)} ${f2(h)}H${f2(r)}A${f2(r)} ${f2(r)} 0 0 1 0 ${f2(h - r)}V${f2(r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(r)} 0Z`;
  }

  function chemin(o) {
    const w = o.w, h = o.h, a = o.ajust;
    const A = (def) => (a != null ? a : def) / 21600;
    const P = pts => 'M' + pts.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L') + 'Z';
    switch (o.forme) {
      case 'ellipse': return `M0 ${f2(h / 2)}A${f2(w / 2)} ${f2(h / 2)} 0 1 0 ${f2(w)} ${f2(h / 2)}A${f2(w / 2)} ${f2(h / 2)} 0 1 0 0 ${f2(h / 2)}Z`;
      case 'rectArrondi': case 'parchemin': return rectArrondi(w, h, Math.min(w, h) * A(3600));
      case 'losange': return P([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
      case 'triangle': return P([[w * A(10800), 0], [w, h], [0, h]]);
      case 'triangleRect': return P([[0, 0], [w, h], [0, h]]);
      case 'parallelogramme': { const d = w * A(5400); return P([[d, 0], [w, 0], [w - d, h], [0, h]]); }
      case 'trapeze': { const d = w * A(5400); return P([[0, 0], [w, 0], [w - d, h], [d, h]]); }
      case 'hexagone': { const d = w * A(5400); return P([[d, 0], [w - d, 0], [w, h / 2], [w - d, h], [d, h], [0, h / 2]]); }
      case 'octogone': { const d = Math.min(w, h) * A(6326); return P([[d, 0], [w - d, 0], [w, d], [w, h - d], [w - d, h], [d, h], [0, h - d], [0, d]]); }
      case 'plus': case 'croix': { const d = Math.min(w, h) * A(5400); return P([[d, 0], [w - d, 0], [w - d, d], [w, d], [w, h - d], [w - d, h - d], [w - d, h], [d, h], [d, h - d], [0, h - d], [0, d], [d, d]]); }
      case 'etoile4': return etoile(w, h, 4, 0.38);
      case 'etoile5': return etoile(w, h, 5, 0.38);
      case 'etoile8': return etoile(w, h, 8, 0.75);
      case 'etoile16': return etoile(w, h, 16, 0.8);
      case 'etoile24': case 'etoile32': return etoile(w, h, 24, 0.85);
      case 'explosion': return etoile(w, h, 12, 0.6);
      case 'soleil': return etoile(w, h, 8, 0.7);
      case 'pentagone': { const d = w * (1 - A(16200)); return P([[0, 0], [w - d, 0], [w, h / 2], [w - d, h], [0, h]]); }
      case 'chevron': { const d = w * (1 - A(16200)); return P([[0, 0], [w - d, 0], [w, h / 2], [w - d, h], [0, h], [d, h / 2]]); }
      case 'flecheD': { const x = w * A(16200), e = h * 0.25; return P([[0, e], [x, e], [x, 0], [w, h / 2], [x, h], [x, h - e], [0, h - e]]); }
      case 'flecheG': { const x = w * (1 - A(16200)), e = h * 0.25; return P([[w, e], [x, e], [x, 0], [0, h / 2], [x, h], [x, h - e], [w, h - e]]); }
      case 'flecheB': { const y = h * A(16200), e = w * 0.25; return P([[e, 0], [e, y], [0, y], [w / 2, h], [w, y], [w - e, y], [w - e, 0]]); }
      case 'flecheH': { const y = h * (1 - A(16200)), e = w * 0.25; return P([[e, h], [e, y], [0, y], [w / 2, 0], [w, y], [w - e, y], [w - e, h]]); }
      case 'flecheGD': { const x = w * 0.2, e = h * 0.25; return P([[0, h / 2], [x, 0], [x, e], [w - x, e], [w - x, 0], [w, h / 2], [w - x, h], [w - x, h - e], [x, h - e], [x, h]]); }
      case 'flecheHB': { const y = h * 0.2, e = w * 0.25; return P([[w / 2, 0], [w, y], [w - e, y], [w - e, h - y], [w, h - y], [w / 2, h], [0, h - y], [e, h - y], [e, y], [0, y]]); }
      case 'coeur': return `M${f2(w / 2)} ${f2(h * 0.25)}C${f2(w / 2)} 0 0 0 0 ${f2(h * 0.3)}C0 ${f2(h * 0.6)} ${f2(w * 0.35)} ${f2(h * 0.75)} ${f2(w / 2)} ${f2(h)}C${f2(w * 0.65)} ${f2(h * 0.75)} ${f2(w)} ${f2(h * 0.6)} ${f2(w)} ${f2(h * 0.3)}C${f2(w)} 0 ${f2(w / 2)} 0 ${f2(w / 2)} ${f2(h * 0.25)}Z`;
      case 'eclair': return P([[w * 0.39, 0], [w * 0.6, h * 0.36], [w * 0.5, h * 0.4], [w * 0.8, h * 0.68], [w * 0.7, h * 0.72], [w, h], [w * 0.3, h * 0.6], [w * 0.42, h * 0.55], [0, h * 0.25], [w * 0.15, h * 0.2]]);
      case 'lune': return `M${f2(w)} 0A${f2(w)} ${f2(h / 2)} 0 0 0 ${f2(w)} ${f2(h)}A${f2(w * 0.6)} ${f2(h / 2)} 0 0 1 ${f2(w)} 0Z`;
      case 'bulleRect': case 'bulleRectArrondi': case 'bulleEllipse': case 'nuage': return bulle(o);
      case 'coinPlie': { const d = Math.min(w, h) * 0.15; return P([[0, 0], [w, 0], [w, h - d], [w - d, h], [0, h]]); }
      case 'vague': return `M0 ${f2(h * 0.1)}C${f2(w * 0.3)} ${f2(-h * 0.1)} ${f2(w * 0.7)} ${f2(h * 0.3)} ${f2(w)} ${f2(h * 0.1)}V${f2(h * 0.9)}C${f2(w * 0.7)} ${f2(h * 1.1)} ${f2(w * 0.3)} ${f2(h * 0.7)} 0 ${f2(h * 0.9)}Z`;
      case 'libre': return libre(o);
      default: return `M0 0H${f2(w)}V${f2(h)}H0Z`;
    }
  }

  function bulle(o) {
    const w = o.w, h = o.h;
    const tx = w * (o.ajust != null ? o.ajust : 1350) / 21600;
    const ty = h * (o.ajust2 != null ? o.ajust2 : 25920) / 21600;
    if (o.forme === 'nuage') {
      // nuage : bosses autour d'une ellipse + petites bulles vers la pointe
      const n = 11, cx = w / 2, cy = h / 2;
      let d = '';
      for (let i = 0; i <= n; i++) {
        const a = i / n * Math.PI * 2;
        const x = cx + Math.cos(a) * cx * 0.92, y = cy + Math.sin(a) * cy * 0.85;
        if (!i) d = `M${f2(x)} ${f2(y)}`;
        else d += `A${f2(w * 0.16)} ${f2(h * 0.2)} 0 0 1 ${f2(x)} ${f2(y)}`;
      }
      d += 'Z';
      for (let k = 1; k <= 3; k++) {
        const t = 0.55 + k * 0.15, r = Math.min(w, h) * (0.07 - k * 0.015);
        const bx = cx + (tx - cx) * t, by = cy + (ty - cy) * t;
        d += `M${f2(bx - r)} ${f2(by)}A${f2(r)} ${f2(r)} 0 1 0 ${f2(bx + r)} ${f2(by)}A${f2(r)} ${f2(r)} 0 1 0 ${f2(bx - r)} ${f2(by)}Z`;
      }
      return d;
    }
    // pointe : attachée au bord le plus proche
    const cx = w / 2, cy = h / 2;
    const dx = tx - cx, dy = ty - cy;
    let a, b;
    if (Math.abs(dy) * w >= Math.abs(dx) * h) {
      const yb = dy > 0 ? h : 0; a = [cx - w * 0.12, yb]; b = [cx + w * 0.12, yb];
    } else {
      const xb = dx > 0 ? w : 0; a = [xb, cy - h * 0.12]; b = [xb, cy + h * 0.12];
    }
    const pointe = `M${f2(a[0])} ${f2(a[1])}L${f2(tx)} ${f2(ty)}L${f2(b[0])} ${f2(b[1])}Z`;
    const corps = o.forme === 'bulleEllipse'
      ? `M0 ${f2(h / 2)}A${f2(w / 2)} ${f2(h / 2)} 0 1 0 ${f2(w)} ${f2(h / 2)}A${f2(w / 2)} ${f2(h / 2)} 0 1 0 0 ${f2(h / 2)}Z`
      : o.forme === 'bulleRectArrondi' ? rectArrondi(w, h, Math.min(w, h) * 0.17) : `M0 0H${f2(w)}V${f2(h)}H0Z`;
    return corps + pointe;
  }

  function libre(o) {
    const g = o.geometrie;
    if (!g || !g.pts.length) return `M0 0H${f2(o.w)}V${f2(o.h)}H0Z`;
    const [gl, gt, gr, gb] = g.cadre;
    const sx = o.w / ((gr - gl) || 1), sy = o.h / ((gb - gt) || 1);
    const pt = i => { const p = g.pts[Math.min(i, g.pts.length - 1)]; return f2((p[0] - gl) * sx) + ' ' + f2((p[1] - gt) * sy); };
    let d = '', i = 0;
    if (!g.segs.length) {
      d = 'M' + pt(0);
      for (i = 1; i < g.pts.length; i++) d += 'L' + pt(i);
      return d;
    }
    for (const s of g.segs) {
      const t = s >> 13, n = s & 0x1fff;
      if (t === 2) { d += 'M' + pt(i++); }
      else if (t === 0) { for (let k = 0; k < (n || 1); k++) d += 'L' + pt(i++); }
      else if (t === 1) { for (let k = 0; k < (n || 1); k++) { d += 'C' + pt(i) + ' ' + pt(i + 1) + ' ' + pt(i + 2); i += 3; } }
      else if (t === 3) d += 'Z';
      else if (t === 4) break;
    }
    return d || 'M0 0';
  }

  /* ---------------- SVG ---------------- */
  function el(nom, attrs, parent) {
    const e = document.createElementNS(NS, nom);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  const TIRETS = { 1: [4, 3], 2: [1, 1], 3: [4, 1, 1, 1], 4: [4, 1, 1, 1, 1, 1], 5: [1, 1], 6: [3, 1], 7: [8, 3], 8: [8, 3, 1, 3], 9: [8, 3, 1, 3, 1, 3], 10: [3, 1] };

  function appliquerTrait(e, t, defs) {
    if (!t) { e.setAttribute('stroke', 'none'); return; }
    const ep = Math.max(t.epaisseur * PT_MM, 0.05);
    e.setAttribute('stroke', t.couleur);
    e.setAttribute('stroke-width', f2(ep));
    if (t.tirets && TIRETS[t.tirets]) e.setAttribute('stroke-dasharray', TIRETS[t.tirets].map(v => f2(v * ep)).join(' '));
    for (const [cote, k] of [['start', 'flecheDebut'], ['end', 'flecheFin']]) {
      if (!t[k]) continue;
      const id = 'mk' + (++compteurDef);
      const m = el('marker', { id, viewBox: '0 0 10 10', refX: cote === 'end' ? 9 : 1, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse', markerUnits: 'strokeWidth' }, defs);
      el('path', { d: 'M0 0L10 5L0 10Z', fill: t.couleur }, m);
      e.setAttribute('marker-' + cote, `url(#${id})`);
    }
  }

  function appliquerFond(e, f, defs, fiche, o) {
    if (!f) { e.setAttribute('fill', 'none'); return; }
    if (f.image && fiche.images[f.image]) {
      const id = 'pf' + (++compteurDef);
      const p = el('pattern', { id, patternUnits: 'objectBoundingBox', width: 1, height: 1, patternContentUnits: 'objectBoundingBox' }, defs);
      el('image', { href: fiche.images[f.image], x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: 'none' }, p);
      e.setAttribute('fill', `url(#${id})`);
    } else if (f.degrade) {
      const id = 'dg' + (++compteurDef);
      const a = (f.angle || 0) * Math.PI / 180;
      const g = el('linearGradient', { id, x1: f2(0.5 - Math.sin(a) / 2), y1: f2(0.5 - Math.cos(a) / 2), x2: f2(0.5 + Math.sin(a) / 2), y2: f2(0.5 + Math.cos(a) / 2) }, defs);
      el('stop', { offset: 0, 'stop-color': f.couleur }, g);
      el('stop', { offset: 1, 'stop-color': f.degrade }, g);
      e.setAttribute('fill', `url(#${id})`);
    } else e.setAttribute('fill', f.couleur);
    if (f.opacite != null) e.setAttribute('fill-opacity', f.opacite);
    void o;
  }

  function svgForme(o, fiche, avecFond) {
    const s = el('svg', { class: 'svg-forme', viewBox: `0 0 ${f2(Math.max(o.w, 0.01))} ${f2(Math.max(o.h, 0.01))}`, preserveAspectRatio: 'none', overflow: 'visible' });
    const defs = el('defs', {}, s);
    const g = el('g', {}, s);
    if (o.miroirH || o.miroirV) g.setAttribute('transform', `translate(${o.miroirH ? f2(o.w) : 0} ${o.miroirV ? f2(o.h) : 0}) scale(${o.miroirH ? -1 : 1} ${o.miroirV ? -1 : 1})`);
    let e;
    if (o.type === 'ligne') e = el('line', { x1: 0, y1: 0, x2: f2(o.w), y2: f2(o.h), fill: 'none' }, g);
    else e = el('path', { d: chemin(o) }, g);
    if (avecFond) appliquerFond(e, o.fond, defs, fiche, o); else e.setAttribute('fill', 'none');
    appliquerTrait(e, o.trait, defs);
    if (o.biseau && avecFond && o.fond) {
      // relief : éclairage spéculaire sur le bord flouté de la forme
      const id = 'bz' + (++compteurDef), m = Math.min(o.w, o.h);
      const f = el('filter', { id, x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
      el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: f2(m * (o.biseau === 'marque' ? 0.07 : 0.04)), result: 'flou' }, f);
      const sp = el('feSpecularLighting', { in: 'flou', surfaceScale: o.biseau === 'marque' ? 6 : 3.5, specularConstant: 0.9, specularExponent: 16, 'lighting-color': '#ffffff', result: 'spec' }, f);
      el('fePointLight', { x: f2(-o.w * 0.6), y: f2(-o.h * 0.8), z: f2((o.w + o.h) * 0.9) }, sp);
      el('feComposite', { in: 'spec', in2: 'SourceAlpha', operator: 'in', result: 'spec2' }, f);
      el('feComposite', { in: 'SourceGraphic', in2: 'spec2', operator: 'arithmetic', k1: 0, k2: 1, k3: 0.75, k4: 0 }, f);
      e.setAttribute('filter', `url(#${id})`);
    }
    e.setAttribute('vector-effect', 'non-scaling-stroke');
    e.removeAttribute('vector-effect');
    return s;
  }

  /* ---------------- objets ---------------- */
  function styleBoite(d, o) {
    d.style.left = o.x + 'mm';
    d.style.top = o.y + 'mm';
    d.style.width = Math.max(o.w, 0) + 'mm';
    d.style.height = Math.max(o.h, 0) + 'mm';
    d.style.transform = o.rot ? `rotate(${o.rot}deg)` : '';
  }

  function contenuTexte(html, cls) {
    const c = document.createElement('div');
    c.className = cls || 'contenu';
    c.innerHTML = html || '<p><br></p>';
    return c;
  }

  function biseauRect(o) {
    const b = document.createElement('div');
    b.className = 'biseau';
    const e = o.biseau === 'marque' ? 1.6 : 0.9;
    b.style.boxShadow = `inset ${e}mm ${e}mm ${e * 1.2}mm rgba(255,255,255,.55), inset -${e}mm -${e}mm ${e * 1.2}mm rgba(0,0,0,.35)`;
    return b;
  }

  function cssBord(b) {
    return b ? `${Math.max(b.e * PT_MM, 0.1).toFixed(2)}mm solid ${b.c}` : '';
  }

  function tableau(o, d) {
    const T = o.tableau;
    const t = document.createElement('table');
    t.className = 'tab';
    const cg = document.createElement('colgroup');
    for (const c of T.cols) { const col = document.createElement('col'); col.style.width = c + 'mm'; cg.appendChild(col); }
    t.appendChild(cg);
    const nl = T.lignes.length, nc = T.cols.length;
    const occupe = Array.from({ length: nl }, () => Array(nc).fill(null));
    T.cellules.forEach((c, i) => {
      for (let r = c.l; r < Math.min(c.l + c.nl, nl); r++) for (let k = c.c; k < Math.min(c.c + c.nc, nc); k++) occupe[r][k] = i;
    });
    const m = T.marges || [1, 1, 1, 1];
    for (let r = 0; r < nl; r++) {
      const tr = document.createElement('tr');
      tr.style.height = T.lignes[r] + 'mm';
      for (let k = 0; k < nc; k++) {
        const i = occupe[r][k];
        if (i != null) {
          const c = T.cellules[i];
          if (c.l !== r || c.c !== k) continue;
          const td = document.createElement('td');
          td.dataset.cellule = i;
          if (c.nl > 1) td.rowSpan = c.nl;
          if (c.nc > 1) td.colSpan = c.nc;
          td.style.padding = `${m[1]}mm ${m[2]}mm ${m[3]}mm ${m[0]}mm`;
          const fond = c.fond || T.fond;
          if (fond) td.style.backgroundColor = fond;
          if (c.diagonale) {
            // cellule coupée en diagonale
            const ep = Math.max(c.diagonale.e || 0.75, 0.25) * 0.67, col = c.diagonale.c || '#000000';
            td.style.backgroundImage = `linear-gradient(to ${c.diagonale.sens === 'asc' ? 'bottom' : 'top'} right, transparent calc(50% - ${ep}px), ${col} calc(50% - ${ep}px), ${col} calc(50% + ${ep}px), transparent calc(50% + ${ep}px))`;
          }
          const b = c.bords || {};
          if (b.h) td.style.borderTop = cssBord(b.h);
          if (b.b) td.style.borderBottom = cssBord(b.b);
          if (b.g) td.style.borderLeft = cssBord(b.g);
          if (b.d) td.style.borderRight = cssBord(b.d);
          if (c.vertical) td.style.verticalAlign = c.vertical === 'milieu' ? 'middle' : c.vertical === 'bas' ? 'bottom' : 'top';
          if (c.diagonale) {
            // cellule coupée : un texte dans chaque triangle (haut-droite et bas-gauche)
            const haut = contenuTexte(c.html2 || '<p><br></p>', 'contenu diag-haut');
            haut.style.textAlign = 'right';
            td.appendChild(haut);
            td.classList.add('a-diagonale');
          }
          const ct = contenuTexte(c.html);
          if (c.diagonale) ct.classList.add('diag-bas');
          if (c.sensTexte) {
            // flux orthogonal : sans hauteur imposée, le navigateur prend celle de la fenêtre
            ct.classList.add('sens-' + c.sensTexte);
            let hc = 0;
            for (let r2 = c.l; r2 < Math.min(c.l + c.nl, nl); r2++) hc += T.lignes[r2];
            ct.style.height = Math.max(hc - m[1] - m[3], 1) + 'mm';
          }
          td.appendChild(ct);
          tr.appendChild(td);
        } else {
          const td = document.createElement('td');
          td.className = 'vide';
          tr.appendChild(td);
        }
      }
      t.appendChild(tr);
    }
    d.appendChild(t);
  }

  function wordart(o, d, fiche) {
    const W = o.wordart;
    const s = el('svg', { class: 'svg-wordart', viewBox: `0 0 ${f2(o.w)} ${f2(o.h)}`, preserveAspectRatio: 'none' });
    const defs = el('defs', {}, s);
    const t = el('text', {
      x: 0, y: f2(o.h * 0.8), 'font-size': f2(o.h * 0.95), 'font-family': W.police,
      'font-weight': W.gras ? 'bold' : null, 'font-style': W.italique ? 'italic' : null,
      textLength: f2(o.w), lengthAdjust: 'spacingAndGlyphs'
    }, s);
    t.textContent = W.texte;
    appliquerFond(t, { couleur: W.couleur || '#000000', degrade: W.degrade, angle: 0 }, defs, fiche, o);
    if (W.contour) appliquerTrait(t, W.contour, defs);
    d.appendChild(s);
  }

  /* ---- habillage : le texte contourne les objets posés dessus ----
     (flottants CSS avec shape-outside, un à gauche et un à droite) */
  function rectObjet(o) {
    const a = (o.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const w = o.w * c + o.h * s, h = o.w * s + o.h * c;
    return { x: o.x + o.w / 2 - w / 2, y: o.y + o.h / 2 - h / 2, w, h };
  }
  /* ---- habillage « serré » : bandes horizontales qui suivent la forme exacte ----
     formes : test de chaque point dans le tracé ; images : profil des pixels opaques
     (calculé par l'éditeur et gardé dans Rendu.profilsImages) */
  let ctxTest = null;
  const profilsImages = {};
  function bandesObjet(b, dist) {
    const r = rectObjet(b);
    const pas = Math.max(0.8, r.h / 60);
    const a = -(b.rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const local = (x, y) => {
      let lx = (x - cx) * ca - (y - cy) * sa + b.w / 2, ly = (x - cx) * sa + (y - cy) * ca + b.h / 2;
      if (b.miroirH) lx = b.w - lx;
      if (b.miroirV) ly = b.h - ly;
      return [lx, ly];
    };
    let dedans = null;
    if (b.type === 'forme' || (b.type === 'texte' && b.forme && b.forme !== 'rect')) {
      if (!ctxTest) ctxTest = document.createElement('canvas').getContext('2d');
      const p = new Path2D(chemin(b));
      dedans = (x, y) => { const [lx, ly] = local(x, y); return ctxTest.isPointInPath(p, lx, ly); };
    } else if (b.type === 'image' && profilsImages[b.image]) {
      const pr = profilsImages[b.image], n = pr.length;
      const [t, rr, bb, l] = b.rognage || [0, 0, 0, 0];
      dedans = (x, y) => {
        const [lx, ly] = local(x, y);
        if (lx < 0 || ly < 0 || lx > b.w || ly > b.h) return false;
        const u = l + lx / b.w * (1 - l - rr), v = t + ly / b.h * (1 - t - bb);
        const row = pr[Math.min(n - 1, Math.floor(v * n))];
        return !!row && u >= row[0] && u <= row[1];
      };
    }
    if (!dedans) return [{ x1: r.x - dist, x2: r.x + r.w + dist, y1: r.y - dist, y2: r.y + r.h + dist }];
    const bandes = [];
    for (let y = r.y; y < r.y + r.h; y += pas) {
      let x1 = Infinity, x2 = -Infinity;
      for (let x = r.x; x <= r.x + r.w; x += 0.5) {
        if (dedans(x, y + pas / 2) || dedans(x, y) || dedans(x, y + pas)) { if (x < x1) x1 = x; x2 = x; }
      }
      if (x2 >= x1) bandes.push({ x1: x1 - dist, x2: x2 + 0.5 + dist, y1: y - (bandes.length ? 0 : dist), y2: y + pas });
    }
    if (bandes.length) bandes[bandes.length - 1].y2 += dist;
    return bandes.length ? bandes : [{ x1: r.x, x2: r.x, y1: r.y, y2: r.y }];
  }

  function flottantsHabillage(o, obstacles, z, deux) {
    if (!obstacles || !obstacles.length || o.rot || o.sensTexte || (o.colonnes > 1)) return [];
    const m = o.marges || [2.54, 1.27, 2.54, 1.27];
    const ix = o.x + m[0], iy = o.y + m[1], iw = o.w - m[0] - m[2], ih = o.h - m[1] - m[3];
    if (iw <= 2 || ih <= 2) return [];
    const gauche = [], droite = [];
    const assezDePlace = Math.max(10, iw * 0.2);
    for (const b of obstacles) {
      const r = rectObjet(b), dist = b.distanceHabillage != null ? b.distanceHabillage : 2.5;
      const x1 = Math.max(r.x - dist, ix) - ix, x2 = Math.min(r.x + r.w + dist, ix + iw) - ix;
      const y1 = Math.max(r.y - dist, iy) - iy, y2 = Math.min(r.y + r.h + dist, iy + ih) - iy;
      if (x2 <= x1 || y2 <= y1) continue;
      if (b.habillage === 'hautbas') { gauche.push({ x1: 0, x2: iw, y1, y2 }); continue; }
      // zones à éviter : le rectangle (carré) ou des bandes qui suivent la forme (serré)
      const zones = b.habillage === 'serre'
        ? bandesObjet(b, dist).map(q => ({ x1: Math.max(q.x1, ix) - ix, x2: Math.min(q.x2, ix + iw) - ix, y1: Math.max(q.y1, iy) - iy, y2: Math.min(q.y2, iy + ih) - iy })).filter(q => q.x2 > q.x1 && q.y2 > q.y1)
        : [{ x1, x2, y1, y2 }];
      // comme en PAO : s'il y a de la place des deux côtés, le texte passe des deux côtés
      if (deux && x1 >= assezDePlace && iw - x2 >= assezDePlace) { for (const q of zones) deux.push({ x1: q.x1 / z, x2: q.x2 / z, y1: q.y1 / z, y2: q.y2 / z }); continue; }
      // sinon le texte va du côté le plus large
      for (const q of zones) { if (x1 >= iw - x2) droite.push({ x1: q.x1, x2: iw, y1: q.y1, y2: q.y2 }); else gauche.push({ x1: 0, x2: q.x2, y1: q.y1, y2: q.y2 }); }
    }
    const res = [];
    const poly = (zones, cote) => {
      if (!zones.length) return;
      zones.sort((a, b) => a.y1 - b.y1);
      const H = Math.max(...zones.map(r => r.y2));
      const W = cote === 'left' ? Math.max(...zones.map(r => r.x2)) : iw - Math.min(...zones.map(r => r.x1));
      const pts = [];
      for (const r of zones) {
        const xa = cote === 'left' ? 0 : r.x1 - (iw - W), xb = cote === 'left' ? r.x2 : W;
        pts.push([xa, r.y1], [xb, r.y1], [xb, r.y2], [xa, r.y2]);
      }
      const span = document.createElement('span');
      span.className = 'habillage';
      span.setAttribute('contenteditable', 'false');
      span.style.cssText = `float:${cote};width:${f2(W / z)}mm;height:${f2(H / z)}mm;` +
        `shape-outside:polygon(${pts.map(([x, y]) => `${f2(x / z)}mm ${f2(y / z)}mm`).join(',')});pointer-events:none`;
      res.push(span);
    };
    poly(gauche, 'left');
    poly(droite, 'right');
    return res;
  }

  // les champs (numéro de page…) prennent leur valeur au rendu
  function remplirChamps(el, ctx) {
    el.querySelectorAll('.champ-page').forEach(s => {
      s.textContent = ctx && ctx.numero != null ? (s.dataset.champ === 'total' ? String(ctx.total) : String(ctx.numero)) : '#';
    });
    el.querySelectorAll('.contenu').forEach(numeroter);
  }

  /* ---- listes numérotées : les numéros se recalculent toujours ---- */
  function numeroter(z) {
    let n = 0;
    for (const p of z.children) {
      const pu = p.querySelector && p.querySelector(':scope > .puce[data-liste="num"]');
      if (pu) { n++; pu.textContent = n + '. '; }
      else if (p.tagName === 'P' && p.textContent.replace(/ /g, ' ').trim()) n = 0;
    }
  }

  /* ---- césure française (règles de coupure des syllabes) ---- */
  const VOY = 'aeiouyàâäéèêëîïôöùûüœæ';
  const GROUPES = ['bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gn', 'gr', 'ph', 'pl', 'pr', 'th', 'tr', 'vr', 'gu', 'qu'];
  function coupuresMot(m) {
    const l = m.toLowerCase(), pos = [];
    const v = i => VOY.includes(l[i]);
    for (let i = 1; i < l.length - 1; i++) {
      // voyelle - consonne(s) - voyelle
      if (!v(i - 1) || v(i)) continue;
      let j = i;
      while (j < l.length && !v(j)) j++;
      if (j >= l.length) break;
      const nc = j - i;
      let c;
      if (nc === 1) c = i;                                   // ba-teau
      else if (GROUPES.includes(l.slice(j - 2, j))) c = j - 2; // ta-bleau, ma-chine
      else c = j - 1;                                        // par-tir, tim-bre
      if (nc === 3 && GROUPES.includes(l.slice(i + 1, i + 3))) c = i + 1; // comp-ter / ins-truire
      if (c >= 2 && l.length - c >= 3 && !"'’-".includes(m[c - 1])) pos.push(c);
      i = j - 1;
    }
    return pos;
  }
  function cesurer(z) {
    const tw = document.createTreeWalker(z, NodeFilter.SHOW_TEXT);
    const noeuds = [];
    for (let t = tw.nextNode(); t; t = tw.nextNode()) if (!t.parentElement.closest('.puce,.champ-page,.lettrine')) noeuds.push(t);
    for (const t of noeuds) {
      t.nodeValue = t.nodeValue.replace(/[A-Za-zÀ-ÖØ-öø-ÿœŒæÆ]{7,}/g, m => {
        const p = coupuresMot(m);
        let r = '', k = 0;
        for (const c of p) { r += m.slice(k, c) + '­'; k = c; }
        return r + m.slice(k);
      });
    }
  }

  /* ---- après mise en page : taquets de tabulation et habillage des deux côtés ----
     (il faut que l'élément soit dans le document pour mesurer) */
  const PX_MM_R = 96 / 25.4;
  function postMiseEnPage(racineEl) {
    racineEl.querySelectorAll('.contenu:not([contenteditable="true"])').forEach(z => {
      if (z.querySelector('p[data-taquets]')) taquets(z);
      if (z.dataset.exclusions) contournerDeuxCotes(z);
      if (z.dataset.lignesBase) caler(z);
    });
  }
  // décale le texte pour que la première ligne de base tombe sur un repère de la page
  function caler(z) {
    const [pas, origine] = z.dataset.lignesBase.split(',').map(Number);
    const feuille = z.closest('.feuille');
    const p = z.querySelector('p');
    if (!feuille || !p || !pas) return;
    z.style.paddingTop = '0';
    const marque = document.createElement('span');
    marque.style.cssText = 'display:inline-block;width:0;height:0';
    p.insertBefore(marque, p.firstChild);
    const k = echelle(feuille) * PX_MM_R;
    const base = (marque.getBoundingClientRect().bottom - feuille.getBoundingClientRect().top) / k;
    marque.remove();
    let cible = origine + Math.ceil((base - origine - 0.01) / pas) * pas;
    const decal = cible - base;
    const zoom = parseFloat(z.style.zoom) || 1;
    if (decal > 0.05) z.style.paddingTop = (decal / zoom) + 'mm';
  }
  function echelle(e) { const r = e.getBoundingClientRect(); return e.offsetWidth ? r.width / e.offsetWidth : 1; }
  function taquets(z) {
    const zoom = parseFloat(z.style.zoom) || 1;
    for (const p of z.querySelectorAll('p[data-taquets]')) {
      // taquet : position en mm + d (droite), c (centré) ou v (décimal, sur la virgule) ; rien = gauche
      const stops = p.dataset.taquets.split(/[;,](?=\s*\d)/).map(s => ({ pos: parseFloat(s), type: (/[dcv]$/.exec(s.trim()) || [''])[0] })).filter(s => s.pos >= 0).sort((a, b) => a.pos - b.pos);
      // isole chaque tabulation dans un élément dont on règle la largeur
      const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      const tabs = [];
      for (let t = tw.nextNode(); t; t = tw.nextNode()) if (t.nodeValue.includes('\t') && !t.parentElement.classList.contains('tab')) tabs.push(t);
      for (const t of tabs) {
        let n = t;
        let i;
        while (n && (i = n.nodeValue.indexOf('\t')) >= 0) {
          const reste = n.splitText(i);
          const apresTab = reste.splitText(1);
          const s = document.createElement('span');
          s.className = 'tab';
          reste.replaceWith(s);
          s.appendChild(reste);
          n = apresTab;
        }
      }
      const k = echelle(p) * PX_MM_R * zoom;
      const pas = parseFloat(z.style.tabSize) || 12.7;
      for (const s of p.querySelectorAll('.tab')) {
        s.style.width = '0';
        const gauche = p.getBoundingClientRect().left + parseFloat(getComputedStyle(p).paddingLeft) * echelle(p);
        const x = (s.getBoundingClientRect().left - gauche) / k;
        let st = stops.find(o => o.pos > x + 0.3);
        let cible = st ? st.pos : (Math.floor(x / pas) + 1) * pas;
        if (st && st.type) {
          // texte qui suit la tabulation, jusqu'à la tabulation suivante
          const r = document.createRange();
          r.setStartAfter(s);
          const suivant = [...p.querySelectorAll('.tab')].find(x2 => s.compareDocumentPosition(x2) & Node.DOCUMENT_POSITION_FOLLOWING);
          if (suivant) r.setEndBefore(suivant); else r.setEnd(p, p.childNodes.length);
          if (st.type === 'v') {
            // décimal : la virgule (ou le point) tombe sur le taquet
            const tw2 = document.createTreeWalker(r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : p, NodeFilter.SHOW_TEXT);
            for (let t = tw2.nextNode(); t; t = tw2.nextNode()) {
              if (!r.intersectsNode(t) || t.parentElement.closest('.tab')) continue;
              const i = t.nodeValue.search(/[,.]/);
              if (i >= 0) { r.setEnd(t, i); break; }
            }
          }
          const larg = r.getBoundingClientRect().width / k;
          cible -= st.type === 'c' ? larg / 2 : larg;
        }
        s.style.width = Math.max(0, cible - x) + 'mm';
      }
    }
  }
  function contournerDeuxCotes(z, profondeur) {
    let zones;
    try { zones = JSON.parse(z.dataset.exclusions); } catch (e) { return; }
    const zoom = parseFloat(z.style.zoom) || 1;
    const mots = [];
    const tw = document.createTreeWalker(z, NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      if (t.parentElement.closest('.habillage,.hab-espace,.puce')) continue;
      const re = /\S+/g;
      let m;
      while ((m = re.exec(t.nodeValue))) mots.push([t, m.index, m.index + m[0].length]);
    }
    const lignesFaites = new Set();
    for (let i = 0; i < mots.length; i++) {
      const [t, a, b] = mots[i];
      if (!t.parentNode) continue;
      const r = document.createRange();
      try { r.setStart(t, a); r.setEnd(t, Math.min(b, t.nodeValue.length)); } catch (e) { continue; }
      const zr = z.getBoundingClientRect(), k = echelle(z) * PX_MM_R * zoom;
      const q = r.getBoundingClientRect();
      const y = (q.top - zr.top) / k, h = q.height / k, x1 = (q.left - zr.left) / k, x2 = (q.right - zr.left) / k;
      const cle = Math.round(y * 4);
      if (lignesFaites.has(cle)) continue;
      // étendue de l'objet sur la hauteur de cette ligne (toutes les bandes qui la touchent)
      let ex1 = Infinity, ex2 = -Infinity;
      for (const zo of zones) if (y + h > zo.y1 && y < zo.y2) { ex1 = Math.min(ex1, zo.x1); ex2 = Math.max(ex2, zo.x2); }
      if (ex2 < ex1 || x2 <= ex1) continue;
      lignesFaites.add(cle);
      if (x1 >= ex2) continue;
      // ce mot touche l'objet : un blanc le repousse juste après l'objet
      const esp = document.createElement('span');
      esp.className = 'hab-espace';
      esp.setAttribute('contenteditable', 'false');
      esp.style.width = Math.max(0, ex2 - x1) + 'mm';
      const ins = document.createRange();
      ins.setStart(t, a); ins.collapse(true);
      ins.insertNode(esp);
      // le texte a bougé : on recommence la liste des mots
      if ((profondeur || 0) < 150) return contournerDeuxCotes(z, (profondeur || 0) + 1);
      return;
    }
  }

  function objet(o, fiche, ctx) {
    const d = document.createElement('div');
    d.className = 'objet t-' + o.type;
    d.dataset.id = o.id;
    styleBoite(d, o);
    const filtres = [];
    // profondeur 3D : empilement d'ombres nettes, qui forme une épaisseur
    if (o.extrusion && o.extrusion.p > 0) {
      const n = Math.min(24, Math.ceil(o.extrusion.p / 0.25)), pas = o.extrusion.p / n;
      for (let i = 0; i < n; i++) filtres.push(`drop-shadow(${f2(pas)}mm ${f2(pas)}mm 0 ${o.extrusion.couleur || '#7f7f7f'})`);
    }
    if (o.ombre) filtres.push(`drop-shadow(${o.ombre.dx}mm ${o.ombre.dy}mm ${o.ombre.flou}mm ${o.ombre.couleur || 'rgba(0,0,0,.45)'})`);
    if (filtres.length) d.style.filter = filtres.join(' ');
    if (o.rot3d) d.style.transform = (o.rot ? `rotate(${o.rot}deg) ` : '') + `perspective(${o.rot3d.p || 120}mm) rotateX(${o.rot3d.x || 0}deg) rotateY(${o.rot3d.y || 0}deg)`;
    if (o.reflet) d.style.webkitBoxReflect = `below ${o.reflet.ecart != null ? o.reflet.ecart : 0.5}mm linear-gradient(transparent ${100 - (o.reflet.taille || 45)}%, rgba(255,255,255,${o.reflet.opacite || 0.5}))`;
    switch (o.type) {
      case 'image': {
        const clip = document.createElement('div');
        clip.className = 'clip';
        const src = o.image && fiche.images[o.image];
        if (src && /^data:image\/x-(emf|wmf)/.test(src)) {
          clip.classList.add('manquante');
          clip.textContent = 'Image ' + src.slice(13, 16).toUpperCase() + '…';
        } else if (src) {
          const im = document.createElement('img');
          im.src = src;
          im.draggable = false;
          im.alt = '';
          const [ha, dr, ba, ga] = o.rognage || [0, 0, 0, 0];
          const lw = 1 - ga - dr, lh = 1 - ha - ba;
          im.style.width = (100 / (lw || 1)) + '%';
          im.style.height = (100 / (lh || 1)) + '%';
          im.style.left = (-ga / (lw || 1) * 100) + '%';
          im.style.top = (-ha / (lh || 1) * 100) + '%';
          if (o.miroirH || o.miroirV) im.style.transform = `scale(${o.miroirH ? -1 : 1},${o.miroirV ? -1 : 1})`;
          if (o.filtres) {
            const F = o.filtres, l = [];
            if (F.luminosite) l.push(`brightness(${1 + F.luminosite / 100})`);
            if (F.contraste) l.push(`contrast(${1 + F.contraste / 100})`);
            if (F.gris) l.push('grayscale(1)');
            if (F.sepia) l.push('sepia(.8)');
            if (F.delave) l.push('opacity(.45)');
            im.style.filter = l.join(' ');
          }
          clip.appendChild(im);
        } else {
          clip.classList.add('manquante');
          clip.textContent = 'Image';
        }
        d.appendChild(clip);
        if (o.trait) d.appendChild(svgForme(Object.assign({}, o, { forme: 'rect', fond: null }), fiche, false));
        if (o.biseau) d.appendChild(biseauRect(o));
        break;
      }
      case 'texte': case 'forme': {
        if (o.fond || o.trait || o.type === 'forme') d.appendChild(svgForme(o, fiche, true));
        if (o.type === 'texte' || o.html) {
          const m = o.marges || [2.54, 1.27, 2.54, 1.27];
          const cadre = document.createElement('div');
          cadre.className = 'cadre-texte v-' + (o.vertical || 'haut');
          if (o.sensTexte) cadre.classList.add('sens-' + o.sensTexte);
          cadre.style.padding = `${m[1]}mm ${m[2]}mm ${m[3]}mm ${m[0]}mm`;
          const ct = contenuTexte(o.html);
          const z = o.ajustement && o.ajustement !== 1 ? o.ajustement : 1;
          if (z !== 1) ct.style.zoom = z;
          if (o.colonnes > 1) {
            ct.style.columnCount = o.colonnes;
            ct.style.columnGap = (o.espaceColonnes != null ? o.espaceColonnes : 5) / z + 'mm';
            ct.style.columnFill = 'auto';
            ct.style.height = '100%';
            cadre.classList.add('colonnes');
          }
          if (o.tabulation) ct.style.tabSize = (o.tabulation / z) + 'mm';
          const deux = [];
          for (const fl of flottantsHabillage(o, ctx && ctx.obstacles, z, deux).reverse()) ct.insertBefore(fl, ct.firstChild);
          if (deux.length) ct.dataset.exclusions = JSON.stringify(deux);
          if (o.cesure) { cesurer(ct); ct.classList.add('cesure'); }
          // calage sur les lignes de base de la page
          const LB = fiche.page && fiche.page.lignesBase;
          if (o.surLignesBase && LB && !o.sensTexte) {
            ct.classList.add('calage');
            ct.style.lineHeight = (LB.pas / z) + 'pt';
            // la ligne d'appui invisible du paragraphe doit avoir la police du texte, sinon les lignes grandissent
            const s1 = ct.querySelector('span[style*="font-size"]:not(.puce)');
            if (s1) { ct.style.fontSize = s1.style.fontSize; if (s1.style.fontFamily) ct.style.fontFamily = s1.style.fontFamily; }
            ct.dataset.lignesBase = `${LB.pas * 25.4 / 72},${(fiche.page.marges ? fiche.page.marges[0] : 0) + LB.decalage * 25.4 / 72}`;
          }
          cadre.appendChild(ct);
          d.appendChild(cadre);
          if (o.suivant) d.classList.add('a-suite');
          if (o.precedent) d.classList.add('est-suite');
        }
        break;
      }
      case 'ligne': d.appendChild(svgForme(o, fiche, false)); break;
      case 'tableau': tableau(o, d); if (o.biseau) d.appendChild(biseauRect(o)); break;
      case 'wordart': wordart(o, d, fiche); break;
    }
    remplirChamps(d, ctx);
    return d;
  }

  // objets qui repoussent le texte de o : ceux posés au-dessus avec un habillage
  function obstacles(o, items) {
    if (o.type !== 'texte') return [];
    const i = items.indexOf(o);
    const r = [];
    for (let k = i + 1; k < items.length; k++) {
      const b = items[k];
      if (b.habillage && b.habillage !== 'aucun') r.push(b);
    }
    return r;
  }

  /* ---------------- page ---------------- */
  function page(p, fiche, options) {
    options = options || {};
    const f = document.createElement('div');
    f.className = 'feuille';
    f.style.width = fiche.page.w + 'mm';
    f.style.height = fiche.page.h + 'mm';
    if (fiche.page.fond) f.style.background = fiche.page.fond;
    const base = { numero: options.numero, total: fiche.pages.length };
    const m = p.maitre && fiche.maitres && fiche.maitres[p.maitre];
    if (m && m.items.length) {
      const cm = document.createElement('div');
      cm.className = 'calque-maitre';
      for (const o of m.items) cm.appendChild(objet(o, fiche, Object.assign({ obstacles: obstacles(o, m.items) }, base)));
      f.appendChild(cm);
    }
    const c = document.createElement('div');
    c.className = 'calque-objets';
    for (const o of p.items) c.appendChild(objet(o, fiche, Object.assign({ obstacles: obstacles(o, p.items) }, base)));
    f.appendChild(c);
    return f;
  }

  const api = { page, objet, chemin, obstacles, postMiseEnPage, numeroter, coupuresMot, profilsImages, PT_MM };
  racine.Rendu = api;
})(typeof window !== 'undefined' ? window : globalThis);
