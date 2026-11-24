/* =====================================================================
   Mascotte animée, à droite du bandeau bleu : elle marche sur le bord du ruban.
   Discrète : dans son couloir de 200 px (elle ne couvre rien), sans son ni message, et on peut la masquer
   (Affichage › Mascotte, ou clic droit dessus).
   Légère : un seul minuteur à la fois, des gestes courts, aucun mouvement en boucle, rien du tout
   quand elle est masquée, quand la fenêtre n'est pas visible, ou une fois endormie depuis cinq minutes.
   ===================================================================== */
const MASCOTTE = {
  BAILLE: 60000, DORT: 180000, IMMOBILE: 480000, // sans rien faire : bâille à 1 min, s'endort à 3 min, ne bouge plus à 8 min
  NOTE: 1600,                                    // range son crayon 1,6 s après la dernière lettre
  BALADE: [20000, 45000],                        // une petite scène toutes les 20 à 45 s, jamais pendant la frappe
  COULOIR: 132, VITESSE: 38,                     // course utile (px) et pas (px par seconde)
  assezLarge: matchMedia('(min-width: 1000px)'), // fenêtre étroite : la place va au titre (même seuil dans mascotte.css)
  peuDeMouvement: matchMedia('(prefers-reduced-motion: reduce)'),
  el: null, perso: null, etat: 'repos', minuteur: 0, dernier: 0, frappe: 0, baille: false,
  x: 132, y: 0, trajet: null, suite: [], prochaine: 0, scene: -1,
  // attitudes : [pose, yeux, bouche, effet, geste, regard, durée]
  GESTES: {
    repos: ['debout', 'yeux', 'sourire', '', '', ''],
    cligne: ['debout', 'yeux', 'sourire', '', 'cligne', '', 250],
    regarde: ['debout', 'yeux', 'sourire', '', '', 'page', 2500],                // un objet est choisi
    gauche: ['debout', 'yeux', 'sourire', '', '', 'gauche', 1300],
    droite: ['debout', 'yeux', 'sourire', '', '', 'droite', 1300],
    ecrit: ['ecrit', 'yeux', 'petite', '', '', 'bas'],
    fier: ['debout', 'joyeux', 'sourire', 'eclats', 'saute', '', 1800],          // document enregistré
    montre: ['debout', 'joyeux', 'sourire', 'eclats', 'montre', '', 2200],       // PDF, Word, images, impression
    content: ['debout', 'joyeux', 'sourire', '', 'saute', '', 1300],             // image ou page ajoutée
    surpris: ['debout', 'ronds', 'oh', '', 'sursaute', '', 1300],                // suppression
    oups: ['debout', 'yeux', 'oups', 'goutte', 'non', '', 1500],                 // annulation, erreur
    coucou: ['debout', 'joyeux', 'sourire', '', 'coucou', '', 1500],             // clic dessus
    baille: ['debout', 'clos', 'baille', 'larme', 'etire', '', 2000],
    dort: ['dort', 'clos', 'petite', 'zzz', 'respire', '']
  },
  // petites scènes du bandeau ; chaque étape : [ce qu'elle fait, valeur]
  SCENES: [
    () => [['va', Math.round(Math.random() * 90)], ['geste', 'cligne'], ['geste', 'droite']],                                           // petite balade
    () => [['va', 0], ['geste', 'gauche'], ['geste', 'content'], ['va', 132]],                                                         // va lire le message de sauvegarde
    () => [['y', 60], ['attend', 1400], ['y', 24], ['geste', 'gauche'], ['geste', 'droite'], ['y', 0], ['geste', 'coucou']],            // cache-cache derrière le ruban
    () => [['va', 205], ['attend', 1200], ['va', 120], ['geste', 'content']],                                                          // sort à droite et revient
    () => [['va', 60], ['geste', 'gauche'], ['va', 100], ['geste', 'cligne'], ['va', 30], ['geste', 'droite'], ['va', 132]]             // fait les cent pas
  ]
};

function masquerOuAfficherMascotte() {
  const m = MASCOTTE;
  if (!m.el) return;
  m.el.hidden = E.options.mascotte === false;
  $('#app').classList.toggle('avec-mascotte', !m.el.hidden);
  clearTimeout(m.minuteur);
  if (mascotteVisible()) poserMascotte('repos');
}
// sans mesurer la page : un calcul de mise en page à chaque lettre ralentirait la frappe
function mascotteVisible() { const m = MASCOTTE; return !!m.el && !m.el.hidden && !document.hidden && m.assezLarge.matches; }
function reposerScene() { const [a, b] = MASCOTTE.BALADE; MASCOTTE.prochaine = Date.now() + a + Math.random() * (b - a); }

/* ---------------- déplacements (transform seul : le reste de la page n'est pas redessiné) ---------------- */
function placerMascotte(x, y, duree) {
  const m = MASCOTTE;
  m.perso.style.transitionDuration = (duree || 0) + 'ms';
  m.perso.style.transform = `translate(${x}px, ${y}px)`;
  m.trajet = duree ? { x0: m.x, y0: m.y, t0: Date.now(), duree } : null;
  m.x = x;
  m.y = y;
}
// s'arrête à l'endroit où elle en est (lu seulement si un trajet est en cours)
function arreterMascotte() {
  const m = MASCOTTE;
  m.el.dataset.pas = '';
  if (!m.trajet) return;
  const p = new DOMMatrixReadOnly(getComputedStyle(m.perso).transform);
  placerMascotte(Math.round(p.m41), Math.round(p.m42), 0);
}

function poserMascotte(nom) {
  const m = MASCOTTE, [pose, yeux, bouche, effet, geste, regard, duree] = m.GESTES[nom];
  clearTimeout(m.minuteur);
  arreterMascotte();
  m.etat = nom;
  Object.assign(m.el.dataset, { pose, yeux, bouche, effet, geste, regard, temps: nom === 'ecrit' ? '1' : '' });
  m.minuteur = setTimeout(suiteMascotte, duree || (nom === 'ecrit' ? 260 : nom === 'dort' ? 2400 : 4000 + Math.random() * 5000));
}
// hors de vue (derrière le ruban ou sortie) : elle revient vite dans son couloir
function revenirMascotte() {
  const m = MASCOTTE, x = Math.max(0, Math.min(m.COULOIR, m.x));
  if (m.y || x !== m.x) placerMascotte(x, 0, m.peuDeMouvement.matches ? 0 : 250);
}

/* ---------------- scènes ---------------- */
function etapeMascotte() {
  const m = MASCOTTE, [quoi, v] = m.suite.shift();
  if (quoi === 'geste') return poserMascotte(v);
  clearTimeout(m.minuteur);
  arreterMascotte();
  const d = m.el.dataset;
  m.etat = 'scene';
  if (quoi === 'attend') { m.minuteur = setTimeout(suiteMascotte, v); return; }
  if (quoi === 'y') { placerMascotte(m.x, v, 450); m.minuteur = setTimeout(suiteMascotte, 500); return; }
  // marche
  const duree = Math.abs(v - m.x) / m.VITESSE * 1000;
  Object.assign(d, { pose: 'debout', yeux: 'yeux', bouche: 'sourire', effet: '', geste: '', temps: '', regard: v < m.x ? 'gauche' : 'droite', pas: '1' });
  placerMascotte(v, 0, duree);
  m.etat = 'marche';
  m.minuteur = setTimeout(suiteMascotte, 190);
}

// ce qu'elle fait ensuite, une fois le geste fini
function suiteMascotte() {
  const m = MASCOTTE, maintenant = Date.now();
  if (!mascotteVisible()) { m.suite = []; m.etat = 'cachee'; return; } // plus aucun minuteur : reprise à la prochaine action
  const calme = maintenant - m.dernier;
  if (m.etat === 'ecrit') {
    if (maintenant - m.frappe > m.NOTE) return poserMascotte('repos');
    if (!m.peuDeMouvement.matches) m.el.dataset.temps = String(+m.el.dataset.temps % 3 + 1);
    m.minuteur = setTimeout(suiteMascotte, 260);
    return;
  }
  if (m.etat === 'marche') {
    if (m.trajet && maintenant - m.trajet.t0 < m.trajet.duree) {
      m.el.dataset.pas = m.el.dataset.pas === '1' ? '2' : '1';
      m.minuteur = setTimeout(suiteMascotte, 190);
      return;
    }
    m.el.dataset.pas = '';
    placerMascotte(m.x, m.y, 0);
  }
  if (m.suite.length) return etapeMascotte();
  revenirMascotte();
  if (calme > m.DORT) {
    if (m.etat !== 'dort') return poserMascotte('dort');
    clearTimeout(m.minuteur);
    const respire = m.el.dataset.geste === 'respire';
    m.el.dataset.geste = respire ? '' : 'respire';
    if (!respire || calme < m.IMMOBILE) m.minuteur = setTimeout(suiteMascotte, respire ? 5000 : 2400);
    return;
  }
  if (calme > m.BAILLE && !m.baille) { m.baille = true; return poserMascotte('baille'); }
  if (m.etat !== 'repos') return poserMascotte('repos');
  // une petite scène de temps en temps, tant que quelqu'un est là ; jamais deux fois la même à la suite
  if (maintenant > m.prochaine && calme < m.BAILLE && !m.peuDeMouvement.matches) {
    reposerScene();
    m.scene = (m.scene + 1 + Math.floor(Math.random() * (m.SCENES.length - 1))) % m.SCENES.length;
    m.suite = m.SCENES[m.scene]();
    return etapeMascotte();
  }
  poserMascotte('cligne');
}

// appelée par l'éditeur : mascotte('fier'), mascotte('surpris')…
function mascotte(nom) {
  const m = MASCOTTE;
  if (!m.el || !mascotteVisible()) return;
  m.dernier = Date.now();
  m.baille = false;
  if (nom === 'ecrit') { m.frappe = m.dernier; if (m.etat === 'ecrit') return; }
  // un simple regard ne coupe ni un geste ni une scène
  if (nom === 'regarde' && (m.suite.length || !['repos', 'cligne', 'regarde', 'dort', 'cachee'].includes(m.etat))) return;
  m.suite = [];
  poserMascotte(nom);
  revenirMascotte();
  // enregistré : elle va voir le message, puis revient
  if (nom === 'fier' && !m.peuDeMouvement.matches) { m.suite = [['va', 0], ['geste', 'gauche'], ['va', m.COULOIR]]; reposerScene(); }
}

function activiteMascotte() {
  const m = MASCOTTE;
  m.dernier = Date.now();
  m.baille = false;
  if (m.etat === 'dort' && mascotteVisible()) { reposerScene(); poserMascotte('surpris'); } // réveil
  else if (m.etat === 'cachee' && mascotteVisible()) { poserMascotte('repos'); revenirMascotte(); }
}

function initMascotte() {
  const m = MASCOTTE;
  const el = document.createElement('div');
  el.id = 'mascotte';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="m-perso" title="Clic droit : masquer la mascotte">${MASCOTTE_SVG}</div>`;
  $('#barre-titre').appendChild(el);
  m.el = el;
  m.perso = el.firstElementChild;
  m.dernier = Date.now();
  reposerScene();
  placerMascotte(m.COULOIR, 0, 0);
  el.addEventListener('mousedown', ev => ev.preventDefault()); // ne pas faire perdre le curseur au texte en cours
  el.addEventListener('click', () => mascotte('coucou'));
  el.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    ouvrirMenu({ x: ev.clientX, y: ev.clientY }, [{ lib: 'Masquer la mascotte (Affichage pour la remettre)', act: () => { E.options.mascotte = false; appliquerOptions(); } }]);
  });
  // écoute seulement : jamais de calcul pendant la frappe
  for (const t of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(t, activiteMascotte, { capture: true, passive: true });
  document.addEventListener('input', ev => { if (ev.target.isContentEditable) mascotte('ecrit'); }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(m.minuteur); m.suite = []; m.etat = 'cachee'; } else activiteMascotte(); });
}
