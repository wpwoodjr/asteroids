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
    const sentinel = g.createAsteroid(50, 50, 'small'); sentinel.vx = sentinel.vy = 0;
    g.asteroids = [g.createAsteroid(g.planet.x, g.planet.y, 'large'), sentinel];
    g.ufo = null; g.ufoSpawnTimer = 99;
    g.score = 500; const before = g.score; g.update(0.016); g.update(0.016);
    ok('crushed large: no fragments, -20', g.asteroids.length === 1 && g.score - before === -20);
    g.score = 5; g.asteroids = [g.createAsteroid(g.planet.x, g.planet.y, 'small'), sentinel]; g.update(0.016);
    ok('score floors at zero', g.score === 0);

    // Saucer crashing into the planet: no score change; shooting one still scores
    g.score = 300; g.spawnUfo(); g.ufo.x = g.planet.x; g.ufo.y = g.planet.y; g.update(0.016);
    ok('crashed UFO: gone, score unchanged', !g.ufo && g.score === 300);
    g.spawnUfo(); const pts = g.ufo.points; g.destroyUfo();
    ok('shot UFO still scores', g.score === 300 + pts);

    // Planet animation uses elapsed time and freezes while paused
    const r0 = g.planet.rot; g.loop(g.lastTime + 1000 / 30);
    const r1 = g.planet.rot; g.lastTime = performance.now();
    const expected = ARCADE_FPS / 30 * [0, 0.012, 0.02, 0.03][g.gravityLevel];
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

    // Fills the whole screen, including beside a camera cutout in a fullscreen app
    ok('page may use the cutout area (viewport-fit=cover)',
       /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]').content));
    ok('page fills the screen without scrolling', document.documentElement.scrollHeight <= innerHeight + 1,
       `${document.documentElement.scrollHeight} / ${innerHeight}`);

    // Thrust sound plays only while the ship is actually thrusting, and comes back
    // with a new ship when thrust is held through the respawn
    const calls = [];
    const realStart = g.sound.startThrust, realStop = g.sound.stopThrust;
    g.sound.startThrust = () => calls.push('start');
    g.sound.stopThrust = () => calls.push('stop');
    g.startGame(); g.asteroids = []; g.nextWaveTimer = 1e9;
    const sounding = () => calls[calls.length - 1] === 'start';
    key('keydown', 'KeyW', 'w'); g.update(0.016);
    ok('thrust sound starts with thrust', sounding());
    g.onShipDeath(); g.update(0.016);
    ok('thrust sound stops when the ship explodes', !sounding());
    g.ship.deadTimer = 0.001; g.update(0.016);
    ok('thrust sound returns after respawn while still held', g.isShipActive() && sounding());
    g.hyperspace(); g.ship.hyperDoomed = false; g.update(0.016);
    ok('no thrust sound in hyperspace', !sounding());
    g.ship.hyperTimer = 0.001; g.update(0.016);
    ok('thrust sound back after hyperspace', sounding());
    g.togglePause();
    ok('thrust sound stops on pause', !sounding());
    g.togglePause(); key('keyup', 'KeyW', 'w');
    g.sound.startThrust = realStart; g.sound.stopThrust = realStop;

    // Losing the last ship: the game carries on with GAME OVER showing for a few seconds
    // (rocks drift, shots in flight still score, no extra ship), then the game over screen
    g.startGame(); g.ufo = null; g.lives = 1;
    localStorage.removeItem('asteroids_leaderboard');
    const rock = g.asteroids[0], rockX = rock.x;
    g.score = 9990; g.lastExtraLifeScore = 0;
    g.onShipDeath();
    ok('last ship lost: game keeps running', g.state === 'PLAYING' && g.gameOverTimer > 0);
    for (let t = 0; t < 2.5; t += 0.05) g.update(0.05);
    ok('rocks keep drifting', rock.x !== rockX);
    g.score += 20; g.update(0.05);
    ok('no ship comes back, even with an extra ship earned', g.state === 'PLAYING' && !g.isShipActive() && g.lives === 0);
    g.render();
    ok('no ship drawn or targeted after its timer runs out', g.ship === null);
    ok('game over screen not shown yet', document.getElementById('screen-game-over').classList.contains('hidden'));
    for (let t = 0; t < 1; t += 0.05) g.update(0.05);
    ok('game over screen after the delay', g.state === 'GAMEOVER' &&
       !document.getElementById('screen-game-over').classList.contains('hidden'));
    ok('final score includes shots that landed after the last ship', JSON.parse(localStorage.getItem('asteroids_leaderboard'))
      .some((e) => e.name === 'YOU' && e.score === 10010));
    localStorage.removeItem('asteroids_leaderboard'); localStorage.removeItem('asteroids_high_score');
    g.highScore = 0;

    // Losing the last ship to the planet (gravity mode) mid-update didn't crash the game
    const gravity = g.gravityLevel;
    g.setGravityLevel(2, false);
    g.startGame(); g.ufo = null; g.asteroids = []; g.lives = 1;
    g.ship.x = g.planet.x; g.ship.y = g.planet.y - g.planet.radius - 5; g.ship.vx = g.ship.vy = 0;
    let crashError = null;
    try { g.update(0.016); } catch (e) { crashError = e; }
    ok('last ship lost to the planet: no crash, game over countdown runs', !crashError && g.ship === null && g.gameOverTimer > 0,
      crashError ? String(crashError) : '');
    g.setGravityLevel(gravity, false);
    g.togglePause();

    // Browser shortcuts and held toggle keys
    const gravityBefore = g.gravityLevel, themeBefore = currentThemeIdx;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG', key: 'g', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c', metaKey: true }));
    ok('Ctrl/Cmd shortcuts are left to the browser', g.gravityLevel === gravityBefore && currentThemeIdx === themeBefore);
    key('keydown', 'KeyG', 'g');
    const gravityPressed = g.gravityLevel;
    key('keydown', 'KeyG', 'g', true); key('keydown', 'KeyG', 'g', true);
    ok('holding G changes gravity once', gravityPressed !== gravityBefore && g.gravityLevel === gravityPressed);
    g.setGravityLevel(gravityBefore, false); g.persistSettings();

    // A slow frame (the 0.1 s cap) is simulated in small steps, so a bullet can't jump
    // past a small asteroid
    let hits = 0;
    for (let n = 0; n < 10; n++) {
      g.startGame(); g.ufo = null;
      Object.assign(g.ship, { x: 300, y: 375, angle: 0, vx: 0, vy: 0 });
      g.asteroids = [g.createAsteroid(340, 375, 'small')];
      g.asteroids[0].vx = g.asteroids[0].vy = 0;
      g.fireBullet();
      g.loop(g.lastTime + 100);
      if (g.asteroids.length === 0 || g.asteroids[0].size !== 'small' || g.score > 0) hits++;
    }
    ok('slow frames don\'t let bullets pass through asteroids', hits === 10, `${hits}/10`);
    g.togglePause();
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
