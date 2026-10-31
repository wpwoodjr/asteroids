// Left mouse click on the playfield fires; other buttons and touch taps don't.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [], c = g.canvas;
  const ok = (n, cond, x = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const down = (pointerType, button) => c.dispatchEvent(new PointerEvent('pointerdown', { pointerType, button, bubbles: true, cancelable: true }));
  try {
    g.startGame(); g.ship.invulnerable = 999;
    down('mouse', 0);
    ok('left click fires', g.bullets.length === 1, `bullets=${g.bullets.length}`);
    ok('left click does not thrust', !g.keys.thrust && g.ship.vx === 0 && g.ship.vy === 0);
    down('mouse', 2);
    ok('right click does not fire', g.bullets.length === 1);
    down('touch', 0);
    ok('touch tap on playfield does not fire', g.bullets.length === 1);
    g.togglePause(); down('mouse', 0);
    ok('no fire while paused', g.bullets.length === 1);
    g.togglePause();
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
