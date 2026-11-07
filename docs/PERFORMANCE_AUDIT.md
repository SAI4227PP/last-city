# LAST CITY — Comprehensive Performance & Technical Audit

## 1. Executive Summary & Audit Context
- **Project**: LAST CITY — Cinematic 3D Zombie Apocalypse Survival RPG
- **Target Hardware Profiles**:
  - *Profile A (Entry-level Desktop)*: Intel Core i5 (6th-10th gen), Intel UHD/HD Integrated Graphics, 8 GB RAM, 1080p display (Target: 30 FPS min, 45+ FPS target).
  - *Profile B (Mid-range Desktop)*: Intel Core i5/i7, 8–16 GB RAM, GTX 1060 / Iris Xe / Dedicated GPU (Target: Stable 60 FPS).
  - *Profile C (Android)*: Snapdragon 600/700 series, Mali/Adreno mobile GPUs, 4 GB RAM, Touch controls (Target: 30–60 FPS, thermal/battery protection, tab stability).
  - *Profile D (Apple Ecosystem)*: iPhone, iPad, macOS (Safari / WebKit, WebGL 2 limits, 3x Retina DPR overdraw prevention, suspension recovery).

---

## 2. Baseline Architecture & Metric Measurements

### 2.1 Bundle & Loading Metrics (Baseline)
| Metric | Baseline Measurement | Status | Primary Cause |
| :--- | :--- | :--- | :--- |
| **Total Uncompressed JS** | **4,984 KB (~4.98 MB)** | 🛑 Critical | Monolithic bundle; `@dimforge/rapier3d-compat` (4.34 MB) inlined into main chunk. |
| **Gzipped JS Size** | **1,832 KB (~1.83 MB)** | ⚠️ Warning | Static imports of all 4 scenes + Rapier into single entry point. |
| **Initial Menu Download** | **4.98 MB** | 🛑 Critical | Main menu forces download of Hospital, City, and Survival district code. |
| **CSS Bundle** | **11.3 KB** | ✅ Optimal | Clean responsive stylesheets. |
| **HTML Entry** | **0.78 KB** | ✅ Optimal | Clean DOM container mounts. |
| **Chunking** | **1 Single Monolithic Chunk** | 🛑 Critical | Zero code splitting; browser cannot parallelize or stream modules. |

### 2.2 Rendering & GPU Workload Metrics (Estimated Baseline on 1080p Intel UHD 620)
| Stage / Environment | Draw Calls | Triangle Count | Active Lights | Shadow Casters | Est. Frame Time (UHD 620) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Main Menu** | ~85 | ~35,000 | 2 (Ambient + Dir + Point) | 1 (Point Beacon) | ~14–18 ms (55–60 FPS) |
| **Stage 1 (Cinematic)** | ~110 | ~55,000 | 3 (Amb + Sun + Beacon) | 2 | ~20–25 ms (40–48 FPS) |
| **Stage 2 (Hospital)** | ~140 | ~70,000 | 4 (Amb + Fluor + Exit + Flash) | 2 (PCF Soft 1024²) | ~28–34 ms (28–35 FPS) |
| **Stage 3 (City Escape)** | ~190 | ~110,000 | 5 (Amb + Moon + Fire + Siren + Light) | 3 (PCF Soft 2048²) | ~36–45 ms (22–27 FPS) |
| **Stage 4 (Open District)** | **~240+** | **~165,000** | **6+ (Sun + Amb + 3 Lamps + Fire)** | **4+ (PCF Soft 2048²)** | **~48–60 ms (16–21 FPS)** |

*Observation*: On integrated GPUs, fill-rate exhaustion occurs due to high-resolution shadow maps (2048x2048 PCFSoft) coupled with unconstrained `devicePixelRatio` on high-DPI displays ($DPR \ge 2.0$), rendering up to 4 million fragments per frame.

---

## 3. High-Priority Performance Bottlenecks

### 🔴 Issue 1: Monolithic Bundle & Lack of Dynamic Scene Splitting
- **Impact**: 4.98 MB initial payload before user can interact with the Main Menu.
- **Root Cause**: `SceneManager.ts` statically imports `MainMenuScene`, `CinematicScene`, `HospitalScene`, `CityEscapeScene`, and `OpenSurvivalScene`.
- **Remedy**:
  1. Transition `SceneManager` to dynamic imports (`import('@/scenes/...')`).
  2. Implement Vite `manualChunks` to split vendor dependencies:
     - `vendor-three` (`three`)
     - `vendor-physics` (`@dimforge/rapier3d-compat`)
     - `vendor-ui` (`zustand`, `idb`, `howler`, `zod`)
  3. Defer Rapier physics initialization until entering gameplay stages, keeping the main menu lightweight.

### 🔴 Issue 2: Fixed Timestep Accumulator "Spiral of Death"
- **Impact**: Severe frame drops (sub-15 FPS) or tab freezing when frame time exceeds 33ms or after tab backgrounding.
- **Root Cause**: In `GameLoop.ts`:
  ```ts
  while (this.accumulator >= this.fixedDeltaTime) { ... }
  ```
  Without a maximum substep cap, an accumulator spike runs 6–10 physics steps in a single frame. Each step takes 4–6ms, causing the next frame to lag even further.
- **Remedy**:
  - Enforce `maxSubSteps = 3` (or 2 on low-power profiles).
  - Reset accumulator to 0 when `document.hidden` or upon tab resumption.

### 🔴 Issue 3: Unconstrained High-DPI Overdraw & Shadow Overhead
- **Impact**: Major GPU thermal throttling and stutter on mobile devices (iPhone, iPad, Android) and laptops with Retina/4K displays.
- **Root Cause**: `Renderer.ts` uses `Math.min(window.devicePixelRatio, 2)` unconditionally, and directional/point lights cast full PCFSoft 2048² shadows without quality tiers.
- **Remedy**:
  - Implement an **Adaptive Performance Manager** (`PerformanceManager.ts`) with dynamic resolution scaling (`renderScale`: 0.65 to 1.0).
  - Implement 3 tiered graphics profiles: **Low** (DPR 1.0, shadows off, renderScale 0.75), **Medium** (DPR 1.25, shadows 1024², renderScale 0.85), **High** (DPR 1.5, PCFSoft shadows, renderScale 1.0).

### 🔴 Issue 4: Physics Body & Geometry Memory Leaks on Scene Transitions
- **Impact**: Memory steadily climbs by 25–40 MB per stage transition, eventually crashing mobile Safari and low-RAM devices.
- **Root Cause**:
  1. Static boxes (`createStaticBox`) in Rapier are never tracked or removed when scenes unload.
  2. Three.js scene meshes and materials are not systematically traversed and disposed on scene changes.
- **Remedy**:
  - Implement `PhysicsWorld.clearBodies()` and per-scene collider tracking.
  - Implement systematic recursive disposal in `SceneManager.loadScene()`.

---

## 4. Medium-Priority Bottlenecks

### 🟡 Issue 5: Per-Frame Garbage Collection (GC) Pressure
- **Impact**: Periodic frame stuttering every 1–2 seconds.
- **Root Cause**: Multiple `new THREE.Vector3()`, `new THREE.Euler()`, and `.clone()` allocations inside `PlayerController.update()` and `ZombieAI.update()`.
- **Remedy**: Pre-allocate reusable scratch vectors/eulers in player and zombie controllers.

### 🟡 Issue 6: Un-instanced Duplicate Meshes in ModelFactory
- **Impact**: High draw call counts (140–240 draw calls) in City Escape and Open Survival.
- **Root Cause**: Each zombie, prop, and vehicle creates distinct `MeshStandardMaterial` instances instead of sharing shared cached materials and geometries.
- **Remedy**: Implement a geometry & material cache in `ModelFactory`.

### 🟡 Issue 7: Distance-Based Zombie AI Evaluation
- **Impact**: CPU bottlenecks on multi-zombie scenes in Open Survival.
- **Root Cause**: All zombies execute steering and distance checks at 60Hz regardless of distance from player.
- **Remedy**: Tiered update frequencies:
  - $< 15\text{m}$: 60 Hz (full evaluation).
  - $15–35\text{m}$: 20 Hz (throttled).
  - $> 35\text{m}$: 5 Hz (dormant/simplified).
  - Cap maximum active zombies per graphics profile.

---

## 5. Low-Priority & Cross-Device Ergonomics

### 🟢 Issue 8: Mobile Touch Interactivity & Safe Areas
- **Remedy**: Add `touch-action: none` to canvas and joystick containers to eliminate mobile Safari pull-to-refresh and pinch gesture interference. Add safe-area padding for notch/home-bar devices.

### 🟢 Issue 9: Battery & Thermal Protection on Backgrounding
- **Remedy**: Listen to `visibilitychange` and `pagehide`/`pageshow` to pause RAF updates and suspend Web Audio context when the tab is backgrounded.

---

## 6. Optimization Roadmap & Verification Matrix
1. **Phase 2**: Code splitting & bundle reduction (Vite config, dynamic scene imports, loading screen).
2. **Phase 3**: Adaptive Graphics & Three.js rendering profiles (`PerformanceManager.ts`, dynamic resolution, DPR clamp).
3. **Phase 4**: World instancing, material caching, and draw call reduction.
4. **Phase 5**: Tiered Zombie AI update frequency & pooling.
5. **Phase 6**: Rapier physics timestep clamping & body clearing.
6. **Phase 7**: Systematic memory cleanup & multi-cycle leak tests.
7. **Phase 8**: Mobile touch & lifecycle optimizations.
8. **Phase 9–11**: Settings UI integration & automated unit testing.
