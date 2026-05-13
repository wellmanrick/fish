# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Fishing with Friends** — a single-page browser game (Canvas 2D, plain HTML/CSS/JS, zero dependencies). The entire app is three files in the repo root: `index.html`, `styles.css`, `game.js`.

## Run / deploy

There is no build step, package manager, linter, or test suite. Iterate by reloading the browser.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Deploy is automatic via `.github/workflows/pages.yml`: every push to `main` uploads the entire repo (`path: .`) as the GitHub Pages artifact. **Anything you add to the repo root ships to production** — keep stray files out.

## Architecture (`game.js`)

All ~1700 lines live in a single IIFE. There is no module system. Read this section before editing — the rendering pipeline and coordinate system are non-obvious.

### Virtual coordinate system + DPR

`resize()` establishes a virtual world with **fixed height `VH = 720`** and width that adapts to the stage's aspect ratio. `ctx.setTransform(state.scale, ...)` is applied once per frame, so all drawing code uses virtual coordinates — never raw CSS pixels. `state.W` / `state.H` are virtual dimensions, not canvas pixels. Triggered on `resize` and `orientationchange`.

### Cached background

`paintStreamBg` / `paintKayakBg` paint into an **offscreen canvas** (`state.bg.canvas`) that is blitted each frame. Call `invalidateBg()` whenever scene, size, or any constant that the background depends on changes — otherwise edits to bg painters won't appear. `ensureBg()` regenerates lazily.

### Per-frame render order (in `render()`)

1. Blit cached background.
2. Animated water ripples (`drawWater`) + sun sparkles (`drawSparkles`).
3. Scene foreground: reflections under, then `drawBlondKid` + `drawBrunetteKid` (stream) or `drawKayak` (kayak).
4. Fish, line+bobber, splashes, bubbles, floating text.

Reflections are drawn by re-invoking the character draw functions inside a flipped/scaled/alpha'd transform — see `drawCharacterReflection`.

### Scene composition constants

`COMP.stream` and `COMP.kayak` hold the shared `waterY` / `kidY` / `kayakY` fractions used by **both** the bg painters and the foreground draw calls. Changing the waterline means changing it here — the comment block above `COMP` documents how the kid's body coordinates relate to it.

### Fish + bite mechanic

- `FISH_TYPES` is a weighted table (`weight` must sum to 1.0). `rollFish()` samples it.
- `maintainFish(dt)` advances each fish, applies a curiosity meter when the bobber is within 150 virtual units, and calls `biteFish()` when curiosity crosses threshold.
- The hook window is **50–850 ms** after `lastBite` (see `castOrHook`). Earlier → "Too soon!"; later → fish escapes via the 1s `setTimeout` in `biteFish`. Don't fold these into a single check — the asymmetry is the gameplay.
- A hooked fish is followed to the bobber via lerp in the main loop, not by direct assignment.

### Game state

Single `state` object holds everything: virtual dims, scene, timer (`timeLeft`, 60s), score, the `line` sub-object (`tipX/tipY`, `bobX/bobY`, `cast`, `hooked`, `lastBite`, `cooldown`), and particle arrays (`fish`, `splashes`, `floats`, `sparkles`, `bubbles`). `startGame()` resets it; `endGame()` shows the overlay and computes `rankFor(score)`.

### Input

Three equivalent paths to `castOrHook()`: pointerdown on canvas, pointerdown on `#cast-btn`, or `Space`. `1` / `2` switch scenes. `haptic()` is a no-op where `navigator.vibrate` is unavailable.

## Conventions

- **Mobile-first.** The layout is a three-row grid (`hud` / `stage` / `action-bar`) sized to `100dvh` with safe-area insets. Don't break the action bar — `#cast-btn` is the primary input on touch.
- **No dependencies, no build.** Don't add npm, bundlers, frameworks, or asset files. All art is drawn live with Canvas 2D path commands; new visuals follow the same pattern (see `drawPine`, `drawRock`, `drawHead` for reference).
- **Pseudo-random with seed.** `mulberry32` is used for anything that should look the same across frames (sparkle layout, decorative rocks). Use it instead of `Math.random()` when the result is cached.
- **Don't reach for DOM inside the render loop.** HUD updates go through `updateHUD()` / `updateCastUI()`, which run on state transitions, not per frame.
