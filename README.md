# Chess (offline) → `chess.apk`

A fast, fully offline chess game for Android with a lot of customisation.
No internet permission, no ads, no accounts, no third-party libraries.

## Get `chess.apk`

**Easiest (no Android Studio): GitHub Actions**
1. Create a new GitHub repository and upload everything in this folder (keep the `.github` folder).
2. Open the **Actions** tab → **Build chess.apk** → it runs on every push (or press *Run workflow*).
3. When it finishes (about 4 minutes), open the run and download the **chess-apk** artifact. It contains `chess.apk`.
4. Copy it to your phone and open it. Allow "install unknown apps" for your file manager or browser when asked.

**Android Studio:** open the `android/` folder, run `node build.js` once in the project root first, then *Build → Build APK(s)*.

**Command line:** with JDK 17 and the Android SDK installed, run `./build-apk.sh`. It writes `chess.apk` in this folder.

> Try it before installing: `dist/chess.html` is the same game as one file. Open it in Chrome on your phone or computer.

## Features

**Play**
- vs Computer or **2 Players on one phone**. Two-player views: fixed, board flips each move, or face-to-face (the top player's pieces and clock are rotated 180°)
- Full rules: castling, en passant, promotion picker (or auto-queen), check, checkmate, stalemate, threefold repetition, fifty-move rule, insufficient material
- Clock: 1, 3, 5, 10 min presets, 3|2, or custom minutes and increment
- Undo / redo, hint arrow, resign, agree a draw, PGN share, auto-save and continue

**Custom difficulty** – presets (Beginner → Master) or Custom: search depth 1–8, max think time, mistake chance, move variety, aggression, reply delay

**Customisation**
- Board: 10 colour themes + custom colours, square styles (flat, gloss, inset, glass), corner roundness, gaps, size, opacity, border, shadow
- Grid: on/off, colour, thickness, opacity, dashed
- Coordinates: off / inside / outside, size and colour
- Pieces: 5 sets (classic, flat, outline, neon, glyph), 6 colour themes + custom, size, outline, gloss, shadow
- Highlights: selection, last move, check colours, hint style (dots, rings, tint)
- Background: solid, gradient (angle), animated gradient, or your own image, plus blur and dimming
- Interface size, panel opacity, left-handed layout

**Effects and performance**
- Motion blur, move duration, 4 easing curves, move trails (streak or ghost), blur while the board rotates
- Capture particles (sparks, shatter, dust, confetti), shockwave, screen shake, check flash, victory confetti
- **Frame-rate limit 30 / 60 / 90 / 120 / Max** and a "request highest refresh rate" switch, render-resolution slider, FPS counter
- Rotation: auto-rotate, follow system, lock portrait or landscape. The layout re-flows live when you turn the phone
- Sound themes (synthesised, no files), haptics, low-time ticks, immersive mode, keep screen on

## Notes on 120 fps
The app asks Android for the display's highest refresh rate (up to your frame-rate cap), but the final
frame rate is up to the phone, the WebView version and power-saving mode. Turn on **Display → Show FPS counter** to see what you actually get.

## Project layout
```
src/        game source (engine, AI, renderer, UI)     build.js  -> dist/chess.html + Android assets
tests/      perft/rules tests, AI tests, UI tests      android/   Gradle project (WebView wrapper, no dependencies)
```
Tests: `node tests/perft.js && node tests/ai.js` (UI tests need Playwright: `node tests/ui.test.js`, `node tests/features.test.js`).
