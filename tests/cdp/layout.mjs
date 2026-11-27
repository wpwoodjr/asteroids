// Layout at different screen sizes and display scales: the header never wraps text
// inside its buttons (it drops labels, then wraps onto two rows if it must), the
// footer fits on one line, and overlays fit the playfield (shrinking, or scrolling
// when shrinking would make them unreadable).
export default async function ({ send, ev, base, sleep }) {
  const out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const sizes = [
    ['small phone', 360, 740, 3, true],
    ['phone at a larger display scale', 735, 663, 2.925],
    ['phone', 883, 796, 2.4375],
    ['desktop', 1280, 800, 1]
  ];
  for (const [label, width, height, scale, upright = false] of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: width < 1000 });
    await send('Page.navigate', { url: `${base}/asteroids.html` });
    await sleep(2500);
    const r = await ev(`(() => {
      const h = document.querySelector('header'), f = document.querySelector('footer');
      const lineHeight = Math.max(...[...h.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height));
      return {
        // (a header split into the side areas fits when its blocks are on screen and clear of the playfield)
        headerFits: !h.classList.contains('side') ? h.scrollWidth <= h.clientWidth + 1 : (() => {
          const fr = document.getElementById('game-frame').getBoundingClientRect();
          return [h.children[0], ...h.querySelectorAll('.settings-group')].every((el) => { const b = el.getBoundingClientRect();
            return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && (b.right <= fr.left - 2 || b.left >= fr.right + 2); });
        })(),
        tallestButton: Math.round(lineHeight),
        footerFits: f.scrollWidth <= f.clientWidth + 1,
        pageFits: document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1,
        mode: h.classList.contains('side') ? 'beside the playfield' : h.classList.contains('wrap') ? 'two rows' : h.classList.contains('compact') ? 'compact' : 'full',
        upright: window.__asteroidsGameInstance.rotated,
        aspect: document.getElementById('game-frame').getBoundingClientRect().width / document.getElementById('game-frame').getBoundingClientRect().height,
        buttonGap: document.getElementById('touch-controls').getBoundingClientRect().top - document.getElementById('game-frame').getBoundingClientRect().bottom - 2, // 2: the outline
        sides: document.getElementById('touch-controls').classList.contains('sides'),
        besideGaps: (() => { const f = document.getElementById('game-frame').getBoundingClientRect(), [l, r] = document.getElementById('touch-controls').children;
          return [f.left - 2 - l.getBoundingClientRect().right, r.getBoundingClientRect().left - (f.right + 2)]; })()
      };
    })()`);
    ok(`${label}: header fits (${r.mode})`, r.headerFits);
    ok(`${label}: no button text wraps`, r.tallestButton <= 40, `tallest button ${r.tallestButton}px`);
    ok(`${label}: footer fits on one line`, r.footerFits);
    ok(`${label}: page fits the screen`, r.pageFits);
    const shape = upright ? 3 / 4 : 4 / 3;
    ok(`${label}: playfield is ${upright ? 'upright, 3:4' : '4:3'}, not squashed`, r.upright === upright && Math.abs(r.aspect - shape) < 0.01, r.aspect.toFixed(3));
    if (r.sides) ok(`${label}: touch buttons sit beside the playfield, clear of it`, r.besideGaps.every((g) => g >= 0), JSON.stringify(r.besideGaps.map(Math.round)));
    else ok(`${label}: touch buttons sit just under the playfield`, r.buttonGap >= 0 && r.buttonGap <= 12, `${Math.round(r.buttonGap)} px gap`);
    for (const id of ['screen-start', 'screen-help', 'screen-game-over']) {
      const v = await ev(`new Promise((done) => {
        document.querySelectorAll('[id^=screen-]').forEach((o) => o.classList.add('hidden'));
        const o = document.getElementById('${id}');
        o.classList.remove('hidden');
        setTimeout(() => {
          const c = o.querySelector('.overlay-fit'), cr = c.getBoundingClientRect(), r = o.getBoundingClientRect();
          const t = getComputedStyle(c).transform, s = t === 'none' ? 1 : new DOMMatrix(t).a;
          const f = document.getElementById('game-frame').getBoundingClientRect();
          done({ scrolls: o.style.overflowY === 'auto', fits: cr.top >= r.top - 0.5 && cr.bottom <= r.bottom + 0.5 && cr.left >= r.left - 0.5 && cr.right <= r.right + 0.5, scale: s,
            onPlayfield: Math.abs(r.top - f.top) < 1 && Math.abs(r.bottom - f.bottom) < 1 });
        }, 300);
      })`);
      const name = id.replace('screen-', '');
      ok(`${label}: ${name} overlay ${v.scrolls ? 'scrolls, on the playfield' : 'fits'}`, (v.scrolls ? v.onPlayfield : v.fits) && v.scale >= 0.5, `scale ${v.scale.toFixed(2)}`);
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
      // (the playfield's 2 px outline is drawn outside the frame)
      const twoRows = touch.classList.contains('two-row'), w = frame.getBoundingClientRect().width + 4;
      // Playfield width with the buttons forced onto one row, for comparison
      touch.classList.remove('two-row');
      const m = document.querySelector('main'), ms = getComputedStyle(m), mr = m.getBoundingClientRect();
      // (the world fills the space inside the outline, so the outlined box is 4 px more than 4:3 each way)
      const oneRowW = Math.min(mr.width - parseFloat(ms.paddingLeft) - parseFloat(ms.paddingRight), (mr.height - 4) * 4 / 3 + 4);
      window.__asteroidsGameInstance.resize();
      const rows = [...new Set([...touch.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top / 20)))].length;
      return { twoRows, w, oneRowW, rows };
    })()`);
    ok(`${label}: ${wantTwoRows ? 'two rows' : 'one row'} of touch buttons`, t.twoRows === wantTwoRows);
    ok(`${label}: playfield not smaller than with one row`, t.w >= t.oneRowW - 1, `${Math.round(t.w)} vs ${Math.round(t.oneRowW)} px wide`);
  }

  // Narrow phone in portrait: the playfield is shown upright, 3:4, which makes it much
  // bigger, and the start screen fits on it
  await send('Emulation.setDeviceMetricsOverride', { width: 411, height: 790, deviceScaleFactor: 2.625, mobile: true });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const u = await ev(`(() => {
    const g = window.__asteroidsGameInstance, f = document.getElementById('game-frame').getBoundingClientRect();
    const o = document.getElementById('screen-start'), t = getComputedStyle(o.querySelector('.overlay-fit')).transform;
    return { rotated: g.rotated, w: f.width, h: f.height, view: [g.viewW, g.viewH], grown: false,
      scale: t === 'none' ? 1 : new DOMMatrix(t).a, canvas: [g.canvas.width, g.canvas.height] };
  })()`);
  ok('portrait phone: playfield shown upright', u.rotated && u.view[0] === 750 && u.view[1] === 1000);
  ok('portrait phone: upright playfield is much bigger than 4:3 would be', u.w * u.h > 1.5 * u.w * (u.w * 3 / 4), `${Math.round(u.w)}x${Math.round(u.h)}`);
  ok('portrait phone: canvas is portrait too', u.canvas[1] > u.canvas[0], u.canvas.join('x'));
  ok('portrait phone: start screen fits on the playfield, at 90% or more', !u.grown && u.scale >= 0.9, `scale ${u.scale.toFixed(2)}`);
  // A playfield limited by the width uses <main>'s side padding, lining up with the header
  const edges = await ev(`(() => {
    const f = document.getElementById('game-frame').getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect();
    return { left: f.left - 2 - h.left, right: h.right - (f.right + 2) }; // 2: the outline outside the frame
  })()`);
  ok('portrait phone: playfield reaches the edges of the header', Math.abs(edges.left) <= 1 && Math.abs(edges.right) <= 1, JSON.stringify(edges));

  // A short phone in landscape: the start screen doesn't fit the playfield. Menus never
  // go past the playfield, so it shrinks (or scrolls, rather than shrink below 50%),
  // and the touch buttons at the sides stay in view.
  // Starting a game puts the buttons back.
  await send('Emulation.setDeviceMetricsOverride', { width: 790, height: 411, deviceScaleFactor: 2.625, mobile: true });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const p = await ev(`(() => {
    const o = document.getElementById('screen-start'), c = o.querySelector('.overlay-fit');
    const t = getComputedStyle(c).transform, frame = document.getElementById('game-frame').getBoundingClientRect();
    const r = o.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return { onPlayfield: Math.abs(r.top - frame.top) < 1 && Math.abs(r.bottom - frame.bottom) < 1 && Math.abs(r.left - frame.left) < 1 && Math.abs(r.right - frame.right) < 1,
      scale: t === 'none' ? 1 : new DOMMatrix(t).a, scrolls: o.style.overflowY === 'auto',
      fits: cr.top >= r.top - 0.5 && cr.bottom <= r.bottom + 0.5,
      touchShown: getComputedStyle(document.getElementById('touch-controls')).visibility === 'visible',
      clearOfButtons: r.left >= document.getElementById('btn-touch-hyperspace').getBoundingClientRect().right
        && r.right <= document.getElementById('btn-touch-fire').getBoundingClientRect().left };
  })()`);
  ok('landscape phone: playfield is not upright', !(await ev('window.__asteroidsGameInstance.rotated')));
  ok('landscape phone: start screen stays on the playfield', p.onPlayfield);
  // (below 50% the text is too small to read, so it scrolls at full size instead)
  ok('landscape phone: start screen readable (fits at 50% or more, or scrolls)',
    p.scrolls ? p.scale > 0.95 : p.fits && p.scale >= 0.5, `scale ${p.scale.toFixed(2)}`);
  ok('landscape phone: side touch buttons stay in view beside it', p.touchShown && p.clearOfButtons);
  await ev('window.__asteroidsGameInstance.startGame()');

  // On a landscape phone the touch buttons go to the sides, which makes the playfield
  // much bigger than with them below (310x232 before). Each hand's buttons stand in a
  // column (left: rotate left, rotate right, Hyperspace; right: Fire, Thrust, Pause, top
  // to bottom), with the top one halfway up the window.
  const sd = await ev(`(() => {
    const box = (id) => document.getElementById(id).getBoundingClientRect(), f = box('game-frame');
    const mid = (id) => { const b = box(id); return b.top + b.height / 2; };
    return { sides: document.getElementById('touch-controls').classList.contains('sides'), frame: [f.width, f.height],
      leftOrder: box('btn-touch-left').top < box('btn-touch-right').top && box('btn-touch-right').top < box('btn-touch-hyperspace').top,
      rightOrder: box('btn-touch-fire').top < box('btn-touch-thrust').top && box('btn-touch-thrust').top < box('btn-touch-pause').top,
      middles: [mid('btn-touch-left'), mid('btn-touch-fire')], half: innerHeight / 2,
      // (how far each column's bottom is above the play area's)
      aboveBottom: ['btn-touch-hyperspace', 'btn-touch-pause'].map((id) => Math.round(document.querySelector('main').getBoundingClientRect().bottom - box(id).bottom)),
      // (how far each column's top is below the header's blocks above it, when they're there)
      belowHeader: [['btn-touch-left', 0], ['btn-touch-fire', 1]].map(([id, i]) => { const g = document.querySelectorAll('header .settings-group')[i];
        return document.querySelector('header').classList.contains('side') ? Math.round(box(id).top - g.getBoundingClientRect().bottom) : null; }),
      clear: box('btn-touch-hyperspace').right <= f.left - 2 && box('btn-touch-fire').left >= f.right + 2 };
  })()`);
  ok('landscape phone: touch buttons at the sides', sd.sides);
  ok('landscape phone: playfield much bigger with them there', sd.frame[0] * sd.frame[1] > 1.5 * 310 * 232, sd.frame.map(Math.round).join('x'));
  ok('landscape phone: side buttons in order, top to bottom', sd.leftOrder && sd.rightOrder);
  // (or as near as they can be while keeping clear of the header's blocks above them
  // and the bottom of the play area)
  ok('landscape phone: rotate left and Fire halfway up, or as near as the header and the bottom allow',
    sd.middles.every((m, i) => Math.abs(m - sd.half) <= 1 || (m > sd.half && Math.abs(sd.belowHeader[i] - 24) <= 1) || (m < sd.half && Math.abs(sd.aboveBottom[i]) <= 1)), JSON.stringify(sd));
  ok('landscape phone: side buttons clear of the playfield', sd.clear);

  // ...and the header moves into the side areas above them, which makes the playfield
  // bigger still (422x316 with the header on top): the logo and two settings above
  // the left column, the other three above the right one, all clear of the playfield
  const hs = await ev(`(() => {
    const h = document.querySelector('header'), box = (el) => el.getBoundingClientRect(), f = box(document.getElementById('game-frame'));
    const [left, right] = h.querySelectorAll('.settings-group'), logo = h.children[0];
    return { side: h.classList.contains('side'), frame: [f.width, f.height],
      leftSide: [logo, left].every((el) => box(el).right <= f.left - 2 && box(el).left >= 0),
      rightSide: box(right).left >= f.right + 2 && box(right).right <= innerWidth,
      above: box(left).bottom <= box(document.getElementById('btn-touch-left')).top && box(right).bottom <= box(document.getElementById('btn-touch-fire')).top,
      settings: left.children.length + right.children.length };
  })()`);
  ok('landscape phone: header split into the side areas', hs.side);
  ok('landscape phone: playfield bigger with the header there', hs.frame[0] * hs.frame[1] > 1.2 * 422 * 316, hs.frame.map(Math.round).join('x'));
  ok('landscape phone: header blocks beside the playfield, above the buttons', hs.leftSide && hs.rightSide && hs.above, JSON.stringify(hs));
  ok('landscape phone: all five settings buttons there (Gravity is on the start screen)', hs.settings === 5);

  // A very short landscape window (Chrome on the folded phone held sideways, about
  // 961x278): columns of the large buttons don't fit, so the side columns use the small
  // ones rather than falling back to buttons below (which left a 133x99 playfield)
  await send('Emulation.setDeviceMetricsOverride', { width: 961, height: 278, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const sh = await ev(`(() => { const t = document.getElementById('touch-controls'), f = document.getElementById('game-frame').getBoundingClientRect();
    const hy = document.getElementById('btn-touch-hyperspace').getBoundingClientRect(), pa = document.getElementById('btn-touch-pause').getBoundingClientRect();
    return { sides: t.classList.contains('sides'), small: t.classList.contains('small'), frame: [f.width, f.height],
      onScreen: hy.bottom <= innerHeight && pa.bottom <= innerHeight, fits: document.documentElement.scrollHeight <= innerHeight + 1 }; })()`);
  ok('short landscape window: small side columns', sh.sides && sh.small, JSON.stringify(sh));
  ok('short landscape window: playfield keeps a playable size', sh.frame[0] >= 280, sh.frame.map(Math.round).join('x'));
  ok('short landscape window: buttons on screen, page fits', sh.onScreen && sh.fits);

  // In any layout the footer goes when that makes the playfield bigger (375x281 with it
  // on the phone sideways, 390x519 on the outer screen upright), and the bottom of the
  // page still keeps clear of a gesture-bar strip
  for (const [w, h, before] of [[961, 330, 375 * 281], [443, 746, 390 * 519]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2.4375, mobile: true });
  for (const inset of [0, 24]) {
    await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: inset } });
    await sleep(600);
    const nf = await ev(`(() => { const f = document.getElementById('game-frame').getBoundingClientRect(), [l, r] = document.getElementById('touch-controls').children;
      return { hidden: getComputedStyle(document.querySelector('footer')).display === 'none', frame: [f.width, f.height],
        lowest: Math.max(f.bottom + 2, l.getBoundingClientRect().bottom, r.getBoundingClientRect().bottom), fits: document.documentElement.scrollHeight <= innerHeight + 1 }; })()`);
    const label = `no footer ${w}x${h}${inset ? ', with a gesture strip' : ''}`;
    ok(`${label}: footer hidden`, nf.hidden);
    if (!inset) ok(`${label}: playfield bigger without it`, nf.frame[0] * nf.frame[1] > 1.05 * before, nf.frame.map(Math.round).join('x'));
    ok(`${label}: playfield and buttons clear of the bottom, page fits`, nf.lowest <= h - Math.max(8, inset) + 0.5 && nf.fits, JSON.stringify(nf));
  }
  }

  // In a short window (the phone sideways, 961x330) the side columns, with the header's
  // blocks above them, already fill nearly all the play area's height: there's no room
  // for even the shortest pills, so the buttons stay round
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0 } });
  await send('Emulation.setDeviceMetricsOverride', { width: 961, height: 330, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const pl = await ev(`(() => { const b = document.getElementById('btn-touch-left').getBoundingClientRect(), t = document.getElementById('touch-controls');
    return { sides: t.classList.contains('sides'), pill: t.classList.contains('pill'), shape: +(b.width / b.height).toFixed(2) }; })()`);
  ok('side buttons stay round where pills would not fit', pl.sides && !pl.pill && pl.shape === 1, JSON.stringify(pl));
  // ...and they keep 24 px clear of the header's buttons above them, so a tap meant for
  // Left or Fire doesn't land on a setting
  const hg = await ev(`(() => { const g = document.querySelectorAll('header .settings-group'), r = (el) => el.getBoundingClientRect();
    return [r(document.getElementById('btn-touch-left')).top - r(g[0]).bottom, r(document.getElementById('btn-touch-fire')).top - r(g[1]).bottom].map(Math.round); })()`);
  ok('side buttons keep clear of the header beside the playfield', hg.every((gap) => gap >= 24), `gaps ${hg.join(', ')} px`);
  // ...and of the header on top of the page, when it stays there (the outer screen in
  // Chrome, split with another app: 442x296)
  await send('Emulation.setDeviceMetricsOverride', { width: 442, height: 296, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const ht = await ev(`(() => { const h = document.querySelector('header'), r = (id) => document.getElementById(id).getBoundingClientRect();
    return { side: h.classList.contains('side'), sides: document.getElementById('touch-controls').classList.contains('sides'),
      gaps: ['btn-touch-left', 'btn-touch-fire'].map((id) => Math.round(r(id).top - h.getBoundingClientRect().bottom)),
      onScreen: Math.max(r('btn-touch-hyperspace').bottom, r('btn-touch-pause').bottom) <= innerHeight,
      pill: document.getElementById('touch-controls').classList.contains('pill'), shape: +(r('btn-touch-left').height / r('btn-touch-left').width).toFixed(2),
      aboveHalf: ['btn-touch-left', 'btn-touch-fire'].map((id) => Math.round(innerHeight / 2 - (r(id).top + r(id).height / 2))) }; })()`);
  ok('side buttons keep clear of the header on top (442x296)', !ht.side && ht.sides && ht.gaps.every((gap) => gap >= 24) && ht.onScreen, JSON.stringify(ht));
  // ...and there, with no room below halfway for pills, they grow upwards instead
  ok('side pills grow upwards where there is no room below (442x296)', ht.pill && ht.shape > 1.2 && ht.aboveHalf.every((d) => d > 0), JSON.stringify(ht));

  // With height to spare (883x560: large buttons at the sides), the side buttons stretch
  // into upright pills, which take no width from the playfield
  await send('Emulation.setDeviceMetricsOverride', { width: 883, height: 560, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const rd = await ev(`(() => { const t = document.getElementById('touch-controls'), b = (id) => document.getElementById(id).getBoundingClientRect();
    return { sides: t.classList.contains('sides'), pill: t.classList.contains('pill'), shapes: ['btn-touch-left', 'btn-touch-fire'].map((id) => +(b(id).height / b(id).width).toFixed(2)),
      frame: Math.round(b('game-frame').width), onScreen: Math.max(b('btn-touch-hyperspace').bottom, b('btn-touch-pause').bottom) <= innerHeight }; })()`);
  ok('side buttons are upright pills, with height to spare', rd.sides && rd.pill && rd.shapes.every((r) => r > 1.4) && rd.frame === 658 && rd.onScreen, JSON.stringify(rd));
  // Last, where there's still room, a little more space between the buttons (16 px for
  // the large ones, not 8), when that changes nothing else: here at the sides, and below
  // the playfield on the unfolded screen in Chrome; not in the short 961x330 window,
  // where it would push the columns further up
  const spacing = `(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), t = document.getElementById('touch-controls');
    return { sides: t.classList.contains('sides'), frame: Math.round(r('game-frame').width),
      gaps: t.classList.contains('sides') ? [r('btn-touch-right').top - r('btn-touch-left').bottom, r('btn-touch-thrust').top - r('btn-touch-fire').bottom].map(Math.round)
        : [r('btn-touch-right').left - r('btn-touch-left').right, r('btn-touch-fire').left - r('btn-touch-thrust').right].map(Math.round) }; })()`;
  const sp1 = await ev(spacing);
  ok('more space between the side buttons where there is room (883x560)', sp1.sides && sp1.gaps.every((gap) => gap === 16) && sp1.frame === 658, JSON.stringify(sp1));
  await send('Emulation.setDeviceMetricsOverride', { width: 883, height: 689, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const sp2 = await ev(spacing);
  ok('more space between the buttons below the playfield where there is room (883x689)', !sp2.sides && sp2.gaps.every((gap) => gap === 16) && sp2.frame === 708, JSON.stringify(sp2));
  await send('Emulation.setDeviceMetricsOverride', { width: 961, height: 330, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const sp3 = await ev(spacing);
  ok('the usual space between the buttons where more would move the side columns (961x330)', sp3.sides && sp3.gaps.every((gap) => gap === 8), JSON.stringify(sp3));
  // In two rows below the playfield, the space side by side and between the rows are
  // separate: on the outer screen in Chrome there's room for more side by side, but more
  // between the rows would make the playfield smaller
  await send('Emulation.setDeviceMetricsOverride', { width: 443, height: 746, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const sp4 = await ev(`(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), t = document.getElementById('touch-controls');
    return { rows: t.classList.contains('two-row'), frame: Math.round(r('game-frame').width),
      across: [r('btn-touch-right').left - r('btn-touch-left').right, r('btn-touch-fire').left - r('btn-touch-thrust').right].map(Math.round),
      down: [r('btn-touch-hyperspace').top - Math.max(r('btn-touch-left').bottom, r('btn-touch-right').bottom), r('btn-touch-pause').top - Math.max(r('btn-touch-thrust').bottom, r('btn-touch-fire').bottom)].map(Math.round) }; })()`);
  ok('two rows: more space side by side, the usual between the rows (443x746)', sp4.rows && sp4.across.every((gap) => gap === 16) && sp4.down.every((gap) => gap === 8) && sp4.frame === 405, JSON.stringify(sp4));
  // ...where the playfield leaves spare space below the buttons (the outer screen in
  // fullscreen), the second row moves down into it for more space between the rows:
  // the first row stays just under the playfield
  await send('Emulation.setDeviceMetricsOverride', { width: 443, height: 961, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const sp5 = await ev(`(() => { const r = (id) => document.getElementById(id).getBoundingClientRect();
    return { firstRow: Math.round(Math.min(r('btn-touch-left').top, r('btn-touch-fire').top) - r('game-frame').bottom),
      down: [r('btn-touch-hyperspace').top - Math.max(r('btn-touch-left').bottom, r('btn-touch-right').bottom), r('btn-touch-pause').top - Math.max(r('btn-touch-thrust').bottom, r('btn-touch-fire').bottom)].map(Math.round) }; })()`);
  ok('two rows: the second row moves down for more space between the rows, the first stays under the playfield (443x961)',
    sp5.down.every((gap) => gap === 16) && sp5.firstRow === 10, JSON.stringify(sp5));

  // Where the width limits the playfield (the unfolded screen turned, in fullscreen),
  // dropping the footer wouldn't make the playfield bigger: it stays
  await send('Emulation.setDeviceMetricsOverride', { width: 883, height: 852, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  ok('footer kept where hiding it gains nothing (883x852)', await ev(`getComputedStyle(document.querySelector('footer')).display !== 'none'`));

  // When the footer's controls list and its "ASTEROIDS" would run together (735x574,
  // with a gesture strip so the footer stays), it drops "ASTEROIDS" rather than the list
  await send('Emulation.setDeviceMetricsOverride', { width: 735, height: 574, deviceScaleFactor: 2.925, mobile: true });
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 27 } });
  await sleep(600);
  const fn = await ev(`(() => { const f = document.querySelector('footer'), shown = (sel) => !!f.querySelector(sel).offsetParent;
    return { footer: !!f.offsetParent, list: shown('.footer-long'), name: shown('.footer-name'), fits: f.scrollWidth <= f.clientWidth + 1 }; })()`);
  ok('narrow footer: keeps the controls list, drops "ASTEROIDS", fits', fn.footer && fn.list && !fn.name && fn.fits, JSON.stringify(fn));
  // The small side buttons are used only when they make the playfield 10% bigger than
  // the large ones do: at 735x574 they do with a gesture strip (the footer stays, so
  // the playfield is shorter with the large buttons below it), and not without one
  const smallButtons = async () => [await ev(`document.getElementById('touch-controls').classList.contains('small')`),
    `small buttons +${Math.round((await ev('window.__asteroidsGameInstance.smallGain') - 1) * 100)}%`];
  let [isSmall, gain] = await smallButtons();
  ok('small buttons for a big gain: used at 735x574 with a gesture strip', isSmall, gain);
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0 } });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  [isSmall, gain] = await smallButtons();
  ok('small buttons only for a big gain: not at 735x574 without one', !isSmall, gain);

  // The pause menu's layout choices: Buttons cycles Auto, Large, Small and Shape cycles
  // Auto, Tall, Wide; each lays the page out again and is remembered
  await send('Emulation.setDeviceMetricsOverride', { width: 883, height: 689, deviceScaleFactor: 2.4375, mobile: true });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const layoutNow = `(() => { const g = window.__asteroidsGameInstance;
    return { rotated: g.rotated, sides: document.getElementById('touch-controls').classList.contains('sides'), fire: Math.round(Math.min(document.getElementById('btn-touch-fire').getBoundingClientRect().width, document.getElementById('btn-touch-fire').getBoundingClientRect().height)),
      labels: [document.getElementById('btn-button-size').textContent.trim(), document.getElementById('btn-view-shape').textContent.trim()],
      title: document.getElementById('layout-config-title').textContent.trim(), screen: [screen.width, screen.height] }; })()`;
  await ev(`window.__asteroidsGameInstance.startGame(); window.__asteroidsGameInstance.togglePause()`);
  const pm0 = await ev(layoutNow);
  await ev(`document.getElementById('btn-button-size').click(); document.getElementById('btn-button-size').click()`);
  const pmSmall = await ev(layoutNow);
  ok('pause menu: no Gravity (it is set between games)', await ev(`!document.querySelector('#screen-pause [data-gravity-toggle]')`));
  ok('pause menu: no tooltips', await ev(`!document.querySelector('#screen-pause [title]')`));
  // Sound: On/Off there too, the same setting as the header's sound button
  const sound = `({ pause: document.getElementById('sound-status').textContent, header: document.getElementById('audio-status').textContent, muted: window.__asteroidsGameInstance.sound.muted })`;
  await ev(`document.getElementById('btn-pause-sound').click()`);
  const soundOff = await ev(sound);
  await ev(`document.getElementById('btn-pause-sound').click()`);
  const soundOn = await ev(sound);
  ok('pause menu: Sound turns the sound off and on, as the header button does',
    soundOff.pause === 'OFF' && soundOff.muted && soundOff.header === 'MUTED' && soundOn.pause === 'ON' && !soundOn.muted && soundOn.header === 'SFX', JSON.stringify([soundOff, soundOn]));
  // Sound on plays a sound, so you hear it's on (the one gravity coming on plays)
  ok('pause menu: Sound On plays a sound', await ev(`(() => {
    const g = window.__asteroidsGameInstance, b = document.getElementById('btn-pause-sound'), play = g.sound.playExtraLife.bind(g.sound);
    let played = 0;
    g.sound.playExtraLife = () => { played++; play(); };
    b.click(); const off = played; b.click();
    g.sound.playExtraLife = play;
    return off === 0 && played === 1 && !g.sound.muted;
  })()`));
  ok('pause menu: Fullscreen, then Sound', await ev(`(() => { const ids = [...document.querySelectorAll('#screen-pause button')].map((b) => b.id);
    return ids.indexOf('btn-pause-fullscreen') + 1 === ids.indexOf('btn-pause-sound'); })()`));
  ok('pause menu: Buttons: Small makes the touch buttons smaller', pmSmall.labels[0] === 'BUTTONS: SMALL' && pmSmall.fire < pm0.fire, JSON.stringify([pm0, pmSmall]));
  await ev(`document.getElementById('btn-view-shape').click()`);
  const pmPortrait = await ev(layoutNow);
  ok('pause menu: Shape: Tall shows the playfield upright on a landscape screen, buttons at its sides', !pm0.rotated && pmPortrait.sides && pmPortrait.rotated && pmPortrait.labels[1] === 'SHAPE: TALL', JSON.stringify(pmPortrait));
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const pmReloaded = await ev(layoutNow);
  ok('pause menu: layout choices remembered after a reload', pmReloaded.rotated && pmReloaded.fire === pmSmall.fire && pmReloaded.labels.join() === 'BUTTONS: SMALL,SHAPE: TALL', JSON.stringify(pmReloaded));
  ok('pause menu: the layout choices are titled for a wide screen', pmReloaded.title === 'WIDE SCREEN:', pmReloaded.title);
  // Choices are kept for wide (landscape) and tall (portrait) screens separately: those
  // made on this wide screen don't apply on a tall one (the outer screen), and come back
  // when the screen is wide again
  await send('Emulation.setDeviceMetricsOverride', { width: 443, height: 746, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const pmPortraitWindow = await ev(layoutNow);
  ok('pause menu: wide screen choices not used on a tall screen', pmPortraitWindow.labels.join() === 'BUTTONS: AUTO,SHAPE: AUTO' && pmPortraitWindow.title === 'TALL SCREEN:', JSON.stringify(pmPortraitWindow));
  await send('Emulation.setDeviceMetricsOverride', { width: 883, height: 689, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  ok('pause menu: wide screen choices back on a wide screen', (await ev(layoutNow)).labels.join() === 'BUTTONS: SMALL,SHAPE: TALL');
  // It's the screen that counts, not the window: a tall window split with another app on
  // the wide unfolded screen keeps the wide screen's choices
  await send('Emulation.setDeviceMetricsOverride', { width: 442, height: 603, screenWidth: 883, screenHeight: 851, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  const pmSplit = await ev(layoutNow);
  ok('pause menu: a tall window on a wide screen keeps the wide screen choices', pmSplit.labels.join() === 'BUTTONS: SMALL,SHAPE: TALL' && pmSplit.title === 'WIDE SCREEN:', JSON.stringify(pmSplit));
  await send('Emulation.setDeviceMetricsOverride', { width: 883, height: 689, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(600);
  await ev(`document.getElementById('btn-button-size').click(); document.getElementById('btn-view-shape').click(); document.getElementById('btn-view-shape').click()`);
  const pmAuto = await ev(layoutNow);
  ok('pause menu: back to Auto, the layout is as before', pmAuto.labels.join() === 'BUTTONS: AUTO,SHAPE: AUTO' && !pmAuto.rotated && pmAuto.fire === pm0.fire, JSON.stringify(pmAuto));
  // Place cycles Auto, Sides, Below: Sides puts the buttons at the sides of the unfolded
  // screen's playfield, where Auto has them below
  await ev(`document.getElementById('btn-button-place').click()`);
  await sleep(300);
  const pmSides = await ev(`({ label: document.getElementById('btn-button-place').textContent.trim(), sides: document.getElementById('touch-controls').classList.contains('sides') })`);
  ok('pause menu: Place: Sides puts the buttons at the sides', !pmAuto.sides && pmSides.sides && pmSides.label === 'PLACE: SIDES', JSON.stringify(pmSides));
  await ev(`document.getElementById('btn-button-place').click(); document.getElementById('btn-button-place').click()`);
  await sleep(300);
  ok('pause menu: Place back to Auto', await ev(`document.getElementById('btn-button-place').textContent.trim() === 'PLACE: AUTO' && !document.getElementById('touch-controls').classList.contains('sides')`));

  // Buttons at the sides win unless below makes the playfield clearly bigger: with the
  // large buttons on the unfolded screen's Chrome window (and its gesture strip), the
  // sides give a playfield 1% smaller than below, and that's where they go
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 32 } });
  await ev(`localStorage.setItem('asteroids_settings', JSON.stringify({ layout: { landscape: { buttonSize: 'large' } } }))`);
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const ps = await ev(`(() => { const g = window.__asteroidsGameInstance, t = document.getElementById('touch-controls');
    return { sides: t.classList.contains('sides'), small: t.classList.contains('small'), gain: g.sidesGain }; })()`);
  ok('buttons at the sides when below is only slightly bigger (large buttons, 883x689 with a gesture strip)',
    ps.sides && !ps.small && ps.gain < 1, JSON.stringify(ps));
  // A Shape saved as Portrait (its old name) is taken as Tall
  await ev(`localStorage.setItem('asteroids_settings', JSON.stringify({ layout: { landscape: { viewShape: 'portrait' } } }))`);
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  ok('a Shape saved as Portrait is taken as Tall', await ev(`window.__asteroidsGameInstance.viewShape === 'tall' && window.__asteroidsGameInstance.rotated`));
  await ev(`window.__asteroidsGameInstance.setLayoutChoice('viewShape', 'auto')`);
  await ev(`localStorage.removeItem('asteroids_settings')`);
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0 } });

  // The diagnostics panel (triple-tap the logo) shows a table of the layouts tried,
  // with the one picked ticked, and measures again when the window changes size
  await ev(`(() => { const logo = document.getElementById('brand-logo');
    for (let i = 0; i < 3; i++) logo.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); })()`);
  const diag = () => ev(`document.getElementById('diagnostics') ? document.getElementById('diagnostics').textContent : ''`);
  const d1 = await diag();
  ok('diagnostics: table of the layouts tried, one picked', /shape +size +where +header +playfield/.test(d1) && (d1.match(/✓/g) || []).length === 1, d1.split('\n').filter((l) => /✓/.test(l)).join(''));
  await send('Emulation.setDeviceMetricsOverride', { width: 443, height: 746, deviceScaleFactor: 2.4375, mobile: true });
  await sleep(800);
  const d2 = await diag();
  ok('diagnostics: measured again after a resize', d2.includes('window 443x746') && d2.includes('3:4  ') && (d2.match(/✓/g) || []).length === 1,
    d2.split('\n').filter((l) => /window|✓/.test(l)).join(' | '));
  // Its own Buttons and Shape buttons change the layout (the panel covers the pause menu's)
  for (let i = 0; i < 2; i++) await ev(`[...document.querySelectorAll('#diagnostics button')].find((b) => b.textContent.startsWith('Shape')).click()`);
  await sleep(300);
  const d3 = await diag();
  ok('diagnostics: its Shape button changes the layout, and the table follows',
    d3.includes('Shape: wide') && await ev('!window.__asteroidsGameInstance.rotated') && /4:3 .*✓/.test(d3), d3.split('\n').filter((l) => /✓/.test(l)).join(''));
  await ev(`window.__asteroidsGameInstance.setLayoutChoice('viewShape', 'auto')`);
  // Small buttons in two rows are pills too, like the large ones (here on the outer screen)
  await ev(`window.__asteroidsGameInstance.setLayoutChoice('buttonSize', 'small')`);
  await sleep(300);
  const sp = await ev(`(() => { const t = document.getElementById('touch-controls'), b = (id) => document.getElementById(id).getBoundingClientRect();
    return { rows: t.classList.contains('two-row') && t.classList.contains('small'), shapes: ['btn-touch-left', 'btn-touch-fire'].map((id) => +(b(id).width / b(id).height).toFixed(2)) }; })()`);
  ok('small buttons in two rows are pills', sp.rows && sp.shapes.every((r) => r > 1.4), JSON.stringify(sp));
  // Large means the large buttons on any screen, even a narrow one (once, below 640 px
  // wide, the "large" buttons were the small size)
  await ev(`window.__asteroidsGameInstance.setLayoutChoice('buttonSize', 'large')`);
  await sleep(300);
  const lg = await ev(`[innerWidth, ...['btn-touch-left', 'btn-touch-fire'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().height))]`);
  ok('Buttons: Large on a narrow screen: the large buttons', lg[0] < 640 && lg[1] === 72 && lg[2] === 80, JSON.stringify(lg));
  await ev(`window.__asteroidsGameInstance.setLayoutChoice('buttonSize', 'auto')`);
  await ev(`document.getElementById('diagnostics').remove()`);
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0 } });

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

  // The layout depends only on the window, not on the one before it: going fullscreen
  // and back on the outer screen (369x621 -> 369x800 -> 369x621) once came back 4:3 with
  // large buttons, because the large buttons from fullscreen were still on when it
  // measured the upright playfield
  const layout = `(() => { const g = window.__asteroidsGameInstance, t = document.getElementById('touch-controls');
    return JSON.stringify({ upright: g.rotated, buttons: t.className.match(/two-row|small|sides|pill/g), w: Math.round(document.getElementById('game-frame').getBoundingClientRect().width) }); })()`;
  await send('Emulation.setDeviceMetricsOverride', { width: 369, height: 621, deviceScaleFactor: 2.925, mobile: true });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const before = await ev(layout);
  await send('Emulation.setDeviceMetricsOverride', { width: 369, height: 800, deviceScaleFactor: 2.925, mobile: true });
  await sleep(400);
  await send('Emulation.setDeviceMetricsOverride', { width: 369, height: 621, deviceScaleFactor: 2.925, mobile: true });
  await sleep(400);
  const after = await ev(layout);
  ok('outer screen: same layout after going taller and back', before === after, `${before} -> ${after}`);

  // Fullscreen on the outer screen, with a camera cutout reported as a 75 px safe area at
  // the top: the header moves down to sit just above the playfield, clear of the cutout
  await send('Emulation.setDeviceMetricsOverride', { width: 443, height: 961, deviceScaleFactor: 2.4375, mobile: true });
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 75, left: 0, right: 0, bottom: 0 } });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const hd = await ev(`(() => { const h = document.querySelector('header').getBoundingClientRect(), f = document.getElementById('game-frame').getBoundingClientRect();
    return { top: h.top, bottom: h.bottom, frameTop: f.top - 2 }; })()`);
  ok('camera cutout: header is below it and above the playfield', hd.top >= 75 && hd.bottom <= hd.frameTop, JSON.stringify(hd));
  ok('camera cutout: header sits just above the playfield', Math.abs(hd.frameTop - 4 - hd.bottom) <= 1, JSON.stringify(hd));
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0 } });
  return out;
}
