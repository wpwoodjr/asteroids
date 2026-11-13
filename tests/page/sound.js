// Sound checks: renders game sounds offline and measures how much of each would come
// out of a small phone speaker, simulated as a high-pass filter at 250 Hz.
window.addEventListener('load', () => setTimeout(async () => {
  const out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  let lastPeak = 0; // peak sample of the most recent render
  let lastPart = null; // samples of the most recent render
  const rms = (data) => Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);

  // Render one sound through the real SoundEngine into an offline context
  // fromSec/toSec measure just part of the sound (e.g. the attack or the body)
  const render = async (play, highpassHz = 0, fromSec = 0, toSec = 0.3) => {
    const ctx = new OfflineAudioContext(1, Math.floor(44100 * 3.2), 44100);
    const sound = new SoundEngine();
    sound.ctx = ctx;
    sound.ensureActive = () => {};
    sound.masterGain = ctx.createGain();
    if (highpassHz) {
      // Two stacked filters give a steep cutoff, like a small speaker
      const hp1 = ctx.createBiquadFilter(), hp2 = ctx.createBiquadFilter();
      hp1.type = hp2.type = 'highpass';
      hp1.frequency.value = hp2.frequency.value = highpassHz;
      sound.masterGain.connect(hp1); hp1.connect(hp2); hp2.connect(ctx.destination);
    } else {
      sound.masterGain.connect(ctx.destination);
    }
    play(sound);
    const data = (await ctx.startRendering()).getChannelData(0);
    const part = data.subarray(Math.floor(fromSec * 44100), Math.floor(toSec * 44100));
    lastPeak = part.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    lastPart = part;
    return rms(part);
  };

  try {
    for (const step of [0, 1]) {
      const full = await render((s) => s.playHeartbeat(step));
      const phone = await render((s) => s.playHeartbeat(step), 250);
      // Body (after the attack) vs the first 20 ms
      const body = await render((s) => s.playHeartbeat(step), 0, 0.05, 0.3);
      const buzz = await render((s) => s.playHeartbeat(step), 1000, 0.05, 0.3);
      const attackBright = await render((s) => s.playHeartbeat(step), 1000, 0, 0.02);
      const attack = await render((s) => s.playHeartbeat(step), 0, 0, 0.02);
      out.push(`INFO heartbeat ${step}: full ${full.toFixed(4)}, above 250 Hz ${phone.toFixed(4)} (${(phone / full * 100).toFixed(0)}%), ` +
        `body above 1 kHz ${(buzz / body * 100).toFixed(0)}%, attack above 1 kHz ${(attackBright / attack * 100).toFixed(0)}%`);
      ok(`heartbeat note ${step + 1} is audible on a phone speaker`, phone >= 0.02, `${phone.toFixed(4)} RMS above 250 Hz`);
      ok(`heartbeat note ${step + 1} body is round, not buzzy`, buzz / body <= 0.1, `${(buzz / body * 100).toFixed(0)}% above 1 kHz`);
      ok(`heartbeat note ${step + 1} has a crisp attack`, attackBright / attack >= 2 * (buzz / body) && attack >= body,
         `${(attackBright / attack * 100).toFixed(0)}% above 1 kHz in the first 20 ms`);
    }
    // The game opens on the lower note, even after a game that ended mid-pair
    const g = window.__asteroidsGameInstance;
    const steps = [];
    const realBeat = g.sound.playHeartbeat;
    g.sound.playHeartbeat = (step) => steps.push(step);
    g.heartbeatStep = 1;
    g.startGame(); g.ufoSpawnTimer = 1e9;
    g.asteroids = [g.createAsteroid(60, 60, 'small')]; g.asteroids[0].vx = g.asteroids[0].vy = 0;
    g.ship.invulnerable = 1e9;
    for (let i = 0; i < 200; i++) { g.ufoSpawnTimer = 1e9; g.update(1 / 60); }
    ok('each game opens on the lower note, then alternates', steps.length >= 3 && steps.every((s, i) => s === i % 2), steps.join());
    // After a respawn the first beat is the lower note, whatever came before
    for (const beatsBefore of [1, 2]) {
      g.startGame(); g.ufoSpawnTimer = 1e9;
      g.asteroids = [g.createAsteroid(60, 60, 'small')]; g.asteroids[0].vx = g.asteroids[0].vy = 0;
      steps.length = 0;
      while (steps.length < beatsBefore) { g.ufoSpawnTimer = 1e9; g.update(1 / 60); }
      g.onShipDeath();
      while (!g.isShipActive()) { g.ufoSpawnTimer = 1e9; g.update(1 / 60); }
      steps.length = 0;
      while (steps.length < 2) { g.ufoSpawnTimer = 1e9; g.update(1 / 60); }
      ok(`respawn restarts on the lower note (after ${beatsBefore} beat${beatsBefore > 1 ? 's' : ''})`, steps.join() === '0,1', steps.join());
    }
    g.sound.playHeartbeat = realBeat;
    // Each note holds a steady pitch (no bend)
    ok('heartbeat pitch stays steady', !/osc\.frequency\.(exponential|linear)RampToValueAtTime/.test(SoundEngine.prototype.playHeartbeat.toString()));
    // Note 0 is the lower one
    ok('note 1 is lower than note 2', (() => {
      const src = SoundEngine.prototype.playHeartbeat.toString();
      const m = src.match(/step === 0 \? ([\d.]+) : ([\d.]+)/);
      return m && Number(m[1]) < Number(m[2]);
    })());

    // Firing sound: "PEEAUW" - audible on phones; a clean, punchy "P" (not a buzzy "z"),
    // the tone held bright for the "EE", then a long fall to a dark "AUW"
    const laser = await render((s) => s.playLaser(), 250);
    out.push(`INFO laser above 250 Hz ${laser.toFixed(4)}`);
    ok('firing sound is audible on a phone speaker', laser >= 0.02, laser.toFixed(4));
    const shot = (hp, from, to) => render((s) => s.playLaser(), hp, from, to);
    const head = await shot(0, 0, 0.03);
    const startBuzz = (await shot(3000, 0, 0.03)) / head;
    ok('firing sound has bite without harsh fizz', startBuzz <= 0.45, `${(startBuzz * 100).toFixed(0)}% above 3 kHz in the first 30 ms`);
    ok('firing sound starts with impact', head >= 0.08, `first 30 ms at ${head.toFixed(3)} RMS`);
    const ee = (await shot(1500, 0.01, 0.045)) / (await shot(0, 0.01, 0.045));
    const auw = (await shot(1500, 0.28, 0.38)) / (await shot(0, 0.28, 0.38));
    ok('"EE" is bright, "AUW" is dark', ee > 2 * auw, `${(ee * 100).toFixed(0)}% → ${(auw * 100).toFixed(0)}% above 1.5 kHz`);
    ok('firing sound is aggressive (gritty, bright "EE")', ee >= 0.8, `${(ee * 100).toFixed(0)}% of the "EE" above 1.5 kHz`);
    await render((s) => { s.masterGain.gain.value = 0.6; s.playLaser(); }, 0, 0, 0.4);
    ok('firing sound doesn\'t clip', lastPeak < 1, `peak ${lastPeak.toFixed(2)} of 1.0`);
    const longTail = await shot(0, 0.3, 0.4);
    ok('the "AUW" carries on to ~0.45 s', longTail >= 0.08 * head, `0.3-0.4 s at ${(longTail / head * 100).toFixed(0)}% of the start`);
    // Asteroid explosions: punchy and audible on phones for every size
    const levels = {}, tails = {};
    for (const size of ['large', 'medium', 'small']) {
      const phone = await render((s) => s.playExplosion(size), 250, 0, 1.5);
      const full = await render((s) => s.playExplosion(size), 0, 0, 1.5);
      const punch = await render((s) => s.playExplosion(size), 250, 0, 0.05);
      out.push(`INFO explosion ${size}: full ${full.toFixed(4)}, above 250 Hz ${phone.toFixed(4)}, first 50 ms above 250 Hz ${punch.toFixed(4)}`);
      ok(`${size} explosion is audible on a phone speaker`, phone >= 0.02, phone.toFixed(4));
      ok(`${size} explosion hits hard at impact`, punch >= 2 * phone, `${(punch / phone).toFixed(1)}x the average`);
      const impact = await render((s) => s.playExplosion(size), 0, 0, 0.05);
      const impactBright = await render((s) => s.playExplosion(size), 3000, 0, 0.05);
      ok(`${size} explosion booms rather than cracks`, impactBright / impact <= 0.15, `impact ${(impactBright / impact * 100).toFixed(0)}% above 3 kHz`);
      levels[size] = full;
      // Through the game's master volume (0.6); 1.0 is full scale
      await render((s) => { s.masterGain.gain.value = 0.6; s.playExplosion(size); }, 0, 0, 3);
      ok(`${size} explosion doesn't clip`, lastPeak < 1, `peak ${lastPeak.toFixed(2)} of 1.0`);
      tails[size] = await render((s) => s.playExplosion(size), 0, 0.3, 0.6);
    }
    // Bomb shape (large): deep (much of the impact below 200 Hz), with an echo/roll that
    // keeps it going well after the hit
    const deepShare = (await render((s) => s.playExplosion('large'), 0, 0, 0.5)) > 0 &&
      1 - (await render((s) => s.playExplosion('large'), 200, 0, 0.5)) / (await render((s) => s.playExplosion('large'), 0, 0, 0.5));
    ok('bomb impact is deep', deepShare >= 0.35, `${(deepShare * 100).toFixed(0)}% of the first 0.5 s below 200 Hz (approx.)`);
    const hit = await render((s) => s.playExplosion('large'), 0, 0, 0.15);
    const rolling = await render((s) => s.playExplosion('large'), 0, 0.5, 1.0);
    ok('bomb keeps rolling after the hit', rolling >= 0.15 * hit, `0.5-1.0 s at ${(rolling / hit * 100).toFixed(0)}% of the hit`);
    // No sharp crackles in the tail (it's not glass). In each 50 ms slice, smooth noise
    // peaks at about 3-4x its own average level; crackles spike much higher.
    for (const size of ['large', 'medium', 'small']) {
      const tailTo = { large: 2.2, medium: 1.5, small: 0.9 }[size];
      await render((s) => s.playExplosion(size), 0, 0.3, tailTo);
      const slice = Math.floor(0.05 * 44100);
      let worst = 0;
      for (let i = 0; i + slice <= lastPart.length; i += slice) {
        const w = lastPart.subarray(i, i + slice);
        const level = rms(w);
        if (level > 1e-4) worst = Math.max(worst, w.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / level);
      }
      ok(`${size} explosion tail is smooth, no sharp crackles`, worst < 5.5, `worst slice peaks at ${worst.toFixed(1)}x its average`);
    }
    const lateTail = await render((s) => s.playExplosion('large'), 250, 1.2, 2.0);
    ok('the tail is audible on a phone', lateTail >= 0.005, lateTail.toFixed(4));
    await render((s) => { s.masterGain.gain.value = 0.6; s.playExplosion('ship'); }, 0, 0, 3);
    ok('ship explosion doesn\'t clip', lastPeak < 1, `peak ${lastPeak.toFixed(2)} of 1.0`);
    ok('bigger asteroids explode louder', levels.large > levels.medium && levels.medium > levels.small,
       `${levels.large.toFixed(3)} > ${levels.medium.toFixed(3)} > ${levels.small.toFixed(3)}`);
    ok('bigger asteroids rumble longer', tails.large > tails.medium && tails.medium > tails.small,
       `0.3-0.6 s: ${tails.large.toFixed(4)} > ${tails.medium.toFixed(4)} > ${tails.small.toFixed(4)}`);
    // Low latency: the game asks for the lowest-latency audio, so sounds start right away
    const live = new SoundEngine();
    live.init();
    ok('audio uses a low-latency buffer', live.ctx.baseLatency === undefined || live.ctx.baseLatency <= 0.02,
       `${(live.ctx.baseLatency * 1000).toFixed(1)} ms`);
    live.ctx.close();

    // Pausing cuts off every sound at once, including the thrust tone and an explosion's
    // tail, by disconnecting them (not a scheduled fade, which a stalled clock would hold
    // back); sounds play again normally afterwards
    const cut = async (play, after) => {
      const ctx = new OfflineAudioContext(1, Math.floor(44100 * 2), 44100);
      const sound = new SoundEngine();
      sound.ctx = ctx;
      sound.ensureActive = () => {};
      sound.masterGain = ctx.createGain();
      sound.masterGain.connect(ctx.destination);
      sound.setupThrust();
      play(sound);
      ctx.suspend(0.5).then(() => { sound.silence(); if (after) after(sound); ctx.resume(); });
      const data = (await ctx.startRendering()).getChannelData(0);
      const at = (from, to) => rms(data.subarray(Math.floor(from * 44100), Math.floor(to * 44100)));
      return { before: at(0.3, 0.5), after: at(0.51, 1.0) };
    };
    const boom = await cut((s) => s.playExplosion('ship'));
    ok('pause cuts off an explosion at once', boom.before > 0.01 && boom.after === 0,
       `${boom.before.toFixed(3)} before, ${boom.after.toFixed(4)} after`);
    const rumble = await cut((s) => s.startThrust());
    ok('pause cuts off the thrust tone at once', rumble.before > 0.01 && rumble.after === 0,
       `${rumble.before.toFixed(3)} before, ${rumble.after.toFixed(4)} after`);
    const again = await cut((s) => s.playExplosion('large'), (s) => { s.startThrust(); s.playLaser(); });
    ok('sounds play again after the cut', again.after > 0.01, again.after.toFixed(3));

    // The audio context sleeps once the game is idle, and only then
    const sleepy = new SoundEngine();
    const fakeCtx = (state) => ({ state, suspend() { this.state = 'suspended'; }, resume() { this.state = 'running'; } });
    sleepy.ctx = fakeCtx('running');
    sleepy.suspendDelay = 400;
    sleepy.isIdle = () => false;
    sleepy.suspendWhenIdle();
    await new Promise((r) => setTimeout(r, 500));
    ok('audio keeps running while playing', sleepy.ctx.state === 'running');
    sleepy.isIdle = () => true;
    sleepy.suspendWhenIdle();
    await new Promise((r) => setTimeout(r, 200));
    ok('audio waits for the last sound to finish', sleepy.ctx.state === 'running');
    await new Promise((r) => setTimeout(r, 300));
    ok('audio sleeps when idle', sleepy.ctx.state === 'suspended');
    sleepy.ensureActive();
    ok('the next sound wakes it', sleepy.ctx.state === 'running');
    // Muted: sleeps even mid-game, sounds don't wake it, unmuting does
    sleepy.isIdle = () => false;
    sleepy.masterGain = { gain: { setValueAtTime() {} } };
    sleepy.setMuted(true);
    // The heartbeat and other sounds keep asking for audio during a game
    for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 100)); sleepy.ensureActive(); }
    await new Promise((r) => setTimeout(r, 100));
    ok('audio sleeps while muted, even mid-game', sleepy.ctx.state === 'suspended');
    sleepy.ensureActive();
    ok('sounds don\'t wake it while muted', sleepy.ctx.state === 'suspended');
    sleepy.setMuted(false);
    ok('unmuting wakes it', sleepy.ctx.state === 'running');
    clearTimeout(sleepy.suspendTimer);
    ok('waits long enough for the longest sound (ship explosion, 3 s)', new SoundEngine().suspendDelay >= 3500);
    g.startGame();
    ok('game is not idle while playing', !g.sound.isIdle());
    g.togglePause();
    ok('game is idle while paused', g.sound.isIdle());
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 300));
