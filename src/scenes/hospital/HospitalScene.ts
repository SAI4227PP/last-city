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
import { EventBus } from '@/core/events/EventBus';

interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  prompt: string;
  onInteract: () => void;
}

export class HospitalScene extends BaseScene {
  public readonly id: StageId = 'hospital';

  public player!: PlayerController;
  public survivalSystem!: SurvivalSystem;
  public inventoryManager!: InventoryManager;
  public combatManager!: CombatManager;
  public zombieManager!: ZombieManager;
  public missionManager!: MissionManager;
  public particleSystem!: ParticleSystem;

  private interactables: Interactable[] = [];
  private currentInteractable: Interactable | null = null;
  private fluorescentLight!: THREE.PointLight;
  private emergencyExitDoor!: THREE.Mesh;
  private hasKeycard: boolean = false;
  private exitDoorUnlocked: boolean = false;

  constructor(engine: GameEngine) {
    super(engine);
  }

  public async init(): Promise<void> {
    this.scene.background = new THREE.Color(0x040608);
    this.scene.fog = new THREE.FogExp2(0x040608, 0.05);

    // 1. Initialize Subsystems
    this.survivalSystem = new SurvivalSystem();
    this.inventoryManager = new InventoryManager();
    this.particleSystem = new ParticleSystem(this.scene);
    this.combatManager = new CombatManager(this.scene, this.engine.cameraManager, this.particleSystem);
    this.zombieManager = new ZombieManager(this.scene, this.survivalSystem, this.engine.physicsWorld);
    this.combatManager.setZombieManager(this.zombieManager);
    this.missionManager = new MissionManager();

    // 2. Build Hospital Architecture & Colliders
    this.buildHospitalLevel();

    // 3. Create Player at Room 104 Bedside
    const startPos = new THREE.Vector3(0, 1.2, 0);
    this.player = new PlayerController(
      this.scene,
      this.engine.physicsWorld,
      this.engine.inputManager,
      this.engine.cameraManager,
      startPos
    );

    // Initial starting item: Tactical Knife
    this.inventoryManager.addItem('item_knife', 1);
    this.combatManager.unlockWeapon('knife');

    // 4. Setup Missions
    this.missionManager.startStageMissions('hospital');

    // 5. Spawn Zombies
    // First encounter: Infected Orderly in the hallway
    this.zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 14));
    // Additional shambler in reception
    this.zombieManager.spawnZombie('runner', new THREE.Vector3(6, 0, 22));

    // 6. Connect Input Actions
    this.engine.inputManager.onInteractPressed = () => {
      if (this.currentInteractable) {
        this.currentInteractable.onInteract();
      }
    };

    // UI Stage Banner & Ambience
    useGameUIStore.getState().setStage('hospital');
    useGameUIStore.getState().setStageBanner('STAGE 1', 'ST. JUDE HOSPITAL OUTBREAK');
    AudioManager.getInstance().startAmbience('hospital');
  }

  private buildHospitalLevel(): void {
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a333d, roughness: 0.4, metalness: 0.2 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f2730, roughness: 0.85 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x8a2323, metalness: 0.6, roughness: 0.3 });

    // Main Floor (Corridor + Rooms)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 60), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(0, -0.5, 20), new THREE.Vector3(15, 0.5, 30));

    // Ambient light
    const amb = new THREE.AmbientLight(0x182430, 0.8);
    this.scene.add(amb);

    // Flickering fluorescent light in corridor
    this.fluorescentLight = new THREE.PointLight(0xbfe3ff, 2.0, 15);
    this.fluorescentLight.position.set(0, 3.2, 12);
    this.fluorescentLight.castShadow = true;
    this.scene.add(this.fluorescentLight);

    // Emergency Exit Red Sign
    const exitSignMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
    const exitSign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.1), exitSignMat);
    exitSign.position.set(0, 3.2, 34.8);
    this.scene.add(exitSign);

    const exitLight = new THREE.PointLight(0x00ff44, 1.5, 8);
    exitLight.position.set(0, 3.0, 34);
    this.scene.add(exitLight);

    // Room 104 Walls
    this.createWall(new THREE.Vector3(-4, 2, 0), new THREE.Vector3(0.2, 2, 5), wallMat);
    this.createWall(new THREE.Vector3(4, 2, 0), new THREE.Vector3(0.2, 2, 5), wallMat);
    this.createWall(new THREE.Vector3(0, 2, -5), new THREE.Vector3(4, 2, 0.2), wallMat);
    // Doorway into corridor
    this.createWall(new THREE.Vector3(-2.8, 2, 5), new THREE.Vector3(1.2, 2, 0.2), wallMat);
    this.createWall(new THREE.Vector3(2.8, 2, 5), new THREE.Vector3(1.2, 2, 0.2), wallMat);

    // Corridor Walls (Z = 5 to Z = 35)
    this.createWall(new THREE.Vector3(-3.5, 2, 20), new THREE.Vector3(0.2, 2, 15), wallMat);
    this.createWall(new THREE.Vector3(3.5, 2, 20), new THREE.Vector3(0.2, 2, 15), wallMat);

    // Props: Hospital Bed in starting room
    const bed = ModelFactory.createHospitalBed();
    bed.position.set(-1.8, 0, -1.5);
    this.scene.add(bed);

    // Props: Medical Cabinet in starting room
    const medCabinet = ModelFactory.createMedicalCabinet();
    medCabinet.position.set(3.4, 1.2, -1.0);
    medCabinet.rotation.y = -Math.PI / 2;
    this.scene.add(medCabinet);

    // Interactable: Medical Cabinet
    this.interactables.push({
      id: 'med_cabinet',
      position: new THREE.Vector3(3.0, 1.0, -1.0),
      radius: 2.2,
      prompt: 'Scavenge Medical Supplies',
      onInteract: () => {
        this.inventoryManager.addItem('bandage', 2);
        this.inventoryManager.addItem('medkit', 1);
        this.missionManager.completeObjective('hosp_m2', 'obj_meds');
        AudioManager.getInstance().playSound('pickup');
        // Remove interactable after use
        this.interactables = this.interactables.filter((i) => i.id !== 'med_cabinet');
      }
    });

    // Nurse Station Reception Desk
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x3d4b59, roughness: 0.6 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.1, 1.2), deskMat);
    desk.position.set(0, 0.55, 22);
    desk.castShadow = true;
    this.scene.add(desk);
    this.engine.physicsWorld.createStaticBox(new THREE.Vector3(0, 0.55, 22), new THREE.Vector3(1.5, 0.55, 0.6));

    // Keycard Prop on Desk
    const cardMat = new THREE.MeshBasicMaterial({ color: 0xd69e2e });
    const keycardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.2), cardMat);
    keycardMesh.position.set(0.4, 1.15, 22);
    this.scene.add(keycardMesh);

    // Interactable: Keycard on reception desk
    this.interactables.push({
      id: 'nurse_keycard',
      position: new THREE.Vector3(0.4, 1.15, 22),
      radius: 2.2,
      prompt: 'Take St. Jude Keycard',
      onInteract: () => {
        this.hasKeycard = true;
        this.inventoryManager.addItem('hospital_keycard', 1);
        this.missionManager.completeObjective('hosp_m2', 'obj_keycard');
        this.scene.remove(keycardMesh);
        AudioManager.getInstance().playSound('pickup');
        this.interactables = this.interactables.filter((i) => i.id !== 'nurse_keycard');
      }
    });

    // Emergency Fire Exit Double Door at Z = 35
    this.emergencyExitDoor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 0.3), doorMat);
    this.emergencyExitDoor.position.set(0, 1.3, 35);
    this.emergencyExitDoor.castShadow = true;
    this.scene.add(this.emergencyExitDoor);
    const doorPhysics = this.engine.physicsWorld.createStaticBox(new THREE.Vector3(0, 1.3, 35), new THREE.Vector3(1.6, 1.3, 0.2));

    // Interactable: Emergency Exit Scanner & Door
    this.interactables.push({
      id: 'emergency_exit',
      position: new THREE.Vector3(0, 1.3, 33.8),
      radius: 2.5,
      prompt: 'Swipe Keycard to Unlock Exit',
      onInteract: () => {
        if (this.hasKeycard) {
          if (!this.exitDoorUnlocked) {
            this.exitDoorUnlocked = true;
            this.missionManager.completeObjective('hosp_m4', 'obj_unlock');
            AudioManager.getInstance().playSound('door_open');

            // Slide door open
            this.emergencyExitDoor.position.y += 3.0;
            this.engine.physicsWorld.removeRigidBody(doorPhysics.body);

            // Complete mission and transition
            this.missionManager.completeObjective('hosp_m4', 'obj_exit');
            setTimeout(() => {
              this.engine.sceneManager.loadScene('city-escape');
            }, 1000);
          }
        } else {
          EventBus.getInstance().emit('subtitle:show', {
            speaker: 'SYSTEM',
            text: 'ACCESS DENIED — St. Jude Security Keycard Required.',
            durationMs: 2500
          });
          AudioManager.getInstance().playSound('click');
        }
      }
    });
  }

  private createWall(pos: THREE.Vector3, halfExtents: THREE.Vector3, mat: THREE.Material): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2),
      mat
    );
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.engine.physicsWorld.createStaticBox(pos, halfExtents);
  }

  public update(dt: number): void {
    const playerPos = this.player.getPosition();

    // 1. Update Player & Combat
    this.player.update(dt);
    this.survivalSystem.update(dt, this.player.isSprinting);
    this.combatManager.update(dt);

    if (this.engine.inputManager.getState().attack) {
      this.combatManager.attack(playerPos, this.player.getForwardVector());
    }

    // 2. Update Zombie AI
    this.zombieManager.update(dt, playerPos);

    // 3. Update Particles
    this.particleSystem.update(dt);

    // 4. Flickering Fluorescent Light
    this.fluorescentLight.intensity = Math.random() > 0.08 ? 2.2 : 0.2;

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

    // First mission awakening trigger
    if (playerPos.z > 4.0) {
      this.missionManager.completeObjective('hosp_m1', 'obj_wake');
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
