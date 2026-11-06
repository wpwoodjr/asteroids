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
        mode: h.classList.contains('wrap') ? 'two rows' : h.classList.contains('compact') ? 'compact' : 'full'
      };
    })()`);
    ok(`${label}: header fits (${r.mode})`, r.headerFits);
    ok(`${label}: no button text wraps`, r.tallestButton <= 40, `tallest button ${r.tallestButton}px`);
    ok(`${label}: footer fits on one line`, r.footerFits);
    ok(`${label}: page fits the screen`, r.pageFits);
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
  return out;
}
