// Settings persistence. Runs twice in the same browser profile:
// ?phase=set changes every setting, ?phase=check reloads and verifies they came back.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c) => out.push((c ? 'PASS ' : 'FAIL ') + n);
  const phase = new URLSearchParams(location.search).get('phase');
  try {
    if (phase === 'set') {
      localStorage.removeItem('asteroids_settings');
      g.cycleTheme(); g.cycleTheme();       // Green Screen
      g.toggleAudio();                      // muted
      g.toggleGravity(); g.toggleGravity(); // MED
      const saved = JSON.parse(localStorage.getItem('asteroids_settings'));
      ok('settings saved', saved && saved.theme === 2 && saved.muted === true && saved.gravity === 2);
    } else {
      ok('palette restored (Green Screen)', document.getElementById('theme-name').textContent === 'Green Screen');
      ok('CRT overlay removed', !document.getElementById('overlay-scanlines') && !document.getElementById('btn-scanlines'));
      ok('mute restored', g.sound.muted && document.getElementById('audio-icon').textContent === '🔇');
      ok('gravity restored (MED)', g.gravityLevel === 2 && g.gravityMode && g.planet.mass === 980000
         && document.getElementById('gravity-status').textContent === 'MED');
      ok('no gravity announcement on load', g.floatingTexts.length === 0);
      // Corrupt saved settings must not break startup
      localStorage.setItem('asteroids_settings', '{bad json');
      ok('corrupt settings tolerated', Object.keys(loadSettings()).length === 0);
    }
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
