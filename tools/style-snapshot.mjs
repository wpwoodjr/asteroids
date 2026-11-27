// Records how every element on the page looks, in each of the game's screens and at
// several window sizes: its position and size on screen and its visual computed styles
// (with buttons hovered and pressed too). For checking that a CSS change changes nothing
// it shouldn't (or only what it should):
//
//   node --experimental-websocket tools/style-snapshot.mjs before.json
//   ...change the CSS or the classes...
//   node --experimental-websocket tools/style-snapshot.mjs after.json
//   node tools/style-snapshot.mjs --compare before.json after.json
//
// Elements are matched by their place in the page (id, or tag and position under the
// nearest parent with an id), so the page's structure must stay the same.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'box-sizing',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'outline-style', 'outline-width', 'outline-color', 'outline-offset',
  'color', 'background-color', 'background-image', 'opacity', 'visibility', 'filter',
  'box-shadow', 'text-shadow', 'transform', 'translate', 'scale', 'transform-origin',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-align', 'text-transform', 'text-decoration-line', 'white-space', 'vertical-align', 'list-style-type',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'justify-content', 'align-items',
  'align-self', 'justify-items', 'row-gap', 'column-gap', 'order',
  'grid-template-columns', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
  'overflow-x', 'overflow-y', 'cursor', 'pointer-events', 'user-select', 'touch-action',
  'transition-property', 'transition-duration', 'transition-timing-function',
  'animation-name', 'animation-duration', 'animation-timing-function', 'animation-iteration-count',
  'container-type', '-webkit-tap-highlight-color', 'tab-size'
];

// Runs in the page: every element's key, rectangle and styles
const SNAPSHOT = `(() => {
  // Animations at their start and transitions at their end, so values don't depend on time
  for (const a of document.getAnimations()) {
    if (a instanceof CSSTransition) a.finish(); else { a.pause(); a.currentTime = 0; }
  }
  const props = ${JSON.stringify(PROPS)};
  const key = (el) => {
    const parts = [];
    for (let e = el; e; e = e.parentElement) {
      if (e.id) { parts.unshift('#' + e.id); break; }
      if (!e.parentElement) { parts.unshift(e.tagName.toLowerCase()); break; }
      parts.unshift(e.tagName.toLowerCase() + ':' + [...e.parentElement.children].indexOf(e));
    }
    return parts.join('>');
  };
  const out = {};
  for (const el of document.querySelectorAll('html, body, body *')) {
    if (el.closest('#diagnostics, script, style')) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), o = {};
    o.rect = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100).join(',');
    for (const p of props) o[p] = cs.getPropertyValue(p);
    // (a border that isn't there has no style or color worth comparing)
    for (const side of ['top', 'right', 'bottom', 'left']) {
      if (o['border-' + side + '-width'] === '0px') { delete o['border-' + side + '-style']; delete o['border-' + side + '-color']; }
    }
    if (o['outline-style'] === 'none') { delete o['outline-width']; delete o['outline-color']; delete o['outline-offset']; }
    out[key(el)] = o;
  }
  return out;
})()`;

// The screens, each set up from the start screen of a freshly loaded page
const g = 'window.__asteroidsGameInstance';
const SETUP = `(() => { const g = ${g};
  try { localStorage.clear(); } catch (e) {}
  g.highScores = [loadHighScore(0), loadHighScore(1)];
  g.bestGames = [{ score: 16000, name: 'ABC', frames: '', events: [], gravity: 0 }, null];
  g.lastGame = g.bestGames[0];
  g.updateReplayButtons(); g.updateHighScoreDisplays(); })()`;
const hideMenus = `document.querySelectorAll('[id^=screen-]').forEach((o) => o.classList.add('hidden'))`;
const STATES = {
  start: '0',
  'start-gravity': `${g}.toggleGravity()`,
  settings: `document.getElementById('btn-start-settings').click()`,
  pause: `${g}.startGame(); ${g}.togglePause()`,
  'pause-muted': `${g}.startGame(); ${g}.togglePause(); ${g}.setAudioMuted(true)`,
  gameover: `(() => { const g = ${g}; g.startGame(); g.ufo = null; g.ufoSpawnTimer = 1e9; g.lives = 1;
    g.score = 20000; g.lastExtraLifeScore = 20000; g.onShipDeath();
    for (let t = 0; t < 3.2 && g.state === 'PLAYING'; t += 0.05) g.update(0.05); })()`,
  help: `document.getElementById('btn-help').click()`,
  scores: `(() => { const g = ${g}; g.startGame(); g.ufo = null; g.ufoSpawnTimer = 1e9; g.lives = 1;
    g.score = 9000; g.lastExtraLifeScore = 9000; g.onShipDeath();
    for (let t = 0; t < 3.2 && g.state === 'PLAYING'; t += 0.05) g.update(0.05);
    g.commitInitials(); document.getElementById('btn-game-over-scores').click(); })()`,
  'scores-gravity': `document.getElementById('btn-scores').click(); document.querySelector('[data-scores-tab="1"]').click()`,
  replay: `(() => { const g = ${g}; g.startGame(); for (let i = 0; i < 30; i++) g.update(0.016);
    const rec = { ...g.recording, score: 0, wave: 1 }; g.togglePause(); ${hideMenus};
    g.state = 'START'; document.getElementById('screen-start').classList.remove('hidden'); g.startReplay(rec, 'TEST'); })()`
};
const SIZES = [[883, 689, 0], [443, 746, 0], [961, 330, 0], [1280, 800, 0], [360, 740, 0]];
// Hovered and pressed buttons: at one size, on the screens with the most buttons
const PSEUDO = { size: [883, 689, 0], states: ['start', 'pause', 'gameover', 'scores'], pseudo: ['hover', 'active'] };

async function record(file) {
  const { browser, sleep } = await import('./browser.mjs');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const b = await browser(root);
  const result = {};
  const forcePseudo = async (classes) => {
    await b.send('DOM.enable'); await b.send('CSS.enable');
    const doc = (await b.send('DOM.getDocument', { depth: -1 })).result.root;
    const nodes = (await b.send('DOM.querySelectorAll', { nodeId: doc.nodeId, selector: 'button, input' })).result.nodeIds;
    for (const nodeId of nodes) await b.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: classes });
  };
  const runs = [];
  for (const [w, h, strip] of SIZES) for (const state of Object.keys(STATES)) runs.push([w, h, strip, state, null]);
  for (const state of PSEUDO.states) for (const pseudo of PSEUDO.pseudo) runs.push([...PSEUDO.size, state, pseudo]);
  for (const [w, h, strip, state, pseudo] of runs) {
    await b.open('asteroids.html', { width: w, height: h, dpr: 1, strip });
    await b.ev(SETUP);
    await b.ev(STATES[state]);
    await sleep(400);
    if (pseudo) { await forcePseudo([pseudo]); await sleep(300); }
    const name = `${w}x${h} ${state}${pseudo ? ' :' + pseudo : ''}`;
    result[name] = await b.ev(SNAPSHOT);
    if (!result[name]) throw new Error(`no snapshot for ${name}`);
    process.stderr.write(`${name}: ${Object.keys(result[name]).length} elements\n`);
  }
  b.close();
  writeFileSync(file, JSON.stringify(result));
}

function compare(beforeFile, afterFile) {
  const before = JSON.parse(readFileSync(beforeFile, 'utf8')), after = JSON.parse(readFileSync(afterFile, 'utf8'));
  // Differences, grouped by element and property, with the states they show up in
  const diffs = new Map();
  for (const state of Object.keys(before)) {
    const a = before[state], b = after[state];
    if (!b) { console.log(`missing state: ${state}`); continue; }
    for (const el of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!a[el] || !b[el]) { const k = `${el} | ${a[el] ? 'gone' : 'new'}`; diffs.set(k, [...(diffs.get(k) || []), state]); continue; }
      for (const p of new Set([...Object.keys(a[el]), ...Object.keys(b[el])])) {
        if (a[el][p] === b[el][p]) continue;
        const k = `${el} | ${p}: ${a[el][p] ?? '(none)'} -> ${b[el][p] ?? '(none)'}`;
        diffs.set(k, [...(diffs.get(k) || []), state]);
      }
    }
  }
  const total = Object.keys(before).length;
  for (const [k, states] of [...diffs].sort()) console.log(`${k}   [${states.length === total ? 'all' : states.join('; ')}]`);
  console.log(`${diffs.size} differences`);
}

const args = process.argv.slice(2);
if (args[0] === '--compare') compare(args[1], args[2]);
else if (args[0]) await record(args[0]);
else console.error('usage: tools/style-snapshot.mjs out.json | --compare before.json after.json');
