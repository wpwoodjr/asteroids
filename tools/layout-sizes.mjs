#!/usr/bin/env node
// Prints the layout resize() picks at a list of window sizes: the playfield's shape and
// size, where the touch buttons go and at what size, and whether the header and footer
// moved. For checking what a change to the layout rules does across devices.
//
//   node --experimental-websocket tools/layout-sizes.mjs [--buttons=large|small] [--place=sides|below] [--shape=landscape|portrait] [file.html]
//
// Each size is width x height at a device pixel ratio, optionally with a gesture-bar
// strip at the bottom (a safe-area inset). See browser.mjs for what it needs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './browser.mjs';

const SIZES = [
  // [width, height, dpr, gesture strip, what it is]
  [443, 746, 2.4375, 0, 'foldable outer screen, Chrome'],
  [443, 961, 2.4375, 0, 'outer screen, fullscreen'],
  [360, 740, 3, 0, 'small phone'],
  [411, 790, 2.625, 0, 'phone'],
  [467, 677, 1.77125, 0, ''],
  [600, 800, 2, 0, ''],
  [700, 800, 2, 0, ''],
  [768, 1024, 2, 0, 'tablet portrait'],
  [820, 1180, 2, 0, 'tablet portrait'],
  [735, 574, 2.925, 0, 'unfolded, Chrome at the stuck scale'],
  [735, 574, 2.925, 27, 'same, with its gesture strip'],
  [735, 663, 2.925, 0, ''],
  [852, 883, 2.4375, 0, 'unfolded, fullscreen'],
  [883, 852, 2.4375, 0, 'unfolded, fullscreen, turned'],
  [883, 689, 2.4375, 0, 'unfolded, Chrome'],
  [883, 689, 2.4375, 32, 'same, with its gesture strip'],
  [1100, 1100, 1, 0, ''],
  [790, 411, 2.625, 0, 'phone in landscape'],
  [961, 278, 2.4375, 0, 'outer screen sideways, Chrome'],
  [442, 296, 2.4375, 0, 'outer screen, Chrome, split with another app'],
  [961, 330, 2.4375, 0, ''],
  [883, 560, 2.4375, 0, ''],
  [1280, 800, 1, 0, 'laptop'],
  [1920, 1080, 1, 0, 'desktop'],
];

const args = process.argv.slice(2);
const option = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, 'asteroids.html'));

const b = await browser(path.dirname(file));
const choices = { buttonSize: option('buttons') || 'auto', buttonPlace: option('place') || 'auto', viewShape: option('shape') || 'auto' };
console.log(`buttons ${choices.buttonSize}, place ${choices.buttonPlace}, shape ${choices.viewShape}`);
for (const [width, height, dpr, strip, what] of SIZES) {
  await b.open(path.basename(file), { width, height, dpr, strip });
  const line = await b.ev(`(() => {
    const g = window.__asteroidsGameInstance, t = document.getElementById('touch-controls');
    for (const [key, value] of Object.entries(${JSON.stringify(choices)})) g.setLayoutChoice(key, value);
    const f = document.getElementById('game-frame').getBoundingClientRect();
    const buttons = (t.classList.contains('sides') ? 'sides' : t.classList.contains('two-row') ? 'below, two rows' : 'below, one row')
      + (t.classList.contains('small') ? ', small' : '') + (t.classList.contains('pill') ? ', pills' : '');
    return [g.rotated ? '3:4' : '4:3', (Math.round(f.width) + 'x' + Math.round(f.height)).padEnd(9), buttons.padEnd(29),
      (g.splitHeader ? 'header beside' : '').padEnd(13), (g.noFooter ? 'no footer' : '').padEnd(9),
      document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1 ? '' : 'OVERFLOW'].join('  ');
  })()`);
  console.log(`${width}x${height}${strip ? ` strip ${strip}` : ''}`.padEnd(19), line, what ? ` (${what})` : '');
}
b.close();
