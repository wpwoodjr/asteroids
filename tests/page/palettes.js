// Color palettes: every element color is readable on the near-black background, the
// ship and saucer differ (except all-white Classic), and the palette carries through
// to drawing and the theme button.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  // WCAG relative luminance and contrast ratio
  const lum = (hex) => {
    const [r, gg, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  };
  const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  try {
    ok('5 palettes', THEMES.length === 5, THEMES.map((t) => t.name).join(', '));
    // Colors within a palette must be clearly different hues (not just shades), except Classic
    const hue = (hex) => {
      const [r, gg, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, gg, b), min = Math.min(r, gg, b), d = max - min;
      if (d === 0) return null;
      const h = max === r ? ((gg - b) / d) % 6 : max === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const hueGap = (a, b) => { const x = hue(a), y = hue(b); return x === null || y === null ? 360 : Math.min(Math.abs(x - y), 360 - Math.abs(x - y)); };
    const deep = THEMES.find((t) => t.name === 'Deep Space');
    ok('Deep Space: blue rocks vs cyan ship are distinct hues', hueGap(deep.rock, deep.ship) >= 20, `${hueGap(deep.rock, deep.ship).toFixed(0)}° apart`);
    for (const t of THEMES) {
      const worst = Math.min(...['rock', 'ship', 'saucer'].map((k) => contrast(t[k], '#030305')));
      ok(`${t.name}: all colors readable on black`, worst >= 4.5, `lowest contrast ${worst.toFixed(1)}:1`);
      if (t.name !== 'Classic') {
        ok(`${t.name}: ship and saucer colors differ`, t.ship !== t.saucer && t.rock !== t.ship);
      }
    }
    ok('Classic is all white', ['rock', 'ship', 'saucer'].every((k) => THEMES[0][k] === '#ffffff'));

    // Cycling updates the theme button's name and three dots
    g.setTheme(1);
    const dots = [...document.querySelectorAll('#theme-indicator [data-part]')].map((d) => d.style.backgroundColor);
    ok('theme button shows the palette name and its 3 colors',
       document.getElementById('theme-name').textContent === 'Arcade Color' && dots.length === 3 && new Set(dots).size === 3, dots.join(' | '));

    // Drawing: record the stroke/fill color used for each kind of object
    g.startGame(); g.ufoSpawnTimer = 1e9;
    g.asteroids = [g.createAsteroid(200, 200, 'large')];
    g.spawnUfo(); g.ufo.x = 700; g.ufo.y = 200;
    g.bullets = [{ x: 400, y: 600, vx: 0, vy: 0, life: 1 }];
    g.ufoBullets = [{ x: 600, y: 600, vx: 0, vy: 0, life: 1 }];
    const used = [];
    const ctx = g.ctx;
    const realStroke = ctx.stroke.bind(ctx), realFill = ctx.fill.bind(ctx);
    ctx.stroke = (...a) => { used.push(['stroke', ctx.strokeStyle]); return realStroke(...a); };
    ctx.fill = (...a) => { used.push(['fill', ctx.fillStyle]); return realFill(...a); };
    g.render();
    ctx.stroke = realStroke; ctx.fill = realFill;
    const t = THEMES[1];
    const has = (kind, color) => used.some(([k, c]) => k === kind && c.toLowerCase() === color);
    ok('asteroids drawn in the rock color', has('stroke', t.rock));
    ok('ship drawn in the ship color', has('stroke', t.ship));
    ok('saucer drawn in the saucer color', has('stroke', t.saucer));
    ok('your bullets match the ship, saucer bullets match the saucer', has('fill', t.ship) && has('fill', t.saucer));
    g.removeUfo();
    g.setTheme(0);
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
