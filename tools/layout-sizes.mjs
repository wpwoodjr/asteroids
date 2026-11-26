#!/usr/bin/env node
// Prints the layout resize() picks at a list of window sizes: the playfield's shape and
// size, where the touch buttons go and at what size, and whether the header and footer
// moved. For checking what a change to the layout rules does across devices.
//
//   node --experimental-websocket tools/layout-sizes.mjs [--buttons=large|small] [--shape=landscape|portrait] [file.html]
//
// Each size is width x height at a device pixel ratio, optionally with a gesture-bar
// strip at the bottom (a safe-area inset). Needs python3 and Chromium (CHROME=/path).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  [961, 330, 2.4375, 0, ''],
  [883, 560, 2.4375, 0, ''],
  [1280, 800, 1, 0, 'laptop'],
  [1920, 1080, 1, 0, 'desktop'],
];

const args = process.argv.slice(2);
const option = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const file = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, 'asteroids.html'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve) => {
  const srv = net.createServer().listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});
async function waitFor(fn, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) {} await sleep(150); }
  throw new Error(`Timed out waiting for ${what}`);
}
if (typeof WebSocket === 'undefined') {
  console.error('This Node has no WebSocket. Use Node 22+, or run with --experimental-websocket');
  process.exit(2);
}

// Serve the file's directory, and drive headless Chromium (muted) over the DevTools protocol
const serverPort = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1', '--directory', path.dirname(file)], { stdio: 'ignore' });
const url = `http://127.0.0.1:${serverPort}/${path.basename(file)}`;
const debugPort = await freePort();
const profile = mkdtempSync(path.join(tmpdir(), 'asteroids-sizes-'));
const chrome = spawn(process.env.CHROME || 'chromium', ['--headless=new', '--mute-audio', '--no-sandbox', '--disable-gpu',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore' });
// Stop the browser and server however this ends (including output piped into head)
const cleanUp = () => { chrome.kill(); server.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch (e) {} };
process.on('exit', cleanUp);
process.stdout.on('error', () => process.exit(0));
try {
  await waitFor(async () => (await fetch(url)).ok, 10000, 'web server');
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((t) => t.type === 'page'), 15000, 'Chromium');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
  const send = (method, params = {}) => new Promise((resolve) => { const id = ++nextId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

  const choices = { buttonSize: option('buttons') || 'auto', viewShape: option('shape') || 'auto' };
  console.log(`buttons ${choices.buttonSize}, shape ${choices.viewShape}`);
  for (const [w, h, dpr, strip, what] of SIZES) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: w < 1000 });
    await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: strip } });
    await send('Page.navigate', { url });
    await sleep(2500);
    const line = await ev(`(() => {
      const g = window.__asteroidsGameInstance, t = document.getElementById('touch-controls');
      g.buttonSize = ${JSON.stringify(choices.buttonSize)}; g.viewShape = ${JSON.stringify(choices.viewShape)}; g.resize();
      const f = document.getElementById('game-frame').getBoundingClientRect();
      const buttons = (t.classList.contains('sides') ? 'sides' : t.classList.contains('two-row') ? 'below, two rows' : 'below, one row')
        + (t.classList.contains('small') ? ', small' : t.classList.contains('big') ? ', big' : '');
      return [g.rotated ? '3:4' : '4:3', (Math.round(f.width) + 'x' + Math.round(f.height)).padEnd(9), buttons.padEnd(22),
        (g.splitHeader ? 'header beside' : '').padEnd(13), (g.noFooter ? 'no footer' : '').padEnd(9),
        document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1 ? '' : 'OVERFLOW'].join('  ');
    })()`);
    console.log(`${w}x${h}${strip ? ` strip ${strip}` : ''}`.padEnd(19), line, what ? ` (${what})` : '');
  }
  ws.close();
} finally {
  cleanUp();
}
