# LAST CITY — System Architecture

## 1. Architectural Principles
1. **Separation of Concerns**:
   - `core/`: Pure engine, rendering, game loop, event bus, physics wrapper, audio synthesizer, input handling.
   - `features/`: Isolated domain gameplay mechanics (player, zombies, combat, inventory, survival, crafting, missions, cinematics, world).
   - `scenes/`: Scene orchestration (MainMenu, Cinematic, Hospital, CityEscape, OpenSurvival).
   - `ui/`: Decoupled DOM presentation layers, reactive Zustand store, zero direct manipulation of 3D entities from UI.
   - `persistence/`: Async IndexedDB storage for state, checkpoints, settings, with migration schemas.
   - `platform/`: Abstract platform adapters (`PlatformAdapter`, `BrowserAdapter`, `CrazyGamesAdapter`).
   - `shared/`: Immutable types, interfaces, mathematical utilities, and constants.
2. **Fixed Timestep Physics & Delta Time**:
   - Rapier 3D runs on fixed 60Hz timesteps (`step()`), while Three.js renders interpolated or clamped variable delta frames.
3. **Event-Driven Decoupling**:
   - Features communicate across boundaries via a strongly typed `EventBus` (`GameEvents`), avoiding tight coupling and circular dependencies.
4. **Deterministic Lifecycle**:
   - All systems implement `init()`, `update(dt: number)`, `pause()`, `resume()`, and `dispose()`. Every allocated mesh, texture, audio source, and rigid body is tracked for clean disposal on scene transitions.
5. **Client-First Persistence**:
   - Zero remote server requirements. All progression, stage flags, inventory, and vitals persist into IndexedDB under the database `LastCityDB`.

## 2. Dependency Flow
```
main.ts
  └─ GameApplication
       ├─ GameEngine (Renderer, SceneManager, CameraManager, PhysicsWorld, GameLoop)
       ├─ AudioManager (Web Audio + Howler)
       ├─ InputManager (Keyboard, Mouse, Touch)
       ├─ SaveManager (IndexedDB)
       ├─ PlatformAdapter (Browser / CrazyGames)
       ├─ GameUIStore (Zustand state bridge)
       └─ SceneManager
            ├─ MainMenuScene
            ├─ CinematicScene
            ├─ HospitalScene
            ├─ CityEscapeScene
            └─ OpenSurvivalScene
```
