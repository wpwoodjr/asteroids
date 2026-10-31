// Ship physics: arcade friction, turn/thrust ease-in, gravity-mode exemption, top speed.
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
  try {
    // Stop the empty field from triggering a new wave
    g.createWave = () => {};

    // Friction: coasting for 1 s from 300 px/s leaves ~237 px/s
    fresh(); g.ship.vx = 300; g.ship.vy = 0; step(1);
    ok('coasting loses ~21%/s', Math.abs(g.ship.vx - 237) < 2, g.ship.vx.toFixed(1));
    step(2);
    ok('~3 s half-life', Math.abs(g.ship.vx - 300 * Math.pow(0.79, 3)) < 2, g.ship.vx.toFixed(1));

    // Thrust ease-in
    fresh(); g.ship.angle = 0; g.keys.thrust = true; step(1 / 60);
    const first = g.ship.vx;
    ok('thrust starts gentle', first > 350 / 60 * 0.3 && first < 350 / 60 * 0.45, (first / (350 / 60) * 100).toFixed(0) + '% power');
    step(0.2); const before = g.ship.vx; step(1 / 60);
    ok('thrust reaches full power', Math.abs((g.ship.vx - before) - 350 / 60) < 0.01);
    g.keys.thrust = false; step(1 / 60); g.keys.thrust = true; const v0 = g.ship.vx; step(1 / 60);
    ok('ease restarts after release', (g.ship.vx - v0) < 350 / 60 * 0.45);
    g.keys.thrust = false;

    // Rotation ease-in, instant stop
    fresh(); g.ship.angle = 0; g.keys.right = true; step(1 / 60);
    const a1 = g.ship.angle;
    ok('turn starts gentle', a1 < 4.2 / 60 * 0.45 && a1 > 0, (a1 / (4.2 / 60) * 100).toFixed(0) + '% speed');
    step(0.2); const a2 = g.ship.angle; step(1 / 60);
    ok('turn reaches full speed', Math.abs((g.ship.angle - a2) - 4.2 / 60) < 1e-6);
    g.keys.right = false; const a3 = g.ship.angle; step(0.5);
    ok('turn stops instantly on release', g.ship.angle === a3);
    g.keys.right = true; step(0.3); g.keys.right = false; g.keys.left = true; const a4 = g.ship.angle; step(1 / 60);
    ok('reversing direction eases in again', (a4 - g.ship.angle) < 4.2 / 60 * 0.45);
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
    ok('top speed capped at 480', Math.abs(Math.hypot(g.ship.vx, g.ship.vy) - 480) < 0.5);
    g.keys.thrust = false;
  } catch (e) { out.push('ERROR ' + e.stack); }
  g.createWave = realCreateWave;
  window.__testResults = out;
  window.__testDone = true;
}, 300));
