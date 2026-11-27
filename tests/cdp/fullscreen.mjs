// Fullscreen button / F key visibility across browser, fullscreen-PWA and standalone modes.
// Headless Chromium can't emulate display-mode, so a controllable fake
// '(display-mode: fullscreen)' query is installed before the page's scripts run.
export default async function ({ send, ev, base, sleep }) {
  const out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const hidden = `({ btn: document.getElementById('btn-fullscreen').classList.contains('hidden'),
                     help: document.getElementById('help-fullscreen-key').classList.contains('hidden'),
                     pause: document.getElementById('btn-pause-fullscreen').classList.contains('hidden') })`;

  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    (() => {
      const real = window.matchMedia.bind(window);
      const listeners = [];
      const fake = { matches: false, media: '(display-mode: fullscreen)',
                     addEventListener: (t, f) => listeners.push(f), removeEventListener() {} };
      window.__setDisplayFullscreen = (v) => { fake.matches = v; listeners.forEach((f) => f({ matches: v })); };
      window.matchMedia = (q) => q.includes('display-mode: fullscreen') ? fake : real(q);
    })();` });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);

  let h = await ev(hidden);
  ok('browser tab: button + help shown, and in the pause menu', !h.btn && !h.help && !h.pause, JSON.stringify(h));

  await ev('__setDisplayFullscreen(true)');
  h = await ev(hidden);
  ok('fullscreen PWA: button + help hidden (live update), and in the pause menu', h.btn && h.help && h.pause, JSON.stringify(h));
  ok('F key ignored in fullscreen PWA', await ev(`(() => {
    let called = false;
    const orig = document.documentElement.requestFullscreen;
    document.documentElement.requestFullscreen = () => { called = true; return Promise.resolve(); };
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF' }));
    document.documentElement.requestFullscreen = orig;
    return !called;
  })()`));

  await ev('__setDisplayFullscreen(false)');
  h = await ev(hidden);
  ok('standalone window: button shown again', !h.btn && !h.help && !h.pause, JSON.stringify(h));

  await ev(`document.getElementById('btn-fullscreen').click()`, { userGesture: true });
  await sleep(800);
  const fs = await ev('!!document.fullscreenElement');
  h = await ev(hidden);
  ok('in API fullscreen: button still shown so it can exit', fs && !h.btn, `fullscreen=${fs}`);
  const status = () => ev(`document.getElementById('fullscreen-status').textContent`);
  ok('pause menu says Fullscreen: On', (await status()) === 'ON');
  // The pause menu's Fullscreen button turns it off (and on) too
  await ev(`document.getElementById('btn-pause-fullscreen').click()`, { userGesture: true });
  await sleep(800);
  ok('pause menu Fullscreen button leaves fullscreen, and says Off', !(await ev('!!document.fullscreenElement')) && (await status()) === 'OFF');
  await ev(`document.getElementById('btn-pause-fullscreen').click()`, { userGesture: true });
  await sleep(800);
  ok('pause menu Fullscreen button enters fullscreen again', (await ev('!!document.fullscreenElement')) && (await status()) === 'ON');
  await ev('document.exitFullscreen()');
  await sleep(500);

  ok('no Fullscreen API (iPhone): hidden', await ev(`(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
    const r = !window.__asteroidsGameInstance.canToggleFullscreen();
    delete document.fullscreenEnabled;
    return r;
  })()`));
  return out;
}
