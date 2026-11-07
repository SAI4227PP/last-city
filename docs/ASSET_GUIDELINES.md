# LAST CITY — Asset Guidelines

## 1. 3D Model Specifications
- **Format**: GLTF 2.0 / Binary GLB format with Draco mesh compression.
- **Target Polygon Budgets**:
  - Main Player Character: ≤ 12,000 triangles.
  - Standard Zombie (Walker / Runner): ≤ 6,000 triangles.
  - Elite Zombie (Brute / Abomination): ≤ 15,000 triangles.
  - Vehicles / Props: 500 – 4,000 triangles.
  - Architectural Buildings: 2,000 – 8,000 triangles (with instancing where repeated).
- **Procedural PBR Fallback**:
  - The engine includes high-fidelity procedural geometry and PBR texture generators for immediate zero-latency browser rendering without broken external asset dependencies.

## 2. Textures & Materials
- Textures: PBR (Albedo, Normal, Roughness/Metalness).
- Resolution: Max 2048x2048 for key characters; 1024x1024 or 512x512 for props and environment.
- Formats: WebP, PNG, KTX2/Basis Universal.

## 3. Audio Guidelines
- Ambient / Music: Stereo OGG / MP3, compressed at 128-192 kbps.
- Sound FX: Mono WAV / OGG, compressed at 96-128 kbps.
- Audio Synthesizer: Procedural Web Audio API synth is embedded for zero-network audio redundancy (gunfire, bat impacts, ambient wind, heartbeat, zombie roars, Geiger counter / alert sirens).
