/* =====================================================================
   PageLibre : application installable (PWA)
   - service worker (fonctionne hors connexion, mise à jour proposée) ;
   - bouton « Installer l'application » ;
   - fichiers .pagelibre et .pub ouverts par double-clic une fois installée.
   Rien n'est actif quand la page est ouverte comme fichier local (file://).
   ===================================================================== */
const EN_LIGNE = /^https?:$/.test(location.protocol);

function initPWA() {
  // installation
  let invite = null;
  const bouton = $('#bouton-installer');
  window.addEventListener('beforeinstallprompt', ev => {
    ev.preventDefault();
    invite = ev;
    if (bouton) bouton.hidden = false;
  });
  if (bouton) bouton.onclick = async () => {
    if (!invite) return;
    invite.prompt();
    await invite.userChoice.catch(() => null);
    invite = null;
    bouton.hidden = true;
  };
  window.addEventListener('appinstalled', () => { if (bouton) bouton.hidden = true; });

  // fichiers ouverts depuis l'Explorateur (application installée)
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async params => {
      const h = params.files && params.files[0];
      if (!h) return;
      try {
        const f = await h.getFile();
        noterRecent(h);
        ouvrirFichier(f, /\.(pagelibre|html?)$/i.test(f.name) ? h : null);
      } catch (e) { alerte('Impossible d\'ouvrir ce fichier.'); }
    });
  }

  // service worker
  if (!EN_LIGNE || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const proposer = w => {
      const bd = $('#bandeau');
      bd.dataset.type = 'maj';
      bd.innerHTML = '<span>Nouvelle version de PageLibre disponible.</span><button class="bouton principal" data-r>Recharger</button><button class="bouton" data-p>Plus tard</button>';
      bd.hidden = false;
      $('[data-p]', bd).onclick = () => { bd.hidden = true; };
      $('[data-r]', bd).onclick = () => {
        if (E.modifie) sauverBrouillon();
        w.postMessage('activer');
      };
    };
    if (reg.waiting && navigator.serviceWorker.controller) proposer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) proposer(w);
      });
    });
    // vérifie les mises à jour toutes les heures si l'application reste ouverte
    setInterval(() => reg.update().catch(() => {}), 3600 * 1000);
  }).catch(e => console.warn('Service worker non enregistré', e));
  let recharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recharge) return;
    recharge = true;
    location.reload();
  });
}

/* ---------------- format natif .pagelibre (JSON) ---------------- */
function jsonFiche() {
  nettoyerImages();
  return JSON.stringify(Object.assign({ application: 'PageLibre', versionApplication: VERSION_EDITEUR }, E.fiche));
}
// format proposé par défaut : document .pagelibre en ligne, page web autonome en local
function formatParDefaut() { return EN_LIGNE ? 'pagelibre' : 'html'; }
