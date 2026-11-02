// Ship physics: arcade friction, full-strength turning and thrust, gravity-mode exemption, top speed.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  // Advance the game in 60 fps steps with nothing else on the field
  const step = (sec) => {
    for (let t = 0; t < sec - 1e-9; t += 1 / 60) {
      g.asteroids = []; g.ufo = null; g.ufoBullets = []; g.ufoSpawnTimer = 99; g.waveTransitionTimer = 0;
      g.update(1 / 60);
    }
  };
  const fresh = () => { g.startGame(); g.asteroids = []; g.ship.invulnerable = 999; g.resetInput(); };
  const realCreateWave = g.createWave.bind(g);
  const ROT = 3 / 256 * 2 * Math.PI * 60; // arcade turn rate, ~4.42 rad/s
  try {
    // Stop the empty field from triggering a new wave
    g.createWave = () => {};

    // Friction: coasting for 1 s from 300 px/s leaves ~237 px/s
    fresh(); g.ship.vx = 300; g.ship.vy = 0; step(1);
    ok('coasting loses ~21%/s', Math.abs(g.ship.vx - 237) < 2, g.ship.vx.toFixed(1));
    step(2);
    ok('~3 s half-life', Math.abs(g.ship.vx - 300 * Math.pow(0.79, 3)) < 2, g.ship.vx.toFixed(1));

    // Thrust is full strength from the first frame
    fresh(); g.ship.angle = 0; g.keys.thrust = true; step(1 / 60);
    ok('thrust is full power immediately', Math.abs(g.ship.vx - SHIP_THRUST / 60) < 1e-9, g.ship.vx.toFixed(2));
    g.keys.thrust = false;

    // Turning: full speed immediately, stops instantly on release
    fresh(); g.ship.angle = 0; g.keys.right = true; step(1 / 60);
    ok('turns at full speed immediately', Math.abs(g.ship.angle - ROT / 60) < 1e-9);
    ok('turn rate is the arcade 3/256 turn per frame (~4.42 rad/s)', Math.abs(ROT - 4.418) < 0.001, ROT.toFixed(3));
    g.keys.right = false; const a1 = g.ship.angle; step(0.5);
    ok('turn stops instantly on release', g.ship.angle === a1);
    g.keys.left = true; step(1 / 60);
    ok('reversing turns at full speed immediately', Math.abs((a1 - g.ship.angle) - ROT / 60) < 1e-9);
    g.keys.left = false;

    // No friction in gravity mode (planet pull disabled to isolate friction)
    fresh(); g.setGravityLevel(1, false); g.applyGravity = () => Infinity;
    g.ship.x = 100; g.ship.y = 100; g.ship.vx = 300; g.ship.vy = 0; step(1);
    ok('no friction with gravity on', Math.abs(g.ship.vx - 300) < 1e-9, g.ship.vx.toFixed(1));
    delete g.applyGravity; g.setGravityLevel(0, false);
    fresh(); g.ship.vx = 300; g.ship.vy = 0; step(1);
    ok('friction back when gravity off', Math.abs(g.ship.vx - 237) < 2, g.ship.vx.toFixed(1));

    // Top speed is still capped under full thrust
    fresh(); g.ship.angle = 0; g.keys.thrust = true; step(5);
    ok('thrust is ~218 px/s² (arcade)', Math.abs(SHIP_THRUST - 218) < 1, SHIP_THRUST.toFixed(1));
    ok('top speed along an axis ~468 px/s', Math.abs(g.ship.vx - SHIP_MAX_AXIS) < 1e-6 && Math.abs(SHIP_MAX_AXIS - 468.75) < 0.01, g.ship.vx.toFixed(1));
    g.keys.thrust = false;
    fresh(); g.ship.angle = Math.PI / 4; g.keys.thrust = true; step(5);
    const diag = Math.hypot(g.ship.vx, g.ship.vy);
    ok('diagonal top speed is faster (per-axis clamp)', Math.abs(diag - SHIP_MAX_AXIS * Math.SQRT2) < 1e-6, diag.toFixed(1));
    g.keys.thrust = false;
  } catch (e) { out.push('ERROR ' + e.stack); }
  g.createWave = realCreateWave;
  window.__testResults = out;
  window.__testDone = true;
}, 300));
