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

## Controls

| Key | Action |
| --- | --- |
| `A` / `←` | Rotate left |
| `D` / `→` | Rotate right |
| `W` / `↑` | Thrust |
| `Space` / `J` | Fire (max 4 shots on screen) |
| `S` / `↓` / `Shift` | Hyperspace (random teleport) |
| `P` / `Esc` | Pause / resume |
| `R` | Restart (when paused or after game over) |
| `G` | Cycle gravity: Off → Low → Med → High |
| `C` | Cycle color theme (White, Emerald, Cyan, Amber) |
| `M` | Mute / unmute |
| `F` | Fullscreen |

On touch devices, on-screen buttons handle rotate, thrust, fire, warp and pause. On small screens, the **🎮 Touch** button in the header shows or hides them.

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

- **Zero-G inertia:** the ship keeps moving until you turn around and thrust the other way. Top speed is capped.
- **Gravity mode:** a planet in the center pulls on the ship, asteroids, saucers and bullets. Asteroids or saucers that fall into it are destroyed and score for you. Touching the planet costs a ship unless you are still shielded after respawning.
- **Arcade audio:** all sounds are generated live with the Web Audio API: laser, explosions, thrust rumble, saucer siren, hyperspace, and a heartbeat that speeds up as fewer asteroids remain.
- **Hall of fame:** the top 5 scores and the all-time high score are saved in the browser's `localStorage`. You can clear them from the Scores screen.
- **Display options:** 4 vector color themes, a CRT scanline and vignette overlay, and fullscreen. The playfield always scales to 4:3 and adjusts for high-DPI screens.

## How it works

Everything lives in `asteroids.html`:

- **`SoundEngine`** wraps the Web Audio API. It uses oscillators and noise buffers, so there are no audio files.
- **`AsteroidsGame`** runs the game. It owns the state machine (`START`, `PLAYING`, `PAUSED`, `GAMEOVER`), entity updates, collisions, rendering and input.
- The game simulates a fixed **1000 × 750** logical world and scales it onto the canvas. Each frame's time step is capped at 100 ms, so physics doesn't jump after the tab was in the background.
- Physics uses frame-time-based velocity integration with screen wrap-around. Gravity is an inverse-square pull with a minimum-distance clamp, scaled for each entity type.

## License

[MIT](LICENSE) © 2026 Bill Wood
