import * as THREE from 'three';
import { BaseScene } from '@/scenes/BaseScene';
import { StageId, PlayerSaveData } from '@/shared/types';
import { GameEngine } from '@/core/engine/GameEngine';
import { PlayerController } from '@/features/player/PlayerController';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';
import { InventoryManager } from '@/features/inventory/InventoryManager';
import { CraftingManager } from '@/features/crafting/CraftingManager';
import { CombatManager } from '@/features/combat/CombatManager';
import { ZombieManager } from '@/features/zombies/ZombieManager';
import { MissionManager } from '@/features/missions/MissionManager';
import { ParticleSystem } from '@/core/engine/ParticleSystem';
import { ModelFactory } from '@/core/assets/ModelFactory';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { AudioManager } from '@/core/audio/AudioManager';
import { PerformanceManager } from '@/core/performance/PerformanceManager';
import { SaveManager } from '@/persistence/SaveManager';
import { EventBus } from '@/core/events/EventBus';
import { Logger } from '@/core/utils/Logger';
import { WeaponLootManager } from '@/features/loot/WeaponLootManager';
import { WeaponAssetPool } from '@/features/combat/WeaponAssetPool';

interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  prompt: string;
  onInteract: () => void;
}

export class OpenSurvivalScene extends BaseScene {
  public readonly id: StageId = 'open-survival';

  public player!: PlayerController;
  public survivalSystem!: SurvivalSystem;
  public inventoryManager!: InventoryManager;
  public craftingManager!: CraftingManager;
  public combatManager!: CombatManager;
  public zombieManager!: ZombieManager;
  public missionManager!: MissionManager;
  public particleSystem!: ParticleSystem;
  public lootManager!: WeaponLootManager;

  private interactables: Interactable[] = [];
  private currentInteractable: Interactable | null = null;
  private autoSaveTimer: number = 0;
  private safehouseUnlocked: boolean = false;

  constructor(engine: GameEngine) {
    super(engine);
  }

  public async init(): Promise<void> {
    this.scene.background = new THREE.Color(0x6e8498);
    this.scene.fog = new THREE.FogExp2(0x6e8498, 0.007);

    // 1. Initialize Subsystems
    this.survivalSystem = new SurvivalSystem();
    this.inventoryManager = new InventoryManager();
    this.craftingManager = new CraftingManager(this.inventoryManager);
    this.particleSystem = new ParticleSystem(this.scene, 1500);
    this.combatManager = new CombatManager(this.scene, this.engine.cameraManager, this.particleSystem);
    this.zombieManager = new ZombieManager(this.scene, this.survivalSystem, this.engine.physicsWorld);
    this.combatManager.setZombieManager(this.zombieManager);
    this.missionManager = new MissionManager();

    // 2. Build Open City District Environment
    this.buildCityDistrict();

    // 3. Create Player at District Entry Plaza
    let startPos = new THREE.Vector3(0, 1.2, 0);

    // Check if an existing save exists to restore progression
    const existingSave = await SaveManager.getInstance().loadGame();
    if (existingSave && existingSave.stage === 'open-survival') {
      Logger.info('Restoring saved game state in Open Survival district.');
      startPos = new THREE.Vector3(...existingSave.playerPosition);
      this.survivalSystem.setVitals(existingSave.vitals);
      this.inventoryManager.setItems(existingSave.inventory);
      this.safehouseUnlocked = existingSave.safehouseUnlocked;
      this.missionManager.setCompletedMissions(existingSave.completedMissions);

      // Restore weapons
      Object.entries(existingSave.weapons).forEach(([type, data]) => {
        if (data.unlocked) {
          this.combatManager.unlockWeapon(type as any, data.currentAmmo, data.reserveAmmo);
        }
      });
      this.combatManager.equipWeapon(existingSave.equippedWeapon);
    } else {
      // Default starting equipment for Open Survival
      this.inventoryManager.addItem('item_knife', 1);
      this.inventoryManager.addItem('item_pistol', 1);
      this.inventoryManager.addItem('ammo_9mm', 30);
      this.inventoryManager.addItem('canned_beans', 2);
      this.inventoryManager.addItem('clean_water', 2);
      this.inventoryManager.addItem('cloth', 4);
      this.inventoryManager.addItem('alcohol', 2);
      this.inventoryManager.addItem('scrap_metal', 6);

      this.combatManager.unlockWeapon('knife');
      this.combatManager.unlockWeapon('pistol', 15, 30);
      this.combatManager.equipWeapon('pistol');
    }

    this.player = new PlayerController(
      this.scene,
      this.engine.physicsWorld,
      this.engine.inputManager,
      this.engine.cameraManager,
      startPos
    );
    await this.player.init();
    this.zombieManager.setPlayer(this.player);

    // 4. Preload Weapon Assets & Setup Weapon Loot Manager
    await WeaponAssetPool.getInstance().preloadAll();
    this.lootManager = new WeaponLootManager(
      this.scene,
      this.combatManager,
      this.inventoryManager,
      this.engine.physicsWorld
    );

    // Initial tactical weapon drops across Veridia District
    // Tactical Shotgun at Police Precinct
    this.lootManager.spawnWeaponDrop('shotgun', new THREE.Vector3(18, 0.4, -20), 8, 16, 'district_police_shotgun');
    // Military Assault Rifle at Abandoned Checkpoint
    this.lootManager.spawnWeaponDrop('rifle', new THREE.Vector3(-22, 0.4, 25), 30, 60, 'district_checkpoint_rifle');
    // High-Caliber Sniper Rifle at Rooftop / Water Tower Nest
    this.lootManager.spawnWeaponDrop('sniper', new THREE.Vector3(30, 0.4, 30), 5, 15, 'district_sniper_nest');
    // Heavy Machine Gun at Central Military Supply Depot
    this.lootManager.spawnWeaponDrop('machinegun', new THREE.Vector3(-15, 0.4, -32), 60, 120, 'district_armory_machinegun');

    // 5. Setup Missions
    this.missionManager.startStageMissions('open-survival');

    // 6. Spawn Zombies Across District (Diverse Variants!)
    this.spawnDistrictZombies();

    // 7. Connect Input Actions
    this.engine.inputManager.onInteractPressed = () => {
      // Prioritize picking up 3D weapon drop
      if (this.lootManager.tryPickup(this.player.getPosition())) {
        return;
      }
      if (this.currentInteractable) {
        this.currentInteractable.onInteract();
      }
    };
    this.engine.inputManager.onReloadPressed = () => {
      this.combatManager.reload();
    };
    this.engine.inputManager.onWeaponSlotPressed = (slot) => {
      this.combatManager.equipSlot(slot);
    };

    // UI & Audio
    useGameUIStore.getState().setStage('open-survival');
    useGameUIStore.getState().setStageBanner('STAGE 3', 'OPEN SURVIVAL — VERIDIA DISTRICT');
    AudioManager.getInstance().startAmbience('city');
  }

  private buildCityDistrict(): void {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3b444f, roughness: 0.88 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x6a7785, roughness: 0.8 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x824d42, roughness: 0.85 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x5e6c7c, roughness: 0.78 });

    // Ground Grid (140m x 140m)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), roadMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(70, 0.5, 70));

    // Directional Sunlight with adaptive shadow resolution
    const perfConfig = PerformanceManager.getInstance().getConfig();
    const sun = new THREE.DirectionalLight(0xffeed6, 2.8);
    sun.position.set(45, 65, -35);
    sun.castShadow = perfConfig.shadows;
    sun.shadow.mapSize.width = perfConfig.shadowMapSize;
    sun.shadow.mapSize.height = perfConfig.shadowMapSize;
    this.scene.add(sun);

    // Sky Dome & Earth Bounce
    const hemi = new THREE.HemisphereLight(0x9bc0db, 0x505b63, 1.8);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xdbe6f0, 1.25);
    this.scene.add(ambient);

    // Sidewalk Plaza
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(40, 0.3, 40), sidewalkMat);
    plaza.position.set(0, 0.15, 0);
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // --- BUILDING 1: Fortified Safehouse (Southwest, X = -24, Z = 20) ---
    const safehouse = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 14), brickMat);
    safehouse.position.set(-24, 4, 20);
    safehouse.castShadow = true;
    this.scene.add(safehouse);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(-24, 4, 20), new THREE.Vector3(8, 4, 7));

    // Safehouse Door Sign
    const safeSignMat = new THREE.MeshBasicMaterial({ color: 0xd69e2e });
    const safeSign = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 0.1), safeSignMat);
    safeSign.position.set(-16.05, 3.2, 20);
    safeSign.rotation.y = Math.PI / 2;
    this.scene.add(safeSign);

    // Interactable: Safehouse Door
    this.interactables.push({
      id: 'safehouse_door',
      position: new THREE.Vector3(-15.8, 1.2, 20),
      radius: 2.5,
      prompt: this.safehouseUnlocked ? 'Rest in Safehouse & Save Game' : 'Unlock Safehouse Deadbolt',
      onInteract: () => {
        this.safehouseUnlocked = true;
        this.missionManager.completeObjective('surv_m1', 'obj_find_safehouse');
        this.missionManager.completeObjective('surv_m1', 'obj_secure_bed');

        // Full heal and stamina refresh on rest
        this.survivalSystem.heal(100);
        this.survivalSystem.setVitals({ stamina: 100 });
        AudioManager.getInstance().playSound('door_open');

        // Save game state
        this.saveGameState();

        EventBus.getInstance().emit('subtitle:show', {
          speaker: 'SAFEHOUSE',
          text: 'Resting in fortified safehouse. Health & stamina restored. Game saved to IndexedDB.',
          durationMs: 4000
        });
      }
    });

    // --- BUILDING 2: Green Cross Pharmacy (Northeast, X = 24, Z = -18) ---
    const pharmacy = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), concreteMat);
    pharmacy.position.set(24, 4, -18);
    pharmacy.castShadow = true;
    this.scene.add(pharmacy);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(24, 4, -18), new THREE.Vector3(9, 4, 7));

    // Green Cross Sign
    const pharmSignMat = new THREE.MeshBasicMaterial({ color: 0x00cc44 });
    const pharmCross = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.1), pharmSignMat);
    pharmCross.position.set(15.05, 3.8, -18);
    pharmCross.rotation.y = -Math.PI / 2;
    this.scene.add(pharmCross);

    // Interactable: Pharmacy Medical Supply Cache
    this.interactables.push({
      id: 'pharmacy_cache',
      position: new THREE.Vector3(15.2, 1.2, -18),
      radius: 2.8,
      prompt: 'Scavenge Green Cross Pharmacy Cache',
      onInteract: () => {
        this.inventoryManager.addItem('medkit', 2);
        this.inventoryManager.addItem('bandage', 3);
        this.inventoryManager.addItem('alcohol', 3);
        this.missionManager.completeObjective('surv_side_pharmacy', 'obj_pharmacy_loot');
        AudioManager.getInstance().playSound('pickup');

        EventBus.getInstance().emit('subtitle:show', {
          speaker: 'PLAYER',
          text: 'Scavenged pharmaceutical stockpiles: 2 Military Medkits, bandages, and antiseptic.',
          durationMs: 3500
        });

        this.interactables = this.interactables.filter((i) => i.id !== 'pharmacy_cache');
      }
    });

    // --- BUILDING 3: Supermarket / Grocery (Northwest, X = -24, Z = -24) ---
    const grocery = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 16), concreteMat);
    grocery.position.set(-24, 4, -24);
    grocery.castShadow = true;
    this.scene.add(grocery);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(-24, 4, -24), new THREE.Vector3(10, 4, 8));

    // Interactable: Supermarket Food Rations & Water
    this.interactables.push({
      id: 'supermarket_supplies',
      position: new THREE.Vector3(-14.2, 1.2, -24),
      radius: 2.8,
      prompt: 'Scavenge Supermarket Grocery Shelves',
      onInteract: () => {
        this.inventoryManager.addItem('canned_beans', 3);
        this.inventoryManager.addItem('clean_water', 3);
        this.inventoryManager.addItem('energy_bar', 4);
        AudioManager.getInstance().playSound('pickup');

        EventBus.getInstance().emit('subtitle:show', {
          speaker: 'PLAYER',
          text: 'Found canned military beans, energy bars, and bottles of fresh purified water!',
          durationMs: 3500
        });

        this.interactables = this.interactables.filter((i) => i.id !== 'supermarket_supplies');
      }
    });

    // --- WEAPON CRATE IN CENTRAL PLAZA: Pump Shotgun & Ammo ---
    const weaponCrate = ModelFactory.createLootCrate();
    weaponCrate.position.set(0, 0, 8);
    this.scene.add(weaponCrate);

    this.interactables.push({
      id: 'shotgun_crate',
      position: new THREE.Vector3(0, 0.6, 8),
      radius: 2.5,
      prompt: 'Pry Open Tactical Weapons Crate',
      onInteract: () => {
        this.inventoryManager.addItem('item_shotgun', 1);
        this.inventoryManager.addItem('ammo_shotgun', 18);
        this.combatManager.unlockWeapon('shotgun', 6, 18);
        this.combatManager.equipWeapon('shotgun');
        AudioManager.getInstance().playSound('pickup');

        EventBus.getInstance().emit('subtitle:show', {
          speaker: 'PLAYER',
          text: 'Unlocked 12G Pump-Action Shotgun with 18 buckshot shells! Close-quarters devastation.',
          durationMs: 4000
        });

        this.interactables = this.interactables.filter((i) => i.id !== 'shotgun_crate');
      }
    });

    // Street Lamps with moody warm lighting
    for (const pos of [new THREE.Vector3(-10, 0, 0), new THREE.Vector3(10, 0, 0), new THREE.Vector3(0, 0, -15)]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5), concreteMat);
      pole.position.copy(pos).add(new THREE.Vector3(0, 2.25, 0));
      this.scene.add(pole);

      const lamp = new THREE.PointLight(0xffcc88, 1.8, 14);
      lamp.position.copy(pos).add(new THREE.Vector3(0, 4.3, 0));
      this.scene.add(lamp);
    }

    // Instanced Concrete Barricades & Debris Piles in Open Survival (1 draw call)
    const barrierGeo = new THREE.BoxGeometry(2.4, 0.9, 0.5);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x3e4756, roughness: 0.85 });
    const barrierPositions = [
      new THREE.Vector3(-12, 0.45, 10),
      new THREE.Vector3(-9.5, 0.45, 10),
      new THREE.Vector3(14, 0.45, 8),
      new THREE.Vector3(16.5, 0.45, 8),
      new THREE.Vector3(0, 0.45, -20),
      new THREE.Vector3(2.5, 0.45, -20),
      new THREE.Vector3(-15, 0.45, -10),
      new THREE.Vector3(18, 0.45, -25)
    ];
    const barrierInstanced = new THREE.InstancedMesh(barrierGeo, barrierMat, barrierPositions.length);
    const dummy = new THREE.Object3D();
    barrierPositions.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.rotation.set(0, i % 2 === 0 ? 0.2 : -0.25, 0);
      dummy.updateMatrix();
      barrierInstanced.setMatrixAt(i, dummy.matrix);
      this.engine.physicsWorld.createStaticBox(pos, new THREE.Vector3(1.2, 0.45, 0.25));
    });
    barrierInstanced.instanceMatrix.needsUpdate = true;
    barrierInstanced.castShadow = perfConfig.shadows;
    barrierInstanced.receiveShadow = true;
    this.scene.add(barrierInstanced);
  }

  private spawnDistrictZombies(): void {
    // 1. Shamblers roaming streets (diverse mix of Zombie_1 and Patient)
    this.zombieManager.spawnZombie('walker', new THREE.Vector3(-8, 0, -12), 'zombie1');
    this.zombieManager.spawnZombie('walker', new THREE.Vector3(12, 0, 16), 'patient');
    this.zombieManager.spawnZombie('walker', new THREE.Vector3(-14, 0, 8), 'zombie1');

    // 2. Fast Runners hunting around the grocery store (Patient runner)
    this.zombieManager.spawnZombie('runner', new THREE.Vector3(-18, 0, -16), 'patient');
    this.zombieManager.spawnZombie('runner', new THREE.Vector3(16, 0, -8), 'patient');

    // 3. Heavy Armored Brute outside the pharmacy (Zombie_2)
    this.zombieManager.spawnZombie('brute', new THREE.Vector3(18, 0, -12), 'zombie2');

    // 4. Toxic Spitter lurker in alleyway (Zombie_1)
    this.zombieManager.spawnZombie('spitter', new THREE.Vector3(-6, 0, 28), 'zombie1');

    // 5. Boss Abomination guarding the central intersection (Massive Zombie_2)
    this.zombieManager.spawnZombie('boss', new THREE.Vector3(0, 0, -32), 'zombie2');
  }

  public saveGameState(): void {
    const playerPos = this.player.getPosition();
    const vitals = this.survivalSystem.getVitals();
    const inventory = this.inventoryManager.getItems();
    const equipped = this.combatManager.getEquippedWeapon();

    const saveData: PlayerSaveData = {
      version: 1,
      timestamp: Date.now(),
      stage: 'open-survival',
      cinematicCompleted: true,
      playerPosition: [playerPos.x, playerPos.y, playerPos.z],
      playerRotation: this.player.group.rotation.y,
      vitals,
      inventory,
      equippedWeapon: equipped,
      weapons: {
        knife: { unlocked: true, currentAmmo: 0, reserveAmmo: 0, maxReserveAmmo: 0 },
        bat: { unlocked: true, currentAmmo: 0, reserveAmmo: 0, maxReserveAmmo: 0 },
        pistol: {
          unlocked: this.combatManager.isWeaponUnlocked('pistol'),
          currentAmmo: this.combatManager.getWeaponStats('pistol').currentAmmo,
          reserveAmmo: this.combatManager.getWeaponStats('pistol').reserveAmmo,
          maxReserveAmmo: this.combatManager.getWeaponStats('pistol').maxReserveAmmo
        },
        shotgun: {
          unlocked: this.combatManager.isWeaponUnlocked('shotgun'),
          currentAmmo: this.combatManager.getWeaponStats('shotgun').currentAmmo,
          reserveAmmo: this.combatManager.getWeaponStats('shotgun').reserveAmmo,
          maxReserveAmmo: this.combatManager.getWeaponStats('shotgun').maxReserveAmmo
        },
        rifle: {
          unlocked: this.combatManager.isWeaponUnlocked('rifle'),
          currentAmmo: this.combatManager.getWeaponStats('rifle').currentAmmo,
          reserveAmmo: this.combatManager.getWeaponStats('rifle').reserveAmmo,
          maxReserveAmmo: this.combatManager.getWeaponStats('rifle').maxReserveAmmo
        },
        sniper: {
          unlocked: this.combatManager.isWeaponUnlocked('sniper'),
          currentAmmo: this.combatManager.getWeaponStats('sniper').currentAmmo,
          reserveAmmo: this.combatManager.getWeaponStats('sniper').reserveAmmo,
          maxReserveAmmo: this.combatManager.getWeaponStats('sniper').maxReserveAmmo
        },
        machinegun: {
          unlocked: this.combatManager.isWeaponUnlocked('machinegun'),
          currentAmmo: this.combatManager.getWeaponStats('machinegun').currentAmmo,
          reserveAmmo: this.combatManager.getWeaponStats('machinegun').reserveAmmo,
          maxReserveAmmo: this.combatManager.getWeaponStats('machinegun').maxReserveAmmo
        }
      },
      completedMissions: this.missionManager.getCompletedMissions(),
      safehouseUnlocked: this.safehouseUnlocked,
      gameTimeMinutes: 45
    };

    SaveManager.getInstance().saveGame(saveData);
  }

  public update(dt: number): void {
    const playerPos = this.player.getPosition();

    // 1. Update Player & Combat
    this.player.update(dt);
    this.survivalSystem.update(dt, this.player.isSprinting);
    this.combatManager.update(dt);

    if (!this.player.isDead && this.engine.inputManager.getState().attack) {
      this.combatManager.attack(playerPos, this.player.getAimVector());
    }

    // 2. Update Zombie Horde AI
    this.zombieManager.update(dt, playerPos, this.engine.cameraManager.camera, this.player.isDead);

    // 3. Update Particles
    this.particleSystem.update(dt);

    // 4. Periodic Auto-Save every 30 seconds
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 30) {
      this.autoSaveTimer = 0;
      this.saveGameState();
    }

    // 5. Query Closest Interactable
    let closest: Interactable | null = null;
    let closestDist = Infinity;

    for (const item of this.interactables) {
      const dist = playerPos.distanceTo(item.position);
      if (dist <= item.radius && dist < closestDist) {
        closest = item;
        closestDist = dist;
      }
    }

    this.currentInteractable = closest;
    if (closest) {
      useGameUIStore.getState().setInteractionPrompt({
        visible: true,
        text: closest.prompt,
        key: 'E'
      });
    } else {
      useGameUIStore.getState().setInteractionPrompt({
        visible: false,
        text: '',
        key: 'E'
      });
    }

    // 6. Update Loot Drops (proximity prompt updates if standing near dropped weapon)
    this.lootManager.update(dt, playerPos);
  }

  public fixedUpdate(fixedDelta: number): void {
    this.engine.physicsWorld.step(fixedDelta);
  }

  public dispose(): void {
    this.saveGameState();
    this.player.dispose();
    this.zombieManager.dispose();
    this.combatManager.dispose();
    this.lootManager.dispose();
    this.particleSystem.dispose();
    useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });
    AudioManager.getInstance().stopAmbience();
  }
}
