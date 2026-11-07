# LAST CITY — Development Roadmap

## Roadmap Overview
1. **Phase 1: Core Foundation & Engine**
   - Professional modular directory structure.
   - Three.js WebGL2 renderer with shadows, tone mapping, and responsive viewport sizing.
   - Rapier 3D physics integration with fixed timestep.
   - Input manager (Keyboard, Mouse with pointer lock, Mobile touch).
   - Core game loop with RAF, delta capping, and pause/resume.
   - Comprehensive test environment and verification.
2. **Phase 2: Character, Zombies & Core Combat Framework**
   - Third-person player controller with state-driven animation, footsteps, sprint, and camera orbit.
   - Modular zombie AI state machine with perception (hearing, vision cone) and 5 variants.
   - Combat system: melee swing hitboxes, firearm raycasting with recoil, muzzle flash, bullet impacts, and headshot damage multipliers.
3. **Phase 3: Stage 1 — Cinematic Introduction**
   - 4-act 40-second cinematic sequence with camera tracking, city skyline, hospital outbreak, chaos, and "30 Days Later" reveal.
   - Skip Intro functionality with immediate persistence and seamless transition to Stage 2.
4. **Phase 4: Stage 2 — Hospital Outbreak**
   - Full interior hospital level: isolation ward, dark corridors, flickering emergency lights, nurse station, locked security doors.
   - Scavenging medkits and electronic keycard.
   - First zombie combat encounter, stealth tutorial, and emergency fire door breakout.
5. **Phase 5: Stage 3 — City Escape**
   - Transition to St. Jude exterior courtyard and destroyed city avenue.
   - Burning cars, police barricades, road craters, and zombie group patrols.
   - Scavenge police cruiser trunk for vehicle key & ammo.
   - Military checkpoint infiltration and discovery of evacuation failure.
6. **Phase 6: Stage 4 — Open Survival District**
   - Expansive open-world district with street grid, grocery store, pharmacy, and fortified safehouse.
   - Full survival mechanics: Health, Stamina, Hunger, Thirst simulation.
   - Grid inventory with weapon slots, consumables, and item inspection.
   - Crafting workbench (Medkits, Spiked Bats, Molotovs, Clean Water).
   - Side mission (Clear Pharmacy for Antibiotics).
   - Safehouse features: bed to save and advance time, storage crate.
   - Continuous IndexedDB persistence across browser refreshes.
7. **Phase 7: Polish, Mobile Support & CrazyGames SDK Readiness**
   - CrazyGames SDK platform adapter.
   - Mobile responsive touch controls.
   - Audio volume controls and graphics quality options (Low/Medium/High).
   - Unit tests for persistence, survival, inventory, and combat.
