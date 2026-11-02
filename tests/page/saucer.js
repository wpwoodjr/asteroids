// Saucers, following the arcade original: when they appear, which size, how they
// move, how often they fire, and how they aim. Timers are in 4-frame ticks.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const U = ARCADE_VEL_UNIT;
  const deg = (r) => (r * 180 / Math.PI).toFixed(1) + '°';
  const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const realRandom = Math.random;
  const still = (x, y) => { const a = g.createAsteroid(x, y, 'small'); a.vx = 0; a.vy = 0; return a; };
  // A quiet field: one parked asteroid far from the ship, nothing else
  const reset = () => {
    g.startGame();
    g.asteroids = [still(60, 60)];
    g.ship.invulnerable = 999;
  };
  // Run whole frames, clearing saucer bullets so they can't hit anything
  const step = (sec) => {
    for (let t = 0; t < sec - 1e-9; t += 1 / 60) { g.ufoBullets = []; g.update(1 / 60); }
  };
  try {
    // First saucer after 146 ticks (~9.7 s) with no asteroids destroyed
    reset();
    step(9.6);
    const early = !g.ufo;
    step(0.25);
    ok('first saucer appears after ~9.7 s', early && !!g.ufo);
    ok('saucer speed is 16 units (~117 px/s)', Math.abs(Math.abs(g.ufo.vx) - 16 * U) < 1e-9, Math.abs(g.ufo.vx).toFixed(1));
    ok('enters at a side edge', g.ufo.vx > 0 ? g.ufo.x < 20 : g.ufo.x > g.width - 20, g.ufo.x.toFixed(0));

    // Leaves at the far edge; the next one comes after the reload time
    g.ufo.x = g.ufo.vx > 0 ? g.width - 1 : 1;
    step(1 / 30);
    ok('leaves at the far edge', !g.ufo);
    ok('next saucer waits the reload time', g.ufoSpawnTimer === g.saucerReload, `${g.ufoSpawnTimer} ticks`);

    // Size: first three are large, then random by reload, always small at 30,000+
    reset();
    const sizes = [];
    for (let i = 0; i < 3; i++) {
      g.ufoSpawnTimer = 1; g.saucerTick(); sizes.push(g.ufo.isSmall ? 'S' : 'L'); g.removeUfo();
    }
    ok('first three saucers are large', sizes.join('') === 'LLL', sizes.join(''));
    ok('reload shortens by 6 per saucer', g.saucerReload === 128, `${g.saucerReload}`);
    Math.random = () => 0.99; // random byte 253 > 122/2
    g.ufoSpawnTimer = 1; g.saucerTick();
    const fourthSmall = g.ufo.isSmall; g.removeUfo();
    g.saucerReload = 128;
    Math.random = () => 0.1;  // random byte 25 <= 122/2
    g.ufoSpawnTimer = 1; g.saucerTick();
    const fourthLarge = !g.ufo.isSmall; g.removeUfo();
    Math.random = realRandom;
    ok('after that, size depends on a random byte vs half the reload', fourthSmall && fourthLarge);
    g.saucerReload = 128; g.score = 30000;
    Math.random = () => 0.1;
    g.ufoSpawnTimer = 1; g.saucerTick();
    Math.random = realRandom;
    ok('always small at 30,000+ points', g.ufo.isSmall);
    g.removeUfo(); g.score = 0;
    g.saucerReload = 35; g.ufoSpawnTimer = 1; g.saucerTick(); g.removeUfo();
    ok('reload never drops below 32', g.saucerReload === 35);

    // Busy shooting asteroids holds saucers back unless few asteroids remain
    reset();
    ok('rock threshold is 6 on wave 1', g.maxRocksForUfo === 6);
    g.createWave(2); g.createWave(3);
    ok('rock threshold grows by 1 per wave', g.maxRocksForUfo === 8);
    for (let w = 4; w <= 9; w++) g.createWave(w);
    ok('rock threshold caps at 10', g.maxRocksForUfo === 10);
    reset();
    g.asteroids = Array.from({ length: 6 }, (_, i) => still(60 + i * 30, 60));
    g.asteroidHitTimer = 80; g.ufoSpawnTimer = 1; g.saucerTick();
    ok('no saucer while shooting with many rocks left', !g.ufo && g.ufoSpawnTimer === 18);
    g.asteroids = g.asteroids.slice(0, 3);
    g.ufoSpawnTimer = 1; g.saucerTick();
    ok('saucer comes when few rocks remain', !!g.ufo);
    g.removeUfo();
    g.asteroids = Array.from({ length: 6 }, (_, i) => still(60 + i * 30, 60));
    g.asteroidHitTimer = 0; g.ufoSpawnTimer = 1; g.saucerTick();
    ok('saucer comes when you have not hit a rock for ~5.3 s', !!g.ufo);
    g.removeUfo();
    g.asteroids = [still(300, 300), still(60, 60)];
    g.bullets = [{ x: 300, y: 300, vx: 0, vy: 0, life: 1 }];
    g.checkCollisions();
    ok('destroying an asteroid sets the 80-tick hold', g.asteroidHitTimer === 80);

    // Movement: vertical speed changes to -16, 0 or +16 units; wraps top to bottom
    reset();
    g.spawnUfo(); g.ufo.x = 500;
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      g.ufo.dirTicks = 1; g.ufo.shootCooldown = 999; g.saucerTick();
      seen.add(Math.round(g.ufo.vy / U));
    }
    ok('vertical moves are -16, 0 or +16 units', [...seen].sort((a, b) => a - b).join() === '-16,0,16', [...seen].join());
    g.ufo.vy = -16 * U; g.ufo.y = 1; g.ufo.dirTicks = 999;
    step(1 / 30);
    ok('wraps from top to bottom', g.ufo && g.ufo.y > g.height - 10, g.ufo && g.ufo.y.toFixed(0));
    g.removeUfo();

    // Firing: first shot after 18 ticks (1.2 s), then every 10 ticks (~0.67 s)
    reset();
    g.spawnUfo(); g.ufo.x = 500; g.ufo.y = 100; g.ufo.vx = 0; g.ufo.dirTicks = 1e9;
    const shotTicks = [];
    for (let tick = 1; tick <= 40; tick++) {
      g.ufoBullets = [];
      g.saucerTick();
      if (g.ufoBullets.length) shotTicks.push(tick);
    }
    ok('shots at ticks 18, 28, 38', shotTicks.join() === '18,28,38', shotTicks.join());
    g.hyperspace();
    g.ufo.shootCooldown = 1; g.ufoBullets = []; g.saucerTick();
    ok('holds fire while the ship is in hyperspace', g.ufoBullets.length === 0);
    g.removeUfo();

    // Large saucer: random directions
    reset();
    g.spawnUfo(); g.ufo.isSmall = false; g.ufo.x = 300; g.ufo.y = 200; g.ufo.vx = 0; g.ufo.vy = 0; g.ufo.dirTicks = 1e9;
    const toShip = Math.atan2(g.ship.y - 200, g.ship.x - 300);
    let wide = 0;
    for (let i = 0; i < 200; i++) {
      g.ufoBullets = []; g.ufo.shootCooldown = 1; g.saucerTick();
      const b = g.ufoBullets[0];
      if (angleDiff(Math.atan2(b.vy, b.vx), toShip) > Math.PI / 2) wide++;
    }
    ok('large saucer fires in random directions', wide > 60, `${wide}/200 shots more than 90° off`);
    g.removeUfo();

    // Small saucer aim: toward the ship, corrected by half its velocity, +/- error
    const smallShots = (score, n = 300) => {
      reset(); g.score = score;
      g.spawnUfo(); g.ufo.isSmall = true; g.ufo.x = 300; g.ufo.y = 200; g.ufo.vx = 16 * U; g.ufo.vy = 0; g.ufo.dirTicks = 1e9;
      g.ship.x = 700; g.ship.y = 500;
      const toUnits = 8192 / 1000 / 64;
      const ideal = Math.round(Math.atan2((500 - 200) * toUnits, (700 - 300) * toUnits - 8) / (2 * Math.PI) * 256) / 256 * 2 * Math.PI;
      let worst = 0;
      for (let i = 0; i < n; i++) {
        g.ufoBullets = []; g.ufo.shootCooldown = 1; g.saucerTick();
        const b = g.ufoBullets[0];
        // Remove the inherited saucer velocity to get the aimed direction
        worst = Math.max(worst, angleDiff(Math.atan2(b.vy - g.ufo.vy, b.vx - g.ufo.vx), ideal));
      }
      g.removeUfo();
      return worst;
    };
    const low = smallShots(0), high = smallShots(40000);
    ok('small saucer error up to ±22.5° below 35,000', low <= 16 / 256 * 2 * Math.PI + 1e-9 && low > 15 / 256 * 2 * Math.PI - 1e-9, deg(low));
    ok('small saucer error up to ±11.25° from 35,000', high <= 8 / 256 * 2 * Math.PI + 1e-9 && high > 7 / 256 * 2 * Math.PI - 1e-9, deg(high));

    // Small saucer doesn't aim across the screen wrap
    reset(); g.score = 0;
    g.spawnUfo(); g.ufo.isSmall = true; g.ufo.x = 980; g.ufo.y = 300; g.ufo.vx = 0; g.ufo.vy = 0; g.ufo.dirTicks = 1e9;
    g.ship.x = 20; g.ship.y = 300;
    Math.random = () => 0.5; // zero aim error
    g.ufoBullets = []; g.ufo.shootCooldown = 1; g.saucerTick();
    Math.random = realRandom;
    const wrapShot = g.ufoBullets[0];
    ok('small saucer aims the long way, not across the wrap', wrapShot.vx < 0, `vx ${wrapShot.vx.toFixed(0)}`);
    g.removeUfo();
  } catch (e) { out.push('ERROR ' + e.stack); }
  Math.random = realRandom;
  window.__testResults = out;
  window.__testDone = true;
}, 300));
