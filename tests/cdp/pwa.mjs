// PWA: service worker, manifest, Chrome installability, and offline play
// (the web server is stopped partway through).
export default async function ({ send, ev, base, stopServer, sleep }) {
  const out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const url = `${base}/asteroids.html`;

  await send('Page.navigate', { url });
  await sleep(4000);
  const state = await ev('navigator.serviceWorker.ready.then((r) => r.active.state)');
  ok('service worker active', state === 'activated', state);
  await send('Page.reload');
  await sleep(3000);
  ok('page controlled by service worker', await ev('!!navigator.serviceWorker.controller'));

  const manifest = (await send('Page.getAppManifest')).result;
  ok('manifest parsed without errors', manifest.url && manifest.errors.length === 0, JSON.stringify(manifest.errors));
  const install = (await send('Page.getInstallabilityErrors')).result;
  ok('Chrome reports installable', install.installabilityErrors?.length === 0, JSON.stringify(install.installabilityErrors));

  const icons = await ev(`Promise.all(['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon.svg', 'icons/apple-touch-icon.png']
    .map((u) => fetch(u).then((r) => r.status)))`);
  ok('icons served', icons.every((s) => s === 200), JSON.stringify(icons));
  const cached = await ev(`caches.keys().then((names) => caches.open(names[0])).then((c) => c.keys())
    .then((reqs) => reqs.map((r) => r.url.replace(location.origin, '')))`);
  ok('app shell + CDN cached', cached.includes('/asteroids.html') && cached.some((u) => u.includes('tailwindcss')), `${cached.length} entries`);

  // Offline: stop the server and load again
  stopServer();
  await sleep(1000);
  await send('Page.navigate', { url });
  await sleep(3000);
  const offline = await ev(`({ title: document.title, game: !!window.__asteroidsGameInstance,
    tw: getComputedStyle(document.getElementById('screen-start')).position })`);
  ok('loads offline', offline?.game && offline.title.startsWith('Asteroids'), JSON.stringify(offline));
  ok('Tailwind styles work offline', offline?.tw === 'absolute', offline?.tw);
  await send('Page.navigate', { url: `${base}/` });
  await sleep(3000);
  ok('root URL works offline', await ev('!!window.__asteroidsGameInstance'));
  return out;
}
