/* =====================================================================
   Éditeur : fichiers (ouvrir, enregistrer, imprimer), brouillon, démarrage
   Une fiche enregistrée est une copie de l'éditeur contenant le document :
   on l'ouvre d'un double-clic et on continue à la modifier.
   ===================================================================== */
let MODELE_HTML = null;
const BALISE_FICHE = '<script id="fiche-integree" type="application/json">';
const FIN_SCRIPT = '<\/script>'; // échappé : le code est lui-même dans une balise script

function capturerModele() {
  const h = document.documentElement.outerHTML;
  const i = h.indexOf(BALISE_FICHE);
  const j = h.indexOf(FIN_SCRIPT, i);
  MODELE_HTML = '<!doctype html>\n' + h.slice(0, i + BALISE_FICHE.length) + 'null' + h.slice(j);
}

/* ---------------- ouverture ---------------- */
async function parcourir() {
  if (window.showOpenFilePicker) {
    try {
      const [p] = await showOpenFilePicker({
        types: [{ description: 'Documents PageLibre et fichiers .pub', accept: { 'application/x-pagelibre': ['.pagelibre'], 'application/octet-stream': ['.pub'], 'text/html': ['.html', '.htm'], 'application/json': ['.json'] } }],
        excludeAcceptAllOption: false
      });
      const f = await p.getFile();
      noterRecent(p);
      ouvrirFichier(f, /\.(pagelibre|html?)$/i.test(f.name) ? p : null);
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const i = $('#entree-fichier');
  i.value = '';
  i.accept = '.pagelibre,.pub,.html,.htm,.json';
  i.onchange = () => { if (i.files[0]) ouvrirFichier(i.files[0], null); };
  i.click();
}

function ouvrirFichier(f, poignee) {
  const suite = async () => {
    try {
      if (/\.pub$/i.test(f.name)) {
        const buf = new Uint8Array(await f.arrayBuffer());
        const fiche = LecteurPub.lirePub(buf, { nom: f.name });
        chargerFiche(fiche, { nom: f.name });
        const av = fiche.avertissements || [];
        bandeau(`Fichier .pub importé : ${fiche.pages.length} page(s). Le fichier d'origine n'est pas modifié : votre travail sera enregistré dans un nouveau document (${formatParDefaut() === 'pagelibre' ? '.pagelibre' : 'page web .html'}).` + (av.length ? ' Attention : ' + av.join(' ') : ''));
      } else if (/\.pagelibre$/i.test(f.name)) {
        const fiche = JSON.parse(await f.text());
        if (!fiche || !Array.isArray(fiche.pages)) throw new Error('Ce fichier n\'est pas un document PageLibre valide.');
        chargerFiche(fiche, { nom: f.name, poignee });
      } else if (/\.html?$/i.test(f.name)) {
        const t = await f.text();
        const fiche = extraireFicheHTML(t);
        if (!fiche) throw new Error('Cette page web ne contient pas de document PageLibre.');
        chargerFiche(fiche, { nom: f.name, poignee });
      } else if (/\.json$/i.test(f.name)) {
        chargerFiche(JSON.parse(await f.text()), { nom: f.name });
      } else {
        throw new Error('Format non reconnu : ouvrez un fichier .pub, un document .pagelibre ou une fiche enregistrée (.html).');
      }
    } catch (e) {
      console.error(e);
      alerte('Impossible d\'ouvrir « ' + f.name + ' » : ' + e.message);
    }
  };
  if (E.modifie) confirmer('La fiche actuelle a des modifications non enregistrées. Les abandonner et ouvrir « ' + f.name + ' » ?', suite);
  else suite();
}

function extraireFicheHTML(t) {
  const i = t.indexOf(BALISE_FICHE);
  if (i < 0) return null;
  const j = t.indexOf(FIN_SCRIPT, i);
  const json = t.slice(i + BALISE_FICHE.length, j).trim();
  if (!json || json === 'null') return null;
  return JSON.parse(json);
}

function chargerFiche(fiche, opt = {}) {
  quitterEdition();
  finDessin();
  annulerModes();
  E.modeMaitre = null;
  const bd = $('#bandeau');
  if (bd && bd.dataset.type === 'info') bd.hidden = true; // message de la fiche précédente
  E.fiche = normaliserFiche(fiche);
  E.ip = 0;
  E.sel = [];
  E.histo = [];
  E.refaire = [];
  E.modifie = false;
  E.poignee = opt.poignee || null;
  E.nomFichier = opt.nom || null;
  E.presse = E.presse || null;
  fermerCoulisses();
  dessinerVignettes();
  afficherPage();
  // cadres chaînés d'origine : on répartit le texte ; images EMF/WMF : conversion
  if (E.fiche.pages.some(p => p.items.some(o => o.suivant))) { refluerChaines(); afficherPage(); dessinerVignettes(); }
  convertirMetafichiers();
  requestAnimationFrame(() => { zoomPage(); });
  majTitre();
}

/* ---------------- enregistrement ---------------- */
// toutes les images dont dépend un objet : image, fond en image, motif (hachures)
function imagesObjet(o) { return [o.image, o.fond && o.fond.image, o.fond && o.fond.motif].filter(Boolean); }
function imagesUtilisees() {
  const u = new Set();
  const voir = o => imagesObjet(o).forEach(k => u.add(k));
  for (const p of [...E.fiche.pages, ...Object.values(E.fiche.maitres)]) p.items.forEach(voir);
  return u;
}
function nettoyerImages() {
  const u = imagesUtilisees();
  for (const k of Object.keys(E.fiche.images)) if (!u.has(k)) delete E.fiche.images[k];
}
function htmlFiche() {
  nettoyerImages();
  const json = JSON.stringify(E.fiche).replace(/</g, '\\u003c');
  const titre = esc(E.fiche.titre) + ' - PageLibre';
  return MODELE_HTML
    .replace(BALISE_FICHE + 'null' + FIN_SCRIPT, () => BALISE_FICHE + json + FIN_SCRIPT)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${titre}</title>`);
}
function nomPropose(ext) { return (E.fiche.titre || 'document').replace(/[\\/:*?"<>|]+/g, '_').trim() + '.' + (ext || 'html'); }
const TYPES_ENREGISTREMENT = {
  pagelibre: { description: 'Document PageLibre', accept: { 'application/x-pagelibre': ['.pagelibre'] } },
  html: { description: 'Page web autonome (s\'ouvre d\'un double-clic, contient l\'éditeur)', accept: { 'text/html': ['.html'] } }
};
function contenuFormat(f) { return f === 'pagelibre' ? [jsonFiche(), 'application/x-pagelibre'] : [htmlFiche(), 'text/html']; }

// format choisi : celui du fichier déjà ouvert, sinon le format par défaut
async function enregistrer(sous) {
  quitterEdition();
  let format = E.poignee && /\.html?$/i.test(E.poignee.name) ? 'html' : E.poignee ? 'pagelibre' : formatParDefaut();
  if (window.showSaveFilePicker) {
    try {
      if (!E.poignee || sous) {
        const autre = format === 'pagelibre' ? 'html' : 'pagelibre';
        E.poignee = await showSaveFilePicker({ suggestedName: nomPropose(format), types: [TYPES_ENREGISTREMENT[format], TYPES_ENREGISTREMENT[autre]] });
        format = /\.html?$/i.test(E.poignee.name) ? 'html' : 'pagelibre';
      }
      const [contenu, type] = contenuFormat(format);
      const w = await E.poignee.createWritable();
      await w.write(new Blob([contenu], { type }));
      await w.close();
      E.nomFichier = E.poignee.name;
      noterRecent(E.poignee);
      marquerEnregistre(`Enregistré dans « ${E.poignee.name} »`);
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.warn('Enregistrement direct impossible, téléchargement à la place', e);
      E.poignee = null;
    }
  }
  const [contenu, type] = contenuFormat(format);
  telecharger(contenu, nomPropose(format), type);
  marquerEnregistre('Document téléchargé : « ' + nomPropose(format) + ' » (dossier Téléchargements)');
}
function exporterFormat(format) {
  quitterEdition();
  const [contenu, type] = contenuFormat(format);
  telecharger(contenu, nomPropose(format), type);
}
function telecharger(contenu, nom, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenu], { type }));
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function marquerEnregistre(msg) {
  E.modifie = false;
  majTitre();
  effacerBrouillon();
  fermerCoulisses();
  $('#indic-sauvegarde').textContent = msg;
  setTimeout(() => { if ($('#indic-sauvegarde').textContent === msg) $('#indic-sauvegarde').textContent = ''; }, 6000);
}

/* ---------------- impression / PDF ---------------- */
// pages mises en page hors écran (taquets et habillage ont besoin de mesurer), puis impression
function imprimer() { return imprimerAvecOptions(false); }

/* ---------------- brouillon automatique (IndexedDB) ---------------- */
function ouvrirBD() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('pagelibre', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('brouillons');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function bdFaire(mode, fn) {
  const db = await ouvrirBD();
  return new Promise((ok, ko) => {
    const tx = db.transaction('brouillons', mode);
    const req = fn(tx.objectStore('brouillons'));
    tx.oncomplete = () => { ok(req && req.result); db.close(); };
    tx.onerror = () => { ko(tx.error); db.close(); };
  });
}
let minuteurAuto = null;
function planifierAutosave() {
  clearTimeout(minuteurAuto);
  minuteurAuto = setTimeout(sauverBrouillon, 2500);
}
async function sauverBrouillon() {
  if (!E.modifie) return;
  try {
    if (E.edition) { const o = objetParId(E.edition.id), el = elementObjet(E.edition.id); if (o && el) lireTexteEdite(o, el); }
    await bdFaire('readwrite', s => s.put({ date: Date.now(), titre: E.fiche.titre, nom: E.nomFichier, fiche: E.fiche }, 'courant'));
    const h = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    $('#indic-sauvegarde').textContent = `Brouillon sauvegardé à ${h}`;
  } catch (e) { /* stockage indisponible : sans conséquence */ }
}
async function lireBrouillon() { try { return await bdFaire('readonly', s => s.get('courant')); } catch (e) { return null; } }
async function effacerBrouillon() { try { await bdFaire('readwrite', s => s.delete('courant')); } catch (e) { /* */ } }

async function proposerBrouillon() {
  const b = await lireBrouillon();
  if (!b || !b.fiche) return;
  const d = new Date(b.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const bd = $('#bandeau');
  bd.dataset.type = 'brouillon';
  bd.innerHTML = `<span>Une fiche non enregistrée a été retrouvée : « ${esc(b.titre)} » (${d}).</span><button class="bouton principal" data-r>Reprendre</button><button class="bouton" data-i>Ignorer</button>`;
  bd.hidden = false;
  $('[data-r]', bd).onclick = () => { bd.hidden = true; chargerFiche(b.fiche, { nom: b.nom }); E.modifie = true; majTitre(); };
  $('[data-i]', bd).onclick = () => { bd.hidden = true; effacerBrouillon(); };
}
function bandeau(msg) {
  const bd = $('#bandeau');
  bd.dataset.type = 'info';
  bd.innerHTML = `<span>${esc(msg)}</span><button class="bouton">OK</button>`;
  $('button', bd).onclick = () => { bd.hidden = true; };
  bd.hidden = false;
  setTimeout(() => { if (bd.dataset.type === 'info') bd.hidden = true; }, 15000);
}

/* ---------------- coulisses (onglet Fichier) ---------------- */
function ouvrirCoulisses(vue) {
  quitterEdition();
  $('#coulisses').hidden = false;
  afficherVueCoulisses(vue || 'infos');
}
function fermerCoulisses() { $('#coulisses').hidden = true; }
function afficherVueCoulisses(vue) {
  $$('.coul-item').forEach(b => b.classList.toggle('actif', b.dataset.vue === vue));
  const c = $('#coul-contenu');
  const P = E.fiche.page;
  if (vue === 'nouveau') {
    const modeles = [['Page A4 portrait', 210, 297], ['Page A4 paysage', 297, 210], ['Page A3 paysage', 420, 297], ['Page A3 portrait', 297, 420], ['Page A5 portrait', 148, 210]];
    c.innerHTML = `<h1>Nouveau</h1><h2>Page vierge</h2><div class="modeles">${modeles.map(([n, w, h]) => {
      const k = 90 / Math.max(w, h);
      return `<button class="modele" data-w="${w}" data-h="${h}"><div class="apercu" style="width:${w * k}px;height:${h * k}px"></div>${n}</button>`;
    }).join('')}</div>
    <h2>Modèles</h2><div class="modeles" id="modeles-liste"></div>
    <h2>Mes modèles</h2><div class="modeles" id="mes-modeles"></div>
    <p class="actions-modeles"><button class="bouton" data-cmd-modele="enregistrer">${ic('modele16')} Enregistrer la fiche actuelle comme modèle</button>
      <button class="bouton" data-cmd-modele="importer">Importer un modèle (.pagelibre)</button>
      ${DEPOT_URL ? `<a href="${esc(DEPOT_URL)}/issues/new?template=modele.yml" target="_blank" rel="noopener">Proposer un modèle à la bibliothèque de PageLibre</a>` : ''}</p>`;
    afficherMesModeles(c);
    // aperçus des modèles : rendus en miniature
    const zm = $('#modeles-liste');
    for (const [cle, M] of Object.entries(MODELES)) {
      const b = document.createElement('button');
      b.className = 'modele';
      b.dataset.modele = cle;
      const k = 90 / Math.max(M.w, M.h) / PX_MM;
      const ap = document.createElement('div');
      ap.className = 'apercu';
      ap.style.cssText = `width:${M.w * k * PX_MM}px;height:${M.h * k * PX_MM}px;position:relative;overflow:hidden`;
      const fv = ficheVierge(M.w, M.h, M.nom);
      fv.pages[0].items = M.objets(fv.page).map((o, i) => Object.assign({ id: 'apercu' + i }, o));
      const f = Rendu.page(fv.pages[0], fv, { numero: 1 });
      f.style.transform = `scale(${k})`; f.style.transformOrigin = '0 0'; f.style.position = 'absolute';
      ap.appendChild(f);
      b.append(ap, M.nom);
      zm.appendChild(b);
    }
    c.onclick = ev => {
      const cm = ev.target.closest('[data-cmd-modele]');
      if (cm) { if (cm.dataset.cmdModele === 'enregistrer') enregistrerCommeModele(); else importerModele(); return; }
      if (ev.target.closest('#mes-modeles')) return; // géré par afficherMesModeles
      const bm = ev.target.closest('[data-modele]');
      if (bm) { nouveauDepuisModele(bm.dataset.modele); return; }
      const b = ev.target.closest('.modele');
      if (!b) return;
      const go = () => chargerFiche(ficheVierge(+b.dataset.w, +b.dataset.h, 'Nouvelle fiche'));
      if (E.modifie) confirmer('La fiche actuelle a des modifications non enregistrées. Les abandonner ?', go); else go();
    };
  } else if (vue === 'ouvrir') {
    c.innerHTML = `<h1>Ouvrir</h1>
      <button class="gros-bouton" data-parcourir>${ic('ouvrir')}<span>Parcourir…<br><small>Fichier .pub, document .pagelibre ou fiche .html</small></span></button>
      <div class="zone-depot">Vous pouvez aussi faire glisser un fichier .pub ou .html n'importe où dans cette fenêtre.</div>
      <h2>Fiches récentes</h2><div id="liste-recents" class="liste-recents"><p>…</p></div>
      <h2>Ce qui est repris d'un fichier .pub</h2>
      <p class="liste-infos">Pages et format, zones de texte (polices, tailles, gras, italique, couleurs, alignements, puces, interlignes), images (PNG, JPEG, avec rognage), formes et traits, tableaux (cellules fusionnées, bordures, remplissages, texte vertical), WordArt, groupes et pages maîtres.<br>
      Le fichier .pub n'est jamais modifié : le travail est enregistré dans un nouveau document (.pagelibre, ou page web .html autonome) qu'on rouvre ici pour continuer.</p>`;
    $('[data-parcourir]', c).onclick = parcourir;
    c.onclick = null;
    listeRecents().then(l => {
      const z = $('#liste-recents');
      if (!z) return;
      if (!l.length) { z.innerHTML = '<p>Les fiches ouvertes ou enregistrées ici apparaîtront dans cette liste.</p>'; return; }
      z.innerHTML = l.map((r, i) => `<button class="recent" data-r="${i}">${ic(/\.pub$/i.test(r.nom) ? 'pub' : 'html')}<span><b>${esc(r.nom)}</b><br><small>${new Date(r.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small></span></button>`).join('');
      z.onclick = ev => { const b = ev.target.closest('[data-r]'); if (b) ouvrirRecent(l[+b.dataset.r]); };
    });
  } else if (vue === 'imprimer') {
    c.innerHTML = `<h1>Imprimer / PDF</h1>
      <button class="gros-bouton" data-imp>${ic('imprimer')}<span>Imprimer…<br><small>${E.fiche.pages.length} page(s), ${arrondi(P.w / 10, 1)} x ${arrondi(P.h / 10, 1)} cm</small></span></button>
      <p>Pour obtenir un <b>PDF</b> : dans la fenêtre d'impression, choisissez l'imprimante « Enregistrer au format PDF » (ou l'imprimante PDF de votre système).</p>
      <p>Réglez « Marges » sur <b>Aucune</b> et « Échelle » sur <b>100 %</b> (ou « Taille réelle ») pour garder la mise en page exacte. Cochez « Graphiques d'arrière-plan » si la fiche a des fonds de couleur.</p>
      <h2>Pour un imprimeur</h2>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="imp-coupe"> Ajouter les traits de coupe et un fond perdu de 3 mm (la feuille fait 2 cm de plus)</label>
      <p style="color:#777">Les objets qui dépassent du bord de la page sont gardés sur 3 mm, pour une coupe sans liseré blanc. Les couleurs restent en RVB : l'imprimeur fait la conversion en CMJN.</p>`;
    $('[data-imp]', c).onclick = () => imprimerAvecOptions($('#imp-coupe').checked);
    c.onclick = null;
  } else if (vue === 'exporter') {
    c.innerHTML = `<h1>Exporter</h1>
      <button class="gros-bouton" data-ex="tout">${ic('image')}<span>Toutes les pages en images PNG<br><small>une image par page, dans le dossier choisi</small></span></button>
      <button class="gros-bouton" data-ex="une">${ic('image')}<span>Cette page en image PNG<br><small>page ${E.ip + 1}</small></span></button>
      <div class="grille-champs" style="max-width:360px;margin-top:8px"><span>Qualité</span><select id="ex-dpi" class="champ"><option value="150">Écran (150 ppp)</option><option value="300" selected>Impression (300 ppp)</option></select></div>
      <button class="gros-bouton" data-fmt="html">${ic('html')}<span>Page web autonome (.html)<br><small>un seul fichier, s'ouvre d'un double-clic et reste modifiable</small></span></button>
      <button class="gros-bouton" data-fmt="pagelibre">${ic('page')}<span>Document PageLibre (.pagelibre)<br><small>format ouvert (JSON) : pages, styles, images</small></span></button>
      <h2>Autres formats</h2>
      <p>PDF : <i>Imprimer / PDF</i>, imprimante « Enregistrer au format PDF ».</p>
      <p style="color:#777">L'enregistrement au format .pub n'est pas proposé : c'est un format propriétaire non documenté.</p>`;
    c.onclick = ev => {
      const f = ev.target.closest('[data-fmt]');
      if (f) { exporterFormat(f.dataset.fmt); return; }
      const b = ev.target.closest('[data-ex]');
      if (b) { fermerCoulisses(); exporterImages(b.dataset.ex === 'tout', +$('#ex-dpi').value); }
    };
  } else if (vue === 'apropos') {
    c.innerHTML = `<h1>À propos</h1>
      <div style="display:flex;gap:18px;align-items:center;margin-bottom:12px"><span style="width:64px;height:64px;display:inline-block">${LOGO_SVG}</span>
        <div><div style="font-size:24px;font-weight:600;color:#23405e">PageLibre</div><div style="color:#666">Version ${esc(VERSION_NOM)} (${esc(VERSION_EDITEUR.replace('T', ' à '))}) · <button class="lien-bouton" data-nouveautes>Quoi de neuf ?</button></div></div></div>
      <p>Logiciel libre et gratuit de mise en page : affiches, fiches, brochures, attestations. Il fonctionne dans le navigateur, s'installe comme une application et marche hors connexion.</p>
      <p><b>Vos documents restent sur votre appareil</b> : rien n'est envoyé sur Internet. <a href="confidentialite.html" target="_blank" rel="noopener">Confidentialité</a></p>
      <h2>Licence</h2>
      <p>PageLibre est distribué sous licence <b>GNU GPL version 3</b> : vous pouvez l'utiliser, l'étudier, le modifier et le redistribuer librement ; toute version modifiée diffusée doit rester libre.</p>
      ${DEPOT_URL ? `<p>Code source : <a href="${esc(DEPOT_URL)}" target="_blank" rel="noopener">${esc(DEPOT_URL)}</a></p>` : ''}
      ${LIEN_SOUTIEN ? `<p>Soutenir le projet : <a href="${esc(LIEN_SOUTIEN)}" target="_blank" rel="noopener">${esc(LIEN_SOUTIEN)}</a></p>` : ''}
      <h2>Compatibilité</h2>
      <p>PageLibre ouvre les fichiers .pub créés avec Microsoft Publisher (versions 2003 à 2019) pour qu'on puisse continuer à les modifier.</p>
      <p style="color:#777">PageLibre n'est pas affilié à Microsoft. Microsoft et Publisher sont des marques de Microsoft Corporation, citées uniquement pour indiquer la compatibilité des fichiers.</p>
      <h2>Composants libres intégrés</h2>
      <p>Polices Carlito, Caladea, Arimo et Tinos (SIL Open Font License 1.1, <a href="licence-polices.txt" target="_blank" rel="noopener">texte de la licence</a>) ; lecteur de PDF pdf.js de Mozilla (licence Apache 2.0), pour l'import des pages d'un PDF.</p>`;
    c.onclick = ev => { if (ev.target.closest('[data-nouveautes]')) afficherNouveautes(true); };
  } else if (vue === 'aide') {
    vueAide(c);
    c.onclick = null;
  } else {
    const nbObjets = E.fiche.pages.reduce((t, p) => t + p.items.length, 0);
    const poids = Object.values(E.fiche.images).reduce((t, u) => t + u.length * 0.75, 0);
    c.innerHTML = `<h1>Informations</h1>
      <div class="grille-champs" style="max-width:520px">
        <span>Titre</span><span><input type="text" id="inf-titre" class="champ" style="width:320px" value="${esc(E.fiche.titre)}"></span>
        <span>Fichier</span><span>${esc(E.nomFichier || '(pas encore enregistré)')}</span>
        <span>Format de page</span><span>${arrondi(P.w / 10, 1)} x ${arrondi(P.h / 10, 1)} cm</span>
        <span>Pages</span><span>${E.fiche.pages.length}</span>
        <span>Objets</span><span>${nbObjets}</span>
        <span>Images</span><span>${Object.keys(E.fiche.images).length} (${arrondi(poids / 1048576, 1)} Mo)</span>
      </div>
      <h2>Raccourcis utiles</h2>
      <p class="liste-infos">Ctrl+S enregistrer · Ctrl+Z / Ctrl+Y annuler / rétablir · Ctrl+C / X / V copier, couper, coller · Ctrl+D dupliquer · Suppr effacer l'objet<br>
      Clic sur un cadre sélectionné ou double-clic : écrire dans le cadre · Échap : sortir du texte · Maj en glissant : garder les proportions / déplacer droit · Alt : sans magnétisme<br>
      Ctrl+molette : zoom · F9 : 100 % · Ctrl+G / Ctrl+Maj+G : grouper / dissocier · Tableau : Tab pour la cellule suivante, Maj+clic pour choisir plusieurs cellules</p>`;
    $('#inf-titre').onchange = ev => { const t = ev.target.value.trim(); if (t) { avant(); E.fiche.titre = t; apres(); } };
    c.onclick = null;
  }
}

/* ---------------- démarrage ---------------- */
function initCadre() {
  $('#onglets').addEventListener('click', ev => { const o = ev.target.closest('.onglet'); if (o) activerOnglet(o.dataset.onglet); });
  $('#onglets').addEventListener('mousedown', ev => { if (E.edition && ev.target.closest('.onglet:not(.onglet-fichier)')) ev.preventDefault(); });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('#barre-titre [data-cmd], #etat [data-cmd], #coulisses [data-cmd]');
    if (b) commande(b.dataset.cmd);
    const v = ev.target.closest('.coul-item[data-vue]');
    if (v) afficherVueCoulisses(v.dataset.vue);
  });
  $('#etat').addEventListener('mousedown', ev => { if (ev.target.closest('button')) ev.preventDefault(); });
  $('#curseur-zoom').addEventListener('input', ev => definirZoom(+ev.target.value / 100));
  const lp = $('#liste-pages');
  lp.addEventListener('click', ev => { const v = ev.target.closest('.vignette'); if (v) allerPage(+v.dataset.index); });
  lp.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    const v = ev.target.closest('.vignette');
    if (v) allerPage(+v.dataset.index);
    ouvrirMenu({ x: ev.clientX, y: ev.clientY }, [
      { lib: 'Insérer une page', ic: 'page16', act: () => insererPage(false) },
      { lib: 'Dupliquer la page', ic: 'dupliquer', act: () => insererPage(true) },
      { lib: 'Supprimer la page', ic: 'supprimer', act: supprimerPage, off: E.fiche.pages.length < 2 },
      '-',
      { lib: 'Déplacer vers le haut', act: () => deplacerPage(-1), off: E.ip === 0 },
      { lib: 'Déplacer vers le bas', act: () => deplacerPage(1), off: E.ip === E.fiche.pages.length - 1 }
    ]);
  });
  window.addEventListener('beforeunload', ev => {
    if (E.modifie) { sauverBrouillon(); ev.preventDefault(); ev.returnValue = ''; }
  });
}

function demarrer() {
  capturerModele();
  try { Object.assign(E.options, JSON.parse(localStorage.getItem('pagelibre-options') || '{}')); } catch (e) { /* */ }
  let fiche = null;
  try { fiche = JSON.parse($('#fiche-integree').textContent); } catch (e) { fiche = null; }
  E.fiche = normaliserFiche(fiche || ficheVierge(210, 297, 'Nouvelle fiche'));
  construireRuban();
  initCadre();
  initInteractions();
  initGuides();
  initDepot();
  initPWA();
  initPlus4();
  chargerFiche(E.fiche,{ nom: fiche ? decodeURIComponent(location.pathname.split('/').pop() || '') : null });
  appliquerOptions();
  noterOutil(!!fiche);
  if (fiche) proposerNouvelleVersion();
  else reprendreTransfert().then(repris => { if (!repris) proposerBrouillon(); });
}

document.addEventListener('DOMContentLoaded', demarrer);
