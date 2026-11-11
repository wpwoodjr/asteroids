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
