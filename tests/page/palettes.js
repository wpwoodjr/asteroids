// Color palettes: every element color is readable on the near-black background, the
// ship and saucer differ (except all-white Classic), and the palette carries through
// to drawing and the theme button. The Nebula palette draws shaded pictures.
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
    ok('3 palettes', THEMES.length === 3, THEMES.map((t) => t.name).join(', '));
    for (const t of THEMES) {
      const worst = Math.min(...['rock', 'ship', 'saucer'].map((k) => contrast(t[k], '#030305')));
      ok(`${t.name}: all colors readable on black`, worst >= 4.5, `lowest contrast ${worst.toFixed(1)}:1`);
      if (t.name !== 'Classic') {
        ok(`${t.name}: ship and saucer colors differ`, t.ship !== t.saucer && t.rock !== t.ship);
      }
    }
    ok('Classic is all white', ['rock', 'ship', 'saucer'].every((k) => THEMES[0][k] === '#ffffff'));

    // Cycling updates the theme button's name and its ship, drawn in the ship color
    g.paletteChosen = true; // a picked palette stays put when a game starts
    g.setTheme(1);
    const shipIcon = document.querySelector('#theme-indicator path').getAttribute('stroke');
    ok('theme button shows the palette name and its ship color',
       document.getElementById('theme-name').textContent === 'Neon' && shipIcon === THEMES[1].ship, shipIcon);

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

    // Nebula: shaded pictures instead of lines. It draws everything, at every gravity
    // level, without using the game's random numbers (so replays play out the same)
    const real = THEMES.findIndex((x) => x.realistic);
    ok('Nebula is the last palette', real === THEMES.length - 1 && THEMES[real].name === 'Nebula');
    g.setTheme(real);
    g.startGame(); g.ufoSpawnTimer = 1e9;
    g.asteroids = [g.createAsteroid(200, 200, 'large'), g.createAsteroid(800, 600, 'small')];
    g.spawnUfo(); g.ufo.x = 700; g.ufo.y = 200;
    g.bullets = [{ x: 400, y: 600, vx: 300, vy: 0, life: 1 }];
    g.ufoBullets = [{ x: 600, y: 600, vx: 0, vy: 200, life: 1 }];
    g.createParticleBurst(500, 500, 20, THEMES[real].rock);
    g.keys.thrust = true;
    let rolls = 0, drawError = null;
    const gameRandom = g.random, fxRandom = g.fxRandom, gravity = g.gravityLevel;
    for (const level of [0, 1]) {
      g.setGravityLevel(level, false);
      g.random = () => { rolls++; return gameRandom(); };
      g.fxRandom = () => { rolls++; return fxRandom(); };
      try { g.render(); } catch (e) { drawError = e; }
      g.random = gameRandom; g.fxRandom = fxRandom;
    }
    ok('Nebula draws everything at every gravity level', !drawError, drawError ? String(drawError) : '');
    ok("Nebula drawing doesn't use the game's random numbers", rolls === 0, `${rolls} rolls`);
    // Inside the rock (not on its outline) is painted, not left as dark sky
    const n = Math.max(3, Math.round(10 * g.scaleX));
    const px = g.ctx.getImageData(Math.round(200 * g.scaleX) - n, Math.round(200 * g.scaleY) - n, n * 2, n * 2).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
    const avg = sum / (px.length / 4);
    ok('the rock is painted solid, not outlined', avg > 60, `brightness ${avg.toFixed(0)} (sky is about 15)`);
    ok('the page keeps the ship color for its tint', getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() === THEMES[real].ship);
    g.keys.thrust = false;
    g.setGravityLevel(gravity, false);
    g.removeUfo();
    g.setTheme(0);

    // Until the player picks a palette, it changes with the waves: Classic, then Neon at
    // wave 2 and Nebula from wave 3, with a hint under the banner at each switch
    const name = () => document.getElementById('theme-name').textContent;
    g.paletteChosen = false; g.paletteReached = 0; g.setTheme(2);
    g.startGame(); g.ufoSpawnTimer = 1e9;
    ok('auto: the first game starts in Classic, with no hint', name() === 'Classic' && g.paletteHint === '', name());
    g.createWave(2);
    ok('auto: Neon at wave 2, with a hint', name() === 'Neon' && /^NEON PALETTE - (PRESS C|TAP THE PALETTE BUTTON) TO CHANGE$/.test(g.paletteHint), g.paletteHint);
    g.render();
    g.createWave(3);
    ok('auto: Nebula at wave 3, with a hint', name() === 'Nebula' && g.paletteHint.startsWith('NEBULA PALETTE'), g.paletteHint);
    g.createWave(4);
    ok('auto: stays Nebula after that, with no hint', name() === 'Nebula' && g.paletteHint === '');

    // The furthest palette reached stays for the next games, and is saved
    g.paletteReached = 1; g.setTheme(0); g.persistSettings();
    g.startGame();
    ok('auto: after reaching Neon, the next game starts in Neon, with no hint', name() === 'Neon' && g.paletteHint === '', name());
    ok('auto: Neon reached is saved', JSON.parse(localStorage.getItem('asteroids_settings')).paletteReached === 'Neon');
    g.createWave(2);
    ok('auto: still Neon at wave 2, with no hint', name() === 'Neon' && g.paletteHint === '');
    g.setTheme(0); g.applySavedSettings();
    ok('auto: on the next visit, Neon from the start', name() === 'Neon' && g.paletteReached === 1, name());
    g.replay = { fake: true }; g.createWave(3); g.replay = null;
    ok('auto: a replay that reaches Nebula switches to it but does not keep it', name() === 'Nebula' && g.paletteReached === 1);
    g.createWave(3);
    ok('auto: reaching Nebula in a game keeps it', g.paletteReached === 2 &&
       JSON.parse(localStorage.getItem('asteroids_settings')).paletteReached === 'Nebula');
    g.startGame();
    ok('auto: and the next game starts in Nebula', name() === 'Nebula', name());
    g.createWave(2); g.cycleTheme();
    ok('picking a palette clears the hint', g.paletteChosen && g.paletteHint === '');
    const picked = name();
    g.startGame(); g.createWave(2); g.createWave(3);
    ok('picked: the palette no longer changes with the waves', name() === picked && g.paletteHint === '', name());
    g.paletteChosen = false; g.paletteReached = 0; g.setTheme(0); g.persistSettings();
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
