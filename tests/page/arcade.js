// Rules taken from the 1979 arcade code: wave sizes, asteroid velocities, bullet
// velocity, hyperspace timing and failure, respawn, wave delay, saucer bullet limit.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const U = ARCADE_VEL_UNIT; // px/s per arcade velocity unit
  const units = (v) => Math.round(v / U);
  const realRandom = Math.random;
  // Run the game for `sec` seconds at 60 fps without saucer fire
  const step = (sec) => {
    for (let t = 0; t < sec - 1e-9; t += 1 / 60) { g.ufoBullets = []; g.update(1 / 60); }
  };
  const still = (x, y, size = 'small') => { const a = g.createAsteroid(x, y, size); a.vx = 0; a.vy = 0; return a; };
  try {
    g.startGame();
    g.ufoSpawnTimer = 999;

    // Wave sizes: 4, +2 per wave, max 11
    const sizes = [1, 2, 3, 4, 5, 6, 9].map((w) => { g.createWave(w); return g.asteroids.length; });
    ok('wave sizes 4, 6, 8, 10, 11, 11, 11', sizes.join() === '4,6,8,10,11,11,11', sizes.join());

    // New waves start on the screen edges (x = 0 or y = 0, which wrap), both kinds used
    let onEdges = true, sides = 0, tops = 0;
    for (let w = 0; w < 30; w++) {
      g.createWave(5);
      for (const a of g.asteroids) {
        if (a.x === 0) sides++; else if (a.y === 0) tops++; else onEdges = false;
      }
    }
    ok('new waves start on the screen edges', onEdges && sides > 0 && tops > 0, `${sides} on the side edge, ${tops} on the top edge`);

    // New asteroids: every size gets 6..16 units per axis, whatever the wave
    let fresh = true;
    for (const size of ['large', 'medium', 'small']) {
      for (let i = 0; i < 300; i++) {
        const a = g.createAsteroid(500, 400, size);
        for (const v of [a.vx, a.vy]) {
          const u = Math.abs(units(v));
          if (u < 6 || u > 16 || Math.abs(v - Math.sign(v) * u * U) > 1e-9) fresh = false;
        }
      }
    }
    ok('new asteroids: 6-16 units per axis for every size', fresh);
    g.wave = 9; g.createWave(9);
    ok('no speed-up on later waves', g.asteroids.every((a) => Math.abs(units(a.vx)) <= 16 && Math.abs(units(a.vy)) <= 16));

    // Fragments inherit the parent's velocity plus a -16..+15 nudge, clamped to 6..31 units
    let inherit = true, sawFast = false;
    for (let i = 0; i < 200; i++) {
      const parent = g.createAsteroid(500, 400, 'large');
      parent.vx = 25 * U; parent.vy = -25 * U;
      g.asteroids = [parent];
      g.destroyAsteroid(0);
      for (const f of g.asteroids) {
        const ux = units(f.vx), uy = units(f.vy);
        if (ux < 9 || ux > 31 || uy > -10 || uy < -31) inherit = false;
        if (ux === 31 || uy === -31) sawFast = true;
      }
    }
    ok('fragments keep parent motion (+nudge, clamped)', inherit);

    // Fragments start nudged off the parent's spot: first sideways, second up/down,
    // by flipping bits of the position's low byte with (velocity & 31) * 2
    let nudgeOk = true, moved = 0;
    const toUnits = 8192 / 1000;
    for (let i = 0; i < 200; i++) {
      const parent = g.createAsteroid(300 + Math.random() * 400, 200 + Math.random() * 300, 'large');
      g.asteroids = [parent];
      g.destroyAsteroid(0);
      const [f1, f2] = g.asteroids;
      const expect = (pos, vel) => {
        const p = Math.floor(pos * toUnits), low = p & 0xff, k = (Math.round(vel / U) & 0x1f) << 1;
        return pos + ((low ^ k) - low) / toUnits;
      };
      if (f1.y !== parent.y || Math.abs(f1.x - expect(parent.x, f1.vx)) > 1e-9) nudgeOk = false;
      if (f2.x !== parent.x || Math.abs(f2.y - expect(parent.y, f2.vy)) > 1e-9) nudgeOk = false;
      if (Math.abs(f1.x - parent.x) > 7.6 || Math.abs(f2.y - parent.y) > 7.6) nudgeOk = false;
      if (f1.x !== parent.x || f2.y !== parent.y) moved++;
    }
    ok('fragments start nudged apart like the original', nudgeOk && moved > 150, `${moved}/200 pairs moved off the spot`);
    ok('fragments can reach the 31-unit cap', sawFast);
    Math.random = () => 0.5; // nudge of 0
    const slow = g.createAsteroid(500, 400, 'medium', { vx: 0, vy: 2 * U });
    Math.random = realRandom;
    ok('slow axes are raised to the 6-unit minimum', units(slow.vx) === 6 && units(slow.vy) === 6, `${units(slow.vx)}, ${units(slow.vy)}`);

    // Bullets: 63 units plus the ship's full velocity, each axis clamped to 111 units, 1.2 s life
    g.startGame(); g.ufoSpawnTimer = 999;
    g.ship.angle = 0;
    g.fireBullet();
    ok('bullet speed from rest is 63 units (~473 px/s)', Math.abs(g.bullets[0].vx - 63 * U) < 1e-6 && Math.abs(g.bullets[0].vy) < 1e-6,
       g.bullets[0].vx.toFixed(1));
    g.bullets = [];
    g.ship.vx = 200; g.ship.vy = -100;
    g.fireBullet();
    const b = g.bullets[0];
    ok('bullet carries full ship velocity', Math.abs(b.vx - (63 * U + 200)) < 1e-6 && Math.abs(b.vy + 100) < 1e-6, `${b.vx.toFixed(1)}, ${b.vy}`);
    g.bullets = [];
    g.ship.vx = 480; g.ship.vy = 0;
    g.fireBullet();
    ok('bullet axis speed clamped to 111 units', Math.abs(g.bullets[0].vx - 111 * U) < 1e-6, g.bullets[0].vx.toFixed(1));
    g.startGame(); g.ufoSpawnTimer = 999;
    g.asteroids = [still(100, 100)];
    g.ship.angle = 0;
    g.fireBullet();
    step(1.15);
    const alive = g.bullets.length === 1;
    step(0.1);
    ok('bullets last ~1.2 s', alive && g.bullets.length === 0);

    // Arcade hit sizes: octagon test, ~32 px for a large asteroid hit by a bullet
    const R = 132 * HIT_UNIT;
    ok('large asteroid hit size ~32 px', Math.abs(R - 32.2) < 0.1, R.toFixed(1) + ' px');
    ok('bullet hits within the size on an axis', arcadeHit(531, 300, 500, 300, 132));
    ok('bullet misses just outside the size', !arcadeHit(534, 300, 500, 300, 132));
    ok('diagonal hit inside the octagon', arcadeHit(523, 323, 500, 300, 132));
    ok('diagonal corner is outside the octagon', !arcadeHit(525, 325, 500, 300, 132));
    const shipSmall = (42 + 28) * HIT_UNIT;
    ok('ship vs small asteroid ~17 px', Math.abs(shipSmall - 17.1) < 0.1, shipSmall.toFixed(1) + ' px');
    const big = g.createAsteroid(0, 0, 'large'), small = g.createAsteroid(0, 0, 'small');
    ok('drawn asteroid sizes match hit sizes', Math.abs(big.radius - R) < 1e-9 && Math.abs(small.radius - 42 * HIT_UNIT) < 1e-9);

    // Collisions from the arcade table
    g.startGame(); g.ufoSpawnTimer = 999;
    g.asteroids = [still(100, 100)];
    let lives = g.lives;
    g.bullets = [{ x: g.ship.x, y: g.ship.y, vx: 0, vy: 0, life: 1 }];
    g.checkCollisions();
    ok('own bullet destroys own ship', g.lives === lives - 1 && !g.isShipActive() && g.bullets.length === 0);

    g.startGame(); g.ufoSpawnTimer = 999;
    g.asteroids = [still(100, 100), still(300, 300, 'large')];
    g.score = 0;
    g.ufoBullets = [{ x: 300, y: 300, vx: 0, vy: 0, life: 1 }];
    g.checkCollisions();
    ok('saucer bullet breaks an asteroid, no points', g.asteroids.length === 3 && g.score === 0 && g.ufoBullets.length === 0);

    g.asteroids = [still(100, 100), still(300, 300, 'large')];
    g.spawnUfo(); g.ufo.x = 300; g.ufo.y = 300;
    g.checkCollisions();
    ok('saucer hitting an asteroid destroys both, no points', !g.ufo && g.asteroids.length === 3 && g.score === 0);
    g.sound.stopUfoSiren();

    g.startGame(); g.ufoSpawnTimer = 999;
    g.asteroids = [still(100, 100), still(g.ship.x + 20, g.ship.y, 'large')];
    lives = g.lives; g.score = 0;
    g.checkCollisions();
    ok('ramming an asteroid: ship lost, asteroid broken and scored', g.lives === lives - 1 && g.score === 20 && g.asteroids.length === 3);

    // Hyperspace: hidden and untouchable for 0.8 s, then back (safe roll)
    g.startGame(); g.ufoSpawnTimer = 999;
    g.asteroids = [still(100, 100)];
    // Pin Math.random during the jump so the failure roll is floor(value * 32)
    const jump = (roll) => { Math.random = () => (roll + 0.5) / 32; g.hyperspace(); Math.random = realRandom; };
    jump(3); // safe roll
    g.asteroids.push(still(g.ship.x, g.ship.y));
    const livesBefore = g.lives;
    step(0.75);
    ok('ship hidden during hyperspace', !g.isShipActive());
    g.fireBullet();
    ok('cannot fire during hyperspace', g.bullets.length === 0);
    ok('cannot be hit during hyperspace', g.lives === livesBefore);
    g.asteroids.pop();
    step(0.1);
    ok('ship back after ~0.8 s', g.isShipActive() && g.lives === livesBefore);

    // Hyperspace failure rule: roll 0..31; rolls 24+ are fatal when (roll & 7) * 2 + 4 >= asteroid count
    const doomed = (roll, count) => {
      g.startGame(); g.ufoSpawnTimer = 999;
      g.asteroids = Array.from({ length: count }, (_, i) => still(50 + i * 20, 60));
      jump(roll);
      return g.ship.hyperDoomed;
    };
    ok('roll 24 with 4 asteroids: fatal', doomed(24, 4));
    ok('roll 24 with 5 asteroids: safe', !doomed(24, 5));
    ok('roll 31 with 18 asteroids: fatal', doomed(31, 18));
    ok('roll 31 with 19 asteroids: safe', !doomed(31, 19));
    ok('roll 23 is always safe', !doomed(23, 1));
    doomed(24, 4);
    const livesBeforeJump = g.lives;
    step(0.85);
    ok('failed hyperspace costs a ship', g.lives === livesBeforeJump - 1 && g.ship.deadTimer > 0);

    // Respawn: waits for a clear spawn area and no saucer, then no shield
    g.startGame(); g.ufoSpawnTimer = 999;
    g.asteroids = [still(100, 100)];
    const sp = g.spawnPoint();
    g.asteroids.push(still(sp.x + 60, sp.y - 60));
    g.onShipDeath();
    step(2.5);
    ok('respawn waits while an asteroid is near the center', !g.isShipActive());
    g.asteroids.pop();
    g.spawnUfo(); g.ufo.x = 500; g.ufo.y = 100; g.ufo.vx = 0; g.ufo.vy = 0; g.ufo.shootCooldown = 999;
    step(0.3);
    ok('respawn waits while a saucer is on screen', !g.isShipActive());
    g.ufo = null; g.sound.stopUfoSiren();
    step(0.1);
    ok('respawns once clear', g.isShipActive());
    ok('no spawn shield', g.ship.invulnerable <= 0);
    g.asteroids.push(still(sp.x + 200, sp.y));
    ok('asteroid 200 px away does not block respawn', g.isSpawnAreaClear());

    // Next wave: ~2.1 s after the last asteroid, and only once any saucer has left
    g.startGame(); g.ufoSpawnTimer = 999;
    g.ship.invulnerable = 999;
    g.asteroids = [];
    step(2.0);
    ok('no new wave before ~2.1 s', g.wave === 1 && g.asteroids.length === 0);
    step(0.2);
    ok('next wave after ~2.1 s, with 6 asteroids', g.wave === 2 && g.asteroids.length === 6);
    g.asteroids = [];
    g.spawnUfo(); g.ufo.x = 500; g.ufo.y = 100; g.ufo.vx = 0; g.ufo.vy = 0; g.ufo.shootCooldown = 999;
    step(2.5);
    ok('next wave waits for the saucer to leave', g.wave === 2);
    g.ufo = null; g.sound.stopUfoSiren();
    step(1 / 60);
    ok('then the wave starts', g.wave === 3);

    // Asteroid limit: at most 27 at once; fragments that don't fit are dropped, points still count
    const field = (n) => Array.from({ length: n }, (_, i) => still(40 + (i % 9) * 100, 60 + Math.floor(i / 9) * 100));
    g.startGame(); g.ufoSpawnTimer = 1e9;
    g.asteroids = [...field(25), still(500, 650, 'large')];
    g.score = 0; g.destroyAsteroid(25);
    ok('room for both fragments: 26 -> 27', g.asteroids.length === 27 && g.score === 20, `${g.asteroids.length} asteroids`);
    g.asteroids = [...field(26), still(500, 650, 'large')];
    g.score = 0; g.destroyAsteroid(26);
    ok('room for one fragment: 27 -> 27', g.asteroids.length === 27 && g.score === 20, `${g.asteroids.length} asteroids`);
    g.asteroids = [...field(26), still(500, 650, 'medium')];
    g.asteroids.push(still(600, 650, 'small'));
    g.score = 0; g.destroyAsteroid(26);
    ok('full field: hit gives points but no fragments', g.asteroids.length === 27 && g.score === 50, `${g.asteroids.length} asteroids, +${g.score}`);
    g.asteroids = [...field(20), still(500, 650, 'large')];
    g.destroyAsteroid(20);
    ok('below the limit both fragments appear', g.asteroids.length === 22);

    // Heartbeat: 4 + gap frames per beat; gap starts at 48 each wave, -1 every 64 frames, min 8
    g.startGame(); g.ufoSpawnTimer = 1e9;
    g.asteroids = [still(100, 100)];
    g.ship.invulnerable = 1e9;
    const beats = [];
    let frame = 0;
    const realBeat = g.sound.playHeartbeat;
    g.sound.playHeartbeat = () => beats.push(frame);
    const frames = (n) => { for (let i = 0; i < n; i++) { frame++; g.ufoSpawnTimer = 1e9; g.update(1 / 60); } };
    const gaps = () => beats.slice(1).map((f, i) => f - beats[i]);
    const startGap = g.heartbeatGap;
    frames(160);
    const early = gaps();
    ok('heartbeat starts at 52 frames per beat (~0.87 s)', startGap === 48 && early[0] >= 49 && early[0] <= 53, early.join());
    ok('and only gets faster', early.every((d, i) => i === 0 || d <= early[i - 1]), early.join());
    beats.length = 0;
    frames(60 * 45);
    beats.length = 0;
    frames(60);
    ok('speeds up to 12 frames per beat (0.2 s) after ~43 s', gaps().length >= 3 && gaps().every((d) => d === 12 || d === 13), gaps().join());
    g.createWave(2);
    g.asteroids = [still(100, 100)];
    const waveGap = g.heartbeatGap;
    beats.length = 0;
    frames(160);
    ok('new wave resets to the slow tempo', waveGap === 48 && gaps()[0] >= 49, gaps().join());
    g.asteroids = [];
    g.nextWaveTimer = 1e9;
    beats.length = 0;
    frames(120);
    ok('silent between waves', beats.length === 0);
    g.nextWaveTimer = null;
    g.asteroids = [still(100, 100)];
    g.onShipDeath();
    beats.length = 0;
    frames(100);
    ok('silent while the ship is exploding', beats.length === 0);
    g.sound.playHeartbeat = realBeat;

    // Saucers: at most 2 bullets on screen
    g.startGame(); g.ufoSpawnTimer = 999;
    g.spawnUfo(); g.ufo.x = 500; g.ufo.y = 100; g.ufo.vx = 0; g.ufo.vy = 0;
    const longShot = () => ({ x: 10, y: 10, vx: 0, vy: 0, life: 99 });
    g.ufoBullets = [longShot(), longShot()];
    g.ufo.shootCooldown = 1; g.saucerTick();
    ok('saucer holds fire with 2 bullets out', g.ufoBullets.length === 2);
    g.ufoBullets = [longShot()];
    g.ufo.shootCooldown = 1; g.saucerTick();
    ok('saucer fires when under the limit', g.ufoBullets.length === 2);
    g.ufo = null; g.sound.stopUfoSiren();
  } catch (e) { out.push('ERROR ' + e.stack); }
  Math.random = realRandom;
  window.__testResults = out;
  window.__testDone = true;
}, 300));
