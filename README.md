# Asteroids

**▶ [Play it in your browser](https://wpwoodjr.github.io/asteroids/)**

A vector-style space shooter that runs in the browser from a single HTML file. It has no build step and no dependencies to install.

You fly a ship through a field of drifting rocks, blast them into smaller pieces, dodge flying saucers, and survive as long as you can. Glowing vector lines, an optional CRT scanline overlay and synthesized sound effects give it a classic arcade look. It also adds an optional gravity-well mode.

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

An internet connection is needed on first load for Tailwind CSS (CDN) and the Google Fonts *Press Start 2P* and *Share Tech Mono*.

### Install as an app

The game is a Progressive Web App (PWA). From the [live site](https://wpwoodjr.github.io/asteroids/), you can install it:

- **Android (Chrome):** menu ⋮ → **Install app** / **Add to Home screen**
- **iPhone/iPad (Safari):** Share → **Add to Home Screen**
- **Desktop Chrome/Edge:** the install icon in the address bar

The installed app opens fullscreen and works offline once you've loaded it online one time. The offline support only works over `http(s)`, not when you open the file directly.

## Controls

| Key | Action |
| --- | --- |
| `A` / `←` | Rotate left |
| `D` / `→` | Rotate right |
| `W` / `↑` | Thrust |
| `Space` / `J` | Fire (max 4 shots on screen) |
| Left click (on the playfield) | Fire |
| `S` / `↓` / `Shift` | Hyperspace (random teleport) |
| `P` / `Esc` | Pause / resume |
| `R` | Restart (when paused or after game over) |
| `G` | Cycle gravity: Off → Low → Med → High |
| `C` | Cycle color theme (White, Emerald, Cyan, Amber) |
| `M` | Mute / unmute |
| `F` | Fullscreen (hidden when the installed app is already fullscreen, or on iPhone) |

On touch devices, use the on-screen buttons below the playfield to rotate, thrust, fire, warp and pause.

## Scoring

| Target | Points |
| --- | --- |
| Large asteroid | 20 |
| Medium asteroid | 50 |
| Small asteroid | 100 |
| Large saucer | 200 |
| Small saucer | 1,000 |

You earn an extra ship every 10,000 points. Each wave adds one more large asteroid, up to 10, and asteroids get about 8% faster per wave. From wave 3, or after 5,000 points, the more accurate small saucers start to appear.

## Features

- **Arcade inertia:** the ship keeps drifting after you let go of thrust and slowly coasts to a stop, losing about a fifth of its speed each second, like the 1979 arcade original. To stop faster, turn around and thrust the other way. In gravity mode there is no friction, so orbits around the planet don't decay. Top speed is capped. Turning and thrust both ease in briefly, so quick taps give fine adjustments.
- **Gravity mode:** a planet in the center pulls on the ship, asteroids, saucers and bullets. A saucer that crashes into it is destroyed with no change to your score, but an asteroid that falls in is swallowed and costs you its point value. Touching the planet costs a ship unless you are still shielded after respawning.
- **Arcade audio:** all sounds are generated live with the Web Audio API: laser, explosions, thrust rumble, saucer siren, hyperspace, and a heartbeat that speeds up as fewer asteroids remain.
- **Hall of fame:** the top 5 scores and the all-time high score are saved in the browser's `localStorage`. You can clear them from the Scores screen.
- **Display options:** 4 vector color themes, a CRT scanline and vignette overlay, and fullscreen. The playfield always scales to 4:3 and adjusts for high-DPI screens.
- **Saved settings:** your color theme, CRT overlay, sound on/off and gravity level are saved in `localStorage`, so they stay the same the next time you play.

## How it works

The game itself lives in `asteroids.html`. `manifest.webmanifest`, `sw.js` (the service worker that caches files for offline play) and `icons/` make it installable. `index.html` redirects to the game.

- **`SoundEngine`** wraps the Web Audio API. It uses oscillators and noise buffers, so there are no audio files.
- **`AsteroidsGame`** runs the game. It owns the state machine (`START`, `PLAYING`, `PAUSED`, `GAMEOVER`), entity updates, collisions, rendering and input.
- The game simulates a fixed **1000 × 750** logical world and scales it onto the canvas. Each frame's time step is capped at 100 ms, so physics doesn't jump after the tab was in the background.
- Physics uses frame-time-based velocity integration with screen wrap-around. Gravity is an inverse-square pull with a minimum-distance clamp, scaled for each entity type.

## Tests

The `tests/` folder has automated checks for gameplay, physics, mouse input, saved settings, the Fullscreen button, and PWA install and offline support. The runner serves the game locally and drives headless Chromium:

```sh
node tests/run.mjs                 # all tests (Node 22+)
node tests/run.mjs physics mouse   # selected tests
node --experimental-websocket tests/run.mjs   # Node 20/21
```

It needs `python3` and Chromium. Set `CHROME=/path/to/chrome` if Chromium isn't on your `PATH` as `chromium`. The runner exits with a nonzero code if any check fails.

## License

[MIT](LICENSE) © 2026 Bill Wood
