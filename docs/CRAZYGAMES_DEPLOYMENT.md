# LAST CITY — CrazyGames Deployment Guide

## 1. Requirements Overview
CrazyGames HTML5 publishing standards require:
1. Pure client-side execution with zero external backend dependencies.
2. Responsive canvas scaling accommodating 16:9, ultrawide, and mobile touch screen viewports.
3. Audio mute / resume handling when tab loses focus or when ad breaks trigger.
4. Game pause / resume hooks during video gameplay ads.
5. Isolated Platform Adapter allowing seamless SDK loading without crashing standalone browser runs.

## 2. CrazyGames SDK v2 / v3 Adapter
An isolated platform interface (`src/platform/CrazyGamesAdapter.ts`) connects to `window.CrazyGames.SDK` if available:
- `gameplayStart()`: Called when entering playable hospital, city, or open survival stages.
- `gameplayStop()`: Called when opening pause menu, inventory, or death screen.
- `happyTime()`: Called upon completing milestones (escaping hospital, reaching checkpoint, establishing safehouse).
- `requestAd('midgame')` / `requestAd('rewarded')`: Available via platform interface.

## 3. Production Build & Test
```bash
npm run build
npm run preview
```
The resulting `dist/` directory contains standard static HTML, CSS, JavaScript, and WASM binaries ready for zip packaging and CrazyGames developer portal upload.
