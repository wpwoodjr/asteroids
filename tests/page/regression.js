// Regression checks for the code-review fixes and planet scoring rules.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const key = (type, code, key, repeat = false) => window.dispatchEvent(new KeyboardEvent(type, { code, key, repeat }));
  const ok = (name, cond) => out.push((cond ? 'PASS ' : 'FAIL ') + name);
  try {
    // Held Space (auto-repeat) must not restart from game over
    g.startGame(); g.triggerGameOver();
    key('keydown', 'Space', ' ', true);
    ok('repeat Space keeps GAMEOVER', g.state === 'GAMEOVER');
    key('keydown', 'Space', ' ', false);
    ok('fresh Space restarts', g.state === 'PLAYING');

    // Space with Scores open on the start screen does nothing
    g.state = 'START';
    document.getElementById('screen-scores').classList.remove('hidden');
    key('keydown', 'Space', ' ');
    ok('Space behind Scores modal ignored', g.state === 'START');
    document.getElementById('screen-scores').classList.add('hidden');

    // Held keys are released on pause
    g.startGame();
    key('keydown', 'KeyW', 'w'); key('keydown', 'KeyA', 'a');
    ok('thrust held', g.keys.thrust && g.keys.left);
    g.togglePause();
    ok('keys cleared on pause', !g.keys.thrust && !g.keys.left);
    g.togglePause();

    // Asteroid swallowed by the planet: no fragments, costs its points, score floors at 0
    if (!g.gravityMode) g.toggleGravity();
    const sentinel = g.createAsteroid(50, 50, 'small', 1); sentinel.vx = sentinel.vy = 0;
    g.asteroids = [g.createAsteroid(g.planet.x, g.planet.y, 'large', 1), sentinel];
    g.ufo = null; g.ufoSpawnTimer = 99;
    g.score = 500; const before = g.score; g.update(0.016); g.update(0.016);
    ok('crushed large: no fragments, -20', g.asteroids.length === 1 && g.score - before === -20);
    g.score = 5; g.asteroids = [g.createAsteroid(g.planet.x, g.planet.y, 'small', 1), sentinel]; g.update(0.016);
    ok('score floors at zero', g.score === 0);

    // Saucer crashing into the planet: no score change; shooting one still scores
    g.score = 300; g.spawnUfo(); g.ufo.x = g.planet.x; g.ufo.y = g.planet.y; g.update(0.016);
    ok('crashed UFO: gone, score unchanged', !g.ufo && g.score === 300);
    g.spawnUfo(); const pts = g.ufo.points; g.destroyUfo();
    ok('shot UFO still scores', g.score === 300 + pts);

    // Planet animation uses elapsed time and freezes while paused
    const r0 = g.planet.rot; g.loop(g.lastTime + 1000 / 30);
    const r1 = g.planet.rot; g.lastTime = performance.now();
    const expected = 2 * [0, 0.012, 0.02, 0.03][g.gravityLevel];
    ok('planet rot uses elapsed time', Math.abs((r1 - r0) - expected) < 1e-6);
    g.togglePause(); const r2 = g.planet.rot; g.loop(g.lastTime + 16);
    ok('planet frozen while paused', g.planet.rot === r2);
    g.togglePause();

    // Leaderboard names are rendered as text, not HTML
    localStorage.setItem('asteroids_leaderboard', JSON.stringify([{ name: '<b>X</b>', score: 5, wave: 1 }]));
    g.renderLeaderboard();
    ok('leaderboard name is text', document.querySelector('#leaderboard-list span:nth-child(2)').textContent === '<b>X</b>'
       && !document.querySelector('#leaderboard-list b'));
    localStorage.removeItem('asteroids_leaderboard');

    ok('touch toggle removed', !document.getElementById('btn-touch-toggle'));
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
