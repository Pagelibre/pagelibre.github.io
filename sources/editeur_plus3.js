/* =====================================================================
   Éditeur : export en images, impression pour imprimeur, modèles de fiches,
   calage du texte sur les lignes de base
   ===================================================================== */

/* ---------------- texte calé sur les lignes de base ---------------- */
function basculerCalage() {
  const objs = selection().filter(o => o.type === 'texte');
  if (!objs.length) return;
  if (!E.fiche.page.lignesBase) { alerte('Définissez d\'abord les repères de ligne de base : Création de page › Guides › Repères de ligne de base.'); return; }
  quitterEdition();
  avant();
  const tous = objs.every(o => o.surLignesBase);
  for (const o of objs) { if (tous) delete o.surLignesBase; else o.surLignesBase = true; redessinerObjet(o); }
  apres();
}

/* ---------------- pages préparées hors écran (impression, export) ---------------- */
async function preparerPages(indices, coupe) {
  const z = $('#impression');
  z.innerHTML = '';
  z.classList.add('mesure');
  z.classList.toggle('coupe', !!coupe);
  const P = E.fiche.page;
  for (const i of indices) {
    const f = Rendu.page(E.fiche.pages[i], E.fiche, { numero: i + 1 });
    if (!coupe) { z.appendChild(f); continue; }
    // planche : fond perdu de 3 mm et traits de coupe autour de la page
    const M = 10, FP = 3;
    const planche = document.createElement('div');
    planche.className = 'planche';
    planche.style.cssText = `position:relative;width:${P.w + 2 * M}mm;height:${P.h + 2 * M}mm;background:#fff`;
    const fp = document.createElement('div');
    fp.style.cssText = `position:absolute;left:${M - FP}mm;top:${M - FP}mm;width:${P.w + 2 * FP}mm;height:${P.h + 2 * FP}mm;overflow:hidden`;
    f.style.position = 'absolute';
    f.style.left = FP + 'mm'; f.style.top = FP + 'mm';
    fp.appendChild(f);
    planche.appendChild(fp);
    const trait = (x, y, w, h) => { const t = document.createElement('div'); t.style.cssText = `position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;background:#000`; planche.appendChild(t); };
    const ep = 0.1, L = 5, ecart = FP + 1;
    for (const x of [M, M + P.w]) { trait(x - ep / 2, M - ecart - L, ep, L); trait(x - ep / 2, M + P.h + ecart, ep, L); }
    for (const y of [M, M + P.h]) { trait(M - ecart - L, y - ep / 2, L, ep); trait(M + P.w + ecart, y - ep / 2, L, ep); }
    z.appendChild(planche);
  }
  await Promise.all($$('img', z).map(i => (i.decode ? i.decode().catch(() => {}) : null)));
  Rendu.postMiseEnPage(z);
  return z;
}
function libererPages() { const z = $('#impression'); z.innerHTML = ''; z.classList.remove('mesure', 'coupe'); }

async function imprimerAvecOptions(coupe) {
  quitterEdition();
  fermerCoulisses();
  const P = E.fiche.page, M = coupe ? 10 : 0;
  await preparerPages(E.fiche.pages.map((p, i) => i), coupe);
  let st = $('#style-impression');
  if (!st) { st = document.createElement('style'); st.id = 'style-impression'; document.head.appendChild(st); }
  st.textContent = `@page { size: ${P.w + 2 * M}mm ${P.h + 2 * M}mm; margin: 0; }`;
  window.addEventListener('afterprint', libererPages, { once: true });
  window.print();
}

/* ---------------- export des pages en images PNG ---------------- */
async function pageEnPNG(feuille, dpi) {
  const P = E.fiche.page;
  const W = P.w * 96 / 25.4, H = P.h * 96 / 25.4, k = dpi / 96;
  const css = ($('#css-rendu') || { textContent: '' }).textContent;
  const xhtml = new XMLSerializer().serializeToString(feuille);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * k)}" height="${Math.round(H * k)}">` +
    `<foreignObject x="0" y="0" width="${W}" height="${H}" transform="scale(${k})"><div xmlns="http://www.w3.org/1999/xhtml"><style><![CDATA[${css}]]></style>${xhtml}</div></foreignObject></svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = Math.round(W * k); c.height = Math.round(H * k);
  const g = c.getContext('2d');
  g.fillStyle = P.fond || '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0);
  return new Promise(ok => c.toBlob(ok, 'image/png'));
}
async function exporterImages(toutes, dpi) {
  quitterEdition();
  const indices = toutes ? E.fiche.pages.map((p, i) => i) : [E.modeMaitre ? 0 : E.ip];
  const base = (E.fiche.titre || 'fiche').replace(/[\\/:*?"<>|]+/g, '_');
  let dossier = null;
  if (indices.length > 1 && window.showDirectoryPicker) {
    try { dossier = await showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { if (e.name === 'AbortError') return; }
  }
  const z = await preparerPages(indices, false);
  const feuilles = $$(':scope > .feuille', z);
  try {
    for (let n = 0; n < feuilles.length; n++) {
      const blob = await pageEnPNG(feuilles[n], dpi);
      const nom = `${base} - page ${indices[n] + 1}.png`;
      if (dossier) {
        const fh = await dossier.getFileHandle(nom, { create: true });
        const w = await fh.createWritable(); await w.write(blob); await w.close();
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = nom;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
      }
    }
    bandeau(`${feuilles.length} image(s) PNG exportée(s)${dossier ? ` dans « ${dossier.name} »` : ' (dossier Téléchargements)'}.`);
  } catch (e) {
    alerte('Export impossible : ' + e.message);
  } finally { libererPages(); }
}

/* ---------------- modèles de fiches ---------------- */
const mSpan = (t, taille, extra) => `<span style="font-family:'Calibri';font-size:${taille}pt;${extra || ''}">${t}</span>`;
const mPar = (t, taille, extra, style) => `<p${style ? ` style="${style}"` : ''}>${mSpan(t, taille, extra)}</p>`;
const MODELES = {
  tp: {
    nom: 'Fiche de TP', w: 210, h: 297,
    objets: P => {
      const [mh, md, mb, mg] = P.marges, lu = P.w - mg - md;
      const B = { c: '#077568', e: 0.75 };
      const cel = (l, c, t) => ({ l, c, nl: 1, nc: 1, html: mPar(t, 10), bords: { h: B, b: B, g: B, d: B } });
      return [
        { type: 'texte', forme: 'rect', x: mg, y: mh, w: lu, h: 16, fond: { couleur: '#077568' }, marges: [4, 1, 4, 1], vertical: 'milieu', html: mPar('TP n° … : titre du travail pratique', 20, 'font-weight:bold;color:#ffffff') },
        { type: 'tableau', x: mg, y: mh + 19, w: lu, h: 16, tableau: { cols: [lu / 3, lu / 3, lu / 3].map(v => +v.toFixed(2)), lignes: [8, 8], marges: [1, 1, 1, 1], cellules: [cel(0, 0, 'Nom :'), cel(0, 1, 'Prénom :'), cel(0, 2, 'Date :'), cel(1, 0, 'Classe :'), cel(1, 1, 'Durée :'), cel(1, 2, 'Note :')] } },
        { type: 'forme', forme: 'rectArrondi', x: mg, y: mh + 39, w: lu, h: 34, fond: { couleur: '#fff2cc' }, trait: { couleur: '#bf9000', epaisseur: 1 } },
        { type: 'texte', forme: 'rect', x: mg + 2, y: mh + 40, w: lu - 4, h: 32, marges: [2, 1, 2, 1], html: mPar('Objectif :', 12, 'font-weight:bold;color:#7f6000') + mPar('À la fin de ce TP, je suis capable de …', 11) + mPar('Matériel :', 12, 'font-weight:bold;color:#7f6000') + mPar('…', 11) },
        { type: 'texte', forme: 'rect', x: mg, y: mh + 78, w: lu, h: 9, marges: [1, 1, 1, 1], html: mPar('Consignes', 14, 'font-weight:bold;color:#077568') },
        { type: 'texte', forme: 'rect', x: mg, y: mh + 88, w: lu, h: 60, marges: [1, 1, 1, 1], html: ['Lire entièrement le sujet avant de commencer.', 'Respecter les règles de sécurité (consignation, EPI).', 'Faire valider le câblage avant la mise sous tension.'].map(t => `<p style="margin-left:6.35mm;text-indent:-6.35mm"><span class="puce" contenteditable="false" data-liste="num" style="font-family:'Calibri';font-size:11pt">1. </span>${mSpan(t, 11)}</p>`).join('') },
        { type: 'texte', forme: 'rect', x: mg, y: mh + 152, w: lu, h: 9, marges: [1, 1, 1, 1], html: mPar('Travail demandé', 14, 'font-weight:bold;color:#077568') },
        { type: 'forme', forme: 'rect', x: mg, y: mh + 162, w: lu, h: P.h - mh - mb - 162, trait: { couleur: '#a6a6a6', epaisseur: 0.75, tirets: 1 } }
      ];
    }
  },
  evaluation: {
    nom: 'Fiche d\'évaluation', w: 210, h: 297,
    objets: P => {
      const [mh, md, , mg] = P.marges, lu = P.w - mg - md;
      const B = { c: '#404040', e: 0.75 };
      const ligne = (l, t, fond) => [0, 1, 2, 3, 4].map(c => ({ l, c, nl: 1, nc: 1, fond, html: mPar(c === 0 ? t : '', 10, l === 0 ? 'font-weight:bold' : ''), bords: { h: B, b: B, g: B, d: B } }));
      const tete = ['Compétence évaluée', 'Non acquis', 'En cours', 'Acquis', 'Expert'];
      const cellules = tete.map((t, c) => ({ l: 0, c, nl: 1, nc: 1, fond: '#d9eeeb', html: mPar(t, 10, 'font-weight:bold', 'text-align:center'), bords: { h: B, b: B, g: B, d: B } }));
      for (let l = 1; l <= 6; l++) cellules.push(...ligne(l, `C${l} – …`));
      const cw = [lu * 0.48, lu * 0.13, lu * 0.13, lu * 0.13, lu * 0.13].map(v => +v.toFixed(2));
      return [
        { type: 'texte', forme: 'rect', x: mg, y: mh, w: lu, h: 14, fond: { couleur: '#1f4e79' }, marges: [4, 1, 4, 1], vertical: 'milieu', html: mPar('Évaluation : …', 18, 'font-weight:bold;color:#ffffff') },
        { type: 'texte', forme: 'rect', x: mg, y: mh + 17, w: lu, h: 10, marges: [1, 1, 1, 1], html: mPar('Nom : ……………………  Prénom : ……………………  Date : ……………', 11) },
        { type: 'tableau', x: mg, y: mh + 30, w: lu, h: 7 * 10, tableau: { cols: cw, lignes: Array(7).fill(10), marges: [1, 1, 1, 1], cellules } },
        { type: 'texte', forme: 'rect', x: mg, y: mh + 106, w: lu, h: 9, marges: [1, 1, 1, 1], html: mPar('Appréciation du formateur', 13, 'font-weight:bold;color:#1f4e79') },
        { type: 'forme', forme: 'rect', x: mg, y: mh + 116, w: lu, h: 40, trait: { couleur: '#7f7f7f', epaisseur: 0.75 } },
        { type: 'forme', forme: 'ellipse', x: P.w - md - 34, y: mh + 160, w: 34, h: 24, trait: { couleur: '#c00000', epaisseur: 1.5 } },
        { type: 'texte', forme: 'rect', x: P.w - md - 34, y: mh + 160, w: 34, h: 24, marges: [1, 1, 1, 1], vertical: 'milieu', html: mPar('/ 20', 16, 'font-weight:bold;color:#c00000', 'text-align:right') }
      ];
    }
  },
  procedure: {
    nom: 'Fiche de procédure', w: 210, h: 297,
    objets: P => {
      const [mh, md, , mg] = P.marges, lu = P.w - mg - md;
      const o = [{ type: 'texte', forme: 'rect', x: mg, y: mh, w: lu, h: 14, fond: { couleur: '#c55a11' }, marges: [4, 1, 4, 1], vertical: 'milieu', html: mPar('Procédure : …', 18, 'font-weight:bold;color:#ffffff') }];
      for (let i = 0; i < 6; i++) {
        const y = mh + 20 + i * 38;
        o.push({ type: 'texte', forme: 'ellipse', x: mg, y: y + 2, w: 12, h: 12, fond: { couleur: '#c55a11' }, marges: [0, 0, 0, 0], vertical: 'milieu', html: mPar(String(i + 1), 14, 'font-weight:bold;color:#ffffff', 'text-align:center') });
        o.push({ type: 'texte', forme: 'rect', x: mg + 16, y, w: lu * 0.55, h: 34, marges: [1, 1, 1, 1], html: mPar(`Étape ${i + 1}`, 12, 'font-weight:bold') + mPar('Description de l\'étape…', 11) });
        o.push({ type: 'forme', forme: 'rect', x: mg + 18 + lu * 0.55, y, w: lu * 0.45 - 18, h: 34, fond: { couleur: '#f2f2f2' }, trait: { couleur: '#bfbfbf', epaisseur: 0.5, tirets: 1 } });
      }
      return o;
    }
  },
  affiche: {
    nom: 'Affiche A3', w: 297, h: 420,
    objets: P => {
      const [mh, md, mb, mg] = P.marges, lu = P.w - mg - md;
      return [
        { type: 'forme', forme: 'rect', x: 0, y: 0, w: P.w, h: 120, fond: { couleur: '#077568', degrade: '#0fb39f', angle: 0 } },
        { type: 'wordart', x: mg, y: 30, w: lu, h: 45, wordart: { texte: 'TITRE DE L\'AFFICHE', police: 'Arial Black', couleur: '#ffffff' } },
        { type: 'texte', forme: 'rect', x: mg, y: 85, w: lu, h: 20, marges: [1, 1, 1, 1], html: mPar('Sous-titre ou date de l\'événement', 24, 'color:#ffffff', 'text-align:center') },
        { type: 'texte', forme: 'rect', x: mg, y: 140, w: lu, h: 180, marges: [2, 2, 2, 2], html: mPar('Texte principal de l\'affiche.', 22, '', 'text-align:center') },
        { type: 'texte', forme: 'rect', x: mg, y: P.h - mb - 30, w: lu, h: 30, fond: { couleur: '#d9eeeb' }, marges: [4, 1, 4, 1], vertical: 'milieu', html: mPar('Nom de votre établissement', 16, 'font-weight:bold;color:#055a50', 'text-align:center') }
      ];
    }
  },
  attestation: {
    nom: 'Attestation (paysage)', w: 297, h: 210,
    objets: P => {
      const [mh, md, mb, mg] = P.marges, lu = P.w - mg - md;
      return [
        { type: 'forme', forme: 'rect', x: mg / 2, y: mh / 2, w: P.w - (mg + md) / 2, h: P.h - (mh + mb) / 2, trait: { couleur: '#bf9000', epaisseur: 4.5 } },
        { type: 'forme', forme: 'rect', x: mg / 2 + 3, y: mh / 2 + 3, w: P.w - (mg + md) / 2 - 6, h: P.h - (mh + mb) / 2 - 6, trait: { couleur: '#bf9000', epaisseur: 0.75 } },
        { type: 'wordart', x: mg + 30, y: mh + 15, w: lu - 60, h: 28, wordart: { texte: 'ATTESTATION', police: 'Georgia', couleur: '#7f6000', gras: true } },
        { type: 'texte', forme: 'rect', x: mg + 20, y: mh + 55, w: lu - 40, h: 80, marges: [2, 2, 2, 2], html: mPar('Nous attestons que', 16, '', 'text-align:center') + mPar('Prénom NOM', 26, 'font-weight:bold;color:#1f4e79', 'text-align:center;margin-top:8pt;margin-bottom:8pt') + mPar('a suivi avec succès la formation …', 16, '', 'text-align:center') },
        { type: 'texte', forme: 'rect', x: P.w - md - 90, y: P.h - mb - 40, w: 80, h: 30, marges: [1, 1, 1, 1], html: mPar('Fait à …, le …', 12, '', 'text-align:center') + mPar('Signature', 12, 'font-style:italic', 'text-align:center') }
      ];
    }
  }
};
function nouveauDepuisModele(cle) {
  const M = MODELES[cle];
  const go = () => {
    const f = ficheVierge(M.w, M.h, M.nom);
    f.pages[0].items = M.objets(f.page).map(o => Object.assign({ id: nouvelId() }, o));
    chargerFiche(f);
  };
  if (E.modifie) confirmer('La fiche actuelle a des modifications non enregistrées. Les abandonner ?', go); else go();
}
