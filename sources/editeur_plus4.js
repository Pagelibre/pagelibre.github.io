/* =====================================================================
   Quatrième série (21/11/2026) :
   - polices libres intégrées : on remet la page en forme quand elles sont prêtes ;
   - images allégées à l'insertion, commande « Compresser les images » ;
   - bibliothèque de modèles (nouveaux modèles, « Mes modèles ») ;
   - tablette : défilement au doigt, zoom à deux doigts, poignées plus grandes ;
   - accessibilité : texte de remplacement, Tab / F6 au clavier, vérificateur ;
   - pages d'un PDF ou image en fond de page ;
   - aide intégrée, « Quoi de neuf ».
   ===================================================================== */

/* ---------------- icônes des nouveaux boutons ---------------- */
(function () {
  const s32 = c => `<svg viewBox="0 0 32 32" aria-hidden="true">${c}</svg>`;
  const s16 = c => `<svg viewBox="0 0 16 16" aria-hidden="true">${c}</svg>`;
  Object.assign(ICONES, {
    compresser: s32(`<rect x="4" y="6" width="24" height="20" rx="1.5" fill="#dbe8f5" stroke="#2b579a"/><path d="M7 22l6-7 4 5 3-3 5 5z" fill="#5a8f3e"/><circle cx="21" cy="11" r="2.2" fill="#e8b33a"/><path d="M2 16h6m-3-3l3 3-3 3M30 16h-6m3-3l-3 3 3 3" fill="none" stroke="#c43e1c" stroke-width="1.6"/>`),
    texteAlt: s32(`<rect x="3" y="4" width="18" height="15" rx="1.2" fill="#dbe8f5" stroke="#2b579a"/><path d="M5 17l5-6 3 4 2-2 4 4z" fill="#5a8f3e"/><path d="M14 18h15v10H18l-3 3v-3h-1z" fill="#fff" stroke="#555"/><path d="M17 22h9M17 25h6" stroke="#2b579a" stroke-width="1.4"/>`),
    accessibilite: s32(`<circle cx="16" cy="16" r="13" fill="#fff" stroke="#23405e" stroke-width="1.6"/><circle cx="16" cy="8.5" r="2.2" fill="#23405e"/><path d="M8.5 12.5l7.5 1.5 7.5-1.5M16 14v5l-3.5 7M16 19l3.5 7" fill="none" stroke="#23405e" stroke-width="2" stroke-linecap="round"/>`),
    pdf: s32(`<path d="M7 3h13l6 6v20H7z" fill="#fff" stroke="#555"/><path d="M20 3v6h6" fill="none" stroke="#555"/><rect x="4" y="15" width="20" height="9" rx="1" fill="#c43e1c"/><text x="14" y="22.3" font-size="7" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">PDF</text>`),
    fondPage: s32(`<path d="M7 3h13l6 6v20H7z" fill="#e8eef5" stroke="#555"/><path d="M20 3v6h6" fill="none" stroke="#555"/><path d="M9 26l6-8 4 5 3-3 4 6z" fill="#8fb27a"/><path d="M10 9h7M10 12h9" stroke="#23405e" stroke-width="1.3"/>`),
    aide: s32(`<circle cx="16" cy="16" r="13" fill="#e3ecf5" stroke="#23405e" stroke-width="1.6"/><path d="M12 12.5a4 4 0 117 2.6c-1.6 1.4-3 2-3 4.4" fill="none" stroke="#23405e" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="23.5" r="1.6" fill="#23405e"/>`),
    modele16: s16(`<path d="M3 1.5h7l3 3v10H3z" fill="#fff" stroke="#555"/><path d="M5 6h6M5 8.5h6M5 11h4" stroke="#2b579a"/>`)
  });
})();

/* ---------------- polices ---------------- */
// les polices intégrées se chargent à la première utilisation : la page est remise en forme ensuite
let minuteurPolices = null;
if (document.fonts && document.fonts.addEventListener) {
  document.fonts.addEventListener('loadingdone', () => {
    clearTimeout(minuteurPolices);
    minuteurPolices = setTimeout(() => { if (E.calque && !E.edition && !G) { afficherPage(); planifierVignette(E.ip); } }, 120);
  });
}

/* ---------------- images : allègement ---------------- */
const IMAGE_RECODABLE = /^data:image\/(png|jpe?g|webp|bmp)[;,]/i;
function decoderImage(url) {
  return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Image illisible')); i.src = url; });
}
function imageOpaque(g, w, h) {
  const d = g.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 250) return false;
  return true;
}
// réduit une image à maxPx (plus grand côté) et la réencode si elle y gagne :
// photo (sans transparence) → JPEG qualité 85 ; image transparente → PNG
async function allegerImage(url, maxPx, force) {
  const img = await decoderImage(url);
  let w = img.naturalWidth, h = img.naturalHeight;
  if (!IMAGE_RECODABLE.test(url)) return { url, w, h };
  const k = Math.min(1, maxPx / Math.max(w, h));
  const lourde = url.length > 400000 || /^data:image\/bmp/i.test(url);
  if (k >= 1 && !lourde && !force) return { url, w, h };
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  const opaque = imageOpaque(g, c.width, c.height);
  let neuf = opaque ? c.toDataURL('image/jpeg', 0.85) : c.toDataURL('image/png');
  if (!opaque && neuf.length > url.length && k < 1) neuf = c.toDataURL('image/webp', 0.9);
  if (neuf.length >= url.length) return { url, w, h };
  return { url: neuf, w: c.width, h: c.height };
}

// taille utile de chaque image : la plus grande taille d'affichage, à la résolution choisie
function usagesImages() {
  const u = {};
  const noter = (cle, wmm, hmm) => { if (!cle) return; const x = u[cle] || (u[cle] = { w: 0, h: 0 }); x.w = Math.max(x.w, wmm); x.h = Math.max(x.h, hmm); };
  for (const p of [...E.fiche.pages, ...Object.values(E.fiche.maitres)]) for (const o of p.items) {
    if (o.image) {
      const [ha, dr, ba, ga] = o.rognage || [0, 0, 0, 0];
      noter(o.image, o.w / Math.max(0.05, 1 - ga - dr), o.h / Math.max(0.05, 1 - ha - ba));
    }
    if (o.fond && o.fond.image) noter(o.fond.image, o.w, o.h);
  }
  return u;
}
function boiteCompresser() {
  quitterEdition();
  const poids = Object.values(E.fiche.images).reduce((t, u) => t + u.length * 0.75, 0);
  ouvrirBoite('Compresser les images', `<p style="max-width:460px">Les images sont réduites à la taille où elles sont affichées, à la résolution choisie, puis enregistrées dans un format plus léger. Le document sera plus facile à envoyer par mail ou à déposer sur l'ENT.</p>
    <div class="grille-champs"><span>Résolution</span><select id="cp-ppp" class="champ">
      <option value="150">Écran et mail (150 ppp)</option><option value="220" selected>Impression au bureau (220 ppp)</option><option value="300">Imprimeur (300 ppp)</option></select>
      <span>Images actuelles</span><span>${Object.keys(E.fiche.images).length} (${arrondi(poids / 1048576, 1).toLocaleString('fr-FR')} Mo)</span></div>
    <p style="color:#666">Ctrl+Z annule la compression.</p>`, () => { compresserImages(+$('#cp-ppp').value); }, { ok: 'Compresser' });
}
async function compresserImages(ppp) {
  const u = usagesImages();
  let avantOctets = 0, apresOctets = 0, n = 0;
  const remplacements = {};
  indication('Compression des images…');
  try {
    for (const [cle, taille] of Object.entries(u)) {
      const url = E.fiche.images[cle];
      if (!url || !IMAGE_RECODABLE.test(url)) continue;
      const besoin = Math.ceil(Math.max(taille.w, taille.h) / 25.4 * ppp);
      const r = await allegerImage(url, Math.max(64, besoin), true);
      avantOctets += url.length * 0.75;
      apresOctets += r.url.length * 0.75;
      if (r.url !== url) { const k = nouvelId('img'); E.fiche.images[k] = r.url; remplacements[cle] = k; n++; }
    }
  } finally { indication(null); }
  if (!n) { bandeau('Les images sont déjà à la bonne taille : rien à compresser.'); return; }
  // nouvelles clés : Ctrl+Z rend les images d'origine
  avant();
  for (const p of [...E.fiche.pages, ...Object.values(E.fiche.maitres)]) for (const o of p.items) {
    if (o.image && remplacements[o.image]) o.image = remplacements[o.image];
    if (o.fond && o.fond.image && remplacements[o.fond.image]) o.fond.image = remplacements[o.fond.image];
  }
  afficherPage();
  dessinerVignettes();
  apres();
  const mo = v => arrondi(v / 1048576, 1).toLocaleString('fr-FR');
  bandeau(`${n} image(s) compressée(s) : ${mo(avantOctets)} Mo → ${mo(apresOctets)} Mo.`);
}

/* ---------------- modèles ---------------- */
const CEL_B = c => ({ h: { c, e: 0.75 }, b: { c, e: 0.75 }, g: { c, e: 0.75 }, d: { c, e: 0.75 } });
Object.assign(MODELES, {
  qcm: {
    nom: 'QCM', w: 210, h: 297,
    objets: P => {
      const [mh, md, , mg] = P.marges, lu = P.w - mg - md;
      const o = [
        { type: 'texte', forme: 'rect', x: mg, y: mh, w: lu, h: 14, fond: { couleur: '#5b2c83' }, marges: [4, 1, 4, 1], vertical: 'milieu', html: mPar('QCM : thème …', 18, 'font-weight:bold;color:#ffffff') },
        { type: 'texte', forme: 'rect', x: mg, y: mh + 17, w: lu, h: 10, marges: [1, 1, 1, 1], html: mPar('Nom : ……………………  Prénom : ……………………  Date : ……………', 11) },
        { type: 'texte', forme: 'rect', x: mg, y: mh + 28, w: lu, h: 9, marges: [1, 1, 1, 1], html: mPar('Cochez la bonne réponse (une seule par question).', 11, 'font-style:italic;color:#595959') }
      ];
      for (let i = 0; i < 6; i++) {
        const y = mh + 40 + i * 37;
        o.push({ type: 'texte', forme: 'rect', x: mg, y, w: lu, h: 8, marges: [1, 1, 1, 1], html: mPar(`${i + 1}. Question …`, 12, 'font-weight:bold;color:#5b2c83') });
        ['a', 'b', 'c', 'd'].forEach((l, j) => {
          o.push({ type: 'forme', forme: 'rect', x: mg + 4, y: y + 10 + j * 6.5, w: 4, h: 4, trait: { couleur: '#5b2c83', epaisseur: 0.75 } });
          o.push({ type: 'texte', forme: 'rect', x: mg + 10, y: y + 8.6 + j * 6.5, w: lu - 12, h: 6.5, marges: [0.5, 0.5, 0.5, 0.5], html: mPar(`Réponse ${l}`, 11) });
        });
      }
      return o;
    }
  },
  securite: {
    nom: 'Consignes de sécurité', w: 210, h: 297,
    objets: P => {
      const [mh, md, , mg] = P.marges, lu = P.w - mg - md;
      const o = [
        { type: 'forme', forme: 'rect', x: mg, y: mh, w: lu, h: 22, fond: { couleur: '#c00000' } },
        { type: 'texte', forme: 'rect', x: mg + 26, y: mh, w: lu - 30, h: 22, marges: [2, 1, 2, 1], vertical: 'milieu', html: mPar('CONSIGNES DE SÉCURITÉ', 22, 'font-weight:bold;color:#ffffff') },
        { type: 'texte', forme: 'triangle', x: mg + 3, y: mh + 2, w: 20, h: 18, fond: { couleur: '#ffc000' }, trait: { couleur: '#000000', epaisseur: 1.5 }, marges: [5, 0, 0, 0], vertical: 'milieu', html: mPar('!', 18, 'font-weight:bold', 'text-align:center') },
        { type: 'texte', forme: 'rect', x: mg, y: mh + 26, w: lu, h: 9, marges: [1, 1, 1, 1], html: mPar('Poste / atelier : …', 13, 'font-weight:bold') }
      ];
      const blocs = [['#0070c0', 'Équipements de protection obligatoires', 'Lunettes, gants, chaussures de sécurité…'], ['#c00000', 'Interdictions', 'Travailler sous tension sans habilitation…'],
        ['#00b050', 'En cas d\'accident', 'Couper l\'alimentation, alerter (15 / 18 / 112), protéger…'], ['#ffc000', 'Avant de commencer', 'Vérifier l\'absence de tension, baliser la zone…']];
      blocs.forEach(([c, t, d], i) => {
        const y = mh + 40 + i * 52;
        o.push({ type: 'forme', forme: 'rectArrondi', x: mg, y, w: lu, h: 48, trait: { couleur: c, epaisseur: 2.25 } });
        o.push({ type: 'texte', forme: 'rect', x: mg, y, w: lu, h: 10, fond: { couleur: c }, marges: [3, 1, 3, 1], vertical: 'milieu', html: mPar(t, 13, 'font-weight:bold;color:#ffffff') });
        o.push({ type: 'texte', forme: 'rect', x: mg + 3, y: y + 12, w: lu - 6, h: 34, marges: [1, 1, 1, 1], html: mPar(d, 12) });
      });
      return o;
    }
  },
  sequence: {
    nom: 'Déroulé de séance', w: 297, h: 210,
    objets: P => {
      const [mh, md, , mg] = P.marges, lu = P.w - mg - md;
      const B = CEL_B('#7f7f7f');
      const tete = ['Durée', 'Phase', 'Activité du formateur', 'Activité des apprenants', 'Supports', 'Évaluation'];
      const cw = [0.08, 0.12, 0.25, 0.25, 0.15, 0.15].map(k => +(k * lu).toFixed(2));
      const cellules = tete.map((t, c) => ({ l: 0, c, nl: 1, nc: 1, fond: '#d6dce5', html: mPar(t, 10, 'font-weight:bold', 'text-align:center'), bords: B }));
      ['Accueil', 'Découverte', 'Apport', 'Application', 'Synthèse'].forEach((ph, i) => tete.forEach((t, c) => cellules.push({ l: i + 1, c, nl: 1, nc: 1, html: mPar(c === 1 ? ph : c === 0 ? '… min' : '', 10), bords: B })));
      return [
        { type: 'texte', forme: 'rect', x: mg, y: mh, w: lu, h: 13, fond: { couleur: '#203864' }, marges: [4, 1, 4, 1], vertical: 'milieu', html: mPar('Déroulé de séance : titre', 18, 'font-weight:bold;color:#ffffff') },
        { type: 'texte', forme: 'rect', x: mg, y: mh + 15, w: lu, h: 16, marges: [1, 1, 1, 1], html: mPar('Public : …   Durée : …   Salle : …', 11) + mPar('Objectif : à la fin de la séance, l\'apprenant sera capable de …', 11) },
        { type: 'tableau', x: mg, y: mh + 33, w: lu, h: 9 + 5 * 26, tableau: { cols: cw, lignes: [9, 26, 26, 26, 26, 26], marges: [1, 1, 1, 1], cellules } }
      ];
    }
  },
  planning: {
    nom: 'Planning de la semaine', w: 297, h: 210,
    objets: P => {
      const [mh, md, , mg] = P.marges, lu = P.w - mg - md;
      const B = CEL_B('#a6a6a6');
      const jours = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
      const creneaux = ['8 h – 10 h', '10 h – 12 h', '13 h 30 – 15 h 30', '15 h 30 – 17 h 30'];
      const cw = [lu * 0.12, ...Array(5).fill(lu * 0.176)].map(v => +v.toFixed(2));
      const cellules = jours.map((j, c) => ({ l: 0, c, nl: 1, nc: 1, fond: '#c55a11', html: mPar(j, 12, 'font-weight:bold;color:#ffffff', 'text-align:center'), bords: B }));
      creneaux.forEach((cr, i) => jours.forEach((j, c) => cellules.push({ l: i + 1, c, nl: 1, nc: 1, fond: c === 0 ? '#fbe5d6' : undefined, html: mPar(c === 0 ? cr : '', 10, c === 0 ? 'font-weight:bold' : ''), bords: B })));
      return [
        { type: 'texte', forme: 'rect', x: mg, y: mh, w: lu, h: 13, marges: [1, 1, 1, 1], vertical: 'milieu', html: mPar('Planning : semaine du … au …', 20, 'font-weight:bold;color:#c55a11') },
        { type: 'tableau', x: mg, y: mh + 16, w: lu, h: 10 + 4 * 36, tableau: { cols: cw, lignes: [10, 36, 36, 36, 36], marges: [1, 1, 1, 1], cellules } }
      ];
    }
  }
});

// « Mes modèles » : gardés dans le navigateur de chacun (IndexedDB), jamais envoyés
function bdModeles(mode, fn) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('pagelibre-modeles', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('modeles', { keyPath: 'id' });
    r.onerror = () => ko(r.error);
    r.onsuccess = () => {
      const db = r.result, tx = db.transaction('modeles', mode), req = fn(tx.objectStore('modeles'));
      tx.oncomplete = () => { ok(req && req.result); db.close(); };
      tx.onerror = () => { ko(tx.error); db.close(); };
    };
  });
}
async function listeMesModeles() { try { return ((await bdModeles('readonly', s => s.getAll())) || []).sort((a, b) => b.date - a.date); } catch (e) { return []; } }
function enregistrerCommeModele() {
  quitterEdition();
  ouvrirBoite('Enregistrer comme modèle', `<label>Nom du modèle</label><input type="text" id="mm-nom" class="champ" style="width:320px" value="${esc(E.fiche.titre || 'Mon modèle')}">
    <p style="color:#666;max-width:440px">Le modèle est gardé dans ce navigateur. Il apparaît dans <i>Fichier › Nouveau › Mes modèles</i>.</p>`, () => {
    const nom = $('#mm-nom').value.trim();
    if (!nom) return false;
    nettoyerImages();
    const fiche = JSON.parse(jsonFiche());
    fiche.titre = nom;
    bdModeles('readwrite', s => s.put({ id: nouvelId('m'), nom, date: Date.now(), fiche }))
      .then(() => { bandeau(`Modèle « ${nom} » enregistré.`); if (!$('#coulisses').hidden) afficherVueCoulisses('nouveau'); })
      .catch(() => alerte('Impossible d\'enregistrer le modèle dans ce navigateur (navigation privée ?).'));
  }, { ok: 'Enregistrer' });
}
function importerModele() {
  const i = $('#entree-fichier');
  i.value = ''; i.accept = '.pagelibre,.json';
  i.onchange = async () => {
    const f = i.files[0];
    if (!f) return;
    try {
      const fiche = normaliserFiche(JSON.parse(await f.text()));
      const nom = (fiche.titre && fiche.titre !== 'Sans titre' ? fiche.titre : f.name.replace(/\.[^.]+$/, '')).slice(0, 80);
      await bdModeles('readwrite', s => s.put({ id: nouvelId('m'), nom, date: Date.now(), fiche }));
      afficherVueCoulisses('nouveau');
    } catch (e) { alerte('Ce fichier n\'est pas un document PageLibre valide.'); }
  };
  i.click();
}
function apercuFiche(fiche, max) {
  const fv = normaliserFiche(copie(fiche));
  const P = fv.page, k = max / Math.max(P.w, P.h) / PX_MM;
  const ap = document.createElement('div');
  ap.className = 'apercu';
  ap.style.cssText = `width:${P.w * k * PX_MM}px;height:${P.h * k * PX_MM}px;position:relative;overflow:hidden`;
  const f = Rendu.page(fv.pages[0], fv, { numero: 1 });
  f.style.transform = `scale(${k})`; f.style.transformOrigin = '0 0'; f.style.position = 'absolute';
  ap.appendChild(f);
  return ap;
}
// section « Mes modèles » de Fichier › Nouveau
async function afficherMesModeles(c) {
  const z = $('#mes-modeles', c);
  if (!z) return;
  const l = await listeMesModeles();
  z.innerHTML = '';
  if (!l.length) z.innerHTML = '<p class="vide">Aucun modèle pour l\'instant. Ouvrez ou créez une fiche, puis « Enregistrer la fiche actuelle comme modèle ».</p>';
  for (const m of l) {
    const b = document.createElement('button');
    b.className = 'modele mon-modele';
    b.dataset.monModele = m.id;
    b.title = m.nom;
    try { b.appendChild(apercuFiche(m.fiche, 90)); } catch (e) { /* aperçu impossible : le nom suffit */ }
    b.append(m.nom);
    const x = document.createElement('span');
    x.className = 'suppr-modele'; x.dataset.supprModele = m.id; x.title = 'Supprimer ce modèle'; x.textContent = '✕';
    b.appendChild(x);
    z.appendChild(b);
  }
  z.onclick = async ev => {
    const sx = ev.target.closest('[data-suppr-modele]');
    if (sx) {
      ev.stopPropagation();
      const m = l.find(x => x.id === sx.dataset.supprModele);
      confirmer(`Supprimer le modèle « ${m.nom} » ?`, async () => { await bdModeles('readwrite', s => s.delete(m.id)); afficherVueCoulisses('nouveau'); });
      return;
    }
    const b = ev.target.closest('[data-mon-modele]');
    if (!b) return;
    ev.stopPropagation();
    const m = l.find(x => x.id === b.dataset.monModele);
    const go = () => { const f = copie(m.fiche); f.titre = m.nom; chargerFiche(f); };
    if (E.modifie) confirmer('La fiche actuelle a des modifications non enregistrées. Les abandonner ?', go); else go();
  };
}

/* ---------------- tablette : doigts et stylet ---------------- */
// un doigt sur un objet : on le déplace (comme à la souris) ; un doigt ailleurs : on fait défiler ;
// deux doigts : zoom. Un appui long ouvre le menu contextuel (géré par le navigateur).
const T = { doigts: new Map(), geste: null };
function initTactile() {
  const zone = $('#defile');
  zone.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse') { document.body.classList.remove('tactile'); return; }
    document.body.classList.add('tactile');
    if (ev.pointerType !== 'touch') return;
    T.doigts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (T.doigts.size === 2) {
      // deuxième doigt : on abandonne le geste en cours et on zoome
      G = null; nettoyerAides();
      const [a, b] = [...T.doigts.values()];
      T.geste = { type: 'pince', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: E.zoom };
      ev.stopImmediatePropagation(); ev.preventDefault();
      return;
    }
    const cible = ev.target;
    const surObjet = cible.closest('#feuille-hote .calque-objets > .objet, .poignee, .poignee-rog, .bord-sel, .sep-tab, .guide-regle');
    if (!surObjet && !E.dessin && !E.lien && !E.pinceau) {
      T.geste = { type: 'defile', x0: ev.clientX, y0: ev.clientY, sl: zone.scrollLeft, st: zone.scrollTop, bouge: false };
      ev.stopImmediatePropagation(); ev.preventDefault();
    }
  }, true);
  window.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'touch' || !T.doigts.has(ev.pointerId)) return;
    T.doigts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const g = T.geste;
    if (!g) return;
    if (g.type === 'pince' && T.doigts.size >= 2) {
      const [a, b] = [...T.doigts.values()];
      const r = zone.getBoundingClientRect();
      definirZoom(g.z0 * Math.hypot(a.x - b.x, a.y - b.y) / g.d0, { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top });
    } else if (g.type === 'defile') {
      const dx = ev.clientX - g.x0, dy = ev.clientY - g.y0;
      if (Math.abs(dx) + Math.abs(dy) > 6) g.bouge = true;
      zone.scrollLeft = g.sl - dx; zone.scrollTop = g.st - dy;
    }
    ev.stopImmediatePropagation();
  }, true);
  const fin = ev => {
    if (ev.pointerType !== 'touch') return;
    T.doigts.delete(ev.pointerId);
    const g = T.geste;
    if (!g) return;
    if (g.type === 'defile' && T.doigts.size === 0) {
      // simple toucher sur un endroit vide : on désélectionne
      if (!g.bouge && ev.type === 'pointerup') { quitterEdition(); E.sel = []; majSelectionUI(); majRuban(); }
      T.geste = null;
    } else if (g.type === 'pince' && T.doigts.size < 2) T.geste = null;
    ev.stopImmediatePropagation();
  };
  window.addEventListener('pointerup', fin, true);
  window.addEventListener('pointercancel', fin, true);
}

/* ---------------- accessibilité ---------------- */
function annoncer(t) { const a = $('#annonce'); if (a) { a.textContent = ''; setTimeout(() => { a.textContent = t; }, 30); } }
function nomObjet(o) {
  const types = { texte: 'Zone de texte', image: 'Image', forme: 'Forme', tableau: 'Tableau', wordart: 'WordArt', ligne: 'Trait' };
  let t = types[o.type] || 'Objet';
  if (o.type === 'image') t += o.alt ? ' : ' + o.alt : ' sans texte de remplacement';
  else if (o.html) { const d = DOC_INERTE.createElement('div'); d.innerHTML = o.html; const s = d.textContent.trim().replace(/\s+/g, ' '); if (s) t += ' : ' + s.slice(0, 80); }
  else if (o.wordart && o.wordart.texte) t += ' : ' + o.wordart.texte;
  return t;
}
// ordre de lecture : de haut en bas, puis de gauche à droite
function objetsDansLOrdre() { return pageCourante().items.filter(o => !o.arrierePlan).slice().sort((a, b) => (Math.abs(a.y - b.y) > 3 ? a.y - b.y : a.x - b.x)); }
function objetSuivant(sens) {
  const l = objetsDansLOrdre();
  if (!l.length) { annoncer('Page vide'); return; }
  const i = E.sel.length ? l.findIndex(o => o.id === E.sel[E.sel.length - 1]) : -1;
  const o = l[(i + sens + l.length) % l.length];
  choisir([o.id]);
  const el = elementObjet(o.id);
  if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  annoncer(`${nomObjet(o)}. Objet ${l.indexOf(o) + 1} sur ${l.length}. Entrée pour écrire, flèches pour déplacer.`);
}
// F6 : ruban → volet des pages → document
function zoneSuivante(sens) {
  const zones = [$('#onglets .onglet.actif'), $('#liste-pages .vignette.active') || $('#liste-pages .vignette'), $('#defile')].filter(Boolean);
  const a = document.activeElement;
  let i = zones.findIndex(z => z === a || z.contains(a) || (z.id === 'onglets' && a.closest && a.closest('#onglets,#ruban')));
  if (i < 0) i = a && a.closest && a.closest('#onglets,#ruban') ? 0 : a && a.closest && a.closest('#volet-pages') ? 1 : 2;
  const z = zones[(i + sens + zones.length) % zones.length];
  z.focus({ preventScroll: true });
  annoncer(z.id === 'defile' ? 'Document : Tab pour passer d\'un objet à l\'autre' : z.closest('#volet-pages') ? 'Volet des pages' : 'Ruban : Tab pour parcourir les boutons');
}
function surToucheAccessible(ev) {
  if (ev.key === 'F6') { ev.preventDefault(); zoneSuivante(ev.shiftKey ? -1 : 1); return true; }
  if (ev.key === 'F1') { ev.preventDefault(); ouvrirCoulisses('aide'); return true; }
  const a = document.activeElement;
  if (ev.key === 'Tab' && !ev.ctrlKey && !ev.altKey && !E.edition && (a === document.body || a === $('#defile'))) {
    ev.preventDefault(); objetSuivant(ev.shiftKey ? -1 : 1); return true;
  }
  return false;
}
// libellés pour les lecteurs d'écran : boutons à icône seule, onglets, vignettes
function accessibiliser(racine) {
  for (const b of $$('button', racine || document)) {
    if (!b.getAttribute('aria-label') && !b.textContent.trim() && b.title) b.setAttribute('aria-label', b.title);
    if (b.dataset.menu) b.setAttribute('aria-haspopup', 'menu');
  }
  for (const o of $$('#onglets .onglet')) { o.setAttribute('role', 'tab'); o.setAttribute('aria-selected', o.classList.contains('actif') ? 'true' : 'false'); }
  for (const v of $$('#liste-pages .vignette')) { v.setAttribute('role', 'button'); v.tabIndex = 0; v.setAttribute('aria-label', 'Page ' + (+v.dataset.index + 1)); }
}
function texteRemplacement() {
  const o = selection().find(x => x.type === 'image');
  if (!o) { alerte('Sélectionnez d\'abord une image.'); return; }
  ouvrirBoite('Texte de remplacement', `<p style="max-width:460px">Décrivez l'image en une phrase pour les personnes qui ne la voient pas (lecteur d'écran, PDF accessible). Exemple : « Schéma de câblage d'un va-et-vient ».</p>
    <textarea id="alt-texte" class="champ" rows="3" style="width:440px">${esc(o.alt || '')}</textarea>
    <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="alt-deco" ${o.decorative ? 'checked' : ''}> Image décorative (rien à décrire)</label>`, () => {
    avant();
    const t = $('#alt-texte').value.trim().replace(/[<>]/g, '');
    if ($('#alt-deco').checked) { o.decorative = true; delete o.alt; } else { delete o.decorative; if (t) o.alt = t; else delete o.alt; }
    redessinerObjet(o);
    apres();
  });
}
// contraste WCAG entre deux couleurs #rrggbb
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const v = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contraste(a, b) { const la = luminance(a), lb = luminance(b); if (la == null || lb == null) return 21; return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
function rgbVersHex(c) { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? '#' + m.slice(1, 4).map(x => (+x).toString(16).padStart(2, '0')).join('') : c; }
function verifierAccessibilite() {
  quitterEdition();
  const pb = [];
  E.fiche.pages.forEach((p, ip) => {
    for (const o of p.items) {
      if (o.type === 'image' && !o.alt && !o.decorative && !o.arrierePlan) pb.push({ ip, id: o.id, txt: 'Image sans texte de remplacement' });
      const htmls = o.type === 'tableau' ? o.tableau.cellules.map(c => c.html) : [o.html];
      const fond = (o.fond && o.fond.couleur) || E.fiche.page.fond || '#ffffff';
      let petit = false, faible = false;
      for (const h of htmls) {
        if (!h) continue;
        const d = DOC_INERTE.createElement('div'); d.innerHTML = h;
        for (const s of d.querySelectorAll('[style]')) {
          if (!s.textContent.trim()) continue;
          const t = /font-size:\s*([\d.]+)pt/.exec(s.getAttribute('style'));
          if (t && +t[1] < 8) petit = true;
          const c = /(?:^|;)\s*color:\s*([^;]+)/.exec(s.getAttribute('style'));
          if (c && contraste(rgbVersHex(c[1].trim()), fond) < 4.5) faible = true;
        }
      }
      if (petit) pb.push({ ip, id: o.id, txt: 'Texte très petit (moins de 8 pt)' });
      if (faible) pb.push({ ip, id: o.id, txt: 'Texte peu contrasté sur son fond' });
    }
  });
  const corps = pb.length
    ? `<p>${pb.length} point(s) à vérifier :</p><div class="liste-verif">${pb.map((x, i) => `<button class="bouton" data-v="${i}">Page ${x.ip + 1} : ${esc(x.txt)}</button>`).join('')}</div>`
    : '<p>Aucun problème trouvé : images décrites, textes lisibles et contrastés.</p>';
  ouvrirBoite('Vérifier l\'accessibilité', corps + '<p style="color:#666;max-width:460px">Pour un PDF accessible : décrivez les images, gardez des textes de 8 pt au moins, et des couleurs bien contrastées.</p>', null, { sansAnnuler: true, ok: 'Fermer' });
  const l = $('#boite .liste-verif');
  if (l) l.onclick = ev => {
    const b = ev.target.closest('[data-v]');
    if (!b) return;
    const x = pb[+b.dataset.v];
    fermerBoite();
    if (E.modeMaitre) quitterModeMaitre();
    allerPage(x.ip);
    choisir([x.id]);
  };
}

/* ---------------- fond de page : image ou pages d'un PDF ---------------- */
function placerFond(page, cle) {
  page.items = page.items.filter(o => !o.arrierePlan);
  page.items.unshift({ id: nouvelId(), type: 'image', image: cle, x: 0, y: 0, w: E.fiche.page.w, h: E.fiche.page.h, habillage: 'aucun', arrierePlan: true, decorative: true });
}
function imageDeFond() {
  choisirFichierImage(async f => {
    try {
      const im = await lireImage(f);
      const k = nouvelId('img');
      E.fiche.images[k] = im.url;
      avant();
      placerFond(pageCourante(), k);
      afficherPage(); planifierVignette(E.ip);
      apres();
    } catch (e) { alerte('Impossible de lire cette image.'); }
  });
}
function retirerFond() {
  if (!pageCourante().items.some(o => o.arrierePlan)) return;
  avant();
  pageCourante().items = pageCourante().items.filter(o => !o.arrierePlan);
  afficherPage(); planifierVignette(E.ip);
  apres();
}
// lecteur de PDF : pdf.js de Mozilla (vendor/pdfjs), chargé seulement quand on importe un PDF.
// Il a besoin d'un site web (http/https) : dans le fichier unique ouvert d'un double-clic, il n'est pas disponible.
let promessePdf = null;
function chargerPdfJs() {
  if (!promessePdf) {
    if (location.protocol === 'file:') return Promise.reject(new Error('l\'import de PDF fonctionne dans PageLibre en ligne ou installé (https://pagelibre.github.io/), pas dans le fichier ouvert d\'un double-clic.'));
    const base = new URL('vendor/pdfjs/', location.href).href;
    promessePdf = import(base + 'pdf.min.mjs').then(lib => { lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs'; return lib; })
      .catch(e => { promessePdf = null; throw new Error('lecteur de PDF indisponible (' + e.message + ').'); });
  }
  return promessePdf;
}
function importerPDF() {
  const i = $('#entree-fichier');
  i.value = ''; i.accept = '.pdf,application/pdf';
  i.onchange = () => { if (i.files[0]) boiteImportPDF(i.files[0]); };
  i.click();
}
async function boiteImportPDF(fichier) {
  let doc;
  try {
    const lib = await chargerPdfJs();
    doc = await lib.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()), isEvalSupported: false }).promise;
  } catch (e) { alerte('Impossible de lire ce PDF : ' + e.message); return; }
  const n = doc.numPages;
  const vierge = E.fiche.pages.length === 1 && !E.fiche.pages[0].items.length && !E.modifie;
  ouvrirBoite('Pages d\'un PDF', `<p style="max-width:460px">Chaque page du PDF devient le <b>fond</b> d'une page de PageLibre : vous écrivez et placez vos objets par-dessus (corrections, réponses, compléments). Le fond ne bouge pas quand on clique dessus.</p>
    <div class="grille-champs"><span>Pages (${n} dans le PDF)</span><input id="pdf-pages" class="champ" value="1-${n}">
      <span>Qualité</span><select id="pdf-ppp" class="champ"><option value="150">Écran (150 ppp)</option><option value="200" selected>Impression (200 ppp)</option></select></div>
    <p style="color:#666">${vierge ? 'Le document prend le format des pages du PDF.' : 'Les pages sont ajoutées après la page actuelle.'}</p>`, () => {
    const pages = [];
    for (const m of $('#pdf-pages').value.split(/[;,]/)) {
      const r = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(m);
      if (!r) continue;
      for (let k = +r[1]; k <= +(r[2] || r[1]); k++) if (k >= 1 && k <= n && !pages.includes(k)) pages.push(k);
    }
    if (!pages.length) return false;
    rendrePagesPDF(doc, pages, +$('#pdf-ppp').value, vierge, fichier.name);
  }, { ok: 'Importer' });
}
async function rendrePagesPDF(doc, pages, ppp, vierge, nom) {
  quitterEdition();
  avant();
  const nouvelles = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      indication(`Import du PDF : page ${i + 1} sur ${pages.length}…`);
      const pg = await doc.getPage(pages[i]);
      const vp = pg.getViewport({ scale: ppp / 72 });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: g, viewport: vp }).promise;
      const k = nouvelId('img');
      E.fiche.images[k] = c.toDataURL('image/jpeg', 0.85);
      if (vierge && i === 0) { E.fiche.page.w = arrondi(c.width / ppp * 25.4); E.fiche.page.h = arrondi(c.height / ppp * 25.4); E.fiche.titre = nom.replace(/\.pdf$/i, ''); }
      nouvelles.push(k);
    }
  } catch (e) { indication(null); alerte('Import du PDF interrompu : ' + e.message); return; }
  indication(null);
  let ip = vierge ? 0 : E.ip + 1;
  if (vierge) E.fiche.pages = [];
  for (const k of nouvelles) {
    const p = { id: nouvelId('p'), maitre: null, items: [] };
    placerFond(p, k);
    E.fiche.pages.splice(ip++, 0, p);
  }
  E.ip = vierge ? 0 : E.ip + 1;
  afficherPage(); dessinerVignettes(); if (vierge) zoomPage();
  apres();
  bandeau(`${nouvelles.length} page(s) du PDF importée(s) en fond de page.`);
}

/* ---------------- aide et nouveautés ---------------- */
const LIEN_PROBLEME = () => (DEPOT_URL ? DEPOT_URL + '/issues/new/choose' : '');
function vueAide(c) {
  const lien = LIEN_PROBLEME();
  c.innerHTML = `<h1>Aide</h1>
    <div class="aide">
    <details open><summary>Premiers pas</summary>
      <ol><li><b>Fichier › Nouveau</b> : une page vierge ou un modèle (fiche de TP, QCM, consignes de sécurité…). Vos propres modèles sont dans « Mes modèles ».</li>
      <li><b>Ajouter</b> du texte, une image, une forme ou un tableau : onglet Accueil ou Insertion, puis tracez l'objet sur la page.</li>
      <li><b>Écrire</b> : cliquez dans une zone de texte. <b>Déplacer</b> : saisissez le cadre par son bord.</li>
      <li><b>Enregistrer</b> : Ctrl+S. Le document reste sur votre appareil (fichier .pagelibre, ou page web .html).</li>
      <li><b>Faire un PDF</b> : le bouton PDF en haut à gauche. <b>Imprimer</b> : Ctrl+P, marges « Aucune ».</li></ol></details>
    <details><summary>Souris, doigt et stylet</summary>
      <ul><li>Poignées rondes : agrandir ; flèche ronde : faire pivoter ; Maj : garder les proportions.</li>
      <li>Ctrl+molette : zoom ; clic droit : menu de l'objet.</li>
      <li><b>Tablette</b> : un doigt sur un objet le déplace, un doigt ailleurs fait défiler, deux doigts zooment ; un appui long ouvre le menu. Les poignées s'agrandissent au toucher.</li></ul></details>
    <details><summary>Clavier et accessibilité</summary>
      <ul><li><b>Tab</b> / Maj+Tab : passer d'un objet à l'autre (dans l'ordre de lecture) ; <b>Entrée</b> : écrire dedans ; <b>Échap</b> : en sortir.</li>
      <li><b>Flèches</b> : déplacer l'objet de 1 mm (Maj : 5 mm, Alt : 0,2 mm).</li>
      <li><b>F6</b> : passer du ruban au volet des pages, puis au document. <b>F1</b> : cette aide.</li>
      <li>Image › <b>Texte de remplacement</b> : décrire une image pour les lecteurs d'écran et les PDF accessibles.</li>
      <li>Affichage › <b>Vérifier l'accessibilité</b> : images non décrites, textes trop petits ou peu contrastés.</li></ul></details>
    <details><summary>Raccourcis</summary>
      <p>Ctrl+S enregistrer · Ctrl+P imprimer · Ctrl+Z / Ctrl+Y annuler / rétablir · Ctrl+C / X / V copier, couper, coller · Ctrl+D dupliquer · Suppr effacer · Ctrl+G / Ctrl+Maj+G grouper / dissocier · Ctrl+F rechercher · Ctrl+H remplacer · Ctrl+K lien · Ctrl+0 page entière · F9 100 %</p></details>
    <details><summary>Donner son document : PDF, Word, images, impression</summary>
      <ul><li><b>PDF</b> : bouton PDF en haut à gauche. Le texte reste net ; on peut le chercher et le copier. Pour un imprimeur : Fichier › Imprimer / PDF, traits de coupe.</li>
      <li>Si le navigateur demande à lire les polices installées, acceptez : sinon, le texte écrit avec d'autres polices que Calibri, Cambria, Arial et Times New Roman devient une image haute définition.</li>
      <li><b>Word</b> : Fichier › Exporter. La mise en page est gardée ; textes, tableaux, formes et images se modifient dans Word. Les WordArt et les bordures décoratives deviennent des images, le texte qui contourne un objet est coupé ligne par ligne, les effets 3D ne sont pas repris.</li>
      <li><b>Images</b> : Fichier › Exporter, une image PNG par page.</li>
      <li><b>Imprimer</b> : Ctrl+P, marges « Aucune », échelle 100 %, « Graphiques d'arrière-plan » cochés.</li></ul></details>
    <details><summary>Formes, hachures, diagrammes, bordures</summary>
      <ul><li><b>Motif (hachures)</b> : Format › Remplissage, pour une forme, une zone de texte ou une cellule.</li>
      <li><b>Secteur</b> de diagramme : dans les formes ; les poignées jaunes règlent les angles.</li>
      <li><b>Bordure décorative</b> : Format › Contour. <b>Petites capitales</b> : bouton Aᴀ de l'onglet Accueil.</li>
      <li><b>Habillage</b> : le texte contourne l'objet (carré), ou suit sa forme (serré).</li></ul></details>
    <details><summary>L'avocat du bandeau bleu</summary>
      <ul><li>C'est la mascotte : elle se promène, prend des notes quand vous écrivez, s'étonne quand vous supprimez, s'endort si vous ne faites rien… Elle ne s'imprime pas et n'est pas dans vos documents.</li>
      <li>Pour la masquer ou la remettre : <b>Affichage › Mascotte</b>, ou clic droit dessus. Elle se cache aussi quand la fenêtre est étroite.</li></ul></details>
    <details><summary>Images et fichiers</summary>
      <ul><li>Les images sont <b>allégées</b> à l'insertion. Image › <b>Compresser les images</b> réduit tout le document (pour un mail ou l'ENT).</li>
      <li>Insertion › <b>Pages d'un PDF</b> : chaque page d'un PDF devient le fond d'une page, pour écrire par-dessus. Création de page › <b>Image de fond</b> fait de même avec une image (document scanné).</li>
      <li>Formats : .pagelibre (format ouvert), .html (s'ouvre d'un double-clic), PDF, Word et PNG (Fichier › Exporter), .pub (ouverture seulement).</li>
      <li>Les polices Calibri, Cambria, Arial et Times New Roman ont des équivalentes libres intégrées : la fiche s'affiche pareil sur tous les ordinateurs.</li></ul></details>
    <details><summary>Confidentialité</summary>
      <p>Tout reste sur votre appareil : pas de compte, pas de statistiques, rien n'est envoyé. Un document reçu de quelqu'un est nettoyé à l'ouverture : seul le contenu mis en forme est gardé.</p></details>
    </div>
    ${lien ? `<h2>Un problème, une idée ?</h2><p><a href="${esc(lien)}" target="_blank" rel="noopener">Signaler un problème ou proposer une idée</a> (sur GitHub, compte gratuit nécessaire).</p>` : ''}
    <p><button class="bouton" data-nouveautes>Quoi de neuf dans cette version ?</button></p>`;
  $('[data-nouveautes]', c).onclick = () => afficherNouveautes(true);
}
function afficherNouveautes(tout) {
  const l = tout ? NOUVEAUTES : NOUVEAUTES.filter(n => n.version === NOUVEAUTES[0].version);
  ouvrirBoite('Quoi de neuf dans PageLibre', `<div class="nouveautes">${l.map(n => `<h3>Version ${esc(n.version)} <small>(${esc(n.date)})</small></h3><ul>${n.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`).join('')}</div>`, null, { sansAnnuler: true, ok: 'Fermer' });
}
// à la première ouverture d'une nouvelle version : les nouveautés (pas au tout premier lancement)
function proposerNouveautes() {
  try {
    const vu = localStorage.getItem('pagelibre-version-vue');
    localStorage.setItem('pagelibre-version-vue', VERSION_NOM);
    if (vu && vu !== VERSION_NOM) setTimeout(() => { if ($('#boite').hidden) afficherNouveautes(false); }, 800);
  } catch (e) { /* stockage indisponible */ }
}

/* ---------------- branchements ---------------- */
Object.assign(COMMANDES, {
  compresserImages: () => boiteCompresser(),
  texteRemplacement: () => texteRemplacement(),
  verifierAccessibilite: () => verifierAccessibilite(),
  importerPDF: () => importerPDF(),
  enregistrerModele: () => enregistrerCommeModele(),
  aide: () => ouvrirCoulisses('aide')
});
const MENUS_PLUS = {
  fondPage: b => ouvrirMenu(sousBouton(b), [
    { lib: 'Image de fond…', ic: 'image', act: imageDeFond },
    { lib: 'Pages d\'un PDF…', act: importerPDF },
    { lib: 'Retirer le fond de cette page', act: retirerFond, off: !pageCourante().items.some(o => o.arrierePlan) }])
};
function initPlus4() {
  initTactile();
  document.addEventListener('keydown', ev => { if (surToucheAccessible(ev)) ev.stopImmediatePropagation(); }, true);
  accessibiliser();
  proposerNouveautes();
}
