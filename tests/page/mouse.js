// Left mouse click on the playfield fires and the right button thrusts while held;
// touch taps there do nothing. The
// pointer is hidden over the playfield while playing.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [], c = g.canvas;
  const ok = (n, cond, x = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const down = (pointerType, button) => c.dispatchEvent(new PointerEvent('pointerdown', { pointerType, button, buttons: [1, 4, 2][button], bubbles: true, cancelable: true }));
  try {
    g.startGame(); g.ship.invulnerable = 999;
    down('mouse', 0);
    ok('left click fires', g.bullets.length === 1, `bullets=${g.bullets.length}`);
    ok('left click does not thrust', !g.keys.thrust && g.ship.vx === 0 && g.ship.vy === 0);
    const ev = (type, button, buttons, pointerType = 'mouse') =>
      c.dispatchEvent(new PointerEvent(type, { pointerType, button, buttons, bubbles: true, cancelable: true }));
    ev('pointerdown', 2, 2);
    ok('right button thrusts while held', g.keys.thrust === true);
    ok('right button does not fire', g.bullets.length === 1);
    ev('pointermove', -1, 2);
    ok('moving the mouse keeps the thrust', g.keys.thrust === true);
    ev('pointermove', 0, 3); // left pressed while right is held: arrives as a pointermove
    ok('left click while thrusting fires', g.bullets.length === 2, `bullets=${g.bullets.length}`);
    ev('pointermove', 0, 2); // left released
    ok('releasing left does not fire', g.bullets.length === 2);
    ev('pointerup', 2, 0);
    ok('releasing the right button stops the thrust', g.keys.thrust === false);
    ev('pointerdown', 2, 2); ev('pointercancel', -1, 0);
    ok('a cancelled pointer stops the thrust', g.keys.thrust === false);
    g.bullets.length = 1;
    down('touch', 0);
    ok('touch tap on playfield does not fire', g.bullets.length === 1);
    g.togglePause(); down('mouse', 0);
    ok('no fire while paused', g.bullets.length === 1);
    for (const type of ['contextmenu', 'selectstart', 'dragstart', 'mousedown']) {
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 2 });
      c.dispatchEvent(e);
      ok(`the browser's ${type} action is blocked on the playfield`, e.defaultPrevented);
    }
    g.render();
    ok('pointer shows while paused', c.style.cursor === '', c.style.cursor);
    g.togglePause(); g.render();
    ok('pointer hidden over the playfield while playing', c.style.cursor === 'none', c.style.cursor);
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
