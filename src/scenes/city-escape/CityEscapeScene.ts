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
import { ModelFactory } from '@/core/assets/ModelFactory';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { AudioManager } from '@/core/audio/AudioManager';
import { PerformanceManager } from '@/core/performance/PerformanceManager';
import { EventBus } from '@/core/events/EventBus';

interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  prompt: string;
  onInteract: () => void;
}

export class CityEscapeScene extends BaseScene {
  public readonly id: StageId = 'city-escape';

  public player!: PlayerController;
  public survivalSystem!: SurvivalSystem;
  public inventoryManager!: InventoryManager;
  public combatManager!: CombatManager;
  public zombieManager!: ZombieManager;
  public missionManager!: MissionManager;
  public particleSystem!: ParticleSystem;

  private interactables: Interactable[] = [];
  private currentInteractable: Interactable | null = null;
  private burningCarLight!: THREE.PointLight;
  private policeBeaconLight!: THREE.PointLight;
  private burningCarPos: THREE.Vector3 = new THREE.Vector3(-4, 1.0, 32);

  constructor(engine: GameEngine) {
    super(engine);
  }

  public async init(): Promise<void> {
    this.scene.background = new THREE.Color(0x788a98);
    this.scene.fog = new THREE.FogExp2(0x788a98, 0.008);

    // 1. Subsystems
    this.survivalSystem = new SurvivalSystem();
    this.inventoryManager = new InventoryManager();
    this.particleSystem = new ParticleSystem(this.scene, 1200);
    this.combatManager = new CombatManager(this.scene, this.engine.cameraManager, this.particleSystem);
    this.zombieManager = new ZombieManager(this.scene, this.survivalSystem, this.engine.physicsWorld);
    this.combatManager.setZombieManager(this.zombieManager);
    this.missionManager = new MissionManager();

    // 2. Build City Street Environment
    this.buildCityEnvironment();

    // 3. Create Player at Hospital Courtyard Exit
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

    // Equip knife
    this.inventoryManager.addItem('item_knife', 1);
    this.combatManager.unlockWeapon('knife');

    // 4. Setup Missions
    this.missionManager.startStageMissions('city-escape');

    // 5. Spawn Zombie Groups along the ruined avenue
    this.zombieManager.spawnZombie('walker', new THREE.Vector3(-3, 0, 18));
    this.zombieManager.spawnZombie('runner', new THREE.Vector3(4, 0, 26));
    this.zombieManager.spawnZombie('walker', new THREE.Vector3(2, 0, 42));
    this.zombieManager.spawnZombie('brute', new THREE.Vector3(0, 0, 54));

    // 6. Connect Input Actions
    this.engine.inputManager.onInteractPressed = () => {
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
    useGameUIStore.getState().setStage('city-escape');
    useGameUIStore.getState().setStageBanner('STAGE 2', 'CITY ESCAPE — VERIDIA BOULEVARD');
    AudioManager.getInstance().startAmbience('city');
  }

  private buildCityEnvironment(): void {
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x3c4652, roughness: 0.85 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x6a7785, roughness: 0.75 });
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x4e5b69, roughness: 0.88 });

    // Main Road (Width 24m, Length 100m)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(24, 100), asphaltMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, 40);
    road.receiveShadow = true;
    this.scene.add(road);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(0, -0.5, 40), new THREE.Vector3(12, 0.5, 50));

    // Road Divider Yellow Stripes (Optimized with InstancedMesh for 1 single draw call)
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd69e2e });
    const stripeGeo = new THREE.PlaneGeometry(0.3, 3);
    stripeGeo.rotateX(-Math.PI / 2);
    const stripeZPositions: number[] = [];
    for (let z = 0; z < 80; z += 6) {
      stripeZPositions.push(z);
    }
    const stripeInstanced = new THREE.InstancedMesh(stripeGeo, stripeMat, stripeZPositions.length);
    const dummy = new THREE.Object3D();
    stripeZPositions.forEach((zPos, idx) => {
      dummy.position.set(0, 0.02, zPos);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      stripeInstanced.setMatrixAt(idx, dummy.matrix);
    });
    stripeInstanced.instanceMatrix.needsUpdate = true;
    this.scene.add(stripeInstanced);

    // Instanced Concrete Barricades & Roadblocks (1 single draw call for all barriers)
    const barrierGeo = new THREE.BoxGeometry(2.4, 0.9, 0.5);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.85 });
    const barrierPositions = [
      new THREE.Vector3(-6, 0.45, 12),
      new THREE.Vector3(-3.5, 0.45, 12),
      new THREE.Vector3(5, 0.45, 22),
      new THREE.Vector3(7.5, 0.45, 22),
      new THREE.Vector3(-4, 0.45, 38),
      new THREE.Vector3(3, 0.45, 50),
      new THREE.Vector3(5.5, 0.45, 50),
      new THREE.Vector3(-7, 0.45, 62)
    ];
    const barrierInstanced = new THREE.InstancedMesh(barrierGeo, barrierMat, barrierPositions.length);
    barrierPositions.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.rotation.set(0, i % 2 === 0 ? 0.15 : -0.2, 0);
      dummy.updateMatrix();
      barrierInstanced.setMatrixAt(i, dummy.matrix);
      this.engine.physicsWorld.createStaticBox(pos, new THREE.Vector3(1.2, 0.45, 0.25));
    });
    barrierInstanced.instanceMatrix.needsUpdate = true;
    barrierInstanced.castShadow = true;
    barrierInstanced.receiveShadow = true;
    this.scene.add(barrierInstanced);

    // Sidewalks
    const sidewalkL = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 100), sidewalkMat);
    sidewalkL.position.set(-14, 0.15, 40);
    sidewalkL.receiveShadow = true;
    const sidewalkR = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 100), sidewalkMat);
    sidewalkR.position.set(14, 0.15, 40);
    sidewalkR.receiveShadow = true;
    this.scene.add(sidewalkL, sidewalkR);

    // City Perimeter Buildings
    for (let z = 5; z < 85; z += 18) {
      const bL = new THREE.Mesh(new THREE.BoxGeometry(12, 25, 16), buildingMat);
      bL.position.set(-22, 12.5, z);
      bL.castShadow = true;
      this.scene.add(bL);
      this.engine.physicsWorld.createStaticBox(new THREE.Vector3(-22, 12.5, z), new THREE.Vector3(6, 12.5, 8));

      const bR = new THREE.Mesh(new THREE.BoxGeometry(12, 28, 16), buildingMat);
      bR.position.set(22, 14, z);
      bR.castShadow = true;
      this.scene.add(bR);
      this.engine.physicsWorld.createStaticBox(new THREE.Vector3(22, 14, z), new THREE.Vector3(6, 14, 8));
    }

    // Realistic Overcast Daylight with adaptive shadow resolution
    const perfConfig = PerformanceManager.getInstance().getConfig();
    const sun = new THREE.DirectionalLight(0xf5ebe0, 2.6);
    sun.position.set(25, 45, 10);
    sun.castShadow = perfConfig.shadows;
    sun.shadow.mapSize.width = perfConfig.shadowMapSize;
    sun.shadow.mapSize.height = perfConfig.shadowMapSize;
    this.scene.add(sun);

    // Natural Sky & Ground Bounce
    const hemiLight = new THREE.HemisphereLight(0xb4c8d8, 0x5a6369, 1.8);
    this.scene.add(hemiLight);

    const ambient = new THREE.AmbientLight(0xd4e2ec, 1.25);
    this.scene.add(ambient);

    // Props: Abandoned Police Cruiser in Courtyard (Z = 8)
    const policeCar = ModelFactory.createPoliceCar();
    policeCar.position.set(3.5, 0, 8);
    policeCar.rotation.y = -0.3;
    this.scene.add(policeCar);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(3.5, 0.7, 8), new THREE.Vector3(1.2, 0.7, 2.3));

    // Flashing siren point light
    this.policeBeaconLight = new THREE.PointLight(0x0066ff, 2.5, 16);
    this.policeBeaconLight.position.set(3.5, 1.8, 8);
    this.scene.add(this.policeBeaconLight);

    // Interactable: Search Police Car Trunk
    this.interactables.push({
      id: 'police_trunk',
      position: new THREE.Vector3(3.5, 1.0, 6.0),
      radius: 2.5,
      prompt: 'Search Police Cruiser Trunk',
      onInteract: () => {
        // Unlock 9mm Pistol & Ammo
        this.inventoryManager.addItem('item_pistol', 1);
        this.inventoryManager.addItem('ammo_9mm', 24);
        this.combatManager.unlockWeapon('pistol', 12, 24);
        this.missionManager.completeObjective('city_m1', 'obj_police_car');
        AudioManager.getInstance().playSound('pickup');

        EventBus.getInstance().emit('subtitle:show', {
          speaker: 'PLAYER',
          text: 'Found a 9mm service pistol and two full magazines in the patrol car. Time to push through.',
          durationMs: 3500
        });

        this.interactables = this.interactables.filter((i) => i.id !== 'police_trunk');
      }
    });

    // Props: Burning Taxi Car (Z = 32)
    const burningCar = ModelFactory.createPoliceCar();
    burningCar.position.copy(this.burningCarPos);
    burningCar.position.y = 0;
    burningCar.rotation.y = 0.8;
    burningCar.rotation.z = 0.2; // tilted/wrecked
    this.scene.add(burningCar);
    this.engine.physicsWorld.createStaticBox(this.burningCarPos, new THREE.Vector3(1.2, 0.7, 2.3));

    this.burningCarLight = new THREE.PointLight(0xff6600, 3.5, 20);
    this.burningCarLight.position.copy(this.burningCarPos).add(new THREE.Vector3(0, 1.5, 0));
    this.scene.add(this.burningCarLight);

    // Concrete Barricades blocking roadway
    const barricade1 = ModelFactory.createConcreteBarricade();
    barricade1.position.set(-3.5, 0, 36);
    this.scene.add(barricade1);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(-3.5, 0.5, 36), new THREE.Vector3(1.5, 0.5, 0.3));

    const barricade2 = ModelFactory.createConcreteBarricade();
    barricade2.position.set(4.0, 0, 37);
    this.scene.add(barricade2);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(4.0, 0.5, 37), new THREE.Vector3(1.5, 0.5, 0.3));

    // Military Checkpoint Alpha (Z = 72)
    const checkpointMat = new THREE.MeshStandardMaterial({ color: 0x3d433b, roughness: 0.8 });
    const checkpointBooth = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 3.5), checkpointMat);
    checkpointBooth.position.set(0, 1.6, 72);
    checkpointBooth.castShadow = true;
    this.scene.add(checkpointBooth);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(0, 1.6, 72), new THREE.Vector3(2.25, 1.6, 1.75));

    // Checkpoint Searchlight
    const checkLight = new THREE.SpotLight(0xffeedd, 3.0, 35, Math.PI / 4, 0.3);
    checkLight.position.set(0, 5, 71);
    checkLight.target.position.set(0, 0, 50);
    this.scene.add(checkLight, checkLight.target);

    // Radio Terminal at Checkpoint
    const radioMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    radioMesh.position.set(0, 1.2, 70.1);
    this.scene.add(radioMesh);

    // Interactable: Military Radio Terminal
    this.interactables.push({
      id: 'military_radio',
      position: new THREE.Vector3(0, 1.2, 69.5),
      radius: 2.5,
      prompt: 'Inspect Military Command Terminal',
      onInteract: () => {
        this.missionManager.completeObjective('city_m3', 'obj_reach_checkpoint');
        AudioManager.getInstance().playSound('siren');

        EventBus.getInstance().emit('subtitle:show', {
          speaker: 'COMMAND RADIO',
          text: 'BROADCAST LOOP: All military evacuation corridors have been severed. Veridia is quarantined. No extraction will be deployed.',
          durationMs: 5000
        });

        // Transition to Stage 4: Open Survival after broadcast
        setTimeout(() => {
          this.engine.sceneManager.loadScene('open-survival');
        }, 3500);
      }
    });
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

    // 3. Update Fire & Smoke Particles
    this.particleSystem.spawnFireSparks(this.burningCarPos, 3);
    this.particleSystem.update(dt);

    // 4. Lights: Fire flicker & Siren alternation
    this.burningCarLight.intensity = 3.0 + Math.sin(Date.now() * 0.015) * 1.2;
    this.policeBeaconLight.color.setHex(Math.sin(Date.now() * 0.008) > 0 ? 0x0044ff : 0xff1100);

    // 5. Objective: Pass the barricade
    if (playerPos.z > 38.0) {
      this.missionManager.completeObjective('city_m2', 'obj_cross_streets');
    }

    // 6. Closest Interactable query
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
  }

  public fixedUpdate(fixedDelta: number): void {
    this.engine.physicsWorld.step(fixedDelta);
  }

  public dispose(): void {
    this.player.dispose();
    this.zombieManager.dispose();
    this.combatManager.dispose();
    this.particleSystem.dispose();
    useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });
    AudioManager.getInstance().stopAmbience();
  }
}
