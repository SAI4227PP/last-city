# LAST CITY — Performance Engineering Standards

## 1. Performance Objectives

LAST CITY must deliver smooth, consistent gameplay across desktop browsers, Android devices, iOS devices, iPadOS and macOS Safari.

Performance must be measured on actual hardware. Estimated FPS, draw calls and rendering times must never be presented as verified benchmark results.

### Target hardware profiles

| Profile | Target hardware | FPS objective |
|---|---|---|
| Entry Desktop | Intel Core i5 6th–10th Gen, Intel HD/UHD, 8GB RAM | Stable 30 FPS |
| Mid-range Desktop | GTX 1060, Intel Iris Xe or equivalent | Stable 60 FPS |
| Entry Mobile | Snapdragon 600/700 series, 4GB RAM | Stable 30 FPS |
| Modern Mobile | Snapdragon 700+, Apple A12+ or equivalent | 30–60 FPS |
| Apple Devices | iPhone, iPad and macOS Safari | Stable device-appropriate FPS |

The game must automatically select suitable graphics settings and allow users to change them manually.

### Frame-time budgets

- 60 FPS: approximately 16.67 ms per frame.
- 30 FPS: approximately 33.33 ms per frame.
- Avoid persistent frame-time spikes and unstable frame pacing.
- Measure CPU and GPU frame time separately where browser tooling permits.
- Prioritize consistent frame delivery over occasional high FPS peaks.

## 2. Rendering Budgets

Use adaptive rendering budgets based on hardware capability and current scene complexity.

| Metric | Entry profile | Mid/high profile |
|---|---:|---:|
| Draw calls | Target 75–100 | Target 100–150 |
| Visible triangles | Target 75k–125k | Target 150k–250k |
| Pixel ratio | 1.0 maximum initially | 1.25–1.5, adaptive |
| Shadow resolution | 512–1024 | 1024–2048 |
| Shadow-casting lights | 1 where practical | Limited and controlled |

These are optimization targets, not universal engine limits. Exceeding a budget should trigger profiling and optimization rather than automatic removal of important gameplay objects.

### Required rendering techniques

1. **Frustum culling**
   - Use Three.js frustum culling.
   - Ensure bounding volumes are correct for animated and dynamically positioned objects.
   - Do not render objects outside the camera's visible region unless required by gameplay.

2. **Level of Detail (LOD)**
   - Use appropriate model detail at different camera distances.
   - Reduce geometry and material complexity for distant objects.
   - Use simplified distant zombie representations where visually appropriate.
   - Avoid visible popping during LOD transitions.

3. **Distance and visibility management**
   - Avoid rendering unnecessary distant details.
   - Use spatial partitioning and district-based loading.
   - Implement occlusion strategies only where they provide measurable benefits.
   - Do not introduce expensive CPU occlusion calculations that cost more than they save.

4. **Instanced rendering**
   - Use InstancedMesh for repeated static objects such as vegetation, debris, street objects and environmental props.
   - Keep independently animated, interactive or destructible objects separate when necessary.

5. **Adaptive resolution**
   - Dynamically reduce internal render resolution when frame time remains above the target.
   - Restore resolution gradually when performance improves.
   - Avoid constantly changing resolution from minor frame fluctuations.
   - Preserve UI sharpness by keeping the UI independent of the 3D render resolution.

## 3. Zombie AI Optimization

Zombie behavior must remain believable while minimizing unnecessary CPU work.

### Distance-based update tiers

| Distance from player | AI update frequency |
|---|---|
| 0–15 meters | Full gameplay AI, approximately 20–30 Hz |
| 15–30 meters | Reduced perception and navigation, approximately 10–15 Hz |
| 30–60 meters | Low-frequency updates, approximately 5–10 Hz |
| Beyond 60 meters | Dormant or event-driven, when safe |

These distances must be configurable and adjustable by graphics/performance profile.

### AI requirements

- Prioritize zombies that are visible, attacking, pursuing or actively interacting with the player.
- Keep combat reactions responsive regardless of background AI throttling.
- Do not let throttling interrupt an active attack animation or damage event.
- Use simplified navigation and perception for distant zombies.
- Wake dormant zombies when the player approaches or a relevant gameplay event occurs.
- Preserve zombie positions, health and relevant state during dormancy.
- Prevent zombies from detecting or attacking through walls without a valid perception path.
- Use active zombie limits appropriate to the hardware profile.

## 4. Object Pooling

Implement reusable object pools for frequently created and destroyed objects.

Required pooled objects:

- Blood particles and splatters.
- Bullet impact effects.
- Muzzle flashes and smoke.
- Projectile tracers.
- Sparks and environmental effects.
- Damage indicators and temporary combat effects.

Requirements:

- Preallocate a configurable pool capacity.
- Reuse inactive objects rather than creating new objects every time.
- Reset transforms, materials, timers and effect state when reusing an object.
- Expand pools only when necessary and within configured limits.
- Release pooled resources correctly when a scene is permanently unloaded.
- Avoid pooling every object indiscriminately; use pooling where profiling shows repeated allocation overhead.

## 5. Shadow and Lighting Optimization

Shadows must preserve the game's atmosphere without overwhelming entry-level GPUs.

### Directional sunlight

- Use a controlled directional light as the primary shadow source.
- Prefer a single optimized shadow map initially.
- Use cascaded shadow maps only if a validated implementation provides a measurable improvement in quality and performance.
- Configure shadow camera bounds tightly around relevant gameplay areas.
- Avoid excessively large shadow maps.

### Point and spot lights

- Emergency beacons, muzzle flashes and temporary lights must not cast shadows by default.
- Enable additional shadow-casting lights only on suitable graphics profiles and only when justified.
- Limit the number of simultaneous shadow-casting lights.
- Prefer baked lighting, lightmaps or non-shadow-casting lights for static environmental illumination where appropriate.

### Graphics profiles

**Low**
- Shadow maps disabled or minimal.
- Reduced lighting complexity.
- Lower render resolution.
- Simplified particles and effects.
- Reduced distant object detail.

**Medium**
- One controlled directional shadow.
- Moderate shadow resolution.
- Balanced render resolution.
- Normal particle and environment detail.

**High**
- Higher shadow resolution.
- Better lighting and particle quality.
- Higher adaptive render resolution.
- Additional effects only when performance allows.

## 6. Memory Management and Resource Disposal

Memory management must be implemented systematically across every scene and district.

### Required disposal behavior

When a scene or district is unloaded:

- Dispose owned geometries.
- Dispose owned materials.
- Dispose owned textures.
- Release render targets and post-processing resources.
- Remove event listeners.
- Dispose physics bodies and colliders.
- Stop and release scene-specific audio.
- Cancel scene-specific timers and animation tasks.
- Remove references to unloaded objects.

### Shared resource ownership

Do not blindly dispose every resource encountered during scene traversal.

- Shared textures, materials and geometries must use explicit ownership or reference counting.
- Do not dispose resources still used by another scene or asset.
- Ensure pooled resources have a clearly defined lifecycle.
- Prevent double disposal.
- Provide a centralized resource management system.

### Memory validation

- Monitor JavaScript heap usage where supported.
- Monitor renderer memory statistics through Three.js.
- Test repeated scene transitions.
- Test district loading and unloading.
- Confirm that memory stabilizes instead of continuously increasing.
- Investigate GPU resource leaks and retained references.

## 7. Physics and Game Loop

- Use a fixed physics timestep.
- Clamp unusually large frame deltas.
- Limit physics substeps to prevent the spiral of death.
- Use a maximum of 2–3 physics substeps per rendered frame.
- Pause or safely suspend physics when the page becomes hidden.
- Reset or reconcile accumulated time after returning from suspension.
- Avoid unnecessary physics bodies and collision checks.
- Use simplified colliders for static environmental objects.
- Track physics resources so they can be released during scene transitions.

## 8. CPU and Garbage Collection

- Avoid creating temporary Vector3, Quaternion, Euler and other math objects every frame.
- Reuse scratch objects in frequently executed update methods.
- Avoid unnecessary array creation, cloning and object spreading in hot paths.
- Avoid expensive DOM operations during the game loop.
- Keep UI updates event-driven rather than rebuilding UI every frame.
- Profile garbage collection pauses during combat and dense scenes.

## 9. Mobile and Apple Device Compatibility

- Use adaptive device pixel ratio.
- Respect safe-area insets.
- Keep touch controls responsive.
- Avoid applying touch-action:none to the entire page unless necessary.
- Suspend rendering and physics when the browser tab is hidden.
- Handle visibilitychange, pagehide, pageshow and context restoration.
- Suspend and resume Web Audio safely.
- Avoid duplicate event listeners after returning from background.
- Reduce render resolution and effects when thermal throttling or sustained frame-time degradation is detected, where measurable.
- Handle WebGL context loss gracefully.
- Ensure the game remains playable after browser suspension.

## 10. Adaptive Performance Manager

Implement a centralized PerformanceManager.

Responsibilities:

- Detect device capabilities.
- Select an initial graphics profile.
- Monitor frame-time stability.
- Adjust render resolution gradually.
- Adjust shadow quality and effect density.
- Control distant AI update frequency.
- Control particle and environment detail.
- Expose manual graphics settings.
- Prevent aggressive or continuous quality oscillation.

Graphics changes must not modify core gameplay rules, mission logic, saved progress or combat balance.

## 11. Performance Testing

Test the following scenarios:

1. Main menu.
2. Cinematic introduction.
3. Hospital interior with active zombies.
4. City escape with vehicles, fires and zombie groups.
5. Open survival with multiple active zombies.
6. Dense combat with particles and weapon effects.
7. Repeated scene transitions.
8. Repeated district loading and unloading.
9. Mobile background and resume.
10. Extended gameplay sessions.

Record:

- Average FPS.
- 1% low FPS where measurable.
- CPU frame time.
- GPU frame time where available.
- Draw calls.
- Visible triangles.
- Active zombies.
