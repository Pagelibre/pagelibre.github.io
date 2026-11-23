// Lance tous les tests : node tests/tout.js [--pub "fiche.pub"]
// Sans --pub (par exemple sur GitHub), les tests qui ont besoin d'une vraie fiche .pub sont sautés :
// les fiches d'essai contiennent des documents de formation qui ne sont pas publiés.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const i = args.indexOf('--pub');
const pub = i >= 0 ? args[i + 1] : process.env.PAGELIBRE_PUB || null;
const ici = __dirname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pagelibre-tests-'));

// image EMF de test (Windows seulement : fabriquée par System.Drawing)
let emf = null;
if (process.platform === 'win32') {
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ici, 'fabriquer_metafichiers.ps1'), tmp], { encoding: 'utf8' });
  const f = fs.readdirSync(tmp).find(n => /\.emf$/i.test(n));
  if (f) emf = path.join(tmp, f); else console.log('EMF de test non fabriqué :', (r.stderr || '').trim());
}

const tests = [
  ['test_securite.js', []],
  ['test_pwa.js', [tmp]],
  ['test_molette.js', []],
  ['test_ajouts.js', [tmp]],
  ['test_fidelite.js', []],
  ['test_exports.js', []],
  ...(emf ? [['test_metafichier.js', [emf, path.join(tmp, 'emf.png')]], ['test_plus2.js', [emf, tmp]]] : []),
  ...(pub ? [['test_lecteur.js', [pub]], ['test_editeur.js', [pub, tmp]], ['test_plus.js', [pub, tmp]], ['test_plus3.js', [pub, tmp]]] : [])
].filter(([f]) => fs.existsSync(path.join(ici, f)));

let echecs = 0;
const bilan = [];
for (const [f, a] of tests) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(process.execPath, [path.join(ici, f), ...a], { stdio: 'inherit', timeout: 15 * 60000 });
  bilan.push(`${r.status === 0 ? 'ok    ' : 'ÉCHEC '} ${f}`);
  if (r.status !== 0) echecs++;
}
console.log('\n' + bilan.join('\n'));
if (!pub) console.log('(tests sur une vraie fiche .pub sautés : --pub "fiche.pub")');
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* */ }
process.exit(echecs ? 1 : 0);
