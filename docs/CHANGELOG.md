# LAST CITY — Changelog

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
