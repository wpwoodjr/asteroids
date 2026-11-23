// Layout at different screen sizes and display scales: the header never wraps text
// inside its buttons (it drops labels, then wraps onto two rows if it must), the
// footer fits on one line, and overlays fit the playfield (shrinking, or scrolling
// when shrinking would make them unreadable).
export default async function ({ send, ev, base, sleep }) {
  const out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const sizes = [
    ['small phone', 360, 740, 3],
    ['phone at a larger display scale', 735, 663, 2.925],
    ['phone', 883, 796, 2.4375],
    ['desktop', 1280, 800, 1]
  ];
  for (const [label, width, height, scale] of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: width < 1000 });
    await send('Page.navigate', { url: `${base}/asteroids.html` });
    await sleep(2500);
    const r = await ev(`(() => {
      const h = document.querySelector('header'), f = document.querySelector('footer');
      const lineHeight = Math.max(...[...h.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height));
      return {
        headerFits: h.scrollWidth <= h.clientWidth + 1,
        tallestButton: Math.round(lineHeight),
        footerFits: f.scrollWidth <= f.clientWidth + 1,
        pageFits: document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1,
        mode: h.classList.contains('wrap') ? 'two rows' : h.classList.contains('compact') ? 'compact' : 'full',
        aspect: document.getElementById('game-frame').getBoundingClientRect().width / document.getElementById('game-frame').getBoundingClientRect().height,
        buttonGap: document.getElementById('touch-controls').getBoundingClientRect().top - document.getElementById('game-frame').getBoundingClientRect().bottom
      };
    })()`);
    ok(`${label}: header fits (${r.mode})`, r.headerFits);
    ok(`${label}: no button text wraps`, r.tallestButton <= 40, `tallest button ${r.tallestButton}px`);
    ok(`${label}: footer fits on one line`, r.footerFits);
    ok(`${label}: page fits the screen`, r.pageFits);
    ok(`${label}: playfield is 4:3, not squashed`, Math.abs(r.aspect - 4 / 3) < 0.01, r.aspect.toFixed(3));
    ok(`${label}: touch buttons sit just under the playfield`, r.buttonGap >= 0 && r.buttonGap <= 12, `${Math.round(r.buttonGap)} px gap`);
    for (const id of ['screen-start', 'screen-help', 'screen-game-over']) {
      const v = await ev(`new Promise((done) => {
        document.querySelectorAll('[id^=screen-]').forEach((o) => o.classList.add('hidden'));
        const o = document.getElementById('${id}');
        o.classList.remove('hidden');
        setTimeout(() => {
          const c = o.querySelector('.overlay-fit'), cr = c.getBoundingClientRect(), r = o.getBoundingClientRect();
          const t = getComputedStyle(c).transform, s = t === 'none' ? 1 : new DOMMatrix(t).a;
          done({ scrolls: o.style.overflowY === 'auto', fits: cr.top >= r.top - 0.5 && cr.bottom <= r.bottom + 0.5 && cr.left >= r.left - 0.5 && cr.right <= r.right + 0.5, scale: s });
        }, 300);
      })`);
      const name = id.replace('screen-', '');
      ok(`${label}: ${name} overlay ${v.scrolls ? 'scrolls' : 'fits'}`, (v.scrolls || v.fits) && v.scale >= 0.55, `scale ${v.scale.toFixed(2)}`);
    }
  }
  // Two-row touch buttons (Hyperspace and Pause on a second row) only when it doesn't
  // shrink the playfield: phone in portrait fullscreen has room; landscape doesn't
  for (const [label, width, height, wantTwoRows] of [['portrait fullscreen', 852, 883, true], ['landscape', 883, 796, false]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2.4375, mobile: true });
    await send('Page.navigate', { url: `${base}/asteroids.html` });
    await sleep(2500);
    const t = await ev(`(() => {
      const touch = document.getElementById('touch-controls'), frame = document.getElementById('game-frame');
      const twoRows = touch.classList.contains('two-row'), w = frame.getBoundingClientRect().width;
      // Playfield width with the buttons forced onto one row, for comparison
      touch.classList.remove('two-row');
      const m = document.querySelector('main'), ms = getComputedStyle(m), mr = m.getBoundingClientRect();
      const oneRowW = Math.min(mr.width - parseFloat(ms.paddingLeft) - parseFloat(ms.paddingRight), mr.height * 4 / 3);
      window.__asteroidsGameInstance.resize();
      const rows = [...new Set([...touch.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top / 20)))].length;
      return { twoRows, w, oneRowW, rows };
    })()`);
    ok(`${label}: ${wantTwoRows ? 'two rows' : 'one row'} of touch buttons`, t.twoRows === wantTwoRows);
    ok(`${label}: playfield not smaller than with one row`, t.w >= t.oneRowW - 1, `${Math.round(t.w)} vs ${Math.round(t.oneRowW)} px wide`);
  }

  // Narrow phone in portrait: the start screen doesn't fit the playfield, so it grows to
  // cover the area between the header and footer (hiding the touch buttons), and fits
  // there without scrolling or shrinking. Starting a game puts the buttons back.
  await send('Emulation.setDeviceMetricsOverride', { width: 411, height: 790, deviceScaleFactor: 2.625, mobile: true });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const p = await ev(`(() => {
    const o = document.getElementById('screen-start'), c = o.querySelector('.overlay-fit');
    const t = getComputedStyle(c).transform, frame = document.getElementById('game-frame').getBoundingClientRect();
    const r = o.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return { grown: r.height > frame.height + 50, scale: t === 'none' ? 1 : new DOMMatrix(t).a, scrolls: o.style.overflowY === 'auto',
      fits: cr.top >= r.top - 0.5 && cr.bottom <= r.bottom + 0.5,
      touchHidden: getComputedStyle(document.getElementById('touch-controls')).visibility === 'hidden' };
  })()`);
  ok('portrait phone: start screen grows past the playfield', p.grown);
  ok('portrait phone: start screen fits without scrolling or shrinking', p.fits && !p.scrolls && p.scale > 0.95, `scale ${p.scale.toFixed(2)}`);
  ok('portrait phone: touch buttons hidden under it', p.touchHidden);
  const shown = await ev(`new Promise((done) => { window.__asteroidsGameInstance.startGame();
    setTimeout(() => done(getComputedStyle(document.getElementById('touch-controls')).visibility === 'visible'), 100); })`);
  ok('portrait phone: touch buttons come back when the game starts', shown);
  // A playfield limited by the width uses <main>'s side padding, lining up with the header
  const edges = await ev(`(() => {
    const f = document.getElementById('game-frame').getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect();
    return { left: f.left - h.left, right: h.right - f.right };
  })()`);
  ok('portrait phone: playfield reaches the edges of the header', Math.abs(edges.left) <= 1 && Math.abs(edges.right) <= 1, JSON.stringify(edges));

  // The touch buttons follow the playfield when the layout changes without a window
  // resize event (as when entering fullscreen on some phones): here the header grows
  // taller, then back
  await send('Emulation.setDeviceMetricsOverride', { width: 852, height: 883, deviceScaleFactor: 2.4375, mobile: true });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  for (const [step, pad] of [['header grows', '80px'], ['header shrinks back', '']]) {
    const gap = await ev(`new Promise((done) => {
      document.querySelector('header').style.paddingBottom = '${pad}';
      setTimeout(() => done(document.getElementById('touch-controls').getBoundingClientRect().top -
        document.getElementById('game-frame').getBoundingClientRect().bottom), 300);
    })`);
    ok(`layout change without a resize event (${step}): touch buttons stay just under the playfield`, gap >= 0 && gap <= 12, `${Math.round(gap)} px gap`);
  }

  // Game over with initials being typed: a real click on a button below the box works
  // (leaving the box mustn't move the buttons between the press and the release)
  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  for (const [btn, what, check] of [
    ['btn-game-over-scores', 'Scores opens the Hall of Fame', "!document.getElementById('screen-scores').classList.contains('hidden')"],
    ['btn-play-again', 'Play Again starts a game', "window.__asteroidsGameInstance.state === 'PLAYING'"]]) {
    await ev(`(() => { const g = window.__asteroidsGameInstance; document.getElementById('screen-scores').classList.add('hidden');
      localStorage.removeItem('asteroids_leaderboard'); g.startGame(); g.ufo = null; g.ufoSpawnTimer = 1e9; g.lives = 1;
      g.score = 12340; g.lastExtraLifeScore = 12340; g.onShipDeath();
      for (let t = 0; t < 3.2 && g.state === 'PLAYING'; t += 0.05) g.update(0.05);
      const i = document.getElementById('initials-input'); i.focus(); i.value = 'QQ'; })()`);
    await sleep(200);
    const [x, y] = await ev(`(() => { const r = document.getElementById('${btn}').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(60);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(300);
    const r = await ev(`({ worked: ${check}, saved: JSON.parse(localStorage.getItem('asteroids_leaderboard')).some((e) => e.name === 'QQ') })`);
    ok(`typing initials, then clicking: ${what}`, r.worked);
    ok(`typing initials, then clicking ${btn.replace('btn-', '')}: the initials are saved`, r.saved);
  }
  await ev(`localStorage.removeItem('asteroids_leaderboard'); localStorage.removeItem('asteroids_initials'); window.__asteroidsGameInstance.togglePause()`);

  // Phone outside fullscreen, with a 32 px gesture-bar strip at the bottom: the touch
  // buttons stay clear of it, and only the footer line uses it
  await send('Emulation.setDeviceMetricsOverride', { width: 852, height: 718, deviceScaleFactor: 2.4375, mobile: true });
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 32 } });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const g = await ev(`(() => {
    const tc = document.getElementById('touch-controls').getBoundingClientRect(), frame = document.getElementById('game-frame').getBoundingClientRect();
    return { clear: innerHeight - tc.bottom, frameH: frame.height, fits: document.documentElement.scrollHeight <= innerHeight + 1 };
  })()`);
  ok('gesture strip: touch buttons stay clear of it', g.clear >= 32, `${Math.round(g.clear)} px above the bottom`);
  ok('gesture strip: page still fits', g.fits);
  ok('gesture strip: playfield uses the freed height', g.frameH >= 530, `${Math.round(g.frameH)} px tall`);
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0 } });
  return out;
}
