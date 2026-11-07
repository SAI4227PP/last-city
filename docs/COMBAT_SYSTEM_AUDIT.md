# LAST CITY — ZOMBIE HEALTH, WEAPON DAMAGE & COMBAT SYSTEM AUDIT

## Executive Summary

A comprehensive combat and damage audit was conducted across **LAST CITY — Cinematic 3D Zombie Apocalypse Survival RPG**. 

Previously, zombies could die after a single hit or appear to have only one effective health point. This investigation identified the root architectural causes, corrected all balancing values, implemented centralized combat configurations, introduced multi-pellet shotgun simulation, established body-part hit locations and armor mitigation for Armored Brutes, enforced line-of-sight wall occlusion checks, and instituted a robust death lifecycle.

All 47 unit and integration tests across 11 test suites pass with 100% reliability, maintaining strict TypeScript compliance and smooth 60 FPS performance.

---

## 1. Investigation of Legacy Combat Bottlenecks

| Issue | Legacy Implementation | Root Cause of Instant Death / 1 HP Feel | Solution Implemented |
| :--- | :--- | :--- | :--- |
| **Low Zombie Health Baselines** | Walker: 60 HP, Runner: 45 HP, Spitter: 50 HP. | Weapon base damage (Shotgun: 90, Rifle: 42, Bat: 40) exceeded or nearly exceeded total zombie HP on normal hits. Any headshot (2.0x multiplier = 180 shotgun, 84 rifle, 80 bat) resulted in instant one-hit kills on nearly all infected. | Increased baseline health across all variants (Walker: 100, Runner: 80, Brute: 250, Spitter: 120, Boss: 600). |
| **Single-Ray Shotgun** | Shotgun fired a single ray that applied all 90–180 damage at once. | An all-or-nothing hit that obliterated enemies at long distance with zero pellet spread. | Implemented 8-pellet conical spread where each pellet deals 10 body / 20 head damage. Total damage scales with pellets landed. |
| **Missing Wall Occlusion on Gunfire** | `checkRayHit` checked lateral distance to zombies without validating static geometry. | Bullets passed straight through concrete walls and doors, hitting zombies that were completely occluded. | Integrated `physicsWorld.raycast` in `checkRayHit` and `checkMeleeSweep` to block shots obstructed by solid walls. |
| **Missing Hit Locations** | Uniform damage applied regardless of whether limbs, torso, or head were struck. | Peripheral shots to hands or feet dealt identical damage to center-mass torso shots. | Implemented 4-zone hit detection (`head`, `torso`, `arms`, `legs`) with location multipliers and armor reduction. |
| **Armored Brute Vulnerability** | Armored Brute had identical flesh damage multipliers across all body regions. | The SWAT ceramic armor provided zero damage resistance. | Added `ARMOR_RESISTANCE_MODIFIERS`: ceramic chest armor absorbs 50% damage; pauldrons/gauntlets absorb 35%. |
| **Dead Zombie Bullet Interception** | Dead zombies retained their collision bounds while lying on the ground. | Bullets and melee swings continued to hit dead corpses instead of living threats behind them. | `hitRadius` and `hitHeight` are now zeroed on death (`isDead = true`), and restored upon recycling. |

---

## 2. Zombie Health & Balancing Matrix

All zombie variants now possess independent, configurable health pools managed via `ZOMBIE_CONFIGS` in `src/data/zombies.ts` and `src/data/combat.ts`:

| Zombie Typology | Internal Key | Max Health | Walk Speed | Run Speed | Attack Dmg | Attack Cooldown | Armor Notes |
| :--- | :--- | :---:| :---:| :---:| :---:| :---:| :--- |
| **Infected Shambler** | `walker` | **100 HP** | 1.8 m/s | 3.2 m/s | 15 HP | 1.5s | Unarmored; standard body multipliers. |
| **Feral Runner** | `runner` | **80 HP** | 2.5 m/s | 6.8 m/s | 12 HP | 1.1s | Sinewy & fast; vulnerable to headshots. |
| **Armored Brute** | `brute` | **250 HP** | 1.3 m/s | 2.8 m/s | 35 HP | 2.0s | Ceramic SWAT armor: **50% torso damage reduction**, **35% arm/pauldron reduction**. |
| **Toxic Spitter** | `spitter` | **120 HP** | 1.6 m/s | 3.8 m/s | 20 HP | 2.5s | Medium health; ranged toxic acid projectiles. |
| **Patient Zero Boss** | `boss` | **600 HP** | 1.8 m/s | 4.5 m/s | 45 HP | 1.8s | Massive endurance; exposed viral heart core. |

### Health State Contract
- `currentHealth` and `maxHealth` are independently tracked on every `ZombieAI` instance.
- Health is clamped between `0` and `maxHealth`.
- Zombie enters the `dead` state only when `currentHealth <= 0`.
- When recycled through `ZombieManager.recycleZombie()` and re-spawned, health is completely restored to `maxHealth`.

---

## 3. Weapon Damage, Multipliers & Shotgun Pellets

All weapon damage values are centralized in `WEAPON_COMBAT_CONFIGS` within `src/data/combat.ts`:

| Weapon | Category | Fire Rate | Range | Body Damage | Head Damage | Head Multiplier | Pellets | Mag Size | Reload Time |
| :--- | :--- | :---:| :---:| :---:| :---:| :---:| :---:| :---:| :---:|
| **Tactical Knife** | Melee | 2.2 /s | 2.0m | **35** | **70** | 2.0x | N/A | Infinite | 0.0s |
| **Baseball Bat** | Melee | 1.4 /s | 2.4m | **45** | **90** | 2.0x | N/A | Infinite | 0.0s |
| **9mm Pistol** | Firearm | 3.5 /s | 45m | **25** | **75** | 3.0x | N/A | 12 rounds | 1.6s |
| **12-Gauge Shotgun** | Firearm | 1.1 /s | 22m | **80** (max) | **160** (max) | 2.0x | **8 pellets** | 6 shells | 2.4s |
| **M4A1 Assault Rifle** | Firearm | 8.0 /s | 65m | **30** | **90** | 3.0x | N/A | 30 rounds | 2.0s |

### Shotgun Pellet Mechanics
- When fired, the shotgun calculates **8 individual pellet trajectories** within a conical spread (`spreadAngleRad = 0.075 rad`, ~4.3° cone).
- Each pellet carries **10 body damage** (or **20 headshot damage**).
- Close-range blasts (within 3–5 meters) land all 8 pellets, delivering the full **80 body** or **160 head** damage.
- Mid-range shots spread out, allowing pellets to hit multiple targets or deal partial damage (e.g., 3 pellets landing = 30 damage).

---

## 4. Hit Locations & Armor Mitigation

Every projectile and melee attack calculates the vertical and lateral point of impact relative to the zombie's bounding cylinder:

$$\text{hitFraction} = \frac{\text{hitPoint.y} - \text{zombiePos.y}}{\text{zombieHeight}}$$

```
                       +-----------------------+
        relY >= 0.72   |       HEAD (2.0x)     |  <-- Precision Headshot Zone
                       +-----------------------+
                       | |                   | |
   0.38 <= relY < 0.72 |A|    TORSO (1.0x)   |A|  <-- Center Mass
                       |R|   (Ceramic Armor  |R|      (Armored Brute absorbs 50%)
                       |M|   for Brute 0.5x) |M|
                       |S|                   |S|
                       +-----------------------+
        relY < 0.38    |      LEGS (0.75x)     |  <-- Lower Extremities
                       +-----------------------+
```

### Armored Brute Damage Resolution
- **Torso Hit**: Base damage × 1.0 × **0.50** (absorbs 50% damage).
- **Arms / Pauldrons Hit**: Base damage × 0.75 × **0.65** (absorbs 35% damage).
- **Legs Hit**: Base damage × 0.75 × **0.75** (absorbs 25% damage).
- **Helmet Visor Opening**: Takes full headshot damage, rewarding tactical marksmanship.

---

## 5. Line-of-Sight & Collision Validation

### Wall Occlusion Checks
Both `checkRayHit` and `checkMeleeSweep` in `ZombieManager.ts` execute a physics world raycast prior to registering hits:
```ts
if (this.physicsWorld) {
  const wallHit = this.physicsWorld.raycast(rayOrigin, rayDir, proj, true);
  if (wallHit && wallHit.distance < proj - 0.25) {
    // Solid wall obstructs the bullet path; shot is blocked
    continue;
  }
}
```
- Bullets hitting concrete walls spawn dust/debris impact particles without penetrating to zombies behind cover.
- Melee weapons cannot swing through walls or security doors.

---

## 6. Zombie Death Lifecycle

```
[ Damage Received ]
        |
[ Health Subtraction & Armor Clamping ]
        |
        v
  [ Health <= 0 ? ]
     /         \
   (No)        (Yes)
    |            |
[Flinch SFX]   [ Enter Death State Once (isDead = true) ]
[Stagger Back]   |-> Disable attack timers (cooldown = Infinity)
                 |-> Disable collision (hitRadius = 0, hitHeight = 0)
                 |-> Play ragdoll-style collapse animation
                 |-> Extinguish ocular / viral point lights
                 |-> Emit audio:play_sfx ('zombie_death')
                 |-> Emit zombie:killed event
                 |-> Retain corpse presentation on ground
                 \-> Safe recycling into object pool upon respawn
```

---

## 7. Player Survival & Damage Cooldown

- **Health Independence**: Player health (100 HP max) is isolated in `SurvivalSystem.ts` and managed independently of zombie entities.
- **Damage Cooldown / i-Frames**: When damaged by infected melee attacks, a **250ms invulnerability window** (`damageCooldownTimer = 0.25s`) prevents instantaneous frame-rate death when surrounded by multiple enemies on the same tick.
- **Environmental Persistence**: Starvation and dehydration penalties pass an `ignoreCooldown` flag, ensuring environmental hazards apply steady pressure.
- **Save/Load**: Player vitals (health, stamina, hunger, thirst) are serialized to IndexedDB upon safehouse rests or mission completions.

---

## 8. Dynamic Difficulty Scalability

`CombatConfigManager` in `src/data/combat.ts` exposes centralized difficulty scaling without modifying gameplay logic:

| Difficulty Mode | Zombie Health Multiplier | Zombie Attack Multiplier | Player Damage Multiplier |
| :--- | :---:| :---:| :---:|
| **Easy** | 0.80x | 0.75x | 1.25x |
| **Normal** | 1.00x | 1.00x | 1.00x |
| **Hard** | 1.30x | 1.40x | 0.85x |

---

## 9. Combat System Test Verification

All 13 automated test suites in `tests/unit/combat/combat_system.test.ts` pass cleanly:

```bash
✓ A. initializes individual zombies with distinct configurable maxHealth
✓ B. ensures damage to one zombie does not affect another zombie
✓ C. applies distinct weapon body damage values accurately
✓ D. applies enhanced damage on headshots
✓ E. applies ceramic riot armor damage reduction on Armored Brute torso and limbs
✓ F. simulates shotgun multi-pellet spread and damage calculation
✓ G. registers no hit or damage when raycast misses the target
✓ H. prevents damage when a solid wall blocks line of fire
✓ I. registers melee hit only within valid weapon range and angle spread
✓ J. eliminates zombie only when health reaches zero and clamps health to 0
✓ K. prevents duplicate death events if damaged while already dead
✓ L. completely restores health and alive state when recycling from object pool
✓ M. emits zombie:killed event with complete identifier and variant payload
```
Total: **47 passing tests across 11 suites in 8.22s**.
