import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { InputManager } from '@/core/input/InputManager';
import { CameraManager } from '@/core/engine/CameraManager';
import { ModelFactory } from '@/core/assets/ModelFactory';
import { EventBus } from '@/core/events/EventBus';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { WeaponType } from '@/shared/types';
import { MathUtils } from '@/core/utils/MathUtils';
import { PlayerAnimationController } from './PlayerAnimationController';
import { Logger } from '@/core/utils/Logger';

export class PlayerController {
  public readonly group: THREE.Group;
  private modelParts: ReturnType<typeof ModelFactory.createPlayerModel>;
  public athleticModel?: THREE.Group;
  public animationController?: PlayerAnimationController;
  private weaponRBone?: THREE.Object3D;
  private rifleMeshes: THREE.SkinnedMesh[] = [];
  private equippedWeapon: WeaponType = 'knife';

  private rigidBody: RAPIER.RigidBody;
  public readonly collider: RAPIER.Collider;

  private inputManager: InputManager;
  private cameraManager: CameraManager;
  private physicsWorld: PhysicsWorld;
  private eventBus: EventBus;

  // Flashlight
  public flashlight: THREE.SpotLight;
  private flashlightTarget: THREE.Object3D;

  // Attached Weapon Mesh
  private currentWeaponMesh?: THREE.Group;

  // Movement parameters
  private walkSpeed: number = 4.5;
  private runSpeed: number = 8.5;
  private crouchSpeed: number = 2.2;
  private rotationSpeed: number = 10.0;
  private jumpForce: number = 6.0;

  // Camera offset parameters (Over-the-shoulder third person)
  private cameraYaw: number = 0;
  private cameraPitch: number = 0.08;
  private readonly cameraOffset: THREE.Vector3 = new THREE.Vector3(-0.45, 0.25, -2.3);
  private isCameraInitialized: boolean = false;

  // Event unsubscriptions
  private weaponSwitchUnsub?: () => void;
  private weaponFireUnsub?: () => void;
  private weaponReloadUnsub?: () => void;
  private damageUnsub?: () => void;
  private deathUnsub?: () => void;
  private meleeUnsub?: () => void;
  private interactUnsub?: () => void;

  // Animation cycle & impulse states
  private strideTimer: number = 0;
  private footstepTimer: number = 0;
  private idleTimer: number = 0;
  private recoilImpulse: number = 0;
  private flinchImpulse: number = 0;
  private meleeSwingTimer: number = 0;
  private wasAirborne: boolean = false;
  public isMoving: boolean = false;
  public isSprinting: boolean = false;

  // Static scratch vectors & eulers to eliminate per-frame GC allocations
  private static readonly _scratchMoveDir: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchCamPivot: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchOffset: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchDesiredCam: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchLookAt: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchEuler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private static readonly _scratchUp: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  private static readonly _scratchForward: THREE.Vector3 = new THREE.Vector3(0, 0, 1);

  constructor(
    scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    inputManager: InputManager,
    cameraManager: CameraManager,
    startPosition: THREE.Vector3 = new THREE.Vector3(0, 1.5, 0)
  ) {
    this.physicsWorld = physicsWorld;
    this.inputManager = inputManager;
    this.cameraManager = cameraManager;
    this.eventBus = EventBus.getInstance();

    // 1. Create Model Hierarchy (Procedural fallback initially)
    this.modelParts = ModelFactory.createPlayerModel();
    this.group = new THREE.Group();
    this.group.name = 'PlayerGroup';
    this.group.add(this.modelParts.root);
    this.group.position.copy(startPosition);
    scene.add(this.group);

    // 2. Create Flashlight & Player Fill Light
    this.flashlightTarget = new THREE.Object3D();
    scene.add(this.flashlightTarget);

    // Front flashlight beam mounted on right shoulder forward of the chest
    this.flashlight = new THREE.SpotLight(0xfff3db, 3.5, 35, Math.PI / 4.2, 0.5, 1.2);
    this.flashlight.position.set(-0.25, 1.35, 0.45);
    this.flashlight.castShadow = false; // Prevents player's own torso/arm self-shadowing that blacks out the world
    this.flashlight.target = this.flashlightTarget;
    this.group.add(this.flashlight);

    // Subtle atmospheric character fill/rim light so the survivor silhouette and gear never black out
    const playerRim = new THREE.PointLight(0x7892a8, 1.2, 5, 1.5);
    playerRim.position.set(0, 1.5, -0.8);
    this.group.add(playerRim);

    // 3. Create Rapier Physics Dynamic Capsule (do not pass this.group as mesh so step() does not override position offset)
    const { body, collider } = this.physicsWorld.createDynamicCapsule(
      startPosition,
      0.65, // half height
      0.35 // radius
    );
    this.rigidBody = body;
    this.collider = collider;

    // 4. Hook up Gameplay Event Listeners
    this.weaponSwitchUnsub = this.eventBus.on('weapon:switch', ({ weapon }) => {
      this.attachWeaponMesh(weapon);
    });

    this.weaponFireUnsub = this.eventBus.on('weapon:fire', () => {
      this.recoilImpulse = 0.32;
      this.animationController?.triggerFire(this.equippedWeapon);
    });

    this.weaponReloadUnsub = this.eventBus.on('weapon:reload', () => {
      this.animationController?.triggerReload(this.equippedWeapon);
    });

    this.meleeUnsub = this.eventBus.on('audio:play_sfx', ({ sound }) => {
      if (sound === 'melee_swing') {
        this.meleeSwingTimer = 0.3;
        this.animationController?.triggerMelee();
      } else if (sound === 'reload') {
        this.animationController?.triggerReload(this.equippedWeapon);
      }
    });

    this.damageUnsub = this.eventBus.on('player:damage', () => {
      this.flinchImpulse = 0.35;
      this.animationController?.triggerDamage('front');
    });

    this.deathUnsub = this.eventBus.on('player:death', () => {
      this.animationController?.triggerDeath();
    });

    this.interactUnsub = this.eventBus.on('player:interact', () => {
      this.animationController?.triggerInteract('press');
    });

    this.attachWeaponMesh('knife');

    // 5. Asynchronously load Athletic_man.glb character model
    this.loadAthleticManModel();
  }

  /**
   * Loads the Athletic_man.glb base character and replaces procedural fallback model.
   */
  private loadAthleticManModel(): void {
    const loader = new GLTFLoader();
    const modelUrl = '/assets/characters/player/model/Athletic_man.glb';

    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        this.athleticModel = model;
        model.name = 'AthleticManVisual';

        this.rifleMeshes = [];
        this.weaponRBone = undefined;

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (
              child.name === 'Athletic_man_11' ||
              child.name === 'Athletic_man_12' ||
              child.name === 'Athletic_man_13'
            ) {
              this.rifleMeshes.push(child as THREE.SkinnedMesh);
            }
          }
          if ((child as THREE.Bone).isBone && child.name === 'WeaponR') {
            this.weaponRBone = child;
          }
        });

        // Remove procedural model parts from root group
        if (this.modelParts.root.parent === this.group) {
          this.group.remove(this.modelParts.root);
        }

        // Add the loaded athletic man model to root group
        this.group.add(model);

        // Initialize animation controller with the loaded model
        this.animationController = new PlayerAnimationController(model);
        this.animationController.preloadCoreAnimations().then(() => {
          const initAnim = this.equippedWeapon === 'knife' || this.equippedWeapon === 'bat'
            ? 'sword_idle'
            : this.equippedWeapon === 'pistol'
            ? 'pistol_idle'
            : this.equippedWeapon === 'rifle'
            ? 'rifle_idle'
            : 'idle';
          this.animationController?.playBaseLocomotion(initAnim);
        });

        // Update weapon meshes on the new model
        this.updateWeaponMeshes(this.equippedWeapon);
        Logger.info('PlayerController: Successfully loaded Athletic_man.glb and initialized animation controller.');
      },
      undefined,
      (err) => {
        Logger.warn(`PlayerController: Athletic_man.glb load skipped (${err}), keeping procedural fallback.`);
      }
    );
  }

  public getPosition(): THREE.Vector3 {
    return this.group.position;
  }

  public setPosition(pos: THREE.Vector3): void {
    this.group.position.copy(pos);
    this.rigidBody.setTranslation(new RAPIER.Vector3(pos.x, pos.y, pos.z), true);
  }

  public getForwardVector(): THREE.Vector3 {
    PlayerController._scratchForward.set(0, 0, 1).applyEuler(new THREE.Euler(0, this.cameraYaw, 0));
    return PlayerController._scratchForward.normalize();
  }

  public attachWeaponMesh(weapon: WeaponType): void {
    this.equippedWeapon = weapon;
    this.updateWeaponMeshes(weapon);
  }

  private updateWeaponMeshes(weapon: WeaponType): void {
    if (this.athleticModel) {
      const isRifle = weapon === 'rifle';

      // Toggle built-in rifle meshes
      for (const mesh of this.rifleMeshes) {
        mesh.visible = isRifle;
      }

      // Detach any existing prop attached to WeaponR bone
      if (this.currentWeaponMesh) {
        if (this.currentWeaponMesh.parent) {
          this.currentWeaponMesh.parent.remove(this.currentWeaponMesh);
        }
        this.currentWeaponMesh = undefined;
      }

      // If not rifle, attach custom weapon model to WeaponR bone
      if (!isRifle && this.weaponRBone) {
        this.currentWeaponMesh = ModelFactory.createWeaponMesh(weapon);
        this.currentWeaponMesh.position.set(0, 0, 0);
        this.weaponRBone.add(this.currentWeaponMesh);
      }
    } else {
      // Fallback procedural model weapon socket
      if (this.currentWeaponMesh) {
        this.modelParts.weaponSocket.remove(this.currentWeaponMesh);
      }
      this.currentWeaponMesh = ModelFactory.createWeaponMesh(weapon);
      this.modelParts.weaponSocket.add(this.currentWeaponMesh);
    }
  }

  public update(dt: number): void {
    const input = this.inputManager.getState();

    // 1. Update Camera Yaw & Pitch from Mouse / Touch Delta
    this.cameraYaw -= input.lookDelta.x;
    this.cameraPitch = MathUtils.clamp(this.cameraPitch - input.lookDelta.y, -0.6, 0.7);
    this.inputManager.resetFrameDeltas();

    // 2. Calculate Movement Direction based on Camera Orientation
    const moveX = input.moveAxis.x;
    const moveZ = input.moveAxis.y;
    this.isMoving = Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05;

    // Check if sprinting
    const uiStore = useGameUIStore.getState();
    const canSprint = uiStore.vitals.stamina > 5;
    this.isSprinting = input.sprint && this.isMoving && canSprint && !input.crouch;

    const speed = input.crouch
      ? this.crouchSpeed
      : this.isSprinting
      ? this.runSpeed
      : this.walkSpeed;

    // World movement vector using pre-allocated vector
    const moveDir = PlayerController._scratchMoveDir.set(moveX, 0, moveZ);
    moveDir.applyAxisAngle(PlayerController._scratchUp, this.cameraYaw);

    const currentVel = this.rigidBody.linvel();
    const targetVx = moveDir.x * speed;
    const targetVz = moveDir.z * speed;
    let targetVy = currentVel.y;

    // Jump logic
    const isAirborne = Math.abs(currentVel.y) > 0.45;
    if (input.jump && Math.abs(currentVel.y) < 0.1) {
      targetVy = this.jumpForce;
      this.eventBus.emit('audio:play_sfx', { sound: 'footstep', volume: 0.6 });
      this.animationController?.triggerJump();
    }

    // Landing detection
    if (this.wasAirborne && !isAirborne) {
      this.animationController?.triggerLand();
    }
    this.wasAirborne = isAirborne;

    // Apply linear velocity to Rapier dynamic body
    this.rigidBody.setLinvel(new RAPIER.Vector3(targetVx, targetVy, targetVz), true);

    // 3. Sync 3D Mesh Position from Physics Body
    const trans = this.rigidBody.translation();
    this.group.position.set(trans.x, trans.y - 0.95, trans.z);

    // Rotate player character toward movement direction when moving, or camera yaw when stationary
    if (this.isMoving) {
      const targetAngle = Math.atan2(targetVx, targetVz);
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetAngle, dt * this.rotationSpeed);
    } else {
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.cameraYaw, dt * 6.0);
    }

    // 4. Update Animations (Animation Controller if GLTF is loaded, otherwise Procedural Fallback)
    if (this.animationController) {
      this.animationController.updateLocomotion({
        isMoving: this.isMoving,
        isSprinting: this.isSprinting,
        isCrouching: !!input.crouch,
        isAirborne,
        isAiming: false,
        moveAxis: { x: moveX, y: moveZ },
        weapon: this.equippedWeapon
      });
      this.animationController.update(dt);
    } else {
      // Procedural Fallback Animation
      this.idleTimer += dt;

      if (isAirborne) {
        this.modelParts.leftLeg.rotation.x = THREE.MathUtils.lerp(this.modelParts.leftLeg.rotation.x, -0.4, dt * 10);
        this.modelParts.rightLeg.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightLeg.rotation.x, -0.4, dt * 10);
        this.modelParts.leftKnee.rotation.x = THREE.MathUtils.lerp(this.modelParts.leftKnee.rotation.x, 0.75, dt * 10);
        this.modelParts.rightKnee.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightKnee.rotation.x, 0.75, dt * 10);
        this.modelParts.spine.rotation.x = THREE.MathUtils.lerp(this.modelParts.spine.rotation.x, -0.1, dt * 8);
        this.modelParts.leftArm.rotation.x = THREE.MathUtils.lerp(this.modelParts.leftArm.rotation.x, -0.3, dt * 8);
        this.modelParts.leftArm.rotation.z = THREE.MathUtils.lerp(this.modelParts.leftArm.rotation.z, -0.35, dt * 8);
        this.modelParts.rightArm.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightArm.rotation.x, -0.6, dt * 8);
        this.modelParts.rightElbow.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightElbow.rotation.x, 0.6, dt * 8);
      } else if (this.isMoving) {
        const animRate = this.isSprinting ? 15 : input.crouch ? 7.5 : 9.5;
        this.strideTimer += dt * animRate;

        const strideAmp = this.isSprinting ? 0.8 : input.crouch ? 0.35 : 0.45;
        const kneeAmp = this.isSprinting ? 1.25 : input.crouch ? 0.6 : 0.8;
        const armAmp = this.isSprinting ? 0.75 : input.crouch ? 0.25 : 0.45;
        const spineLean = this.isSprinting ? 0.26 : input.crouch ? 0.35 : 0.08;

        const legCycle = Math.sin(this.strideTimer);

        this.modelParts.leftLeg.rotation.x = legCycle * strideAmp;
        this.modelParts.rightLeg.rotation.x = -legCycle * strideAmp;

        const baseKnee = input.crouch ? 0.65 : 0.05;
        this.modelParts.leftKnee.rotation.x = baseKnee + (legCycle > 0 ? legCycle * kneeAmp : 0);
        this.modelParts.rightKnee.rotation.x = baseKnee + (-legCycle > 0 ? -legCycle * kneeAmp : 0);

        this.modelParts.spine.rotation.x = THREE.MathUtils.lerp(this.modelParts.spine.rotation.x, spineLean, dt * 10);
        this.modelParts.spine.rotation.z = Math.sin(this.strideTimer) * 0.03;
        this.modelParts.body.rotation.y = Math.sin(this.strideTimer) * 0.05;

        this.modelParts.leftArm.rotation.x = -legCycle * armAmp;
        this.modelParts.leftArm.rotation.z = 0;
        this.modelParts.leftElbow.rotation.x = 0.25 + Math.max(0, -legCycle) * 0.5;

        if (this.meleeSwingTimer <= 0) {
          this.modelParts.rightArm.rotation.x = -0.65 + (this.isSprinting ? Math.sin(this.strideTimer) * 0.15 : Math.sin(this.strideTimer) * 0.05);
          this.modelParts.rightArm.rotation.y = 0;
          this.modelParts.rightElbow.rotation.x = 0.75 + (this.isSprinting ? Math.sin(this.strideTimer) * 0.1 : 0);
        }
      } else {
        this.strideTimer = 0;
        const breath = Math.sin(this.idleTimer * 2.2);

        this.modelParts.leftLeg.rotation.x = THREE.MathUtils.lerp(this.modelParts.leftLeg.rotation.x, 0, dt * 10);
        this.modelParts.rightLeg.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightLeg.rotation.x, 0, dt * 10);
        this.modelParts.leftKnee.rotation.x = THREE.MathUtils.lerp(this.modelParts.leftKnee.rotation.x, input.crouch ? 0.7 : 0.05, dt * 10);
        this.modelParts.rightKnee.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightKnee.rotation.x, input.crouch ? 0.7 : 0.05, dt * 10);

        this.modelParts.spine.rotation.x = THREE.MathUtils.lerp(this.modelParts.spine.rotation.x, input.crouch ? 0.35 : breath * 0.015, dt * 8);
        this.modelParts.spine.rotation.z = THREE.MathUtils.lerp(this.modelParts.spine.rotation.z, 0, dt * 8);
        this.modelParts.body.rotation.y = THREE.MathUtils.lerp(this.modelParts.body.rotation.y, 0, dt * 8);

        this.modelParts.chest.position.y = 0.35 + breath * 0.008;
        this.modelParts.head.rotation.y = THREE.MathUtils.lerp(this.modelParts.head.rotation.y, Math.sin(this.idleTimer * 0.8) * 0.05, dt * 4);

        this.modelParts.leftArm.rotation.x = THREE.MathUtils.lerp(this.modelParts.leftArm.rotation.x, 0.05, dt * 8);
        this.modelParts.leftArm.rotation.z = THREE.MathUtils.lerp(this.modelParts.leftArm.rotation.z, 0, dt * 8);
        this.modelParts.leftElbow.rotation.x = THREE.MathUtils.lerp(this.modelParts.leftElbow.rotation.x, 0.25, dt * 8);

        if (this.meleeSwingTimer <= 0) {
          this.modelParts.rightArm.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightArm.rotation.x, -0.65, dt * 8);
          this.modelParts.rightArm.rotation.y = THREE.MathUtils.lerp(this.modelParts.rightArm.rotation.y, 0, dt * 8);
          this.modelParts.rightElbow.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightElbow.rotation.x, 0.75, dt * 8);
        }
      }

      // Crouch height adjustment
      const bounce = this.isMoving ? Math.abs(Math.sin(this.strideTimer * 2)) * (this.isSprinting ? 0.05 : 0.025) : 0;
      const targetBodyY = (input.crouch ? 0.65 : 1.0) + bounce;
      this.modelParts.body.position.y = THREE.MathUtils.lerp(this.modelParts.body.position.y, targetBodyY, dt * 14);

      // Melee swing arc
      if (this.meleeSwingTimer > 0) {
        this.meleeSwingTimer -= dt;
        const swingProgress = 1 - this.meleeSwingTimer / 0.3;
        const swingArc = Math.sin(swingProgress * Math.PI);
        this.modelParts.rightArm.rotation.x = -Math.PI / 3 - swingArc * 0.55;
        this.modelParts.rightArm.rotation.y = -Math.PI / 4 + swingArc * 1.3;
        this.modelParts.rightElbow.rotation.x = 0.5 + swingArc * 0.4;
        this.modelParts.spine.rotation.y = swingArc * 0.3;
      } else {
        this.modelParts.spine.rotation.y = THREE.MathUtils.lerp(this.modelParts.spine.rotation.y, 0, dt * 10);
      }

      // Gun recoil impulse
      if (this.recoilImpulse > 0.005) {
        this.modelParts.rightArm.rotation.x -= this.recoilImpulse;
        this.modelParts.chest.rotation.x -= this.recoilImpulse * 0.4;
        this.recoilImpulse = THREE.MathUtils.lerp(this.recoilImpulse, 0, dt * 14);
      }

      // Damage flinch impulse
      if (this.flinchImpulse > 0.005) {
        this.modelParts.spine.rotation.x -= this.flinchImpulse * 0.5;
        this.modelParts.head.rotation.x -= this.flinchImpulse * 0.4;
        this.flinchImpulse = THREE.MathUtils.lerp(this.flinchImpulse, 0, dt * 10);
      }
    }

    // Footstep audio rhythm
    if (this.isMoving && !isAirborne) {
      const animRate = this.isSprinting ? 15 : input.crouch ? 7.5 : 9.5;
      this.footstepTimer += dt * animRate;
      if (this.footstepTimer >= Math.PI) {
        this.footstepTimer = 0;
        this.eventBus.emit('audio:play_sfx', {
          sound: 'footstep',
          volume: this.isSprinting ? 0.45 : input.crouch ? 0.15 : 0.28
        });
      }
    } else {
      this.footstepTimer = 0;
    }

    // 5. Update Flashlight Target Direction with aim ray (yaw + pitch)
    PlayerController._scratchEuler.set(this.cameraPitch, this.cameraYaw, 0, 'YXZ');
    const aimDir = PlayerController._scratchForward.set(0, 0, 1).applyEuler(PlayerController._scratchEuler);
    this.flashlightTarget.position.copy(this.group.position).addScaledVector(aimDir, 18);
    this.flashlightTarget.position.y += 1.35;

    // 6. Update Third-Person Over-the-Shoulder Camera
    const cam = this.cameraManager.camera;
    const camPivot = PlayerController._scratchCamPivot.copy(this.group.position);
    camPivot.y += 1.45; // Shoulder & eye level pivot

    // Calculate rotated camera position behind player
    const offset = PlayerController._scratchOffset.copy(this.cameraOffset);
    offset.applyEuler(PlayerController._scratchEuler);

    const desiredCamPos = PlayerController._scratchDesiredCam.copy(camPivot).add(offset);

    // Aim target 30m down the crosshair line of sight
    const lookAtPoint = PlayerController._scratchLookAt.copy(camPivot).addScaledVector(aimDir, 30);

    // Immediate first-frame snap to prevent top-down lerp artifact, smooth follow thereafter
    if (!this.isCameraInitialized) {
      this.isCameraInitialized = true;
      cam.position.copy(desiredCamPos);
      cam.lookAt(lookAtPoint);
    } else {
      cam.position.lerp(desiredCamPos, Math.min(1.0, dt * 16));
      cam.lookAt(lookAtPoint);
    }

    this.cameraManager.update(dt);
  }

  public dispose(): void {
    if (this.weaponSwitchUnsub) this.weaponSwitchUnsub();
    if (this.weaponFireUnsub) this.weaponFireUnsub();
    if (this.weaponReloadUnsub) this.weaponReloadUnsub();
    if (this.damageUnsub) this.damageUnsub();
    if (this.deathUnsub) this.deathUnsub();
    if (this.meleeUnsub) this.meleeUnsub();
    if (this.interactUnsub) this.interactUnsub();

    this.animationController?.dispose();
    this.physicsWorld.removeRigidBody(this.rigidBody);

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    if (this.flashlightTarget.parent) {
      this.flashlightTarget.parent.remove(this.flashlightTarget);
    }
  }
}
