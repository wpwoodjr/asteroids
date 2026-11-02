// Saucer aiming: shortest path across the screen wrap, leading a moving ship,
// and the spread of large vs small saucer shots.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const deg = (r) => (r * 180 / Math.PI).toFixed(1) + '°';
  try {
    g.startGame();
    g.asteroids = [g.createAsteroid(50, 50, 'small', 1)];
    g.ship.invulnerable = 999;

    // Wrap: saucer near the right edge, ship near the left edge -> shoot right, across the wrap
    g.ship.x = 20; g.ship.y = 300; g.ship.vx = 0; g.ship.vy = 0;
    const wrapAngle = g.aimAtShip(980, 300, 320, false);
    ok('aims across the screen wrap', angleDiff(wrapAngle, 0) < 1e-6, deg(wrapAngle));

    // Lead: a bullet fired at the lead angle meets the moving ship
    g.ship.x = 500; g.ship.y = 500; g.ship.vx = 150; g.ship.vy = -90;
    const sx = 200, sy = 200, speed = 320;
    const leadAngle = g.aimAtShip(sx, sy, speed, true);
    let closest = Infinity;
    for (let t = 0; t < 3; t += 0.001) {
      const bx = sx + Math.cos(leadAngle) * speed * t, by = sy + Math.sin(leadAngle) * speed * t;
      const px = g.ship.x + g.ship.vx * t, py = g.ship.y + g.ship.vy * t;
      closest = Math.min(closest, Math.hypot(bx - px, by - py));
    }
    ok('lead shot intercepts a moving ship', closest < 1, `closest ${closest.toFixed(2)} px`);
    const directAngle = g.aimAtShip(sx, sy, speed, false);
    ok('lead differs from direct aim', angleDiff(leadAngle, directAngle) > 0.05, deg(angleDiff(leadAngle, directAngle)));

    // Ship faster than bullets moving away: falls back to direct aim instead of failing
    g.ship.vx = 470; g.ship.vy = 0; g.ship.x = 600; g.ship.y = 200;
    const fallback = g.aimAtShip(200, 200, 320, true);
    ok('unreachable target falls back to direct aim', Number.isFinite(fallback) && angleDiff(fallback, 0) < 1e-6, deg(fallback));

    // Fire real shots through update() and measure their error from the ideal aim
    const sample = (isSmall, score, n = 200) => {
      g.score = score;
      let worst = 0;
      for (let i = 0; i < n; i++) {
        g.ship.x = 700; g.ship.y = 500; g.ship.vx = 120; g.ship.vy = 60; g.ship.deadTimer = 0;
        g.spawnUfo();
        g.ufo.isSmall = isSmall; g.ufo.x = 300; g.ufo.y = 200; g.ufo.vy = 0; g.ufo.shootCooldown = 0;
        const ideal = g.aimAtShip(g.ufo.x + g.ufo.vx / 120, g.ufo.y, 320, isSmall);
        g.ufoBullets = [];
        g.update(1 / 120);
        const b = g.ufoBullets[0];
        if (!b) return NaN;
        worst = Math.max(worst, angleDiff(Math.atan2(b.vy, b.vx), ideal));
      }
      g.ufo = null; g.sound.stopUfoSiren();
      return worst;
    };
    const large = sample(false, 0);
    ok('large saucer aims within ±12°', large <= 12 * Math.PI / 180 + 0.005, 'worst ' + deg(large));
    ok('large saucer is not pinpoint', large > 8 * Math.PI / 180, 'worst ' + deg(large));
    const smallEarly = sample(true, 0);
    ok('small saucer within ±7.5° at low score', smallEarly <= 0.12 + 0.01, 'worst ' + deg(smallEarly));
    const smallLate = sample(true, 50000);
    ok('small saucer within ±2° at 40,000+', smallLate <= 0.03 + 0.01, 'worst ' + deg(smallLate));
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
