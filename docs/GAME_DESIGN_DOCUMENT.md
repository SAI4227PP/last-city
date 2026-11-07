# LAST CITY — Game Design Document (GDD)

## 1. Game Overview
- **Title**: LAST CITY
- **Genre**: 3D Cinematic Zombie Apocalypse Survival RPG
- **Platform**: WebGL 2 / Modern Desktop & Mobile Browsers (Targeted for CrazyGames)
- **Engine**: Three.js + Rapier 3D Physics
- **Viewpoint**: Third-Person Over-the-Shoulder & Tactical Exploration

## 2. Narrative & World Premise
A virulent pathogen—designated the **Aevum Strain**—infiltrates the metropolitan center of **Veridia**. The infection rapidly triggers hyper-aggression, tissue necrosis, and neurological collapse in hosts.
Within 72 hours, emergency services disintegrate, martial law fails, and the military executes a scorched-earth tactical retreat, leaving behind sealed perimeter barricades.

**Thirty days later**, our protagonist awakens in the derelict St. Jude Metropolitan Hospital. Weakened, isolated, and disoriented, the player must:
1. Navigate the infected ruins of the hospital.
2. Escape into the devastated urban core.
3. Overcome mutated threats and scavenge food, clean water, and ammunition.
4. Establish a safehouse network and uncover the truth behind the infection.

## 3. Core Gameplay Loop
The game links four progressive stages:
1. **Cinematic Prologue (Stage 1)**: Visual storytelling of the city's collapse (skippable at any point).
2. **Hospital Outbreak (Stage 2)**: Grounded survival horror tutorial (awakening, stealth/evasion, scavenging supplies and keycards, first zombie encounter, emergency exit).
3. **City Escape (Stage 3)**: Urban gauntlet through ruined intersections, police barricades, burning vehicles, military checkpoint breach.
4. **Open Survival (Stage 4)**: Persistent RPG survival simulation (explorable district, building scavenging, crafting, melee & firearm combat, zombie hordes with 5 distinct variants, safehouse fortification, survivor quests, and full IndexedDB save/load).

## 4. Mechanics & Player Systems
- **Survival Vitals**:
  - **Health (0-100)**: Decreases upon taking damage or starving/dehydrating. Restored with bandages, medkits, or rest.
  - **Stamina (0-100)**: Consumed by sprinting and heavy melee attacks. Regenerates when walking or idle.
  - **Hunger (0-100)**: Depletes over time. Restored with canned rations, energy bars.
  - **Thirst (0-100)**: Depletes faster than hunger. Restored with purified water bottles.
- **Combat & Arsenal**:
  - *Combat Knife*: Silent, high durability, fast speed.
  - *Baseball Bat / Spiked Bat*: High impact, stagger effect.
  - *9mm Service Pistol*: Precision firearm, moderate noise.
  - *Pump-Action Shotgun*: High spread, devastating close-range stopping power.
  - *Tactical Assault Rifle*: Rapid fire, burst control.
- **Zombie Archetypes**:
  1. *Walker (Normal Infected)*: Standard shambler, group threat.
  2. *Runner (Fast Infected)*: Sprinter, high agility, detects sounds rapidly.
  3. *Brute (Heavy Infected)*: High armor and health, heavy knockback slams.
  4. *Spitter (Toxic Infected)*: Ranged acid/bile projector, leaves hazard pools.
  5. *Abomination (Boss Infected)*: Multi-phase elite monstrosity encountered at fortified zones.

## 5. UI / UX Design
- Minimalist, immersive HUD: health/stamina bars, dynamic crosshair, ammo counter, survival gauges, contextual interaction prompts ("Press [E] to Scavenge").
- Inventory grid with item inspection, stacking, and equipment slots.
- Full mobile touchscreen support: virtual movement joystick, touch look, dynamic action buttons.
