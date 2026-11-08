import * as THREE from 'three';
import { BaseScene } from '@/scenes/BaseScene';
import { StageId } from '@/shared/types';
import { GameEngine } from '@/core/engine/GameEngine';
import { PlayerController } from '@/features/player/PlayerController';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';
import { InventoryManager } from '@/features/inventory/InventoryManager';
import { CombatManager } from '@/features/combat/CombatManager';
import { ZombieManager } from '@/features/zombies/ZombieManager';
import { MissionManager } from '@/features/missions/MissionManager';
import { ParticleSystem } from '@/core/engine/ParticleSystem';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { WeaponLootManager } from '@/features/loot/WeaponLootManager';
import { WeaponAssetPool } from '@/features/combat/WeaponAssetPool';

import { HospitalEnvironment } from './HospitalEnvironment';
import { HospitalLighting } from './HospitalLighting';
import { HospitalDoors } from './HospitalDoors';
import { HospitalInteractions } from './HospitalInteractions';
import { HospitalZombieSpawns } from './HospitalZombieSpawns';
import { HospitalAudio } from './HospitalAudio';
import { HospitalMission } from './HospitalMission';

export class HospitalScene extends BaseScene {
  public readonly id: StageId = 'hospital';

  // Core Subsystems
  public player!: PlayerController;
  public survivalSystem!: SurvivalSystem;
  public inventoryManager!: InventoryManager;
  public combatManager!: CombatManager;
  public zombieManager!: ZombieManager;
  public missionManager!: MissionManager;
  public particleSystem!: ParticleSystem;
  public lootManager!: WeaponLootManager;

  // Modular Hospital Systems
  private environment!: HospitalEnvironment;
  private lighting!: HospitalLighting;
  private doors!: HospitalDoors;
  private interactions!: HospitalInteractions;
  private zombieSpawns!: HospitalZombieSpawns;
  private audio!: HospitalAudio;
  private mission!: HospitalMission;

  private isTransitioning: boolean = false;

  constructor(engine: GameEngine) {
    super(engine);
  }

  public async init(): Promise<void> {
    // 1. Atmosphere: Background & Subtle Clean Depth Fog
    this.scene.background = new THREE.Color(0x1a2632);
    // Linear fog: crystal clear in immediate proximity (0-28m), soft atmospheric fade down long corridors (28-75m)
    this.scene.fog = new THREE.Fog(0x1a2632, 28, 75);

    // 2. Initialize Core Subsystems
    this.survivalSystem = new SurvivalSystem();
    this.inventoryManager = new InventoryManager();
    this.particleSystem = new ParticleSystem(this.scene);
    this.combatManager = new CombatManager(this.scene, this.engine.cameraManager, this.particleSystem);
    this.zombieManager = new ZombieManager(this.scene, this.survivalSystem, this.engine.physicsWorld);
    this.combatManager.setZombieManager(this.zombieManager);
    this.missionManager = new MissionManager();

    // 3. Initialize Modular Hospital Level Systems
    this.environment = new HospitalEnvironment(this.scene, this.engine.physicsWorld);
    this.environment.buildLevel();

    this.lighting = new HospitalLighting(this.scene);
    this.doors = new HospitalDoors(this.scene, this.engine.physicsWorld);
    this.interactions = new HospitalInteractions(
      this.scene,
      this.inventoryManager,
      this.missionManager,
      this.doors
    );
    this.zombieSpawns = new HospitalZombieSpawns(this.zombieManager, this.missionManager);
    this.audio = new HospitalAudio();
    this.mission = new HospitalMission(this.missionManager);

    // 4. Preload Weapon Assets and Initialize Weapon Loot Manager
    await WeaponAssetPool.getInstance().preloadAll();
    this.lootManager = new WeaponLootManager(
      this.scene,
      this.combatManager,
      this.inventoryManager,
      this.engine.physicsWorld
    );

    // Place initial tactical weapon drops in hospital
    // Tactical Shotgun in Nurse Station (Room 102 / Nurse reception)
    this.lootManager.spawnWeaponDrop('shotgun', new THREE.Vector3(7.5, 0.6, 22.0), 8, 16, 'hospital_nurse_shotgun');
    // Service Assault Rifle in Trauma Ward / Security
    this.lootManager.spawnWeaponDrop('rifle', new THREE.Vector3(-1.5, 0.6, 48.0), 30, 60, 'hospital_security_rifle');

    // 5. Create Player at Room 104 Bedside
    const startPos = new THREE.Vector3(0, 1.2, 0);
    this.player = new PlayerController(
      this.scene,
      this.engine.physicsWorld,
      this.engine.inputManager,
      this.engine.cameraManager,
      startPos
    );
    await this.player.init();
    this.zombieManager.setPlayer(this.player);

    // Initial starting item: Tactical Knife & Service Pistol
    this.inventoryManager.addItem('item_knife', 1);
    this.inventoryManager.addItem('item_ammo_9mm', 30);
    this.combatManager.unlockWeapon('knife');
    this.combatManager.unlockWeapon('pistol', 15, 30);

    // 6. Connect Input Actions
    this.engine.inputManager.onInteractPressed = () => {
      // Prioritize weapon loot pickup if player is standing near a dropped weapon
      if (this.lootManager.tryPickup(this.player.getPosition())) {
        return;
      }
      this.interactions.triggerInteract();
    };
    this.engine.inputManager.onReloadPressed = () => {
      this.combatManager.reload();
    };
    this.engine.inputManager.onWeaponSlotPressed = (slot) => {
      this.combatManager.equipSlot(slot);
    };

    // 7. Connect Stage Exit Transition
    this.mission.onStageComplete = () => {
      this.triggerCityEscapeTransition();
    };

    // 8. UI Stage Banner
    useGameUIStore.getState().setStage('hospital');
    useGameUIStore.getState().setStageBanner('STAGE 1', 'ST. JUDE HOSPITAL OUTBREAK');
  }

  private triggerCityEscapeTransition(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    setTimeout(() => {
      this.engine.sceneManager.loadScene('city-escape');
    }, 1200);
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

    // 2. Update Zombie AI
    this.zombieManager.update(dt, playerPos, this.engine.cameraManager.camera, this.player.isDead);

    // 3. Update Loot Drops & Particle Effects
    this.lootManager.update(dt, playerPos);
    this.particleSystem.update(dt);

    // 4. Update Hospital Level Modules
    this.lighting.update(dt);
    this.doors.update(dt);
    this.interactions.update(playerPos);
    this.zombieSpawns.update(playerPos);
    this.mission.update(playerPos);
  }

  public fixedUpdate(fixedDelta: number): void {
    this.engine.physicsWorld.step(fixedDelta);
  }

  public dispose(): void {
    this.player.dispose();
    this.zombieManager.dispose();
    this.combatManager.dispose();
    this.lootManager.dispose();
    this.particleSystem.dispose();

    this.environment.dispose();
    this.lighting.dispose();
    this.doors.dispose();
    this.interactions.dispose();
    this.zombieSpawns.dispose();
    this.audio.dispose();
    this.mission.dispose();

    useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });
  }
}
