// Settings persistence. Runs twice in the same browser profile:
// ?phase=set changes every setting, ?phase=check reloads and verifies they came back.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c) => out.push((c ? 'PASS ' : 'FAIL ') + n);
  const phase = new URLSearchParams(location.search).get('phase');
  try {
    if (phase === 'set') {
      localStorage.removeItem('asteroids_settings');
      g.toggleAudio(); g.toggleAudio();
      const before = JSON.parse(localStorage.getItem('asteroids_settings'));
      ok('no palette saved until the player picks one', before && before.palette === undefined);
      g.setTheme(0); g.cycleTheme(); g.cycleTheme(); // Nebula
      g.toggleAudio();                      // muted
      g.toggleGravity();                    // on (between games, as now)
      const saved = JSON.parse(localStorage.getItem('asteroids_settings'));
      ok('settings saved', saved && saved.palette === 'Nebula' && saved.muted === true && saved.gravity === 1);
    } else {
      ok('palette restored (Nebula)', document.getElementById('theme-name').textContent === 'Nebula');
      ok('a restored palette counts as picked', g.paletteChosen === true);
      const themeName = () => document.getElementById('theme-name').textContent;
      const fromSaved = (palette) => {
        localStorage.setItem('asteroids_settings', JSON.stringify({ ...loadSettings(), palette }));
        g.applySavedSettings();
        return themeName();
      };
      localStorage.setItem('asteroids_settings', JSON.stringify({ theme: 'Nebula' }));
      g.applySavedSettings();
      ok('a palette saved by an older version is ignored (automatic palettes)', themeName() === 'Classic' && !g.paletteChosen);
      ok('unknown saved palette falls back to Classic', fromSaved('Plaid') === 'Classic' && !g.paletteChosen);
      ok('CRT overlay removed', !document.getElementById('overlay-scanlines') && !document.getElementById('btn-scanlines'));
      ok('mute restored', g.sound.muted && document.getElementById('audio-icon').textContent === '🔇');
      ok('gravity restored (on)', g.gravityLevel === 1 && g.gravityMode && g.planet.mass === 450000
         && [...document.querySelectorAll('[data-gravity-status]')].every((s) => s.textContent === 'ON'));
      ok('no gravity announcement on load', g.floatingTexts.length === 0);
      // Gravity saved when it had levels (Low, Med, High) is on
      localStorage.setItem('asteroids_settings', JSON.stringify({ ...loadSettings(), gravity: 3 }));
      g.applySavedSettings();
      ok('gravity saved as High (an older version) is on', g.gravityLevel === 1 && g.planet.mass === 450000);
      // Corrupt saved settings must not break startup
      localStorage.setItem('asteroids_settings', '{bad json');
      ok('corrupt settings tolerated', Object.keys(loadSettings()).length === 0);
    }
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
