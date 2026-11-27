// Shared by the tools here: serves a directory on localhost and drives headless
// Chromium (muted) over the DevTools protocol, for looking at the game at a given
// window size. Needs python3 and Chromium (CHROME=/path); Node 22+ has WebSocket built
// in, and on Node 20/21 run with --experimental-websocket.
//
//   const b = await browser(dir);
//   await b.open('asteroids.html', { width, height, dpr, strip });   // strip: gesture bar (px)
//   await b.ev('window.__asteroidsGameInstance.rotated');
//   await b.screenshot('out.png');
//   b.close();
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve) => {
  const srv = net.createServer().listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});
async function waitFor(fn, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) {} await sleep(150); }
  throw new Error(`Timed out waiting for ${what}`);
}

export async function browser(dir) {
  if (typeof WebSocket === 'undefined') {
    console.error('This Node has no WebSocket. Use Node 22+, or run with --experimental-websocket');
    process.exit(2);
  }
  const serverPort = await freePort();
  const server = spawn('python3', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1', '--directory', dir], { stdio: 'ignore' });
  const debugPort = await freePort();
  const profile = mkdtempSync(path.join(tmpdir(), 'asteroids-tool-'));
  const chrome = spawn(process.env.CHROME || 'chromium', ['--headless=new', '--mute-audio', '--no-sandbox', '--disable-gpu',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore' });
  // Stop the browser and server however this ends (including output piped into head)
  const cleanUp = () => { chrome.kill(); server.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch (e) {} };
  process.on('exit', cleanUp);
  process.stdout.on('error', () => process.exit(0));

  await waitFor(async () => (await fetch(`http://127.0.0.1:${serverPort}/`)).ok, 10000, 'web server');
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((t) => t.type === 'page'), 15000, 'Chromium');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
  const send = (method, params = {}) => new Promise((resolve) => { const id = ++nextId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

  return {
    send, ev,
    // Load a page (a path inside dir) in a window of the given size; strip is the height
    // of a gesture bar at the bottom (a safe-area inset)
    async open(page, { width, height, dpr = 1, strip = 0 }) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: width < 1000 });
      await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: strip } });
      await send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/${page}` });
      await sleep(2500);
    },
    async screenshot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    },
    close() { ws.close(); cleanUp(); }
  };
}
