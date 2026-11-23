// Frame rates: while playing, every frame. The start and game over screens keep rocks
// drifting at about 30 fps (MENU_FPS), with one loop however often they're redrawn.
// A paused game is drawn once and then left alone until something visible changes.
window.addEventListener('load', () => setTimeout(async () => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let renders = 0;
  const realRender = g.render.bind(g);
  g.render = () => { renders++; realRender(); };
  const count = async (ms) => { renders = 0; await wait(ms); return renders; };
  try {
    const menu = await count(1000);
    ok('start screen: rocks drift at about 30 fps', menu >= 15 && menu <= 33, `${menu} in 1 s`);
    const startRocks = g.asteroids.map((a) => a.x + ',' + a.y).join();
    await wait(200);
    ok('start screen: the rocks move', g.asteroids.length > 0 && g.asteroids.map((a) => a.x + ',' + a.y).join() !== startRocks);
    const pixel = () => [...g.ctx.getImageData(0, 0, g.canvas.width, g.canvas.height).data].some((v, i) => i % 4 !== 3 && v > 20);
    ok('start screen: the playfield is still drawn', pixel());

    g.cycleTheme(); g.cycleTheme(); g.cycleTheme(); window.dispatchEvent(new Event('resize'));
    const after = await count(1000);
    ok('redraw requests on the start screen don\'t add a second loop', after >= 15 && after <= 33, `${after} in 1 s`);

    g.startGame();
    g.ship.invulnerable = 1e9;
    g.ufoSpawnTimer = 1e9;
    const playing = await count(500);
    ok('playing: draws every frame', playing >= 20, `${playing} in 0.5 s`);

    g.togglePause();
    await wait(100);
    ok('paused: no redraws', (await count(500)) === 0, `${renders} in 0.5 s`);
    g.togglePause();
    const resumed = await count(500);
    ok('resumed: draws every frame again', resumed >= 20, `${resumed} in 0.5 s`);
    ok('only one frame loop runs (no doubled speed)', resumed <= 40, `${resumed} in 0.5 s`);

    // Auto-pause: switching away (tab hidden) or another window taking focus
    ok('playing before switching away', g.state === 'PLAYING');
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    ok('tab hidden: game pauses', g.state === 'PAUSED' && !document.getElementById('screen-pause').classList.contains('hidden'));
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    ok('back on the tab: stays paused until you resume', g.state === 'PAUSED');
    g.togglePause();
    window.dispatchEvent(new Event('blur'));
    ok('window loses focus: game pauses', g.state === 'PAUSED');
    window.dispatchEvent(new Event('blur'));
    ok('losing focus again while paused: still paused', g.state === 'PAUSED');
    g.togglePause();

    // A game that ends during a frame (as it really does) keeps the loop going for the
    // game over screen's drifting rocks
    g.lives = 1; g.ship.invulnerable = 0; g.onShipDeath(); g.gameOverTimer = 0.05;
    g.requestRender();
    await wait(300);
    ok('the game ended on its own', g.state === 'GAMEOVER');
    const over = await count(1000);
    ok('game over: rocks drift at about 30 fps', over >= 15 && over <= 33, `${over} in 1 s`);
    g.state = 'PAUSED'; await wait(100);
    ok('a paused game is not redrawn', (await count(500)) === 0, `${renders} in 0.5 s`);
    g.state = 'GAMEOVER'; g.requestRender();
  } catch (e) { out.push('ERROR ' + e.stack); }
  g.render = realRender;
  window.__testResults = out;
  window.__testDone = true;
}, 500));
