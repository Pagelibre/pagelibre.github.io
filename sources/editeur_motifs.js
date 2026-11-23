/* =====================================================================
   Remplissage à motif (hachures) : formes, zones de texte, cellules de tableau.
   Un motif = 8 × 8 points, écrits en 16 chiffres hexadécimaux (une ligne = 2 chiffres,
   bit de poids fort à gauche) dans la forme : { couleur, fondMotif, points }.
   Les points à 1 prennent la couleur de premier plan (couleur), les autres celle d'arrière-plan (fondMotif).
   ===================================================================== */
const MOTIFS = (() => {
  const bayer = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  const hexa = fn => { let s = ''; for (let y = 0; y < 8; y++) { let o = 0; for (let x = 0; x < 8; x++) if (fn(x, y)) o |= 128 >> x; s += o.toString(16).padStart(2, '0'); } return s; };
  const l = [];
  const ajout = (nom, fn) => l.push({ nom, points: typeof fn === 'string' ? fn : hexa(fn) });
  // hachures et lignes
  ajout('Hachures montantes', (x, y) => ((x + y) & 7) === 7);
  ajout('Hachures descendantes', (x, y) => ((x - y) & 7) === 0);
  ajout('Hachures montantes serrées', (x, y) => ((x + y) & 3) === 3);
  ajout('Hachures descendantes serrées', (x, y) => ((x - y) & 3) === 0);
  ajout('Hachures montantes épaisses', (x, y) => ((x + y) & 3) >= 2);
  ajout('Hachures descendantes épaisses', (x, y) => ((x - y) & 3) < 2);
  ajout('Hachures montantes larges', (x, y) => ((x + y) & 7) >= 5);
  ajout('Hachures descendantes larges', (x, y) => ((x - y) & 7) < 3);
  ajout('Lignes verticales', x => (x & 7) === 3);
  ajout('Lignes horizontales', (x, y) => (y & 7) === 3);
  ajout('Lignes verticales serrées', x => (x & 3) === 0);
  ajout('Lignes horizontales serrées', (x, y) => (y & 3) === 0);
  ajout('Lignes verticales fines', x => (x & 1) === 0);
  ajout('Lignes horizontales fines', (x, y) => (y & 1) === 0);
  ajout('Lignes verticales épaisses', x => (x & 3) < 2);
  ajout('Lignes horizontales épaisses', (x, y) => (y & 3) < 2);
  // tirets
  ajout('Tirets montants', (x, y) => ((x + y) & 3) === 3 && y < 4);
  ajout('Tirets descendants', (x, y) => ((x - y) & 3) === 0 && y < 4);
  ajout('Tirets horizontaux', (x, y) => (y === 0 && x < 4) || (y === 4 && x >= 4));
  ajout('Tirets verticaux', (x, y) => (x === 0 && y < 4) || (x === 4 && y >= 4));
  // quadrillages et croisillons
  ajout('Quadrillage', (x, y) => x === 0 || y === 0);
  ajout('Quadrillage serré', (x, y) => (x & 3) === 0 || (y & 3) === 0);
  ajout('Quadrillage pointillé', (x, y) => (x === 0 && !(y & 1)) || (y === 0 && !(x & 1)));
  ajout('Croisillons', (x, y) => ((x + y) & 7) === 7 || ((x - y) & 7) === 0);
  ajout('Croisillons serrés', (x, y) => ((x + y) & 3) === 3 || ((x - y) & 3) === 0);
  ajout('Croisillons pointillés', (x, y) => !(y & 1) && (((x + y) & 7) === 0 || ((x - y) & 7) === 0));
  ajout('Petit damier', (x, y) => ((x >> 1) + (y >> 1)) & 1);
  ajout('Grand damier', (x, y) => ((x >> 2) + (y >> 2)) & 1);
  ajout('Losanges pleins', (x, y) => Math.abs(x - 3.5) + Math.abs(y - 3.5) < 4);
  // points
  ajout('Points', (x, y) => (x & 3) === 1 && (y & 3) === 1);
  ajout('Points décalés', (x, y) => (x === 1 && y === 1) || (x === 5 && y === 5));
  ajout('Gros points', '003c7e7e7e7e3c00');
  ajout('Confettis', '8010024000080120');
  ajout('Gros confettis', 'c0c30c0c3030c303');
  // matières
  ajout('Briques', (x, y) => (y & 3) === 3 || x === (y < 4 ? 7 : 3));
  ajout('Briques en diagonale', '0102040818244281');
  ajout('Zigzag', (x, y) => (y & 3) === (x < 4 ? x : 7 - x));
  ajout('Vagues', '0000182503c00000');
  ajout('Tissage', '8854224588152251');
  ajout('Écailles', '0304081830c08181');
  // trames (pourcentage de points de premier plan)
  for (const p of [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]) ajout('Trame ' + p + ' %', (x, y) => bayer[y * 8 + x] < p * 64 / 100);
  return l;
})();

function apercuMotif(points, couleur, fond, cote) {
  return `<svg viewBox="0 0 16 16" width="${cote}" height="${cote}" shape-rendering="crispEdges" aria-hidden="true"><rect width="16" height="16" fill="${esc(fond)}"/>${[[0, 0], [8, 0], [0, 8], [8, 8]].map(([x, y]) => `<path transform="translate(${x} ${y})" d="${Rendu.cheminMotif(points)}" fill="${esc(couleur)}"/>`).join('')}</svg>`;
}
// couleur utilisable par un sélecteur de couleur (#rrggbb)
const couleurHex = (c, defaut) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : defaut);

// boîte « Motif » : surOK reçoit { couleur, fondMotif, points }, ou null pour « aucun motif »
function boiteMotif(actuel, surOK) {
  const a = actuel || {};
  let choisi = a.points || MOTIFS[0].points;
  // motif repris d'un .pub, absent de la grille : proposé en premier
  const liste = a.points && !MOTIFS.some(m => m.points === a.points) ? [{ nom: 'Motif actuel', points: a.points }, ...MOTIFS] : MOTIFS;
  ouvrirBoite('Remplissage à motif', `<div class="grille-motifs" id="mo-grille" role="listbox" aria-label="Motifs"></div>
    <div class="grille-champs" style="margin-top:10px"><span>Premier plan</span><input type="color" id="mo-1" value="${couleurHex(a.points ? a.couleur : null, '#000000')}">
      <span>Arrière-plan</span><input type="color" id="mo-2" value="${couleurHex(a.points ? a.fondMotif : a.couleur, '#ffffff')}">
      <span>Aperçu</span><span id="mo-apercu"></span></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="mo-aucun"> Retirer le motif (remplissage uni, couleur d'arrière-plan)</label>`, () => {
    const c1 = $('#mo-1').value, c2 = $('#mo-2').value;
    surOK($('#mo-aucun').checked ? null : { couleur: c1, fondMotif: c2, points: choisi }, c2);
  });
  const dessiner = () => {
    const c1 = $('#mo-1').value, c2 = $('#mo-2').value;
    $('#mo-grille').innerHTML = liste.map((m, i) => `<button type="button" role="option" data-m="${i}" title="${esc(m.nom)}" aria-label="${esc(m.nom)}" aria-selected="${m.points === choisi}">${apercuMotif(m.points, c1, c2, 32)}</button>`).join('');
    $('#mo-apercu').innerHTML = [0, 1, 2, 3].map(() => apercuMotif(choisi, c1, c2, 32)).join('');
  };
  $('#mo-grille').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; choisi = liste[+b.dataset.m].points; $('#mo-aucun').checked = false; dessiner(); const n = $(`#mo-grille [data-m="${b.dataset.m}"]`); if (n) n.focus(); });
  $('#mo-1').addEventListener('input', dessiner);
  $('#mo-2').addEventListener('input', dessiner);
  dessiner();
}

function motifFormes() {
  const cibles = () => selection().filter(o => o.type === 'forme' || o.type === 'texte');
  const objs = cibles();
  if (!objs.length) { alerte('Sélectionnez une forme ou une zone de texte (pour un tableau : onglet Disposition › Motif).'); return; }
  const f = objs[0].fond || {};
  boiteMotif({ couleur: f.couleur, fondMotif: f.fondMotif, points: Rendu.pointsMotif(f, E.fiche) }, (m, uni) => {
    quitterEdition();
    avant();
    for (const o of cibles()) { const op = o.fond && o.fond.opacite; o.fond = m ? Object.assign({}, m) : { couleur: uni }; if (op != null) o.fond.opacite = op; redessinerObjet(o); }
    apres();
  });
}
function motifCellules() {
  const o = selection().find(x => x.type === 'tableau');
  if (!o) { alerte('Cliquez d\'abord dans une cellule du tableau.'); return; }
  // les cellules visées sont mémorisées : la boîte fait perdre le curseur
  const vises = E.cellules.length ? [...E.cellules] : E.celluleActive != null ? [E.celluleActive] : o.tableau.cellules.map((c, i) => i);
  const c0 = o.tableau.cellules[vises[0]] || {};
  boiteMotif(c0.motif || { couleur: c0.fond }, (m, uni) => {
    quitterEdition();
    avant();
    for (const i of vises) { const c = o.tableau.cellules[i]; if (!c) continue; if (m) { c.motif = Object.assign({}, m); delete c.fond; } else { if (c.motif) c.fond = uni; delete c.motif; } }
    redessinerObjet(o);
    apres();
  });
}
Object.assign(COMMANDES, { motif: motifFormes, motifCellules });
