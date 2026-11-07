import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { InputManager } from '@/core/input/InputManager';
import { CameraManager } from '@/core/engine/CameraManager';
import { ModelFactory } from '@/core/assets/ModelFactory';
import { EventBus } from '@/core/events/EventBus';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { WeaponType } from '@/shared/types';
import { MathUtils } from '@/core/utils/MathUtils';

export class PlayerController {
  public readonly group: THREE.Group;
  private modelParts: ReturnType<typeof ModelFactory.createPlayerModel>;
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
  private cameraPitch: number = 0.15;
  private readonly cameraOffset: THREE.Vector3 = new THREE.Vector3(0.5, 1.8, -3.2);

  // Animation cycle states
  private strideTimer: number = 0;
  private footstepTimer: number = 0;
  public isMoving: boolean = false;
  public isSprinting: boolean = false;

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

    // 1. Create Model Hierarchy
    this.modelParts = ModelFactory.createPlayerModel();
    this.group = this.modelParts.root;
    this.group.position.copy(startPosition);
    scene.add(this.group);

    // 2. Create Flashlight
    this.flashlightTarget = new THREE.Object3D();
    scene.add(this.flashlightTarget);

    this.flashlight = new THREE.SpotLight(0xfff3db, 3.0, 30, Math.PI / 5, 0.4, 1.2);
    this.flashlight.position.set(0.2, 1.4, 0.2);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.width = 1024;
    this.flashlight.shadow.mapSize.height = 1024;
    this.flashlight.target = this.flashlightTarget;
    this.group.add(this.flashlight);

    // 3. Create Rapier Physics Dynamic Capsule
    const { body, collider } = this.physicsWorld.createDynamicCapsule(
      startPosition,
      0.65, // half height
      0.35, // radius
      this.group
    );
    this.rigidBody = body;
    this.collider = collider;

    // Listen for weapon switch events to update 3D attachment in hand
    this.eventBus.on('weapon:switch', ({ weapon }) => {
      this.attachWeaponMesh(weapon);
    });
    this.attachWeaponMesh('knife');
  }

  public getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  public setPosition(pos: THREE.Vector3): void {
    this.group.position.copy(pos);
    this.rigidBody.setTranslation(new RAPIER.Vector3(pos.x, pos.y, pos.z), true);
  }

  public getForwardVector(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyEuler(new THREE.Euler(0, this.cameraYaw, 0));
    return forward.normalize();
  }

  public attachWeaponMesh(weapon: WeaponType): void {
    if (this.currentWeaponMesh) {
      this.modelParts.weaponSocket.remove(this.currentWeaponMesh);
    }
    this.currentWeaponMesh = ModelFactory.createWeaponMesh(weapon);
    this.modelParts.weaponSocket.add(this.currentWeaponMesh);
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

    // World movement vector
    const moveDir = new THREE.Vector3(moveX, 0, moveZ);
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);

    const currentVel = this.rigidBody.linvel();
    let targetVx = moveDir.x * speed;
    let targetVz = moveDir.z * speed;
    let targetVy = currentVel.y;

    // Jump
    if (input.jump && Math.abs(currentVel.y) < 0.1) {
      targetVy = this.jumpForce;
      this.eventBus.emit('audio:play_sfx', { sound: 'footstep', volume: 0.6 });
    }

    // Apply linear velocity to Rapier dynamic body
    this.rigidBody.setLinvel(new RAPIER.Vector3(targetVx, targetVy, targetVz), true);

    // 3. Sync 3D Mesh Position from Physics Body
    const trans = this.rigidBody.translation();
    this.group.position.set(trans.x, trans.y - 0.95, trans.z);

    // Rotate player character toward camera yaw direction when moving
    if (this.isMoving) {
      const targetAngle = Math.atan2(targetVx, targetVz);
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetAngle, dt * this.rotationSpeed);
    } else {
      // Face aim forward
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.cameraYaw, dt * 6.0);
    }

    // 4. Procedural Stride Animation (Legs and Arms swinging)
    if (this.isMoving) {
      const animRate = this.isSprinting ? 14 : 9;
      this.strideTimer += dt * animRate;

      const legAngle = Math.sin(this.strideTimer) * (this.isSprinting ? 0.75 : 0.45);
      this.modelParts.leftLeg.rotation.x = legAngle;
      this.modelParts.rightLeg.rotation.x = -legAngle;

      const armAngle = Math.sin(this.strideTimer) * (this.isSprinting ? 0.6 : 0.35);
      this.modelParts.leftArm.rotation.x = -armAngle;
      // Right arm holds weapon forward with slight bob
      this.modelParts.rightArm.rotation.x = -Math.PI / 4 + Math.sin(this.strideTimer) * 0.1;

      // Footstep audio rhythm
      this.footstepTimer += dt * animRate;
      if (this.footstepTimer >= Math.PI) {
        this.footstepTimer = 0;
        this.eventBus.emit('audio:play_sfx', {
          sound: 'footstep',
          volume: this.isSprinting ? 0.45 : 0.25
        });
      }
    } else {
      // Idle pose
      this.strideTimer = 0;
      this.footstepTimer = 0;
      this.modelParts.leftLeg.rotation.x = THREE.MathUtils.lerp(this.modelParts.leftLeg.rotation.x, 0, dt * 10);
      this.modelParts.rightLeg.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightLeg.rotation.x, 0, dt * 10);
      this.modelParts.leftArm.rotation.x = THREE.MathUtils.lerp(this.modelParts.leftArm.rotation.x, 0, dt * 10);
      this.modelParts.rightArm.rotation.x = THREE.MathUtils.lerp(this.modelParts.rightArm.rotation.x, -Math.PI / 4, dt * 10);
    }

    // Crouch height adjustment
    const targetBodyY = input.crouch ? 0.7 : 1.0;
    this.modelParts.body.position.y = THREE.MathUtils.lerp(this.modelParts.body.position.y, targetBodyY, dt * 12);

    // 5. Update Flashlight Target Direction
    const lookTarget = this.group.position.clone().add(this.getForwardVector().multiplyScalar(15));
    lookTarget.y += 1.2;
    this.flashlightTarget.position.copy(lookTarget);

    // 6. Update Third-Person Over-the-Shoulder Camera
    const cam = this.cameraManager.camera;
    const camPivot = this.group.position.clone().add(new THREE.Vector3(0, 1.6, 0));

    // Calculate rotated camera position behind player
    const offset = this.cameraOffset.clone();
    offset.applyEuler(new THREE.Euler(this.cameraPitch, this.cameraYaw, 0, 'YXZ'));
    const desiredCamPos = camPivot.clone().add(offset);

    // Smooth lerp camera
    cam.position.lerp(desiredCamPos, dt * 16);
    const lookAtPoint = camPivot.clone().add(new THREE.Vector3(0, Math.sin(this.cameraPitch) * 2.0, 0));
    cam.lookAt(lookAtPoint);

    this.cameraManager.update(dt);
  }

  public dispose(): void {
    this.physicsWorld.removeRigidBody(this.rigidBody);
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
