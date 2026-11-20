/* =====================================================================
   Sécurité : un document ouvert ne contient que du texte mis en forme.
   Tout ce qui pourrait exécuter du code ou appeler Internet est retiré
   avant affichage (fichiers .pagelibre, .html, .json reçus de quelqu'un).
   Le HTML est analysé dans un document inerte : rien n'y est exécuté ni chargé.
   En complément, la page déclare une règle de sécurité (CSP, voir build.js)
   qui n'autorise que son propre code.
   ===================================================================== */
'use strict';
const DOC_INERTE = document.implementation.createHTMLDocument('');
const BALISES_INTERDITES = 'script,style,iframe,frame,frameset,object,embed,applet,link,meta,base,form,input,button,textarea,select,option,template,svg,math,audio,video,source,track,canvas,dialog,portal,noscript,xmp,plaintext,title,head,noembed,noframes';
const ATTRIBUTS_PERMIS = /^(class|style|title|alt|lang|dir|align|valign|colspan|rowspan|width|height|href|target|rel|src|face|color|size|start|type|reversed|contenteditable|spellcheck|role|data-[\w-]+|aria-[\w-]+)$/i;
// une image SVG affichée comme image (balise img, motif) n'exécute jamais son code : elle est permise
const IMAGE_SURE = /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml|x-emf|x-wmf)[;,]/i;

function lienSur(v) {
  const t = String(v).replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  if (/^(https?:|mailto:|tel:|#)/.test(t)) return true;
  return !/^[a-z][a-z0-9+.-]*:/.test(t); // adresse relative
}
// styles : seules les images intégrées sont permises dans url(...), rien d'exécutable
function styleSur(s) {
  let t = String(s).replace(/url\s*\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (m, q, u) => (IMAGE_SURE.test(u.trim()) ? m : 'none'));
  if (/expression\s*\(|javascript:|vbscript:|@import|behavior\s*:|-moz-binding|url\s*\(/i.test(t.replace(/url\s*\(\s*(['"]?)data:image\/[^)]*\)/gi, ''))) return null;
  return t;
}
function assainirArbre(racine) {
  racine.querySelectorAll(BALISES_INTERDITES).forEach(x => x.remove());
  for (const x of [...racine.querySelectorAll('*')]) {
    if (x.tagName === 'IMG' && !IMAGE_SURE.test(x.getAttribute('src') || '')) { x.remove(); continue; }
    for (const a of [...x.attributes]) {
      const n = a.name.toLowerCase();
      let garder = ATTRIBUTS_PERMIS.test(n);
      if (garder && n === 'href') garder = x.tagName === 'A' && lienSur(a.value);
      if (garder && n === 'src') garder = x.tagName === 'IMG';
      if (garder && n === 'contenteditable') garder = x.classList.contains('puce') || x.classList.contains('champ-page');
      if (garder && n === 'style') { const s = styleSur(a.value); if (s == null) garder = false; else if (s !== a.value) x.setAttribute('style', s); }
      if (!garder) x.removeAttribute(a.name);
    }
    if (x.tagName === 'A' && x.hasAttribute('href')) { x.setAttribute('rel', 'noopener noreferrer'); x.setAttribute('target', '_blank'); }
  }
}
function assainirHTML(html) {
  if (typeof html !== 'string' || !html) return html;
  const d = DOC_INERTE.createElement('div');
  d.innerHTML = html;
  assainirArbre(d);
  return d.innerHTML;
}

const CLES_HTML = new Set(['html', 'html2', 'htmlComplet']);
const COULEUR_SURE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,20}|transparent)$/i;
// parcourt tout le document : textes HTML, images, styles, polices
function assainirFiche(f) {
  const vus = new Set();
  (function parcourir(v) {
    if (!v || typeof v !== 'object' || vus.has(v)) return;
    vus.add(v);
    for (const k of Object.keys(v)) {
      const x = v[k];
      if (typeof x === 'string') {
        if (CLES_HTML.has(k)) v[k] = assainirHTML(x);
        else if (k === 'police' || k === 'titre' || k === 'texte' || k === 'nom') v[k] = x.replace(/[<>"'`\\{};]/g, k === 'police' ? '' : m => (m === '<' || m === '>' ? '' : m));
        else if (k === 'couleur' && !COULEUR_SURE.test(x.trim())) v[k] = '#000000';
        else if ((k === 'lien' || k === 'href') && !lienSur(x)) delete v[k];
      } else if (x && typeof x === 'object') parcourir(x);
    }
  })(f);
  // images intégrées : uniquement des images intégrées (data:image/…), jamais une adresse Internet
  if (f.images && typeof f.images === 'object') for (const k of Object.keys(f.images)) if (typeof f.images[k] !== 'string' || !IMAGE_SURE.test(f.images[k])) delete f.images[k];
  return f;
}
