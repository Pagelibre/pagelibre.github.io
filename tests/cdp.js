// Pilotage d'Edge sans fenêtre par le protocole CDP (sans puppeteer).
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

const attendre = ms => new Promise(r => setTimeout(r, ms));

async function lancer(options = {}) {
  const port = options.port || (9300 + Math.floor(Math.random() * 500));
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-pub-'));
  const largeur = options.largeur || 1400, hauteur = options.hauteur || 900;
  const proc = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`,
    '--allow-file-access-from-files', '--no-first-run', '--disable-gpu', ...(options.barres ? [] : ['--hide-scrollbars']), // barres : true → barres de défilement visibles, comme chez l'utilisateur
    `--window-size=${largeur},${hauteur}`, '--force-device-scale-factor=1', 'about:blank'
  ], { stdio: 'ignore' });
  let cible = null;
  for (let i = 0; i < 100 && !cible; i++) {
    await attendre(100);
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      cible = l.find(t => t.type === 'page');
    } catch (e) { /* pas encore prêt */ }
  }
  if (!cible) throw new Error('Edge ne répond pas');
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  let id = 0;
  const attente = new Map();
  const ecouteurs = [];
  const consoleMsgs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && attente.has(m.id)) {
      const { ok, ko } = attente.get(m.id);
      attente.delete(m.id);
      m.error ? ko(new Error(m.error.message)) : ok(m.result);
    } else if (m.method) {
      if (m.method === 'Runtime.consoleAPICalled') consoleMsgs.push(m.params.args.map(a => a.value ?? a.description).join(' '));
      if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
      for (const e of ecouteurs) e(m);
    }
  };
  const envoyer = (method, params = {}) => new Promise((ok, ko) => {
    const n = ++id;
    attente.set(n, { ok, ko });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  await envoyer('Runtime.enable');
  await envoyer('Page.enable');
  await envoyer('Emulation.setDeviceMetricsOverride', { width: largeur, height: hauteur, deviceScaleFactor: 1, mobile: false });

  const api = {
    envoyer,
    consoleMsgs,
    surEvenement(methode, fn) { ecouteurs.push(m => { if (m.method === methode) fn(m.params); }); },
    async ouvrir(url) {
      const charge = new Promise(r => { const f = m => { if (m.method === 'Page.loadEventFired') { ecouteurs.splice(ecouteurs.indexOf(f), 1); r(); } }; ecouteurs.push(f); });
      await envoyer('Page.navigate', { url });
      await charge;
      await attendre(200);
    },
    async eval(expr) {
      const r = await envoyer('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('JS : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async capture(fichier, clip) {
      const p = { format: 'png', captureBeyondViewport: true };
      if (clip) p.clip = Object.assign({ scale: 1 }, clip);
      const r = await envoyer('Page.captureScreenshot', p);
      fs.writeFileSync(fichier, Buffer.from(r.data, 'base64'));
    },
    async souris(type, x, y, extra = {}) {
      await envoyer('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1 }, extra));
    },
    async clic(x, y, n = 1) {
      for (let k = 1; k <= n; k++) {
        await api.souris('mousePressed', x, y, { clickCount: k });
        await api.souris('mouseReleased', x, y, { clickCount: k });
      }
      await attendre(60);
    },
    async glisser(x1, y1, x2, y2, etapes = 8) {
      await envoyer('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1, button: 'none' });
      await api.souris('mousePressed', x1, y1);
      for (let i = 1; i <= etapes; i++) await api.souris('mouseMoved', x1 + (x2 - x1) * i / etapes, y1 + (y2 - y1) * i / etapes);
      await api.souris('mouseReleased', x2, y2);
      await attendre(80);
    },
    async touche(key, code, modifiers = 0, texte) {
      const vk = { Delete: 46, Backspace: 8, Escape: 27, Enter: 13, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Tab: 9 }[key];
      const base = { key, code: code || key, modifiers, windowsVirtualKeyCode: vk || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0) };
      await envoyer('Input.dispatchKeyEvent', Object.assign({ type: texte ? 'keyDown' : 'rawKeyDown', text: texte }, base));
      await envoyer('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
      await attendre(40);
    },
    async taper(texte) {
      await envoyer('Input.insertText', { text: texte });
      await attendre(40);
    },
    async fermer() {
      // fermeture demandée au navigateur : tuer le seul processus lancé laissait tourner tous les autres
      try { await Promise.race([envoyer('Browser.close'), attendre(3000)]); } catch (e) { /* déjà fermé */ }
      try { ws.close(); } catch (e) { /* */ }
      for (let i = 0; i < 20; i++) {
        await attendre(150);
        try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) { /* profil encore verrouillé */ }
        if (!fs.existsSync(profil)) return;
      }
      proc.kill();
      // dernier recours (Windows) : les processus de ce profil d'essai, et eux seuls
      if (process.platform === 'win32') spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match '${path.basename(profil)}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`]);
      try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) { /* */ }
    }
  };
  return api;
}

module.exports = { lancer, attendre };
