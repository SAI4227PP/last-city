# LAST CITY — Player Character & Animation Package Integration Report

## Executive Summary

The complete `Athletic_man_anims.zip` package has been fully integrated into **LAST CITY** as the authoritative playable human survivor character. The integration replaces the initial procedural mannequin model with a production-grade 3D character (38,340 triangles, 12 embedded PBR textures, 69-bone skeletal rig, A-pose bind) while seamlessly driving the character across all 59 motion clips using an event-driven `PlayerAnimationController` integrated with Three.js `AnimationMixer`.

Root motion displacement on movement tracks (`Hips.position`) has been stripped to in-place motion (preserving vertical pelvic bounce/oscillation on Y while clamping horizontal X and Z translation to frame 0). This preserves **Rapier 3D physics dynamic capsule** as strictly authoritative without sliding, double movement, or wall clipping.

All 57 automated tests across 12 test suites pass with 100% success rate, and strict TypeScript compilation (`tsc --noEmit`) passes with zero errors.

---

## 1. Asset Organization & Structure

All character package files have been organized into the clean public assets directory according to Phase 1 guidelines:

```text
public/assets/characters/player/
├── model/
│   └── Athletic_man.glb                 # 38,340 tris, 13 skinned meshes, 69 bones
├── animations/
│   ├── Athletic_man@idle.glb            # Looping relaxed survivor stance
│   ├── Athletic_man@walk.glb            # Forward walk
│   ├── Athletic_man@run.glb             # Forward run
│   ├── Athletic_man@walk_back.glb       # Backward walk
│   ├── Athletic_man@strafe_left.glb     # Lateral strafe left
│   ├── Athletic_man@strafe_right.glb    # Lateral strafe right
│   ├── Athletic_man@rifle_idle.glb      # Tactical rifle ready
│   ├── Athletic_man@rifle_walk.glb      # Tactical rifle advance
│   ├── Athletic_man@rifle_fire.glb      # Rifle single shot
│   ├── Athletic_man@rifle_reload.glb    # Rifle reload sequence
│   ├── Athletic_man@pistol_idle.glb     # Sidearm ready
│   ├── Athletic_man@pistol_walk.glb     # Sidearm advance
│   ├── Athletic_man@pistol_fire.glb     # Sidearm shot
│   ├── Athletic_man@hit_front.glb       # Directional damage flinch
│   ├── Athletic_man@death_forward.glb   # Forward death collapse
│   └── ... (59 total clips)
├── metadata/
│   ├── Athletic_man.rig.json            # 69-bone hierarchical skeleton description
│   └── Athletic_man.params.json         # Character generator parameters
├── README.txt
├── LICENSE.txt
└── preview.png
```

---

## 2. 3D Model & Mesh Structure

- **Triangles**: 38,340
- **Bones**: 69 (Mixamo compatible, with `Hips` root and `WeaponR` attached to `RightHand` at `[-0.52, 1.03, 0.27]`).
- **Skinned Meshes**:
  - `Athletic_man_1` to `Athletic_man_10`: Survivor anatomy, detailed head/face, eyes, eyebrows, eyelashes, teeth, tongue, clothing, survival outfit, shoes, hair.
  - `Athletic_man_11`, `Athletic_man_12`, `Athletic_man_13`: Built-in assault rifle (gunmetal, polymer receiver, barrel).

### Weapon Swapping & Socket Mechanics:
1. **Rifle Equipped**:
   - `Athletic_man_11..13.visible = true`.
   - Any external weapon prop attached to `WeaponR` is detached.
2. **Pistol / Knife / Bat / Shotgun Equipped**:
   - `Athletic_man_11..13.visible = false` (rifle hidden cleanly).
   - Dedicated weapon mesh created via `ModelFactory.createWeaponMesh(weapon)` is mounted to `WeaponR` bone.
3. **Unarmed**:
   - `Athletic_man_11..13.visible = false`.
   - Hand socket empty.

---

## 3. Root Motion In-Place Reconciliation

In standard animations (e.g. Mixamo or Character Creator clips), movement translations are encoded on `Hips.position`:
- `walk`: Z displaces by $+1.59\text{m}$.
- `run`: Z displaces by $+2.68\text{m}$.
- `walk_back`: Z displaces by $-1.58\text{m}$.
- `strafe_left`: X displaces by $+0.38\text{m}$.
- `strafe_right`: X displaces by $-0.38\text{m}$.

If root motion translations are left active alongside Rapier's dynamic physics capsule velocity, **double movement** occurs: the capsule advances in world space while the animation displaces the hips away from the capsule center, resulting in foot sliding, camera jitter, and physics collision penetration through walls.

### In-Place Conversion Algorithm (`PlayerAnimationController.processClipForInPlace`):
```ts
public static processClipForInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  const cloned = clip.clone();
  for (const track of cloned.tracks) {
    if (track.name.endsWith('.position') && (track.name.includes('Hips') || track.name.includes('Pelvis') || track.name.includes('Root'))) {
      const values = track.values;
      if (values.length >= 3) {
        const initialX = values[0];
        const initialZ = values[2];
        for (let i = 0; i < values.length; i += 3) {
          values[i] = initialX;             // Clamped to frame 0
          // values[i + 1] (Y) preserved!   // Natural pelvic bobbing & gait oscillation intact
          values[i + 2] = initialZ;         // Clamped to frame 0
        }
      }
    }
  }
  return cloned;
}
```
Rapier physics remains 100% authoritative over world translation and collision, while character meshes articulate naturally in place.

---

## 4. Complete 59 Animation Clip Registry & Classification

| # | Animation ID | GLB Asset | Loop Mode | Clamp | In-Place | Priority | Description |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 1 | `idle` | `Athletic_man@idle.glb` | Repeat | No | No | Locomotion | Unarmed survivor idle |
| 2 | `walk` | `Athletic_man@walk.glb` | Repeat | No | Yes | Locomotion | Forward natural walk |
| 3 | `run` | `Athletic_man@run.glb` | Repeat | No | Yes | Locomotion | Forward run / sprint |
| 4 | `walk_back` | `Athletic_man@walk_back.glb` | Repeat | No | Yes | Locomotion | Backward walk |
| 5 | `walk_slouch` | `Athletic_man@walk_slouch.glb` | Repeat | No | Yes | Locomotion | Injured / exhausted walk |
| 6 | `model_walk` | `Athletic_man@model_walk.glb` | Repeat | No | Yes | Locomotion | Confident upright stride |
| 7 | `strafe_left` | `Athletic_man@strafe_left.glb` | Repeat | No | Yes | Locomotion | Lateral side-step left |
| 8 | `strafe_right` | `Athletic_man@strafe_right.glb` | Repeat | No | Yes | Locomotion | Lateral side-step right |
| 9 | `jump` | `Athletic_man@jump.glb` | Once | Yes | No | Action | Full standing jump cycle |
| 10 | `jump_start` | `Athletic_man@jump_start.glb` | Once | Yes | No | Action | Jump takeoff crouch & spring |
| 11 | `jump_air` | `Athletic_man@jump_air.glb` | Repeat | No | No | Locomotion | Mid-air tuck pose loop |
| 12 | `jump_land` | `Athletic_man@jump_land.glb` | Once | No | No | Action | Impact absorption landing |
| 13 | `jump_running` | `Athletic_man@jump_running.glb` | Once | Yes | Yes | Action | Running leap |
| 14 | `fall` | `Athletic_man@fall.glb` | Repeat | No | Yes | Locomotion | Extended falling posture |
| 15 | `rifle_idle` | `Athletic_man@rifle_idle.glb` | Repeat | No | No | Locomotion | Low-ready tactical stance |
| 16 | `rifle_aim` | `Athletic_man@rifle_aim.glb` | Repeat | No | No | Locomotion | Shouldered rifle sight picture |
| 17 | `rifle_crouch_aim` | `Athletic_man@rifle_crouch_aim.glb` | Repeat | No | No | Locomotion | Low-profile crouched aim |
| 18 | `rifle_crouch_walk` | `Athletic_man@rifle_crouch_walk.glb` | Repeat | No | Yes | Locomotion | Low-profile crouched advance |
| 19 | `rifle_fire` | `Athletic_man@rifle_fire.glb` | Once | No | No | Action | Semi-auto shot recoil impulse |
| 20 | `rifle_fire_auto` | `Athletic_man@rifle_fire_auto.glb` | Repeat | No | No | Action | Sustained burst fire recoil |
| 21 | `rifle_reload` | `Athletic_man@rifle_reload.glb` | Once | No | No | Action | Magazine drop, insert, bolt cycle |
| 22 | `rifle_walk` | `Athletic_man@rifle_walk.glb` | Repeat | No | Yes | Locomotion | Patrol advance with rifle |
| 23 | `rifle_walk_back` | `Athletic_man@rifle_walk_back.glb` | Repeat | No | Yes | Locomotion | Tactical retreat with rifle |
| 24 | `rifle_strafe_left` | `Athletic_man@rifle_strafe_left.glb` | Repeat | No | Yes | Locomotion | Tactical strafe left with rifle |
| 25 | `rifle_strafe_right` | `Athletic_man@rifle_strafe_right.glb` | Repeat | No | Yes | Locomotion | Tactical strafe right with rifle |
| 26 | `rifle_run` | `Athletic_man@rifle_run.glb` | Repeat | No | Yes | Locomotion | Tactical jog with rifle |
| 27 | `rifle_sprint` | `Athletic_man@rifle_sprint.glb` | Repeat | No | Yes | Locomotion | High-port sprint with rifle |
| 28 | `pistol_idle` | `Athletic_man@pistol_idle.glb` | Repeat | No | No | Locomotion | Two-hand pistol ready |
| 29 | `pistol_aim` | `Athletic_man@pistol_aim.glb` | Repeat | No | No | Locomotion | Two-hand pistol sight picture |
| 30 | `pistol_aim_one_hand` | `Athletic_man@pistol_aim_one_hand.glb` | Repeat | No | No | Locomotion | One-hand pistol stance |
| 31 | `pistol_fire` | `Athletic_man@pistol_fire.glb` | Once | No | No | Action | Handgun shot recoil |
| 32 | `pistol_walk` | `Athletic_man@pistol_walk.glb` | Repeat | No | Yes | Locomotion | Tactical walk with handgun |
| 33 | `pistol_run` | `Athletic_man@pistol_run.glb` | Repeat | No | Yes | Locomotion | Tactical run with handgun |
| 34 | `pistol_sprint` | `Athletic_man@pistol_sprint.glb` | Repeat | No | Yes | Locomotion | Full sprint with handgun |
| 35 | `pistol_strafe_left` | `Athletic_man@pistol_strafe_left.glb` | Repeat | No | Yes | Locomotion | Handgun strafe left |
| 36 | `pistol_strafe_right` | `Athletic_man@pistol_strafe_right.glb` | Repeat | No | Yes | Locomotion | Handgun strafe right |
| 37 | `punch` | `Athletic_man@punch.glb` | Once | No | No | Action | High unarmed cross punch |
| 38 | `punch_low` | `Athletic_man@punch_low.glb` | Once | No | No | Action | Low body hook punch |
| 39 | `sword_idle` | `Athletic_man@sword_idle.glb` | Repeat | No | No | Locomotion | Melee weapon ready guard |
| 40 | `sword_slash` | `Athletic_man@sword_slash.glb` | Once | No | No | Action | Melee slash (knife / bat / blade) |
| 41 | `sword_block` | `Athletic_man@sword_block.glb` | Once | No | No | Action | Defensive parry / block |
| 42 | `hit` | `Athletic_man@hit.glb` | Once | No | Yes | Damage | General impact flinch |
| 43 | `hit_front` | `Athletic_man@hit_front.glb` | Once | No | Yes | Damage | Frontal impact recoil |
| 44 | `hit_back` | `Athletic_man@hit_back.glb` | Once | No | Yes | Damage | Rear strike stagger |
| 45 | `hit_left` | `Athletic_man@hit_left.glb` | Once | No | Yes | Damage | Left strike tilt |
| 46 | `hit_right` | `Athletic_man@hit_right.glb` | Once | No | Yes | Damage | Right strike tilt |
| 47 | `knockdown` | `Athletic_man@knockdown.glb` | Once | Yes | Yes | Knockdown | Knockdown ground collapse |
| 48 | `get_up_face_up` | `Athletic_man@get_up_face_up.glb` | Once | No | Yes | Knockdown | Supine recovery to feet |
| 49 | `get_up_face_down` | `Athletic_man@get_up_face_down.glb` | Once | No | Yes | Knockdown | Prone recovery to feet |
| 50 | `death_forward` | `Athletic_man@death_forward.glb` | Once | Yes | Yes | Death | Forward lethal collapse |
| 51 | `death_backward` | `Athletic_man@death_backward.glb` | Once | Yes | Yes | Death | Backward lethal collapse |
| 52 | `pick_up` | `Athletic_man@pick_up.glb` | Once | No | No | Action | Ground loot grab |
| 53 | `put_down` | `Athletic_man@put_down.glb` | Once | No | No | Action | Item deposit / placement |
| 54 | `use_press` | `Athletic_man@use_press.glb` | Once | No | No | Action | Button / terminal interaction |
| 55 | `open_door` | `Athletic_man@open_door.glb` | Once | No | No | Action | Door latch push / open |
| 56 | `push` | `Athletic_man@push.glb` | Once | No | No | Action | Heavy crate / barrier shove |
| 57 | `carry_idle` | `Athletic_man@carry_idle.glb` | Repeat | No | No | Locomotion | Heavy supply carrier stance |
| 58 | `carry_walk` | `Athletic_man@carry_walk.glb` | Repeat | No | Yes | Locomotion | Heavy supply transport walk |
| 59 | `throw_grenade` | `Athletic_man@throw_grenade.glb` | Once | No | No | Action | Explosive / lure overhead throw |

---

## 5. Gameplay Event Synchronization

The player character animations are tied to the gameplay lifecycle:

| Gameplay Trigger | Event / State | Animation Action | Priority |
|---|---|---|:---:|
| Moving forward | Analog axis $y > 0$ | `walk` / `run` / `rifle_walk` / `pistol_walk` | Locomotion (0) |
| Moving backward | Analog axis $y < -0.3$ | `walk_back` / `rifle_walk_back` | Locomotion (0) |
| Strafing | Analog axis $\|x\| > \|y\|$ | `strafe_left` / `strafe_right` / `rifle_strafe_*` | Locomotion (0) |
| Sprinting | Sprint button held + stamina $> 5$ | `run` / `rifle_sprint` / `pistol_sprint` | Locomotion (0) |
| Jump initiation | Jump key + grounded | `jump_start` | Action (1) |
| Airborne | Vertical velocity $\|v_y\| > 0.45$ | `jump_air` | Locomotion (0) |
| Landing | Transition from airborne to ground | `jump_land` | Action (1) |
| Gunfire | `weapon:fire` | `rifle_fire` / `pistol_fire` | Action (1) |
| Reload | `weapon:reload` | `rifle_reload` | Action (1) |
| Melee strike | `audio:play_sfx` (`melee_swing`) | `sword_slash` / `punch` | Action (1) |
| Zombie damage | `player:damage` | `hit_front` / `hit_back` | Damage (2) |
| Knockdown | Stun / heavy blow | `knockdown` | Knockdown (3) |
| Recovery | Getting up from knockdown | `get_up_face_down` / `get_up_face_up` | Knockdown (3) |
| Death | `player:death` | `death_forward` / `death_backward` | Death (4, lock) |
| Interaction | `player:interact` | `use_press` / `pick_up` / `open_door` | Action (1) |

---

## 6. Verification and Test Results

### Automated Test Suite (`tests/unit/player/player_animation.test.ts`):
- `registers all 59 supplied animations in the registry` — Passed.
- `enforces correct looping rules: locomotion loops, one-shots do not` — Passed.
- `enforces clampWhenFinished on death and knockdown actions` — Passed.
- `locks X and Z displacement to frame 0 while preserving vertical Y bobbing on Hips` — Passed.
- `resolves stationary postures based on equipped weapon and stance` — Passed.
- `resolves directional locomotion (forward, backward, strafe) correctly` — Passed.
- `resolves in-air jump state regardless of lateral movement` — Passed.
- `locks character in death state and ignores subsequent locomotion or actions` — Passed.
- `toggles rifle meshes and attaches custom weapons to WeaponR bone` — Passed.
- `stops actions and cleans up resources without memory leaks` — Passed.

### Overall Project Health:
- **Test Suite**: 57 tests passing across 12 test suites in 10.2s.
- **TypeScript**: Strict type check (`tsc --noEmit`) passes with 0 errors.
- **Production Build**: Vite bundle compiles cleanly in 1.05s.
