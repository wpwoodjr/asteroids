// Replays: a game is recorded as it's played, and playing the recording back gives
// exactly the same game. Phase "play" plays a whole game through the real key
// handlers (random controls, pauses, gravity changes, uneven frame times and hitches)
// and replays it; phase "check" reloads the page and replays the saved games again.
window.addEventListener('load', () => setTimeout(() => {
  const g = window.__asteroidsGameInstance, out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const phase = new URLSearchParams(location.search).get('phase');
  const realRender = g.render;
  g.render = () => {}; // drawing isn't needed here, and the test runs much faster without it

  // A deterministic stream of test choices, separate from the game's own
  let s = 2024;
  const pick = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const key = (type, code, k = code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: k, bubbles: true }));
  const press = (code, k) => { key('keydown', code, k); key('keyup', code, k); };
  let t = performance.now();
  const frame = (ms) => { t += ms; g.loop(t); };

  // Where everything is when the game ends
  const snapshot = () => JSON.stringify({
    score: g.score, wave: g.wave, lives: g.lives,
    rocks: g.asteroids.map((a) => [a.x, a.y, a.vx, a.vy, a.size]),
    ufo: g.ufo && [g.ufo.x, g.ufo.y], bullets: g.bullets.map((b) => [b.x, b.y])
  });
  let replayEnd = null;
  const stopReplay = g.stopReplay;
  g.stopReplay = function () {
    if (this.state === 'GAMEOVER') replayEnd = snapshot();
    return stopReplay.call(this);
  };

  // Play a recorded game to its end, at 4x, with frames of `ms`
  const playBack = (rec, label, ms = 16.7) => {
    replayEnd = null;
    g.startReplay(rec, label);
    g.setReplaySpeed(4);
    for (let i = 0; i < 400000 && g.replay; i++) frame(ms);
    return g.lastReplayResult;
  };

  try {
    if (phase === 'play') {
      try { localStorage.clear(); } catch (e) {}
      g.lastGame = g.bestGame = null;
      g.setGravityLevel(0, false);
      g.startGame();
      const held = { ArrowLeft: false, ArrowRight: false, ArrowUp: false };
      let frames = 0, pauses = 0, gravityChanges = 0, saucers = 0;
      const spawnUfo = g.spawnUfo;
      g.spawnUfo = function () { saucers++; return spawnUfo.call(this); };
      while (g.state !== 'GAMEOVER' && frames < 200000) {
        frames++;
        // A simple player: turn toward the nearest rock or saucer and shoot when lined
        // up, with short random bursts of thrust (held keys change only via key events)
        const want = { ArrowLeft: false, ArrowRight: false, ArrowUp: held.ArrowUp ? pick() > 0.08 : pick() < 0.004 };
        let aligned = false;
        if (g.isShipActive()) {
          const targets = [...g.asteroids, ...(g.ufo ? [g.ufo] : [])];
          let best = null, bestD = Infinity;
          for (const a of targets) {
            const d = Math.hypot(a.x - g.ship.x, a.y - g.ship.y);
            if (d < bestD) { bestD = d; best = a; }
          }
          if (best) {
            const diff = Math.atan2(Math.sin(Math.atan2(best.y - g.ship.y, best.x - g.ship.x) - g.ship.angle),
              Math.cos(Math.atan2(best.y - g.ship.y, best.x - g.ship.x) - g.ship.angle));
            want.ArrowLeft = diff < -0.06;
            want.ArrowRight = diff > 0.06;
            aligned = Math.abs(diff) < 0.2;
          }
        }
        for (const code of Object.keys(held)) {
          if (want[code] !== held[code]) { held[code] = want[code]; key(held[code] ? 'keydown' : 'keyup', code); }
        }
        if (aligned && pick() < 0.3) press('Space', ' ');
        if (pick() < 0.0003) press('ShiftLeft', 'Shift');
        if (pick() < 0.002 && g.state === 'PLAYING') { press('KeyP', 'p'); press('KeyP', 'p'); pauses++; }
        // Gravity: low for a while, then changed while paused (med, high, back off)
        if (frames === 400) { press('KeyG', 'g'); gravityChanges++; }
        if (frames === 1000) {
          press('KeyP', 'p'); pauses++;
          for (let i = 0; i < 3; i++) { press('KeyG', 'g'); gravityChanges++; }
          press('KeyP', 'p');
        }
        if (frames === 300 || frames === 1300) press('ShiftLeft', 'Shift');
        // Mostly ~60 fps with jitter, sometimes 120 fps, now and then a hitch
        const r = pick();
        frame(r < 0.01 ? 90 + pick() * 200 : r < 0.2 ? 8.3 : 16.7 + (pick() - 0.5) * 3);
      }
      ok('a whole game was played', g.state === 'GAMEOVER', `${frames} frames, ${pauses} pauses, ${gravityChanges} gravity changes, ${saucers} saucers, wave ${g.wave}, score ${g.score}`);
      ok('long enough to meet saucers', saucers > 0);
      const original = snapshot();
      const rec = g.lastGame;
      const events = rec.events.map((e) => e % 8);
      ok('the game was recorded', rec && rec.frames.length > 1000 && rec.score === g.score && rec.wave === g.wave,
        rec && `${rec.frames.length} frames, ${rec.events.length} events`);
      ok('shots, hyperspace and gravity changes are in it', events.includes(0) && events.includes(1) && events.some((e) => e >= 2));
      ok('it was saved', JSON.stringify(loadReplay(REPLAY_KEYS.last)) === JSON.stringify(rec));
      ok('a scoring game is saved as the best game', rec.score === 0 || JSON.stringify(loadReplay(REPLAY_KEYS.best)) === JSON.stringify(rec));
      ok('the Replay button shows', !document.getElementById('btn-replay-last').classList.contains('hidden'));
      const gravityBefore = g.gravityLevel;
      const settingsBefore = localStorage.getItem('asteroids_settings');

      // Replay it, with frame times unlike the original's
      delete g.spawnUfo;
      const result = playBack(rec, 'LAST GAME', 11);
      ok('the replay plays the recording to its end', result.finished && result.frame === result.frames, JSON.stringify(result));
      ok('and ends with the same score', result.score === rec.score, `${result.score} vs ${rec.score}`);
      ok('with everything where it was', replayEnd === original);
      ok('afterwards the game over screen is back as it was', g.state === 'GAMEOVER' && snapshot() === original &&
        !document.getElementById('screen-game-over').classList.contains('hidden') &&
        document.getElementById('replay-bar').classList.contains('hidden'));
      ok("the player's gravity setting is back", g.gravityLevel === gravityBefore);
      ok('the replay saved no scores or settings', localStorage.getItem('asteroids_settings') === settingsBefore &&
        JSON.stringify(g.lastGame) === JSON.stringify(rec));

      // The player's controls don't reach the replayed game
      g.startReplay(rec, 'LAST GAME');
      const level = g.gravityLevel;
      for (let i = 0; i < 30; i++) frame(16.7);
      press('KeyG', 'g');
      press('KeyM', 'm'); press('KeyM', 'm');
      const settings = JSON.parse(localStorage.getItem('asteroids_settings'));
      ok('G does nothing during a replay', g.gravityLevel === level);
      ok("muting during a replay saves the player's gravity, not the replay's", settings.gravity === gravityBefore);
      press('KeyP', 'p');
      ok('P pauses a replay', g.state === 'PAUSED' && g.replay);
      press('KeyP', 'p');
      key('keydown', 'Escape', 'Escape');
      ok('Esc stops it and goes back', !g.replay && g.state === 'GAMEOVER' && snapshot() === original);
    } else {
      // After a reload: the saved games load, the buttons show, and both replay exactly
      const last = g.lastGame, best = g.bestGame;
      ok('the saved games load', last && best && last.v === REPLAY_VERSION);
      ok('the start screen offers the best game', !document.getElementById('btn-start-replay-best').classList.contains('hidden') &&
        document.querySelector('#btn-start-replay-best [data-replay-score]').textContent === best.score.toLocaleString());
      const result = playBack(best, 'BEST GAME', 16.7);
      ok('the saved best game replays exactly', result.finished && result.frame === result.frames && result.score === best.score,
        JSON.stringify(result));
      ok('afterwards the start screen is back, with an empty field', g.state === 'START' && g.score === 0 &&
        g.asteroids.length === 0 && !document.getElementById('screen-start').classList.contains('hidden'));

      // Smooth playback: record 20 s at 60 fps with the usual wobble in frame times, then
      // play it back on screens of different rates and count recorded frames per refresh
      g.startGame();
      for (let i = 0; i < 1200; i++) {
        if (i % 25 === 0) press('Space', ' ');
        g.keys.left = i % 300 < 100;
        frame(16.67 + (pick() - 0.5) * 3);
      }
      const steady = { ...g.recording, score: g.score, wave: g.wave };
      g.togglePause();
      const perRefresh = (refreshMs, speed) => {
        const counts = [];
        const stepFrame = g.stepFrame;
        let n = 0;
        g.stepFrame = function (units) { n++; return stepFrame.call(this, units); };
        g.startReplay(steady, 'TEST');
        g.setReplaySpeed(speed);
        for (let i = 0; i < 400 && g.replay; i++) {
          n = 0;
          frame(refreshMs + (pick() - 0.5) * refreshMs * 0.18);
          if (i >= 10 && g.replay) counts.push(n); // after a few refreshes to measure the screen, not the last
        }
        delete g.stepFrame;
        g.stopReplay();
        const tally = {};
        for (const c of counts) tally[c] = (tally[c] || 0) + 1;
        return tally;
      };
      const only = (tally, n) => Object.keys(tally).length === 1 && tally[n] > 0;
      let tally = perRefresh(16.67, 1);
      ok('60 fps game on a 60 Hz screen: one frame every refresh', only(tally, 1), JSON.stringify(tally));
      tally = perRefresh(16.67, 2);
      ok('at 2x: two frames every refresh', only(tally, 2), JSON.stringify(tally));
      tally = perRefresh(16.67, 4);
      ok('at 4x: four frames every refresh', only(tally, 4), JSON.stringify(tally));
      tally = perRefresh(8.33, 1);
      ok('on a 120 Hz screen: a frame every other refresh, never two', !tally[2] && Math.abs(tally[0] - tally[1]) < 40, JSON.stringify(tally));
      tally = perRefresh(11.11, 1);
      ok('on a 90 Hz screen: never two frames in one refresh', !tally[2] && tally[1] > tally[0], JSON.stringify(tally));

      // Restarting from a paused replay starts a real game
      g.startReplay(last, 'LAST GAME');
      for (let i = 0; i < 20; i++) frame(16.7);
      g.togglePause();
      g.startGame();
      ok('Restart from a paused replay starts a new game', !g.replay && g.state === 'PLAYING' && g.recording &&
        document.getElementById('replay-bar').classList.contains('hidden'));
      g.togglePause();

      // Old replays from a different version are ignored
      localStorage.setItem('replay-test', JSON.stringify({ ...best, v: REPLAY_VERSION - 1 }));
      ok('replays from another version are dropped', loadReplay('replay-test') === null);
      localStorage.removeItem('replay-test');

      g.resetScores();
      ok('clearing the scores drops the best game', !g.bestGame && !loadReplay(REPLAY_KEYS.best) &&
        document.getElementById('btn-start-replay-best').classList.contains('hidden'));
    }
  } catch (e) { out.push('ERROR ' + e.stack); }
  g.render = realRender;
  window.__testResults = out;
  window.__testDone = true;
}, 300));
