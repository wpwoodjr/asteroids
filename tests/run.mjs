#!/usr/bin/env node
// Test runner: serves the repo on localhost and drives headless Chromium over the
// DevTools protocol. Each test gets its own server and a fresh browser profile.
//
//   node tests/run.mjs                 # all tests
//   node tests/run.mjs physics mouse   # selected tests
//
// Needs python3 and Chromium (override with CHROME=/path/to/chrome).
// Node 22+ has WebSocket built in; on Node 20/21 run with --experimental-websocket.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const CHROME = process.env.CHROME || 'chromium';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (typeof WebSocket === 'undefined') {
  console.error('This Node has no WebSocket. Use Node 22+, or run: node --experimental-websocket tests/run.mjs');
  process.exit(2);
}

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(fn, timeoutMs, what) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {}
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

async function startServer() {
  const port = await freePort();
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  await waitFor(async () => (await fetch(`${base}/asteroids.html`)).ok, 10000, 'web server');
  return { base, stop: () => proc.kill() };
}

async function launchBrowser() {
  const port = await freePort();
  const profile = mkdtempSync(path.join(tmpdir(), 'asteroids-test-'));
  const proc = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
  const target = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    return list.find((t) => t.type === 'page');
  }, 15000, 'Chromium');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const ev = async (expression, { userGesture = false } = {}) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
    if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description || 'evaluation failed');
    return res.result?.result?.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');

  const close = () => {
    try { ws.close(); } catch (e) {}
    proc.kill();
    setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
  };
  return { send, ev, close };
}

// In-page tests (tests/page/*.js) run inside the game page. They report by setting
// window.__testResults (array of "PASS ..."/"FAIL ..." lines) and window.__testDone.
function pageTest(file, phases = [null]) {
  return async ({ send, ev, base }) => {
    const source = readFileSync(path.join(here, 'page', file), 'utf8');
    await send('Page.addScriptToEvaluateOnNewDocument', { source });
    const lines = [];
    for (const phase of phases) {
      await send('Page.navigate', { url: `${base}/asteroids.html${phase ? `?phase=${phase}` : ''}` });
      await waitFor(() => ev('window.__testDone === true'), 20000, `${file} to finish`);
      lines.push(...(await ev('window.__testResults')));
    }
    return lines;
  };
}

const TESTS = {
  regression: pageTest('regression.js'),
  physics: pageTest('physics.js'),
  mouse: pageTest('mouse.js'),
  settings: pageTest('settings.js', ['set', 'check']),
  fullscreen: async (ctx) => (await import('./cdp/fullscreen.mjs')).default(ctx),
  pwa: async (ctx) => (await import('./cdp/pwa.mjs')).default(ctx)
};

const selected = process.argv.slice(2);
const unknown = selected.filter((n) => !TESTS[n]);
if (unknown.length) {
  console.error(`Unknown test(s): ${unknown.join(', ')}. Available: ${Object.keys(TESTS).join(', ')}`);
  process.exit(2);
}

let passed = 0;
let failed = 0;
for (const name of selected.length ? selected : Object.keys(TESTS)) {
  const server = await startServer();
  const browser = await launchBrowser();
  let lines;
  try {
    lines = await TESTS[name]({ ...browser, base: server.base, stopServer: server.stop, sleep });
  } catch (e) {
    lines = [`ERROR ${e.stack || e}`];
  } finally {
    browser.close();
    server.stop();
  }
  console.log(`\n${name}`);
  for (const line of lines) {
    console.log(`  ${line}`);
    if (line.startsWith('PASS')) passed++;
    else if (line.startsWith('FAIL') || line.startsWith('ERROR')) failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
