// Idle CPU: the frame loop runs only while playing. The start, paused and game over
// screens are drawn once and then left alone until something visible changes.
window.addEventListener('load', () => setTimeout(async () => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let renders = 0;
  const realRender = g.render.bind(g);
  g.render = () => { renders++; realRender(); };
  const count = async (ms) => { renders = 0; await wait(ms); return renders; };
  try {
    ok('start screen: no redraws while idle', (await count(800)) === 0, `${renders} in 0.8 s`);
    const pixel = () => [...g.ctx.getImageData(0, 0, g.canvas.width, g.canvas.height).data].some((v, i) => i % 4 !== 3 && v > 20);
    ok('start screen: the playfield is still drawn', pixel());

    renders = 0; g.cycleTheme(); await wait(200);
    ok('changing the palette redraws the idle screen', renders >= 1 && renders <= 3, `${renders} redraws`);
    renders = 0; window.dispatchEvent(new Event('resize')); await wait(200);
    ok('resizing redraws the idle screen', renders >= 1 && renders <= 3, `${renders} redraws`);
    ok('then it goes idle again', (await count(500)) === 0, `${renders} in 0.5 s`);

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

    g.triggerGameOver();
    await wait(100);
    ok('game over: no redraws', (await count(500)) === 0, `${renders} in 0.5 s`);
  } catch (e) { out.push('ERROR ' + e.stack); }
  g.render = realRender;
  window.__testResults = out;
  window.__testDone = true;
}, 500));
