# LAST CITY — Complete Playable 3D Hospital Level Architecture & Design

## Executive Summary

Stage 1 (**St. Jude Hospital Outbreak**) has been transformed from a single corridor prototype into a complete, cinematic, connected, and fully playable 3D survival-horror level. The level follows the spatial layout, visual benchmarks, and environmental storytelling inspired by classic survival-horror hospital environments (*The Sinking City 2*, *Resident Evil*, *Silent Hill*).

The implementation strictly preserves all working gameplay subsystems (Athletic Man character model and 59 animation clips, Rapier 3D dynamic physics capsule, Zombie AI variants, combat hit detection, inventory, survival vitals, and mission progressions) while refactoring the hospital into a clean modular architecture.

---

## 1. Spatial Layout & Level Design

```text
               +-------------------------------------------------+
               |       EMERGENCY FIRE EXIT (Z: 62)               |
               |  Double Heavy Steel Doors + Keycard Scanner     |
               +-----------------------+-------------------------+
                                       |
    +-----------------------+          | Corridor (Z: 50-60)     +-----------------------+
    | STAIRCASE BLOCKADE    |          | Wheelchairs, Blood      | SECURITY COMMAND      |
    | Collapsed Rubble      |          |                         | CCTV Console, Monitors|
    | (X: -13 to -3)        |          |                         | [Security Keycard]    |
    | (Z: 48 to 58)         |          |                         | (X: 3 to 13, Z: 48-58)|
    +-----------------------+          |                         +-----------------------+
                                       |
    +-----------------------+          | Corridor (Z: 32-46)     +-----------------------+
    | HOSPITAL PHARMACY     |  Grate   | Overhead Fluorescents   | EMERGENCY WARD        |
    | Medicine Racks        |  Door    | Stretcher, Debris       | Trauma Bays, Curtains |
    | Medkits & Bandages    +----]     |                         | Surgical Overhead Lamp|
    | (X: -14 to -3, Z:32-46)          |                         | [First Zombie Encounter]|
    +-----------------------+          |                         | (X: 3 to 15, Z: 30-46)|
                                       |                         +-----------------------+
                                       |
    +-----------------------+          | Corridor (Z: 14-28)     +-----------------------+
    | PATIENT ROOM 102      |          | Overhead Light (Flicker)| NURSE STATION & REC.  |
    | Exam Bed, Supplies    |          | Blood Smear             | Curved Counter Desk   |
    | (X: -12 to -3, Z:18-28)          |                         | PC Monitors, Clipboards|
    +-----------------------+          |                         | [Doctor's Memo Note]  |
                                       |                         | (X: 3 to 13, Z: 14-28)|
    +-----------------------+          |                         +-----------------------+
    | PATIENT ROOM 101      |          |
    | Overturned Bed, Loot  |          | Corridor (Z: 5-14)
    | (X: -12 to -3, Z:6-16)|          | Wheelchair, Signposts
    +-----------------------+          |
                                       |
               +-----------------------+-------------------------+
               | ROOM 104 - PATIENT AWAKENING (Z: -5 to 5)       |
               | Hospital Bed, ECG Monitor, Medicine Cabinet     |
               | Player Spawns at (0, 1.2, 0)                    |
               +-------------------------------------------------+
```

### Area Breakdown & Gameplay Functionality

| Zone | Coordinates | Visual Assets & Props | Gameplay Purpose |
|---|---|---|---|
| **Room 104** | $X \in [-4.5, 4.5]$, $Z \in [-5, 5]$ | Hospital bed, green ECG monitor, IV stand, medicine cabinet | Player awakens, grabs tactical knife, learns locomotion & camera controls. |
| **Main Corridor** | $X \in [-3, 3]$, $Z \in [5, 62]$ | Fluorescent fixtures, directional signs, overturned wheelchairs, debris | Connects all wings; establishes atmosphere, dread, and navigation signs. |
| **Nurse Station** | $X \in [3, 13]$, $Z \in [14, 28]$ | Curved reception desk, CRT terminals, filing cabinets, doctor's memo | Discover outbreak lore note explaining that the security keycard is in Security. |
| **Patient Rooms (101, 102)** | $X \in [-12, -3]$, $Z \in [6, 28]$ | Overturned beds, examination lights, blood smears, loot | Side exploration for antiseptic bandages, clean rags, and crafting items. |
| **Emergency Ward** | $X \in [3, 15]$, $Z \in [30, 46]$ | Trauma bays, privacy curtains, surgical overhead lamp, crash cart, arterial blood splatters | First infected encounter: Hospital Orderly Shambler (`walker`, 100 HP). |
| **Hospital Pharmacy** | $X \in [-14, -3]$, $Z \in [32, 46]$ | Steel drug racks, medicine crates, pill bottles | High-tier medicine loot (2x Sterile Medkits, 3x Antiseptic Bandages). |
| **Security Command** | $X \in [3, 13]$, $Z \in [48, 58]$ | Surveillance console, 3 glowing CCTV screens, terminal keyboard | Obtain the **St. Jude Security Keycard** (`hospital_keycard`). |
| **Staircase Blockade** | $X \in [-13, -3]$, $Z \in [48, 58]$ | Collapsed concrete rubble, hazard barrier | Blocked route that funnels player towards the final fire exit. |
| **Emergency Fire Exit** | $X \in [-3.5, 3.5]$, $Z \in [58, 64]$ | Double heavy steel fire doors, green EXIT sign, card reader terminal | Swipe keycard, unlock fire exit, step through into city courtyard (`city-escape`). |

---

## 2. Technical Architecture & Modular Directory Structure

```text
src/scenes/hospital/
├── HospitalLevelConfig.ts    # Central typed data registry (rooms, doors, props, lights, triggers)
├── HospitalEnvironment.ts    # Floors, ceilings, walls, colliders, and procedural 3D prop generation
├── HospitalLighting.ts       # Ambient, overhead fluorescents, electrical flicker, and emergency pulses
├── HospitalDoors.ts          # Interactive doors, swinging/sliding states, audio, and physics barriers
├── HospitalInteractions.ts   # Interaction prompts, keycard pickups, medicine loot, note reading
├── HospitalZombieSpawns.ts   # Proximity-triggered zombie encounters (Orderly, Runner, Shambler)
├── HospitalAudio.ts          # Environmental hospital drone, electrical hums, and SFX bus
├── HospitalMission.ts        # Stage 1 mission progression hooks (hosp_m1 through hosp_m4)
└── HospitalScene.ts          # Master scene coordinator implementing BaseScene
```

---

## 3. Atmospheric Survival-Horror Lighting

1. **Ambient Fill Light**: `AmbientLight(0x42586e, 1.45)` guarantees that shadows are never crushed to 0 black by `ACESFilmicToneMapping`.
2. **Room 104 Awakening**: Warm overhead fixture `PointLight(0xc2e2ff, 2.6, 14, 1.2)` + green monitor glow `PointLight(0x38ef7d, 1.5, 6)`.
3. **Corridor Lighting**: Series of 4 overhead fluorescent fixtures ($Z = 12, 24, 36, 48$) with mathematical electrical arc flicker (`flickers: true`).
4. **Emergency Ward**: Cool clinical surgical lamp `PointLight(0xe8f4ff, 3.0, 16, 1.0)` + red emergency beacon `PointLight(0xff1e1e, 1.8, 12)` with smooth sine-wave breathing pulse.
5. **Security Command**: Cyan-blue CCTV terminal glow `PointLight(0x38bdf8, 2.0, 10)`.
6. **Emergency Fire Exit**: Green illuminated EXIT sign `PointLight(0x22c55e, 2.0, 8)` + red hazard beacon.

---

## 4. Mission Flow & Player Progression

1. **Awakening (`hosp_m1`)**:
   - Objective `obj_wake`: Investigate Room 104 and step out into the corridor ($Z > 4.5\text{m}$).
2. **Search for Supplies (`hosp_m2`)**:
   - Objective `obj_meds`: Scavenge medical cabinet in Room 104 for antiseptic bandages.
   - Objective `obj_keycard`: Pick up the St. Jude Security Keycard in the Security Office.
3. **First Contact (`hosp_m3`)**:
   - Objective `obj_encounter`: Encounter and overcome or evade the infected orderly in the Emergency Ward.
4. **Hospital Escape (`hosp_m4`)**:
   - Objective `obj_unlock`: Swipe the keycard at the emergency exit card reader terminal.
   - Objective `obj_exit`: Walk through the open fire doors into the courtyard to transition seamlessly to Stage 2 (`city-escape`).

---

## 5. Verification & Test Metrics

- **Vitest Suite**: 57 passed tests across 12 test suites with 0 failures.
- **TypeScript**: Strict type-checking (`tsc --noEmit`) passes with 0 errors.
- **Production Build**: Vite builds and code-splits all scenes cleanly (HospitalScene bundle: 31.73 kB minified / 8.42 kB gzip).
