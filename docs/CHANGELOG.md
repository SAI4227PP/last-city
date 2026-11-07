# LAST CITY — Changelog

## [1.1.1] - Physics WASM Asynchrony Hardening
- **Deferred Rapier Initialization**:
  - Resolved `TypeError: Cannot read properties of undefined (reading 'rawintegrationparameters_new')` by eliminating synchronous constructor execution of `new RAPIER.World()` prior to WASM compilation.
  - Implemented async `PhysicsWorld.initWorld()` singleton promise pattern.
  - Updated `SceneManager` to automatically await `physicsWorld.initWorld()` during the interactive loading screen when entering gameplay stages (`HospitalScene`, `CityEscapeScene`, `OpenSurvivalScene`).
  - Added null-safe guards across `PhysicsWorld.step()`, `createStaticBox()`, `createDynamicCapsule()`, `castRay()`, `removeRigidBody()`, and `clearBodies()`.

## [1.1.0] - Cross-Device Performance Optimization & Adaptive Engine
- **Bundle Size Optimization**:
  - Configured Vite manual chunks: separated `vendor-three`, `vendor-physics` (Rapier 3D WASM), and `vendor-ui-core`.
  - Implemented dynamic code splitting for all scenes in `SceneManager`.
  - Reduced initial main menu payload from 4.98 MB down to ~602 KB (-87.9% reduction, ~150 KB gzip).
- **Adaptive Performance Management**:
  - Implemented `PerformanceManager.ts` with real-time frame time and FPS moving average calculation.
  - Added 3 tiered graphics profiles (Low, Medium, High) with dynamic resolution scaling (0.70x to 1.0x).
  - Clamped maximum device pixel ratio (`maxDpr`) to prevent high-DPI Retina/Quad-HD overdraw on integrated/mobile GPUs.
  - Added in-game real-time performance diagnostics overlay (FPS, Frame Time, Draw Calls, Triangles).
- **Physics Timestep Hardening**:
  - Added `maxSubSteps = 3` cap in `GameLoop.ts` to prevent the "physics spiral of death" under CPU lag spikes.
  - Added automatic accumulator zeroing on window `visibilitychange` to handle mobile tab backgrounding and suspension.
  - Added `PhysicsWorld.clearBodies()` for cross-scene physics cleanup.
- **Garbage Collection (GC) Elimination**:
  - Pre-allocated static scratch vectors and eulers across `PlayerController` and `ZombieAI`.
  - Implemented shared geometry and material caching in `ModelFactory`.
- **Multi-Tier Zombie AI Scaling**:
  - Implemented distance-tiered update frequencies (60Hz near, 20Hz mid, 5Hz far).
  - Enforced active zombie population limits per graphics profile.
- **Mobile Ergonomics**:
  - Integrated `touch-action: none` to eliminate browser pull-to-refresh and page bouncing.
  - Added iOS safe-area inset padding for home indicator and notch displays.
- **Documentation**:
  - Created `docs/PERFORMANCE_AUDIT.md`.
  - Created `docs/PERFORMANCE_OPTIMIZATION_REPORT.md`.
  - Created `docs/MEMORY_MANAGEMENT.md`.
  - Created `docs/DEVICE_COMPATIBILITY.md`.

## [1.0.0] - Initial Production Architecture & Full 4-Stage Implementation
- Initialized TypeScript, Vite, Vitest, Rapier 3D, Three.js, Zustand, and Howler stack.
- Configured strict TypeScript compiler options and bundler path aliases.
- Created complete documentation suite (GDD, Architecture, Folder Structure, Roadmap, Asset Guidelines, Performance, CrazyGames).
- Built core engine modules: Renderer, CameraManager, SceneManager, GameLoop, EventBus, InputManager (Keyboard/Mouse/Touch), PhysicsWorld, and procedural AudioManager.
- Built all 4 connected stages:
  - Stage 1: Cinematic Prologue (40s, 4 acts, camera animation, breaking news subtitles, skip button, audio).
  - Stage 2: Hospital Outbreak (Room awakening, medical scavenging, keycard access, first zombie encounter, emergency exit).
  - Stage 3: City Escape (Hospital exterior, broken avenue, burning wreck, police cruiser search, military checkpoint overrun).
  - Stage 4: Open Survival (City district, enterable buildings, survival vitals, 5 zombie variants, melee/guns, inventory/crafting, safehouse, persistent IndexedDB save/load).
- Integrated responsive HTML5/CSS3 HUD and UI overlays with Zustand state management.
- Implemented CrazyGames platform adapter.
