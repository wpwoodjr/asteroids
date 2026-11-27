// Gravity on or off, with separate scores: games with gravity have their own Hall of
// Fame list (with its own made-up scores to beat), high score and best game. Gravity is
// set between games, on the start and game over screens.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const keys = ['asteroids_leaderboard', 'asteroids_high_score', 'asteroids_leaderboard_gravity', 'asteroids_high_score_gravity',
    'asteroids_initials', 'asteroids_replay_last', 'asteroids_replay_best', 'asteroids_replay_best_gravity', 'asteroids_settings'];
  const kept = Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)]));
  const board = (key) => JSON.parse(localStorage.getItem(key) || 'null');
  const text = (selector) => document.querySelector(selector).textContent.trim();
  // Play a game that ends with the given score (on whatever gravity is set)
  const finish = (score) => {
    g.startGame(); g.ufo = null; g.ufoSpawnTimer = 1e9; g.lives = 1;
    g.score = score; g.lastExtraLifeScore = score;
    g.onShipDeath();
    for (let t = 0; t < 3.2 && g.state === 'PLAYING'; t += 0.05) g.update(0.05);
  };
  try {
    for (const k of keys) localStorage.removeItem(k);
    g.highScores = [loadHighScore(0), loadHighScore(1)];
    g.bestGames = [null, null]; g.lastGame = null;
    g.setGravityLevel(0, false);

    // Where gravity is set
    const toggles = (selector) => document.querySelectorAll(`${selector} [data-gravity-toggle]`).length;
    ok('a Gravity button on the start and game over screens, not in the pause menu or header',
      toggles('#screen-start') === 1 && toggles('#screen-game-over') === 1 && toggles('#screen-pause') === 0 && toggles('header') === 0);
    g.state = 'START';
    document.querySelector('#screen-start [data-gravity-toggle]').click();
    const statuses = () => [...document.querySelectorAll('[data-gravity-status]')].map((s) => s.textContent);
    ok('Gravity: On, on both screens', g.gravityLevel === 1 && g.gravityMode && statuses().every((s) => s === 'ON'), statuses().join());
    ok('with its own high score (the gravity list starts at 9,250)', text('#start-high-score') === '9,250' && g.highScore === 9250);
    document.querySelector('#screen-start [data-gravity-toggle]').click();
    ok('and back to Off, the high score without gravity', g.gravityLevel === 0 && statuses().every((s) => s === 'OFF') &&
      text('#start-high-score') === '15,420');

    // A game with gravity goes on the gravity list only
    g.setGravityLevel(1, false);
    finish(4000);
    const withGravity = board('asteroids_leaderboard_gravity');
    ok('a game with gravity goes on the gravity list', withGravity && withGravity.some((e) => e.score === 4000 && e.name === 'YOU'),
      withGravity && withGravity.map((e) => e.score).join());
    ok('and not on the list without gravity', board('asteroids_leaderboard') === null);
    ok('its best game is kept with gravity', g.bestGames[1] && g.bestGames[1].score === 4000 && !g.bestGames[0] &&
      loadReplay(REPLAY_KEYS.bestGravity).score === 4000 && !loadReplay(REPLAY_KEYS.best));
    // Initials go on the list the game went on, even after gravity is changed on the
    // game over screen
    document.querySelector('#screen-game-over [data-gravity-toggle]').click();
    ok('gravity can be changed on the game over screen', g.state === 'GAMEOVER' && g.gravityLevel === 0);
    const input = document.getElementById('initials-input');
    input.value = 'GRV';
    g.commitInitials();
    ok('initials saved on the gravity list', board('asteroids_leaderboard_gravity').some((e) => e.score === 4000 && e.name === 'GRV') &&
      board('asteroids_leaderboard') === null && g.bestGames[1].name === 'GRV');

    // A higher score without gravity: its own high score; the gravity one stays
    finish(16000);
    ok('a game without gravity goes on its own list', board('asteroids_leaderboard')[0].score === 16000 &&
      !board('asteroids_leaderboard_gravity').some((e) => e.score === 16000));
    ok('separate high scores', g.highScores[0] === 16000 && g.highScores[1] === 9250, JSON.stringify(g.highScores));
    ok('separate best games', g.bestGames[0].score === 16000 && g.bestGames[1].score === 4000);
    const bestShown = () => text('#btn-replay-best [data-replay-score]');
    const offBest = bestShown();
    document.querySelector('#screen-game-over [data-gravity-toggle]').click();
    ok('the Best Game button shows the best game for the gravity chosen', offBest.endsWith('16,000') && bestShown() === 'GRV 4,000',
      `${offBest} / ${bestShown()}`);

    // Switching gravity on the start screen doesn't move it, though there's a best game
    // to watch for only one of the settings (its button keeps its place, blank)
    g.bestGames = [null, g.bestGames[1]];
    g.state = 'START';
    document.getElementById('screen-game-over').classList.add('hidden');
    document.getElementById('screen-start').classList.remove('hidden');
    const menuTop = () => document.querySelector('#screen-start .overlay-fit').offsetTop;
    const startBest = document.getElementById('btn-start-replay-best');
    const tops = [], shown = [];
    for (let i = 0; i < 2; i++) {
      document.querySelector('#screen-start [data-gravity-toggle]').click();
      tops.push(menuTop()); shown.push(getComputedStyle(startBest).visibility === 'visible' && !startBest.classList.contains('hidden'));
    }
    // (gravity was on: off, then on again)
    ok("switching gravity doesn't move the start screen", tops[0] === tops[1] && shown.join() === 'false,true', JSON.stringify({ tops, shown, gravity: g.gravityLevel }));
    document.getElementById('screen-start').classList.add('hidden');
    document.getElementById('screen-game-over').classList.remove('hidden');
    g.state = 'GAMEOVER';
    g.setGravityLevel(1, false);

    // The Hall of Fame: a tab for each list, opening on the one for the gravity set
    const names = () => [...document.querySelectorAll('#leaderboard-list > div')].map((r) => r.children[1].textContent);
    const scores = () => [...document.querySelectorAll('#leaderboard-list > div')].map((r) => r.children[3].textContent);
    const pressed = () => [...document.querySelectorAll('[data-scores-tab]')].map((t) => t.getAttribute('aria-pressed'));
    document.getElementById('btn-game-over-scores').click();
    ok('Hall of Fame opens on the gravity list (gravity on)', pressed().join() === 'false,true' && names()[0] === 'PLN' && names().includes('GRV'),
      names().join());
    document.querySelector('[data-scores-tab="0"]').click();
    ok('its other tab shows the list without gravity', pressed().join() === 'true,false' && scores()[0] === '16,000' && !scores().includes('4,000'),
      scores().join());
    // Reset clears only the list showing
    g.resetScores();
    ok('Reset clears only the list showing', board('asteroids_leaderboard') === null && board('asteroids_leaderboard_gravity').length === 10 &&
      g.highScores[0] === 15420 && g.highScores[1] === 9250 && !g.bestGames[0] && g.bestGames[1], JSON.stringify(g.highScores));
    document.getElementById('btn-scores-ok').click();
    document.querySelector('#screen-game-over [data-gravity-toggle]').click();
    document.getElementById('btn-game-over-scores').click();
    ok('with gravity off it opens on the list without gravity', pressed().join() === 'true,false');
    document.getElementById('btn-scores-ok').click();
  } catch (e) { out.push('ERROR ' + e.stack); }
  for (const k of keys) {
    if (kept[k] === null) localStorage.removeItem(k);
    else localStorage.setItem(k, kept[k]);
  }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
