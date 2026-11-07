# LAST CITY — Folder Structure

```
LAST-CITY/
├── docs/                      # Architectural, design, and roadmap specifications
├── public/                    # Static web assets, icons, audio, shaders
│   └── assets/
│       ├── audio/
│       ├── models/
│       └── textures/
├── src/
│   ├── app/                   # Top-level lifecycle, config, and game container
│   │   ├── ApplicationContext.ts
│   │   ├── GameApplication.ts
│   │   ├── GameBootstrap.ts
│   │   └── GameConfig.ts
│   ├── core/                  # Reusable low-level game engine subsystems
│   │   ├── assets/            # Loaders, procedural generators, texture cache
│   │   ├── audio/             # Procedural synth & audio manager
│   │   ├── engine/            # Three.js renderer, camera, scene controller
│   │   ├── events/            # Type-safe EventBus and event catalog
│   │   ├── input/             # Keyboard, mouse, touch, pointer lock
│   │   ├── loop/              # Timestep manager, RAF loop, FPS monitor
│   │   ├── physics/           # Rapier 3D world wrapper, colliders, raycasts
│   │   └── utils/             # ObjectPool, MathUtils, Logger, Disposable
│   ├── features/              # Modular gameplay domains
│   │   ├── cinematics/        # Director, camera timeline, subtitles
│   │   ├── combat/            # Weapons, ballistics, damage pipeline
│   │   ├── crafting/          # Recipes, workbench, upgrades
│   │   ├── inventory/         # Slot storage, equipment, stack limits
│   │   ├── missions/          # Objective tracker, mission registry
│   │   ├── player/            # Movement, animation controller, camera follow
│   │   ├── survival/          # Health, hunger, thirst, stamina vitals
│   │   ├── world/             # Environment props, districts, interactables
│   │   └── zombies/           # State machine AI, perception, variants, horde
│   ├── scenes/                # Playable stages and menus
│   │   ├── BaseScene.ts
│   │   ├── main-menu/
│   │   ├── cinematic/
│   │   ├── hospital/
│   │   ├── city-escape/
│   │   └── open-survival/
│   ├── ui/                    # Presentation UI, styles, Zustand store
│   │   ├── components/
│   │   ├── screens/
│   │   ├── store/
│   │   └── styles/
│   ├── persistence/           # IndexedDB save manager & migrations
│   ├── platform/              # Browser & CrazyGames SDK adapters
│   ├── data/                  # Static weapon, item, recipe, mission definitions
│   ├── shared/                # Universal types, interfaces, constants
│   └── main.ts                # Application entrypoint
├── tests/                     # Unit and integration test suites
│   ├── unit/
│   │   ├── persistence/
│   │   ├── survival/
│   │   ├── inventory/
│   │   └── combat/
│   └── integration/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
