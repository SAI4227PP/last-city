# LAST CITY — Performance Guidelines

## 1. Frame Rate & Budget Targets
- **Target Desktop**: 60 FPS on mid-range GPUs (e.g. GTX 1060 / Intel Iris Xe).
- **Target Mobile**: 30–60 FPS on modern smartphones (Snapdragon 700+ / Apple A12+).
- **Draw Call Budget**: Max 150 draw calls per frame in dense scenes.
- **Triangle Budget**: Max 250,000 visible triangles per frame.

## 2. Optimization Techniques
1. **Frustum Culling**: Built into Three.js object hierarchies; bounding spheres calibrated.
2. **Distance-Based AI Throttling**:
   - Zombies within 15 meters update perception and steering at full 60Hz.
   - Distant zombies (> 30 meters) throttle AI evaluation to 10Hz or pause completely when dormant.
3. **Object Pooling**:
   - Particle bursts (blood splatters, sparks, muzzle smoke) and projectile tracers use pre-allocated pools.
4. **Shadow Optimization**:
   - Directional sunlight casts cascaded or single high-res shadow with PCF soft filtering.
   - Point lights (flashing emergency beacons, muzzle flash) only cast shadows on High graphics profile.
5. **Memory & Disposal**:
   - Explicit `dispose()` implemented on all geometries, materials, and textures when scenes or districts unload.
