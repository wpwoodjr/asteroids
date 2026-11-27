#!/usr/bin/env node
// Saves a screenshot of the game at a given window size, for checking a layout:
//
//   node --experimental-websocket tools/screenshot.mjs out.png 883x689 [options]
//
// Options:
//   --dpr=2.4375          device pixel ratio (default 1; the PNG is at device pixels)
//   --strip=32            a gesture bar this tall at the bottom (a safe-area inset)
//   --buttons=small       the pause menu's Buttons choice (auto, large, small)
//   --place=sides         the pause menu's Place choice (auto, sides, below)
//   --shape=portrait      the pause menu's Shape choice (auto, landscape, portrait)
//   --play                start a game first
//   --pause               start a game and pause it (shows the pause menu)
//   --diag                open the diagnostics panel
//   --js='code'           run this in the page before the screenshot
//   --page=other.html     a page other than asteroids.html
// It also prints the layout picked (as the diagnostics panel's first lines).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser, sleep } from './browser.mjs';

const args = process.argv.slice(2);
const option = (name) => { const a = args.find((x) => x === `--${name}` || x.startsWith(`--${name}=`)); return a && (a.includes('=') ? a.slice(a.indexOf('=') + 1) : true); };
const [out, size] = args.filter((a) => !a.startsWith('--'));
if (!out || !/^\d+x\d+$/.test(size || '')) {
  console.error('usage: tools/screenshot.mjs out.png WIDTHxHEIGHT [--dpr=N] [--strip=N] [--buttons=X] [--place=X] [--shape=X] [--play|--pause] [--diag] [--js=CODE]');
  process.exit(2);
}
const [width, height] = size.split('x').map(Number);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const b = await browser(root);
await b.open(option('page') || 'asteroids.html', { width, height, dpr: +(option('dpr') || 1), strip: +(option('strip') || 0) });
const choices = { buttonSize: option('buttons') || 'auto', buttonPlace: option('place') || 'auto', viewShape: option('shape') || 'auto' };
await b.ev(`(() => { const g = window.__asteroidsGameInstance;
  for (const [key, value] of Object.entries(${JSON.stringify(choices)})) g.setLayoutChoice(key, value); })()`);
if (option('play') || option('pause')) await b.ev('window.__asteroidsGameInstance.startGame()');
if (option('pause')) await b.ev('window.__asteroidsGameInstance.togglePause()');
if (option('js')) await b.ev(option('js'));
if (option('diag')) {
  await b.ev(`(() => { const logo = document.getElementById('brand-logo');
    for (let i = 0; i < 3; i++) logo.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); })()`);
}
await sleep(1200);
await b.screenshot(out);
console.log(await b.ev(`(() => { const g = window.__asteroidsGameInstance, t = document.getElementById('touch-controls'), f = document.getElementById('game-frame').getBoundingClientRect();
  return 'playfield ' + Math.round(f.width) + 'x' + Math.round(f.height) + ' ' + (g.rotated ? '3:4' : '4:3') + ', buttons '
    + (t.classList.contains('sides') ? 'at the sides' : t.classList.contains('two-row') ? 'below, two rows' : 'below, one row')
    + (t.classList.contains('small') ? ', small' : t.classList.contains('big') ? ', big' : '')
    + (g.splitHeader ? ', header beside' : '') + (g.noFooter ? ', no footer' : ''); })()`));
console.log(`saved ${out}`);
b.close();
