// Left mouse click on the playfield fires and the right button thrusts while held;
// touch taps there do nothing. While playing, the pointer hides over the playfield
// after 1 s still, and only a larger move brings it back.
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
    // While playing, the mouse works off the playfield too (the hidden pointer drifts),
    // but not on an actual button
    const at = (el, type, button, buttons) =>
      el.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', button, buttons, bubbles: true, cancelable: true }));
    g.togglePause(); g.bullets.length = 0;
    const footer = document.querySelector('footer'), headerBtn = document.getElementById('btn-scores');
    at(footer, 'pointerdown', 0, 1); at(footer, 'pointerup', 0, 0);
    ok('left click off the playfield fires while playing', g.bullets.length === 1, `bullets=${g.bullets.length}`);
    at(headerBtn, 'pointerdown', 0, 1); at(headerBtn, 'pointerup', 0, 0);
    ok('left click on a header button does not fire', g.bullets.length === 1, `bullets=${g.bullets.length}`);
    at(footer, 'pointerdown', 2, 2);
    ok('right button off the playfield thrusts', g.keys.thrust === true);
    at(headerBtn, 'pointerup', 2, 0);
    ok('releasing the right button anywhere stops the thrust', g.keys.thrust === false);
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    footer.dispatchEvent(menu);
    ok("the browser's menu is blocked off the playfield while playing", menu.defaultPrevented);
    const btnMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    headerBtn.dispatchEvent(btnMenu);
    ok("the browser's menu still works on a button", !btnMenu.defaultPrevented);
    g.togglePause(); g.bullets.length = 1;
    const pausedMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    footer.dispatchEvent(pausedMenu);
    ok("the browser's menu works off the playfield when not playing", !pausedMenu.defaultPrevented);
    at(footer, 'pointerdown', 0, 1);
    ok('no fire off the playfield while paused', g.bullets.length === 1);
    g.render();
    ok('pointer shows while paused', c.style.cursor === '', c.style.cursor);
    g.togglePause(); g.mouseMovedAt = performance.now(); g.render();
    ok('pointer shows while playing if the mouse just moved', c.style.cursor === '', c.style.cursor);
    g.mousePos = { x: 300, y: 300 }; g.mouseMovedAt = performance.now() - 1100; g.render();
    ok('pointer hidden over the playfield after 1 s still', c.style.cursor === 'none', c.style.cursor);
    at(document.querySelector('footer'), 'pointermove', 0, 1); g.render();
    ok('a click (button change) does not bring the pointer back', c.style.cursor === 'none', c.style.cursor);
    const move = (x, y) => c.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', button: -1, buttons: 0, clientX: x, clientY: y, bubbles: true }));
    move(400, 380); move(200, 380);
    ok('small moves do not bring the pointer back', c.style.cursor === 'none', c.style.cursor);
    move(470, 300);
    ok('a larger move brings the pointer back at once', c.style.cursor === '', c.style.cursor);
    move(472, 301);
    g.render();
    ok('and it stays while the mouse is moving', c.style.cursor === '', c.style.cursor);
    g.bullets.length = 0;
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
