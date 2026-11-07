# LAST CITY — Memory Management & Resource Lifecycle Guide

## 1. Principles of WebGL & WASM Memory in Browsers
Unlike native desktop games where process memory is returned to the OS upon termination, web games running in browsers (WebGL 2 + Rapier WASM) require explicit garbage collection and GPU resource deallocation.

Failing to dispose GPU buffers and WASM heap structures causes:
1. **GPU Context Loss** (WebGL context crashed by mobile Safari/Chrome due to exceeding device memory thresholds).
2. **Unmanaged WASM Heap Leaks** (Rapier rigid bodies remaining in memory indefinitely).
3. **CPU Garbage Collection (GC) Stutters** (recurrent 20–50ms frame freezes from short-lived vector and matrix allocations).

---

## 2. Resource Ownership Hierarchy

```
GameApplication (Singleton root lifecycle)
  ├── GameEngine
  │     ├── Renderer (Owns WebGL context, DOM canvas, tone mapping)
  │     ├── CameraManager (Owns projection matrix, trauma states)
  │     ├── PhysicsWorld (Owns Rapier RAPIER.World WASM instance & rigid bodies map)
  │     └── GameLoop (Owns RAF loop, fixed step accumulator, visibility & suspension listeners)
  ├── SceneManager
  │     └── Current Scene (HospitalScene, CityEscapeScene, OpenSurvivalScene, etc.)
  │           ├── THREE.Scene (Root node, owns light objects and mesh hierarchy)
  │           ├── PlayerController (Owns player dynamic capsule body, spotlight, weapon mesh)
  │           ├── ZombieManager (Owns active zombie AI instances & zombiePool recycling)
  │           ├── CombatManager (Owns weapon definitions & muzzle lights)
  │           ├── ParticleSystem (Owns dynamic BufferGeometry and Points material)
  │           └── MissionManager (Owns objective state machine)
  └── UIManager (Owns DOM overlays & Zustand store subscription)
```

---

## 3. Disposal Protocols & Lifecycle Rules

### Rule 1: Systematic Scene Unloading
When transitioning between stages (`SceneManager.loadScene(stageId)`):
1. **Scene-Level Disposal**: The active scene's `dispose()` method is called first:
   - Disposes `PlayerController` (removes rigid body, removes flashlight target, unsubscribes `weaponSwitchUnsub`).
   - Disposes `ZombieManager` (clears active zombies, clears and disposes `zombiePool`).
   - Disposes `CombatManager` (removes muzzle flash light).
   - Disposes `ParticleSystem` (disposes geometry, materials, and removes points from scene).
   - Stops ambient sound oscillators.
2. **Selective Three.js Traversal**: `DisposableManager.disposeObject3D(scene)` traverses all children:
   - Disposes non-shared `BufferGeometry` attached to meshes (`!geometry.userData?.isShared`).
   - Disposes non-shared `Material` instances (`!material.userData?.isShared`), preserving shared pools.
3. **Physics Body Clearing by Owner**: `PhysicsWorld.clearBodies()` iterates through `this.rigidBodies`, safely frees Rapier bodies, and resets the tracking map.
4. **Game Loop Timers Reset**: `GameLoop.resetTimers()` zeros the accumulator and sets `lastTimestamp = performance.now()`.

### Rule 2: Shared Geometry & Material Caching
- `ModelFactory` maintains static material and geometry caches (`materials: Map<string, THREE.Material>` and `geometries: Map<string, THREE.BufferGeometry>`).
- All shared materials and geometries are marked with `userData.isShared = true`.
- Reusable assets are never disposed mid-scene; they remain resident for zero-overhead re-instantiation across districts.
- If full cache purge is needed, `ModelFactory.clearCache()` is available.

### Rule 3: Zero-Allocation Per-Frame Mathematics
- All per-frame calculations in `PlayerController.ts`, `ZombieAI.ts`, and `ZombieManager.ts` use static scratch vectors:
  - `PlayerController._scratchMoveDir`
  - `PlayerController._scratchCamPivot`
  - `PlayerController._scratchOffset`
  - `PlayerController._scratchEuler`
  - `ZombieAI._scratchMoveDir`
  - `ZombieAI._scratchLookDir`
  - `ZombieAI._scratchForward`
  - `ZombieAI._scratchEyePos`
  - `ZombieManager._scratchToZombie`
  - `ZombieManager._scratchRayPoint`
  - `ZombieManager._scratchZombiePos`
  - `ZombieManager._scratchRayDir`
- In-place operations (`.set()`, `.addScaledVector()`, `.subVectors()`) replace `.clone()` and `new THREE.Vector3()`, keeping JavaScript heap growth flat.

---

## 4. Multi-Cycle Transition Validation Test (MEASURED)

The scene transition lifecycle was verified in `tests/unit/memory/lifecycle.test.ts` through the following sequential loop:
```
Main Menu ➔ Cinematic ➔ Hospital ➔ City Escape ➔ Open Survival ➔ Main Menu (x5 Consecutive Cycles)
```

### Measured Findings:
1. **DOM Nodes**: Stable at constant node count (~60 UI elements). Zero orphaned nodes created (**MEASURED**).
2. **Three.js Geometries & Materials**: Actively freed and rebuilt while shared cache is preserved. Zero shader program leaks (**MEASURED**).
3. **Rapier Rigid Bodies**: Count drops to 0 on exit from Open Survival and stays at 0 in Main Menu (**MEASURED**).
4. **Event Listeners**: Subscriptions clean up on scene disposal; no duplicate event dispatching (**MEASURED**).
5. **JS Heap**: Flat memory profile after initial warm-up; garbage collection pauses remain $< 3\text{ms}$ (**ESTIMATED** based on scratch vector recycling).
