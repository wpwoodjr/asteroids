# Asteroids

**▶ [Play it in your browser](https://wpwoodjr.github.io/asteroids/)**

A vector-style space shooter that runs in the browser from a single HTML file. It has no build step and no dependencies to install.

You fly a ship through a field of drifting rocks, blast them into smaller pieces, dodge flying saucers, and survive as long as you can. Glowing vector lines and synthesized sound effects give it a classic arcade look, and the core gameplay follows the 1979 arcade original closely. It also adds an optional gravity-well mode.

## Playing

Open `asteroids.html` in any modern browser:

```sh
xdg-open asteroids.html      # Linux
open asteroids.html          # macOS
start asteroids.html         # Windows
```

Or serve the folder and visit it from another device on your network, such as a phone:

```sh
python3 -m http.server 8000
# then browse to http://<your-ip>:8000/asteroids.html
```

Everything the game needs, including its styles and fonts, is in `asteroids.html`, so it works without an internet connection and contacts no other site.

### Install as an app

The game is a Progressive Web App (PWA). From the [live site](https://wpwoodjr.github.io/asteroids/), you can install it:

- **Android (Chrome):** menu ⋮ → **Install app** / **Add to Home screen**
- **iPhone/iPad (Safari):** Share → **Add to Home Screen**
- **Desktop Chrome/Edge:** the install icon in the address bar

The installed app opens fullscreen and works offline. The offline support only works over `http(s)`, not when you open the file directly.

## Controls

| Key | Action |
| --- | --- |
| `A` / `←` | Rotate left |
| `D` / `→` | Rotate right |
| `W` / `↑` | Thrust |
| `Space` / `J` | Fire (max 4 shots on screen) |
| Left click | Fire (while playing, anywhere but on a button) |
| Right button, held | Thrust (likewise) |
| `S` / `↓` / `Shift` | Hyperspace (random teleport; can destroy your ship) |
| `P` / `Esc` | Pause / resume |
| `R` | Restart (when paused or after game over) |
| `G` | Cycle gravity: Off → Low → Med → High |
| `C` | Cycle color palette (Classic, Neon, Nebula) |
| `M` | Mute / unmute |
| `F` | Fullscreen (hidden in the installed app, which is already fullscreen, and on iPhone) |

On touch devices, use the on-screen buttons below the playfield to rotate, thrust, fire, hyperspace and pause.

The game pauses automatically when you switch to another tab or app, the screen turns off, or another window takes focus.

During a replay, `Esc`, `Enter` or `Space` stops it, `P` pauses, and `1`, `2` or `4` sets the speed. Mute, colors and fullscreen still work; the ship's controls and gravity don't.

## Scoring

| Target | Points |
| --- | --- |
| Large asteroid | 20 |
| Medium asteroid | 50 |
| Small asteroid | 100 |
| Large saucer | 200 |
| Small saucer | 1,000 |

You earn an extra ship every 10,000 points. Waves start with 4 large asteroids and add 2 more each wave, up to 11. As in the original, new asteroids start on the screen edges and drift in. Asteroids don't speed up by wave, but fragments keep their parent's motion plus a random nudge, so they can end up faster than their parent. The next wave starts about 2 seconds after you clear the last asteroid. Flying saucers behave like the original's. The first comes after about 10 seconds, and they come more often as the game goes on. While you're busy shooting asteroids, one only shows up once few rocks remain. The first three are large; after that, small ones become more and more likely, and from 30,000 points every saucer is small. Large saucers fire in random directions. Small saucers aim at you, missing by up to ±22° (±11° from 35,000 points). Saucers fire about every 0.7 seconds, but never while you're respawning or in hyperspace.

## Features

- **Arcade inertia:** the ship keeps drifting after you let go of thrust and slowly coasts to a stop, losing about a fifth of its speed each second, like the 1979 arcade original. To stop faster, turn around and thrust the other way. In gravity mode there is no friction, so orbits around the planet don't decay. Thrust and top speed match the original: about 2 seconds to full speed, capped at about 480 px/s along each axis (so diagonal flight is faster).
- **Gravity mode:** a planet in the center pulls on the ship, asteroids, saucers and bullets. A saucer that crashes into it is destroyed with no change to your score, but an asteroid that falls in is swallowed and costs you its point value. Touching the planet costs a ship. If you turn gravity on while your ship is near the center, the ship is moved clear and briefly shielded.
- **Arcade rules:** these follow the original's code. Hit sizes match the original's collision boxes, and asteroids are drawn to match them. At most 27 asteroids can be on screen at once: when the screen is that full, hitting an asteroid still scores but makes fewer fragments, or none. Bullets fly at about the ship's top speed plus the shooter's own velocity, and last 1.2 seconds. Your own bullets can hit you after wrapping around the screen. Saucer bullets and saucers smash asteroids (no points for you), and ramming an asteroid breaks it and scores it even though it costs you the ship. Saucers can have at most 2 bullets on screen. Hyperspace hides you for 0.8 s, and it can destroy your ship: the risk is up to 25%, rising as fewer asteroids remain. After you lose a ship, the new one appears with no shield, and only once no asteroid is near the center and no saucer is on screen.
- **Arcade audio:** all sounds are generated live with the Web Audio API: laser, explosions, thrust rumble, saucer siren, hyperspace, and a heartbeat that, like the original's, starts each wave at about one beat per 0.85 s and speeds up over about 42 seconds to five beats a second.
- **Replays:** after a game, **▶ Replay** plays it back from the start, and **★ Best Game** plays your highest-scoring game. The start screen offers the best game too. Replays run at 1×, 2× or 4× speed, with sound, at the gravity they were played with. Your last game and your best game are saved in the browser, so they're still there next time. Clearing the scores clears the best game too.
- **Hall of fame:** the top 5 scores and the all-time high score are saved in the browser's `localStorage`. You can clear them from the Scores screen.
- **Display options:** 3 color palettes and fullscreen. Until you pick a palette, each game starts in Classic, switches to Neon at wave 2 and to Nebula at wave 3, with a note under the wave banner saying how to choose. Once you pick one with `C` or the palette button, it stays. Each palette gives asteroids, your ship and the saucers their own colors, and bullets match whoever fired them. Classic is all white, like the arcade. **Nebula** swaps the glowing lines for shaded pictures: a starfield with faint nebulas that you slowly drift into, cratered rocks lit from one side, a metal starfighter whose engines fire as it thrusts and turns, a saucer with chasing lights, banded planets, and fiery explosions. It only changes the look; the game plays the same. The playfield always scales to 4:3 and adjusts for high-DPI screens.
- **Saved settings:** your color palette (once you pick one), sound on/off and gravity level are saved in `localStorage`, so they stay the same the next time you play.

## How it works

The game itself lives in `asteroids.html`. `manifest.webmanifest`, `sw.js` (the service worker that caches files for offline play) and `icons/` make it installable. `index.html` redirects to the game.

- **`SoundEngine`** wraps the Web Audio API. It uses oscillators and noise buffers, so there are no audio files.
- **`AsteroidsGame`** runs the game. It owns the state machine (`START`, `PLAYING`, `PAUSED`, `GAMEOVER`), entity updates, collisions, rendering and input.
- The game simulates a fixed **1000 × 750** logical world and scales it onto the canvas. Each frame's time step is capped at 100 ms, so physics doesn't jump after the tab was in the background.
- Physics uses frame-time-based velocity integration with screen wrap-around. Gravity is an inverse-square pull with a minimum-distance clamp, scaled for each entity type.
- **Replays** store what the player did, not what was on screen: the game's random seed, its starting gravity, each frame's length and the controls held, and when shots, hyperspace jumps and gravity changes happened. Playing them back through the same game code repeats the game exactly, so ten minutes of play at 60 fps takes about 50,000 characters (about 100 KB as the browser stores it). This depends on the game being deterministic: gameplay randomness must come from `game.random` (or `game.fxRandom` for explosion particles), never `Math.random`. **When a change alters how a game plays out** (physics, timing, scoring, saucers, anything using `game.random`), bump `REPLAY_VERSION` in `asteroids.html`, so that replays saved before the change are dropped instead of playing out a different game. The `replay` test plays a whole game and checks that its replay ends identically.

### Styles

The page's HTML uses [Tailwind CSS](https://tailwindcss.com) classes. The CSS for them is generated ahead of time and embedded in `asteroids.html` (the `<style id="tailwind">` block), so players' browsers download nothing from Tailwind. After adding or changing Tailwind classes, rebuild it:

```sh
node tools/build-css.mjs
```

This needs Tailwind CSS v3.4.17's command-line tool: the [standalone executable](https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.17) (no npm needed) or `npx tailwindcss@3.4.17`. Set `TAILWINDCSS=/path/to/tailwindcss` if it isn't on your `PATH`. The `styles` test fails if a class is missing its CSS.

The fonts, [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) and [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono), are embedded too (the `<style id="fonts">` block), as the Latin subsets Google Fonts serves.

## Tests

The `tests/` folder has automated checks for gameplay, arcade rules, physics, sounds, mouse input, saved settings, replays, color palettes, embedded styles and fonts, the Fullscreen button, layout at different screen sizes, and PWA install and offline support. The runner serves the game locally and drives headless Chromium:

```sh
node tests/run.mjs                 # all tests (Node 22+)
node tests/run.mjs physics mouse   # selected tests
node --experimental-websocket tests/run.mjs   # Node 20/21
```

It needs `python3` and Chromium. Set `CHROME=/path/to/chrome` if Chromium isn't on your `PATH` as `chromium`. The runner exits with a nonzero code if any check fails.

## License

[MIT](LICENSE) © 2026 Bill Wood

The embedded fonts are licensed separately under the SIL Open Font License 1.1: *Press Start 2P* © 2012 The Press Start 2P Project Authors, and *Share Tech Mono* © 2012 Carrois Type Design, Ralph du Carrois. Their license texts are in [`licenses/`](licenses).
