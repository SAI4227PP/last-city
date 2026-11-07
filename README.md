# LAST CITY — 3D Cinematic Zombie Apocalypse Survival RPG

**LAST CITY** is a cinematic, third-person, story-driven 3D zombie apocalypse survival RPG built entirely for modern web browsers (WebGL 2, Three.js, Rapier 3D physics, TypeScript, Zustand, and IndexedDB). Designed for high performance, modularity, and CrazyGames publishing.

---

## 🎮 Game Stages

1. **Stage 1: Cinematic Introduction (Prologue)**
   - 4-act 40-second cinematic sequence detailing the fall of the metropolis (News broadcast, hospital ICU breach, military line collapse, 30 days later title card).
   - Instant Skip button (`ESC` / Mobile button) with seamless progression persistence.
2. **Stage 2: Hospital Outbreak**
   - Grounded survival horror tutorial in St. Jude Hospital.
   - Scavenge bandages & medkits, locate security keycard, encounter the infected orderly, and unlock the emergency exit.
3. **Stage 3: City Escape**
   - Urban gauntlet through ruined boulevards, burning taxi wrecks, and police barricades.
   - Search abandoned police cruiser trunk to unlock the 9mm Service Pistol & ammo.
   - Breached military checkpoint reveals complete evacuation failure.
4. **Stage 4: Open Survival**
   - Persistent open-world district simulation with enterable buildings: Green Cross Pharmacy, Supermarket/Grocery, Fortified Safehouse.
   - 5 Zombie Variants: Walkers, Fast Runners, Armored Brutes, Toxic Spitters, and Patient Zero Boss.
   - Full survival mechanics: Health, Stamina, Hunger, Thirst.
   - Grid inventory & Crafting (Medkits, Bandages, Improvised Ammo).
   - Persistent safehouse bed with automatic & manual IndexedDB save/restore across browser sessions.

---

## 🛠️ Tech Stack & Architecture

- **Language**: TypeScript (Strict Mode)
- **3D Engine**: Three.js (WebGL 2, ACES Filmic Tone Mapping, PCF Soft Shadows)
- **Physics**: Rapier 3D Physics (`@dimforge/rapier3d-compat`)
- **State Management**: Zustand (Vanilla store)
- **Persistence**: IndexedDB (`idb`)
- **Audio**: Hybrid Web Audio procedural synthesis + Howler.js
- **Build System**: Vite 8
- **Testing**: Vitest + Happy DOM

---

## 🚀 Running the Game Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Test Suite
```bash
npm run test
```

### 4. Type Check
```bash
npm run type-check
```

### 5. Production Build
```bash
npm run build
npm run preview
```

---

## 🕹️ Controls

- **WASD / Arrows**: Move Character
- **Mouse / Touch Drag**: Orbit Camera & Aim
- **Left Click / Attack Touch**: Melee Swing / Fire Weapon
- **Shift / Sprint Touch**: Sprint (Drains Stamina)
- **C**: Crouch
- **Space**: Jump
- **E / Action Touch**: Interact / Scavenge
- **R**: Reload Firearm
- **Tab / Bag Touch**: Inventory & Crafting
- **Escape**: Pause Menu / Skip Intro
