# Think-about-it list

Open questions and possible changes that haven't been decided yet.

## Respawn can take a long time

After you lose a ship, the new one appears only when no asteroid is within 125 px of the center and no saucer is on screen. This matches the 1979 arcade code: when the respawn timer runs out, it checks the spawn area (`$7139`) and for a saucer (`$705D`), and if either is blocked it keeps waiting (`$7062`–`$7064`).

Reported once (2026-11-02): destroyed by an asteroid, and the ship didn't respawn. I couldn't make it hang for good, but simulations show long waits:

| Situation | Usual wait | Longest wait | Never respawned |
| --- | --- | --- | --- |
| Busy asteroid field, gravity off | ~3 s | ~13 s | 0 of 120 |
| Busy asteroid field, high gravity | ~2.4 s | ~14 s | 0 of 120 |
| Saucer on screen, gravity off | +8.5 s | +8.5 s | 0 of 150 |
| Saucer on screen, high gravity | +7 s | +39 s | 0 of 150 |

A saucer only leaves by crossing the screen or being destroyed, and high gravity can hold one back for over half a minute. Nothing on screen says the game is waiting, so it looks stuck. Still unknown for the report: whether gravity was on, whether a saucer was on screen, and how long the wait was. A rarer real bug isn't ruled out.

Options (can be combined):

1. **Keep it:** arcade-accurate.
2. **Show a message**, such as "WAITING FOR CLEAR SPACE", while the respawn is held up.
3. **Don't wait for the saucer:** respawn once the center is clear. The saucer holds fire while you respawn, so its first shot comes about 1.2 s after you reappear.
4. **Cap the wait:** respawn after at most a few extra seconds no matter what.

The code is in `isSpawnAreaClear()` and the ship update in `asteroids.html`.

## Where new waves' asteroids appear

When a new wave starts, the ship stays where it is in both versions, still moving. The difference is where the new large asteroids appear:

- **Original:** each one starts on a screen edge, either along the left/right edge or along the top/bottom edge, chosen at random per rock (`$719D`–`$71D3`). They drift in from the edges toward wherever the ship is.
- **This version:** anywhere on screen, at least 150 px from the ship (and clear of the planet in gravity mode).

Options:

1. **Match the original:** start them on the edges. Catch: if the ship is sitting at an edge when the wave starts, a rock can appear close to it (true in the original too).
2. **Edges, but not near the ship:** start on the edges, skipping spots within 150 px of the ship.
3. **Keep it as is.**

The code is in `createWave()` in `asteroids.html`.

## Black band at the top of the installed app

On the test phone (2152 × 2076 screen), the installed app leaves a black band about 136 pixels tall across the top, by the camera. A Chrome tab after tapping **Full** fills the whole screen.

What the diagnostics panel showed (triple-tap the ASTEROIDS logo), at Chrome's 120% zoom:

| | Window | Fills the screen? |
| --- | --- | --- |
| Chrome tab, after Full | 735 × 709 | Yes |
| Installed app | 735 × 663 | No: 46 px short |
| Installed app, after Full | 735 × 663 | No: still 46 px short |

All safe-area insets are 0, so the page isn't told about a cutout it could draw into: Android simply gives the installed app a shorter window. Already tried, without effect in the app: `viewport-fit=cover`, safe-area padding, and switching to browser fullscreen on start (reverted).

Options:

1. **Reinstall the app.** A long shot: Android may set these window rules when the app is installed.
2. **Play in a Chrome tab with Full**, which fills the screen.
3. **Live with it** in the installed app.
4. **Check again after Chrome updates**, in case the installed-app behavior changes.
