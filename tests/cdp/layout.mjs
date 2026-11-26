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
    return { rotated: g.rotated, w: f.width, h: f.height, view: [g.viewW, g.viewH], grown: o.classList.contains('menu-expanded'),
      scale: t === 'none' ? 1 : new DOMMatrix(t).a, canvas: [g.canvas.width, g.canvas.height] };
  })()`);
  ok('portrait phone: playfield shown upright', u.rotated && u.view[0] === 750 && u.view[1] === 1000);
  ok('portrait phone: upright playfield is much bigger than 4:3 would be', u.w * u.h > 1.5 * u.w * (u.w * 3 / 4), `${Math.round(u.w)}x${Math.round(u.h)}`);
  ok('portrait phone: canvas is portrait too', u.canvas[1] > u.canvas[0], u.canvas.join('x'));
  ok('portrait phone: start screen fits on the playfield', !u.grown && u.scale > 0.95, `scale ${u.scale.toFixed(2)}`);
  // A playfield limited by the width uses <main>'s side padding, lining up with the header
  const edges = await ev(`(() => {
    const f = document.getElementById('game-frame').getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect();
    return { left: f.left - 2 - h.left, right: h.right - (f.right + 2) }; // 2: the outline outside the frame
  })()`);
  ok('portrait phone: playfield reaches the edges of the header', Math.abs(edges.left) <= 1 && Math.abs(edges.right) <= 1, JSON.stringify(edges));

  // A short phone in landscape: the start screen doesn't fit the playfield, so it grows
  // to cover the area between the header and footer. The touch buttons are at the sides
  // here, so it grows only between them, and they stay in view.
  // Starting a game puts the buttons back.
  await send('Emulation.setDeviceMetricsOverride', { width: 790, height: 411, deviceScaleFactor: 2.625, mobile: true });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const p = await ev(`(() => {
    const o = document.getElementById('screen-start'), c = o.querySelector('.overlay-fit');
    const t = getComputedStyle(c).transform, frame = document.getElementById('game-frame').getBoundingClientRect();
    const r = o.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return { grown: r.height > frame.height + 1, scale: t === 'none' ? 1 : new DOMMatrix(t).a, scrolls: o.style.overflowY === 'auto',
      fits: cr.top >= r.top - 0.5 && cr.bottom <= r.bottom + 0.5,
      placed: { off: [r.left - parseFloat(o.style.left), r.top - parseFloat(o.style.top)], onScreen: r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 },
      touchShown: getComputedStyle(document.getElementById('touch-controls')).visibility === 'visible',
      clearOfButtons: r.left >= document.getElementById('btn-touch-hyperspace').getBoundingClientRect().right
        && r.right <= document.getElementById('btn-touch-fire').getBoundingClientRect().left };
  })()`);
  ok('landscape phone: playfield is not upright', !(await ev('window.__asteroidsGameInstance.rotated')));
  ok('landscape phone: start screen grows past the playfield', p.grown);
  // (a transform on the playfield's frame once made it land offset by the frame's position)
  ok('landscape phone: grown start screen sits where it was placed, on screen',
    Math.abs(p.placed.off[0]) < 0.5 && Math.abs(p.placed.off[1]) < 0.5 && p.placed.onScreen, JSON.stringify(p.placed));
  // (below 55% the text is too small to read, so it scrolls at full size instead)
  ok('landscape phone: start screen readable (fits at 55% or more, or scrolls)',
    p.scrolls ? p.scale > 0.95 : p.fits && p.scale >= 0.55, `scale ${p.scale.toFixed(2)}`);
  ok('landscape phone: side touch buttons stay in view beside it', p.touchShown && p.clearOfButtons);
  await ev('window.__asteroidsGameInstance.startGame()');

  // On a landscape phone the touch buttons go to the sides, which makes the playfield
  // much bigger than with them below (310x232 before). Each hand's buttons stand in a
  // column (left: rotate left, rotate right, Hyperspace; right: Fire, Thrust, Pause, top
  // to bottom), with the middle one halfway up the window.
  const sd = await ev(`(() => {
    const box = (id) => document.getElementById(id).getBoundingClientRect(), f = box('game-frame');
    const mid = (id) => { const b = box(id); return b.top + b.height / 2; };
    return { sides: document.getElementById('touch-controls').classList.contains('sides'), frame: [f.width, f.height],
      leftOrder: box('btn-touch-left').top < box('btn-touch-right').top && box('btn-touch-right').top < box('btn-touch-hyperspace').top,
      rightOrder: box('btn-touch-fire').top < box('btn-touch-thrust').top && box('btn-touch-thrust').top < box('btn-touch-pause').top,
      middles: [mid('btn-touch-right'), mid('btn-touch-thrust')], half: innerHeight / 2,
      clear: box('btn-touch-hyperspace').right <= f.left - 2 && box('btn-touch-fire').left >= f.right + 2 };
  })()`);
  ok('landscape phone: touch buttons at the sides', sd.sides);
  ok('landscape phone: playfield much bigger with them there', sd.frame[0] * sd.frame[1] > 1.5 * 310 * 232, sd.frame.map(Math.round).join('x'));
  ok('landscape phone: side buttons in order, top to bottom', sd.leftOrder && sd.rightOrder);
  ok('landscape phone: rotate right and Thrust halfway up', sd.middles.every((m) => Math.abs(m - sd.half) <= 1), JSON.stringify(sd));
  ok('landscape phone: side buttons clear of the playfield', sd.clear);

  // ...and the header moves into the side areas above them, which makes the playfield
  // bigger still (422x316 with the header on top): the logo and three settings above
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
  ok('landscape phone: all six settings buttons there', hs.settings === 6);
  // (the width beside the columns limits the playfield here, so dropping the footer
  // wouldn't make it bigger: it stays)
  ok('landscape phone: footer kept (hiding it gains nothing here)', await ev(`getComputedStyle(document.querySelector('footer')).display !== 'none'`));

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
  // on the phone sideways, 407x543 on the outer screen upright), and the bottom of the
  // page still keeps clear of a gesture-bar strip
  for (const [w, h, before] of [[961, 330, 375 * 281], [443, 746, 407 * 543]]) {
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
  // Auto, Landscape, Portrait; each lays the page out again and is remembered
  await send('Emulation.setDeviceMetricsOverride', { width: 883, height: 689, deviceScaleFactor: 2.4375, mobile: true });
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const layoutNow = `(() => { const g = window.__asteroidsGameInstance;
    return { rotated: g.rotated, sides: document.getElementById('touch-controls').classList.contains('sides'), fire: Math.round(document.getElementById('btn-touch-fire').getBoundingClientRect().width),
      labels: [document.getElementById('btn-button-size').textContent.trim(), document.getElementById('btn-view-shape').textContent.trim()] }; })()`;
  await ev(`window.__asteroidsGameInstance.startGame(); window.__asteroidsGameInstance.togglePause()`);
  const pm0 = await ev(layoutNow);
  await ev(`document.getElementById('btn-button-size').click(); document.getElementById('btn-button-size').click()`);
  const pmSmall = await ev(layoutNow);
  ok('pause menu: Buttons: Small makes the touch buttons smaller', pmSmall.labels[0] === 'BUTTONS: SMALL' && pmSmall.fire < pm0.fire, JSON.stringify([pm0, pmSmall]));
  await ev(`document.getElementById('btn-view-shape').click(); document.getElementById('btn-view-shape').click()`);
  const pmPortrait = await ev(layoutNow);
  ok('pause menu: Shape: Portrait shows the playfield upright on a landscape screen, buttons at its sides', !pm0.rotated && pmPortrait.sides && pmPortrait.rotated && pmPortrait.labels[1] === 'SHAPE: PORTRAIT', JSON.stringify(pmPortrait));
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const pmReloaded = await ev(layoutNow);
  ok('pause menu: layout choices remembered after a reload', pmReloaded.rotated && pmReloaded.fire === pmSmall.fire && pmReloaded.labels.join() === 'BUTTONS: SMALL,SHAPE: PORTRAIT', JSON.stringify(pmReloaded));
  await ev(`document.getElementById('btn-button-size').click(); document.getElementById('btn-view-shape').click()`);
  const pmAuto = await ev(layoutNow);
  ok('pause menu: back to Auto, the layout is as before', pmAuto.labels.join() === 'BUTTONS: AUTO,SHAPE: AUTO' && !pmAuto.rotated && pmAuto.fire === pm0.fire, JSON.stringify(pmAuto));

  // Buttons at the sides win unless below makes the playfield clearly bigger: with the
  // large buttons on the unfolded screen's Chrome window (and its gesture strip), the
  // sides give a playfield 1% smaller than below, and that's where they go
  await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 32 } });
  await ev(`localStorage.setItem('asteroids_settings', JSON.stringify({ buttonSize: 'large' }))`);
  await send('Page.navigate', { url: `${base}/asteroids.html` });
  await sleep(2500);
  const ps = await ev(`(() => { const g = window.__asteroidsGameInstance, t = document.getElementById('touch-controls');
    return { sides: t.classList.contains('sides'), small: t.classList.contains('small'), gain: g.sidesGain }; })()`);
  ok('buttons at the sides when below is only slightly bigger (large buttons, 883x689 with a gesture strip)',
    ps.sides && !ps.small && ps.gain < 1, JSON.stringify(ps));
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
  await ev(`[...document.querySelectorAll('#diagnostics button')].find((b) => b.textContent.startsWith('Shape')).click()`);
  await sleep(300);
  const d3 = await diag();
  ok('diagnostics: its Shape button changes the layout, and the table follows',
    d3.includes('Shape: landscape') && await ev('!window.__asteroidsGameInstance.rotated') && /4:3 .*✓/.test(d3), d3.split('\n').filter((l) => /✓/.test(l)).join(''));
  await ev(`window.__asteroidsGameInstance.setLayoutChoice('viewShape', 'auto')`);
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
    return JSON.stringify({ upright: g.rotated, buttons: t.className.match(/two-row|big/g), w: Math.round(document.getElementById('game-frame').getBoundingClientRect().width) }); })()`;
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
