// High scores with initials: a score that makes the top 10 goes on the Hall of Fame at
// once and the game over screen asks for initials. Typing doesn't trigger game keys,
// Enter saves them without starting a game, and they're offered again next time.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const box = document.getElementById('initials-entry'), input = document.getElementById('initials-input');
  const shown = () => !box.classList.contains('hidden');
  const keys = ['asteroids_leaderboard', 'asteroids_high_score', 'asteroids_initials', 'asteroids_replay_last', 'asteroids_replay_best'];
  const kept = Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)]));
  // Play a game that ends with the given score
  const finish = (score) => {
    g.startGame(); g.ufo = null; g.ufoSpawnTimer = 1e9; g.lives = 1;
    g.setGravityLevel(0, false);
    g.score = score; g.lastExtraLifeScore = score;
    g.onShipDeath();
    for (let t = 0; t < 3.2 && g.state === 'PLAYING'; t += 0.05) g.update(0.05);
  };
  const board = () => JSON.parse(localStorage.getItem('asteroids_leaderboard'));
  try {
    for (const k of keys) localStorage.removeItem(k);
    g.bestGame = null; g.lastGame = null;

    // A board saved when there were 5 places is filled up to 10 with default scores
    localStorage.setItem('asteroids_leaderboard', JSON.stringify([
      { name: 'ACE', score: 15420, wave: 8 }, { name: 'YOU', score: 11000, wave: 5 }, { name: 'VEC', score: 9850, wave: 6 },
      { name: 'PIL', score: 6240, wave: 5 }, { name: 'CMD', score: 3890, wave: 3 }]));
    const old = loadLeaderboard();
    ok('an old board of 5 is filled up to 10', old.length === 10 && old[1].name === 'YOU' &&
       old.filter((e) => e.name === 'ACE').length === 1 && old[9].name === 'BLT', old.map((e) => e.name).join(','));
    localStorage.setItem('asteroids_leaderboard', JSON.stringify([{ name: 'LOW', score: 50, wave: 1 }]));
    const low = loadLeaderboard();
    ok('filling up never pushes a saved score off', low.length === 10 && low[9].name === 'LOW', low.map((e) => e.name).join(','));
    localStorage.removeItem('asteroids_leaderboard');

    // After a touch, the box doesn't take the focus (that would pop up the phone keyboard)
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    finish(20000);
    ok('after a touch, the phone keyboard is not popped up', shown() && document.activeElement !== input);
    ok('the box has YOU in it the first time', input.value === 'YOU', input.value);
    input.dispatchEvent(new FocusEvent('focus'));
    ok('tapping into the box selects it, so typing replaces it', input.selectionStart === 0 && input.selectionEnd === 3);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    ok('saving it keeps YOU', board().some((e) => e.name === 'YOU' && e.score === 20000) && !shown());
    localStorage.removeItem('asteroids_leaderboard');
    g.bestGame = null; // so the next game is the best one again

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft', bubbles: true }));
    finish(20000);
    ok('a top 10 score asks for initials', g.state === 'GAMEOVER' && shown());
    ok('the box has the focus, ready to type', document.activeElement === input);
    ok('the score is on the board at once, as YOU the first time', board().some((e) => e.name === 'YOU' && e.score === 20000));

    // Typing: the keys are letters, not game keys
    const theme = currentThemeIdx, muted = g.sound.muted;
    for (const key of ['c', 'm', 'r', ' ']) input.dispatchEvent(new KeyboardEvent('keydown', { key, code: key === ' ' ? 'Space' : 'Key' + key.toUpperCase(), bubbles: true }));
    ok('typing C, M, R or Space does nothing to the game', currentThemeIdx === theme && g.sound.muted === muted && g.state === 'GAMEOVER');
    input.value = 'wp-w9'; input.dispatchEvent(new Event('input', { bubbles: true }));
    ok('only letters and digits, in capitals, at most 3', input.value === 'WPW', input.value);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    ok('Enter saves the initials without starting a game', g.state === 'GAMEOVER' && !shown());
    ok('the board entry gets the initials', board().some((e) => e.name === 'WPW' && e.score === 20000));
    ok('the best game gets the initials', g.bestGame && g.bestGame.name === 'WPW' &&
       document.querySelector('#btn-replay-best [data-replay-score]').textContent === 'WPW 20,000');

    g.renderLeaderboard();
    const rows = [...document.getElementById('leaderboard-list').children];
    ok('the Hall of Fame shows 10 scores', rows.length === 10, `${rows.length} rows`);
    ok("this game's score is highlighted", rows.filter((r) => r.classList.contains('you')).length === 1 &&
       rows[0].classList.contains('you') && rows[0].textContent.includes('WPW'));

    // A score below the 10th doesn't ask
    finish(100);
    ok('a score that misses the top 10 does not ask', g.state === 'GAMEOVER' && !shown() && !board().some((e) => e.score === 100));

    // Next time the box offers the last initials; Play Again keeps them
    finish(5000);
    ok('the last initials are offered next time', shown() && input.value === 'WPW', input.value);
    ok('they are already on the board', board().some((e) => e.name === 'WPW' && e.score === 5000));
    input.value = 'AB'; input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('btn-play-again').click();
    ok('Play Again saves what was typed', g.state === 'PLAYING' && !shown() && board().some((e) => e.name === 'AB' && e.score === 5000));
    g.togglePause();

    // An empty box keeps the name the entry already has. (Leaving the box saves too, but
    // the test browser's window has no focus, so it doesn't send blur events.)
    finish(6000);
    input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    ok('saving an empty box keeps the offered name', !shown() && board().some((e) => e.name === 'AB' && e.score === 6000));
    finish(7000);
    input.value = 'Z'; input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('btn-initials-ok').click();
    ok('the OK button saves them too', !shown() && board().some((e) => e.name === 'Z' && e.score === 7000));

    // All of the player's scores are picked out softly; the game just played has the box
    saveInitials('AB');
    g.renderLeaderboard();
    const look = [...document.getElementById('leaderboard-list').children].map((r) => ({
      name: r.children[1].textContent, box: r.classList.contains('you'), mine: r.classList.contains('mine') }));
    ok("the player's other scores are picked out, without the box",
       look.filter((r) => r.name === 'AB').length === 2 && look.filter((r) => r.name === 'AB').every((r) => r.mine && !r.box), JSON.stringify(look.filter((r) => r.mine || r.box)));
    ok("the game just played still has the box", look.filter((r) => r.box).length === 1 && look.find((r) => r.box).name === 'Z');
    ok("other players' scores are plain", look.filter((r) => r.name !== 'AB' && r.name !== 'Z').every((r) => !r.mine && !r.box));
  } catch (e) { out.push('ERROR ' + e.stack); }
  // Put back what this test changed, for the tests that share this browser profile
  for (const k of keys) { if (kept[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, kept[k]); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
