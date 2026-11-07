import * as THREE from 'three';
import { ZombieVariantType, ZombieState } from '@/shared/types';
import { ZOMBIE_CONFIGS, ZombieConfig } from '@/data/zombies';
import { ModelFactory } from '@/core/assets/ModelFactory';
import { EventBus } from '@/core/events/EventBus';
import { HitLocation, ARMOR_RESISTANCE_MODIFIERS } from '@/data/combat';

export interface ZombieDamageResult {
  damageDealt: number;
  remainingHealth: number;
  isDead: boolean;
  isHeadshot: boolean;
  hitLocation: HitLocation;
  armorReduced: number;
}

export class ZombieAI {
  public readonly id: string;
  public readonly variant: ZombieVariantType;
  public readonly config: ZombieConfig;
  public readonly group: THREE.Group;
  private modelParts: ReturnType<typeof ModelFactory.createZombieModel>;

  public state: ZombieState = 'idle';
  public maxHealth: number;
  public currentHealth: number;
  public isDead: boolean = false;

  // Backward compatibility getter/setter for tests and legacy callers
  public get health(): number {
    return this.currentHealth;
  }
  public set health(val: number) {
    this.currentHealth = Math.max(0, Math.min(this.maxHealth, val));
    if (this.currentHealth <= 0 && !this.isDead) {
      this.die();
    }
  }

  public getHealth(): number {
    return this.currentHealth;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private patrolOrigin: THREE.Vector3;
  private patrolTarget: THREE.Vector3 = new THREE.Vector3();
  private stateTimer: number = 3.0;
  private attackCooldownTimer: number = 0;
  private strideTimer: number = 0;
  private damageFlinchTimer: number = 0;
  private eventBus: EventBus;

  // Staggered update counter for multi-tier frequency throttling
  private updateFrameCounter: number = Math.floor(Math.random() * 10);

  // Reusable scratch vectors to prevent per-frame GC allocations
  private static readonly _scratchMoveDir: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchLookDir: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchForward: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  private static readonly _scratchEyePos: THREE.Vector3 = new THREE.Vector3();

  // Collision bounding cylinder (dynamic, disabled when dead)
  public hitRadius: number;
  public hitHeight: number;

  constructor(
    id: string,
    variant: ZombieVariantType,
    spawnPosition: THREE.Vector3,
    scene: THREE.Scene
  ) {
    this.id = id;
    this.variant = variant;
    this.config = ZOMBIE_CONFIGS[variant];
    this.maxHealth = this.config.maxHealth;
    this.currentHealth = this.maxHealth;
    this.eventBus = EventBus.getInstance();

    this.patrolOrigin = spawnPosition.clone();
    this.patrolTarget.copy(spawnPosition);

    this.hitRadius = 0.5 * this.config.scale[0];
    this.hitHeight = 1.9 * this.config.scale[1];

    this.modelParts = ModelFactory.createZombieModel(variant);
    this.group = this.modelParts.root;
    this.group.position.copy(spawnPosition);
    scene.add(this.group);
  }

  public getPosition(): THREE.Vector3 {
    return this.group.position;
  }

  public getEyePosition(): THREE.Vector3 {
    ZombieAI._scratchEyePos.copy(this.group.position);
    ZombieAI._scratchEyePos.y += this.hitHeight * 0.85;
    return ZombieAI._scratchEyePos;
  }

  public reset(spawnPosition: THREE.Vector3): void {
    this.maxHealth = this.config.maxHealth;
    this.currentHealth = this.maxHealth;
    this.isDead = false;
    this.state = 'idle';
    this.stateTimer = 3.0;
    this.attackCooldownTimer = 0;
    this.strideTimer = 0;
    this.damageFlinchTimer = 0;
    this.patrolOrigin.copy(spawnPosition);
    this.patrolTarget.copy(spawnPosition);
    this.group.position.copy(spawnPosition);
    this.group.rotation.set(0, 0, 0);

    // Restore collision bounds
    this.hitRadius = 0.5 * this.config.scale[0];
    this.hitHeight = 1.9 * this.config.scale[1];

    // Reset joint rotations
    this.modelParts.leftLeg.rotation.set(0, 0, 0);
    this.modelParts.rightLeg.rotation.set(0, 0, 0);
    if (this.modelParts.leftKnee) this.modelParts.leftKnee.rotation.set(0, 0, 0);
    if (this.modelParts.rightKnee) this.modelParts.rightKnee.rotation.set(0, 0, 0);
    this.modelParts.leftArm.rotation.set(0, 0, 0);
    this.modelParts.rightArm.rotation.set(0, 0, 0);
    if (this.modelParts.leftElbow) this.modelParts.leftElbow.rotation.set(0, 0, 0);
    if (this.modelParts.rightElbow) this.modelParts.rightElbow.rotation.set(0, 0, 0);
    if (this.modelParts.spine) this.modelParts.spine.rotation.set(0, 0, 0);
    if (this.modelParts.jaw) this.modelParts.jaw.rotation.set(0, 0, 0);
    this.modelParts.head.rotation.set(0, 0, 0);

    this.modelParts.eyeLights.forEach((light) => {
      light.intensity = 1.2;
    });
    if (this.modelParts.acidLight) this.modelParts.acidLight.intensity = 1.5;
    if (this.modelParts.viralLight) this.modelParts.viralLight.intensity = 2.0;
  }

  public alertToNoise(noisePosition: THREE.Vector3, intensity: number): void {
    if (this.isDead || this.state === 'chase' || this.state === 'attack') return;

    const dist = this.group.position.distanceTo(noisePosition);
    if (dist <= this.config.hearingRadius * (intensity / 20)) {
      this.state = 'investigate';
      this.targetPosition.copy(noisePosition);
      this.stateTimer = 6.0;
      this.eventBus.emit('audio:play_sfx', { sound: 'zombie_groan', volume: 0.6 });
    }
  }

  public takeDamage(
    amount: number,
    _hitPoint: THREE.Vector3,
    isHeadshotOrLocation: boolean | HitLocation = false
  ): ZombieDamageResult {
    const hitLocation: HitLocation =
      typeof isHeadshotOrLocation === 'string'
        ? isHeadshotOrLocation
        : isHeadshotOrLocation
        ? 'head'
        : 'torso';

    const isHeadshot = hitLocation === 'head';

    if (this.isDead) {
      return {
        damageDealt: 0,
        remainingHealth: 0,
        isDead: true,
        isHeadshot,
        hitLocation,
        armorReduced: 0
      };
    }

    // Factor in variant-specific armor resistance for this hit location
    const armorMod = ARMOR_RESISTANCE_MODIFIERS[this.variant]?.[hitLocation] ?? 1.0;
    const damageAfterArmor = Math.max(1, Math.round(amount * armorMod));
    const armorReduced = Math.max(0, Math.round(amount - damageAfterArmor));

    this.currentHealth = Math.max(0, this.currentHealth - damageAfterArmor);
    this.state = 'chase';
    this.damageFlinchTimer = 0.25;

    if (this.currentHealth <= 0) {
      this.die();
      return {
        damageDealt: damageAfterArmor,
        remainingHealth: 0,
        isDead: true,
        isHeadshot,
        hitLocation,
        armorReduced
      };
    } else {
      this.stateTimer = 0.25;
      const fwd = this.getForwardVector();
      this.group.position.addScaledVector(fwd, -0.2);
      this.eventBus.emit('audio:play_sfx', { sound: 'zombie_groan', volume: 0.7 });
      return {
        damageDealt: damageAfterArmor,
        remainingHealth: this.currentHealth,
        isDead: false,
        isHeadshot,
        hitLocation,
        armorReduced
      };
    }
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.currentHealth = 0;
    this.state = 'dead';
    this.attackCooldownTimer = Infinity;
    this.hitRadius = 0;
    this.hitHeight = 0;

    this.eventBus.emit('audio:play_sfx', { sound: 'zombie_death', volume: 0.9 });
    this.eventBus.emit('zombie:killed', {
      id: this.id,
      variant: this.variant,
      position: [this.group.position.x, this.group.position.y, this.group.position.z]
    });

    // Realistic skeletal collapse crumple
    this.group.rotation.x = Math.PI / 2.15;
    this.group.rotation.z = 0.2;
    this.group.position.y = 0.15;

    if (this.modelParts.leftKnee) this.modelParts.leftKnee.rotation.x = 1.3;
    if (this.modelParts.rightKnee) this.modelParts.rightKnee.rotation.x = 1.1;
    this.modelParts.leftLeg.rotation.x = -0.4;
    this.modelParts.rightLeg.rotation.x = -0.5;
    if (this.modelParts.spine) {
      this.modelParts.spine.rotation.x = 0.5;
      this.modelParts.spine.rotation.z = 0.25;
    }
    this.modelParts.leftArm.rotation.z = -1.0;
    this.modelParts.rightArm.rotation.z = 0.9;
    if (this.modelParts.jaw) this.modelParts.jaw.rotation.x = 0.75; // Jaw hangs open in death

    this.modelParts.eyeLights.forEach((light) => {
      light.intensity = 0;
    });
    if (this.modelParts.acidLight) this.modelParts.acidLight.intensity = 0;
    if (this.modelParts.viralLight) this.modelParts.viralLight.intensity = 0;
  }

  public getForwardVector(): THREE.Vector3 {
    ZombieAI._scratchForward.set(0, 0, 1).applyEuler(this.group.rotation);
    return ZombieAI._scratchForward.normalize();
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    onAttackPlayer: (dmg: number) => void,
    hasLineOfSight?: (from: THREE.Vector3, to: THREE.Vector3) => boolean
  ): void {
    if (this.isDead) return;

    const distToPlayer = this.group.position.distanceTo(playerPos);
    this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    this.updateFrameCounter++;

    // Multi-tier distance optimization:
    // Distant zombies (> 35m) only run AI every 12th frame (~5Hz)
    if (distToPlayer > 35 && this.updateFrameCounter % 12 !== 0) {
      return;
    }
    // Mid-distance zombies (15m - 35m) run AI every 3rd frame (~20Hz)
    if (distToPlayer > 15 && distToPlayer <= 35 && this.updateFrameCounter % 3 !== 0) {
      // Step movement forward if chasing
      if (this.state === 'chase') {
        this.moveTo(playerPos, this.config.runSpeed, dt);
      }
      return;
    }

    const canSeePlayer = (): boolean => {
      if (!hasLineOfSight) return true;
      return hasLineOfSight(this.getEyePosition(), playerPos);
    };

    // 1. Perception & State Evaluation (Near or Scheduled frame)
    switch (this.state) {
      case 'idle':
        this.stateTimer -= dt;
        if (distToPlayer <= this.config.detectionRadius && canSeePlayer()) {
          this.state = 'chase';
          this.eventBus.emit('audio:play_sfx', { sound: 'zombie_attack', volume: 0.8 });
        } else if (this.stateTimer <= 0) {
          this.state = 'patrol';
          this.stateTimer = 5.0;
          this.patrolTarget.set(
            this.patrolOrigin.x + (Math.random() - 0.5) * 12,
            this.patrolOrigin.y,
            this.patrolOrigin.z + (Math.random() - 0.5) * 12
          );
        }
        break;

      case 'patrol':
        this.stateTimer -= dt;
        if (distToPlayer <= this.config.detectionRadius && canSeePlayer()) {
          this.state = 'chase';
          this.eventBus.emit('audio:play_sfx', { sound: 'zombie_attack', volume: 0.8 });
        } else {
          this.moveTo(this.patrolTarget, this.config.walkSpeed, dt);
          if (this.group.position.distanceTo(this.patrolTarget) < 1.0 || this.stateTimer <= 0) {
            this.state = 'idle';
            this.stateTimer = 3.0 + Math.random() * 2;
          }
        }
        break;

      case 'investigate':
        this.stateTimer -= dt;
        if (distToPlayer <= this.config.detectionRadius && canSeePlayer()) {
          this.state = 'chase';
        } else {
          this.moveTo(this.targetPosition, this.config.walkSpeed * 1.2, dt);
          if (this.group.position.distanceTo(this.targetPosition) < 1.5 || this.stateTimer <= 0) {
            this.state = 'idle';
            this.stateTimer = 2.0;
          }
        }
        break;

      case 'chase':
        if (distToPlayer <= this.config.attackRange) {
          this.state = 'attack';
          this.stateTimer = 0.8;
        } else if (distToPlayer > this.config.detectionRadius * 2.2) {
          this.state = 'idle';
          this.stateTimer = 4.0;
        } else {
          this.moveTo(playerPos, this.config.runSpeed, dt);
        }
        break;

      case 'attack':
        this.stateTimer -= dt;
        this.lookAt(playerPos);

        if (this.attackCooldownTimer <= 0) {
          this.attackCooldownTimer = this.config.attackCooldown;
          // Only damage player if in attack range and unobstructed by walls
          if (distToPlayer <= this.config.attackRange + 0.5 && canSeePlayer()) {
            onAttackPlayer(this.config.attackDamage);
            this.eventBus.emit('audio:play_sfx', { sound: 'zombie_attack', volume: 0.9 });
          }
        }

        if (this.stateTimer <= 0) {
          this.state = distToPlayer <= this.config.attackRange ? 'attack' : 'chase';
          this.stateTimer = 0.8;
        }
        break;
    }

    // 2. Animate Limbs (Skip if distant to save CPU cycles)
    if (distToPlayer <= 32) {
      this.animate(dt);
    }
  }

  private moveTo(target: THREE.Vector3, speed: number, dt: number): void {
    const dir = ZombieAI._scratchMoveDir.subVectors(target, this.group.position);
    dir.y = 0;
    const len = dir.length();
    if (len > 0.1) {
      dir.divideScalar(len); // In-place normalize
      this.group.position.addScaledVector(dir, speed * dt);
      const targetAngle = Math.atan2(dir.x, dir.z);
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetAngle, dt * 8.0);
    }
  }

  private lookAt(target: THREE.Vector3): void {
    const dir = ZombieAI._scratchLookDir.subVectors(target, this.group.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.01) {
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  private animate(dt: number): void {
    const isMoving = this.state === 'patrol' || this.state === 'investigate' || this.state === 'chase';

    switch (this.variant) {
      case 'walker':
        this.animateWalker(dt, isMoving);
        break;
      case 'runner':
        this.animateRunner(dt, isMoving);
        break;
      case 'brute':
        this.animateBrute(dt, isMoving);
        break;
      case 'spitter':
        this.animateSpitter(dt, isMoving);
        break;
      case 'boss':
        this.animateBoss(dt, isMoving);
        break;
    }

    // Damage flinch impulse
    if (this.damageFlinchTimer > 0) {
      this.damageFlinchTimer -= dt;
      if (this.modelParts.spine) {
        this.modelParts.spine.rotation.x -= 0.35;
      }
      this.modelParts.head.rotation.x -= 0.25;
    }
  }

  // 1. Infected Shambler: Asymmetric limp, dragging leg, twitching head, unhinged drooping jaw
  private animateWalker(dt: number, isMoving: boolean): void {
    if (isMoving) {
      const animRate = this.state === 'chase' ? 8.5 : 5.5;
      this.strideTimer += dt * animRate;

      // Asymmetric dragging stride
      const cycle = Math.sin(this.strideTimer * 0.7);
      this.modelParts.leftLeg.rotation.x = cycle * 0.45;
      this.modelParts.rightLeg.rotation.x = -cycle * 0.22; // Stiff dragging right leg
      if (this.modelParts.leftKnee) this.modelParts.leftKnee.rotation.x = Math.max(0, cycle) * 0.6;
      if (this.modelParts.rightKnee) this.modelParts.rightKnee.rotation.x = 0.08; // Minimal knee bend

      // Pelvic limp wobble
      this.group.rotation.z = Math.sin(this.strideTimer * 0.7) * 0.06;

      // Hunched and twisted spine
      if (this.modelParts.spine) {
        this.modelParts.spine.rotation.x = 0.25;
        this.modelParts.spine.rotation.z = Math.sin(this.strideTimer * 0.7) * 0.1;
      }

      // Sporadic necrotic head twitch
      const twitch = Math.sin(this.strideTimer * 5.0) > 0.85 ? 0.35 : 0;
      this.modelParts.head.rotation.y = Math.sin(this.strideTimer * 1.5) * 0.2 + twitch;

      // Slack unhinged jaw swaying
      if (this.modelParts.jaw) {
        this.modelParts.jaw.rotation.x = 0.25 + Math.sin(this.strideTimer * 2.8) * 0.15;
      }

      // Grasping outstretched arms
      this.modelParts.leftArm.rotation.x = -Math.PI / 2.3 + Math.sin(this.strideTimer * 1.1) * 0.15;
      this.modelParts.rightArm.rotation.x = -Math.PI / 2.2 - Math.sin(this.strideTimer * 1.1) * 0.15;
      if (this.modelParts.leftElbow) this.modelParts.leftElbow.rotation.x = 0.35;
      if (this.modelParts.rightElbow) this.modelParts.rightElbow.rotation.x = 0.4;
    } else if (this.state === 'attack') {
      // Lunging clutching double-arm bite attack
      const attackCycle = Math.sin(this.stateTimer * 14);
      this.modelParts.leftArm.rotation.x = -Math.PI / 2 + attackCycle * 0.4;
      this.modelParts.rightArm.rotation.x = -Math.PI / 2 + attackCycle * 0.4;
      this.modelParts.leftArm.rotation.z = -0.3 + attackCycle * 0.35;
      this.modelParts.rightArm.rotation.z = 0.3 - attackCycle * 0.35;
      if (this.modelParts.jaw) this.modelParts.jaw.rotation.x = 0.65;
    } else {
      // Idle twitching corpse
      this.strideTimer += dt * 1.5;
      if (this.modelParts.spine) this.modelParts.spine.rotation.x = 0.15;
      if (this.modelParts.jaw) this.modelParts.jaw.rotation.x = 0.2 + Math.sin(this.strideTimer) * 0.1;
      this.modelParts.head.rotation.y = Math.sin(this.strideTimer * 0.8) * 0.15;
    }
  }

  // 2. Feral Runner: Low predatory sprint crouch, high knee drives, frenzied claw slashes
  private animateRunner(dt: number, isMoving: boolean): void {
    if (isMoving) {
      const animRate = this.state === 'chase' ? 19.0 : 12.0;
      this.strideTimer += dt * animRate;

      // Low feral hunch
      if (this.modelParts.spine) this.modelParts.spine.rotation.x = 0.52;

      // High knee drive sprint
      const legCycle = Math.sin(this.strideTimer);
      this.modelParts.leftLeg.rotation.x = legCycle * 0.75;
      this.modelParts.rightLeg.rotation.x = -legCycle * 0.75;
      if (this.modelParts.leftKnee) this.modelParts.leftKnee.rotation.x = 0.2 + Math.max(0, legCycle) * 1.35;
      if (this.modelParts.rightKnee) this.modelParts.rightKnee.rotation.x = 0.2 + Math.max(0, -legCycle) * 1.35;

      // Galloping claw pump
      this.modelParts.leftArm.rotation.x = -Math.PI / 2.5 + Math.sin(this.strideTimer) * 0.6;
      this.modelParts.rightArm.rotation.x = -Math.PI / 2.5 - Math.sin(this.strideTimer) * 0.6;
      if (this.modelParts.leftElbow) this.modelParts.leftElbow.rotation.x = 0.7;
      if (this.modelParts.rightElbow) this.modelParts.rightElbow.rotation.x = 0.7;

      if (this.modelParts.jaw) this.modelParts.jaw.rotation.x = 0.4 + Math.sin(this.strideTimer * 3.5) * 0.15;
    } else if (this.state === 'attack') {
      // Rapid frenzied clawing
      const attackSpeed = this.stateTimer * 24;
      this.modelParts.leftArm.rotation.x = -Math.PI / 2 + Math.sin(attackSpeed) * 0.85;
      this.modelParts.rightArm.rotation.x = -Math.PI / 2 - Math.sin(attackSpeed) * 0.85;
      if (this.modelParts.spine) this.modelParts.spine.rotation.x = 0.4 + Math.sin(attackSpeed) * 0.15;
      if (this.modelParts.jaw) this.modelParts.jaw.rotation.x = 0.5 + Math.sin(attackSpeed) * 0.2;
    } else {
      // Low predatory stance
      if (this.modelParts.spine) this.modelParts.spine.rotation.x = 0.4;
      if (this.modelParts.leftKnee) this.modelParts.leftKnee.rotation.x = 0.4;
      if (this.modelParts.rightKnee) this.modelParts.rightKnee.rotation.x = 0.4;
    }
  }

  // 3. Armored Brute: Slow heavyweight lumber, ground-shaking stomps, double-overhead ground slam
  private animateBrute(dt: number, isMoving: boolean): void {
    if (isMoving) {
      const animRate = this.state === 'chase' ? 6.2 : 3.5;
      this.strideTimer += dt * animRate;

      // Wide heavy stance
      this.modelParts.leftLeg.rotation.z = -0.16;
      this.modelParts.rightLeg.rotation.z = 0.16;

      const legCycle = Math.sin(this.strideTimer);
      this.modelParts.leftLeg.rotation.x = legCycle * 0.5;
      this.modelParts.rightLeg.rotation.x = -legCycle * 0.5;
      if (this.modelParts.leftKnee) this.modelParts.leftKnee.rotation.x = 0.1 + Math.max(0, legCycle) * 0.75;
      if (this.modelParts.rightKnee) this.modelParts.rightKnee.rotation.x = 0.1 + Math.max(0, -legCycle) * 0.75;

      // Heavy torso sway
      if (this.modelParts.spine) {
        this.modelParts.spine.rotation.z = Math.sin(this.strideTimer) * 0.12;
        this.modelParts.spine.rotation.x = 0.15;
      }

      // Heavy fists swinging
      this.modelParts.leftArm.rotation.x = -0.4 + Math.sin(this.strideTimer) * 0.2;
      this.modelParts.rightArm.rotation.x = -0.4 - Math.sin(this.strideTimer) * 0.2;
      if (this.modelParts.leftElbow) this.modelParts.leftElbow.rotation.x = 0.65;
      if (this.modelParts.rightElbow) this.modelParts.rightElbow.rotation.x = 0.65;
    } else if (this.state === 'attack') {
      // Overhead double-fist ground pound slam
      if (this.stateTimer > 0.35) {
        // Windup: raise massive armored arms overhead
        this.modelParts.leftArm.rotation.x = -Math.PI * 0.85;
        this.modelParts.rightArm.rotation.x = -Math.PI * 0.85;
        if (this.modelParts.spine) this.modelParts.spine.rotation.x = -0.25;
      } else {
        // Impact: violent downward ground slam
        this.modelParts.leftArm.rotation.x = -0.15;
        this.modelParts.rightArm.rotation.x = -0.15;
        if (this.modelParts.spine) this.modelParts.spine.rotation.x = 0.55;
      }
    } else {
      // Heavy breathing stance
      this.strideTimer += dt * 1.5;
      if (this.modelParts.spine) this.modelParts.spine.rotation.x = 0.1 + Math.sin(this.strideTimer) * 0.04;
    }
  }

  // 4. Toxic Spitter: Backward-arched spine, pulsing acid throat, violent acid spit recoil
  private animateSpitter(dt: number, isMoving: boolean): void {
    // Pulsing toxic acid reservoir glow
    if (this.modelParts.acidLight) {
      this.modelParts.acidLight.intensity = 1.2 + Math.sin(this.strideTimer * 4.0) * 0.8;
    }

    if (isMoving) {
      const animRate = this.state === 'chase' ? 11.0 : 6.0;
      this.strideTimer += dt * animRate;

      if (this.modelParts.spine) this.modelParts.spine.rotation.x = -0.12; // Arched backward

      const legCycle = Math.sin(this.strideTimer);
      this.modelParts.leftLeg.rotation.x = legCycle * 0.45;
      this.modelParts.rightLeg.rotation.x = -legCycle * 0.45;
      if (this.modelParts.leftKnee) this.modelParts.leftKnee.rotation.x = 0.1 + Math.max(0, legCycle) * 0.7;
      if (this.modelParts.rightKnee) this.modelParts.rightKnee.rotation.x = 0.1 + Math.max(0, -legCycle) * 0.7;

      // Dripping twitchy claws
      this.modelParts.leftArm.rotation.x = -0.5 + Math.sin(this.strideTimer * 1.2) * 0.25;
      this.modelParts.rightArm.rotation.x = -0.5 - Math.sin(this.strideTimer * 1.2) * 0.25;
      if (this.modelParts.leftElbow) this.modelParts.leftElbow.rotation.x = 0.5;
      if (this.modelParts.rightElbow) this.modelParts.rightElbow.rotation.x = 0.5;
    } else if (this.state === 'attack') {
      // Acid heave & violent projectile expulsion
      if (this.stateTimer > 0.4) {
        // Windup: throat distends and spine arches back
        if (this.modelParts.spine) this.modelParts.spine.rotation.x = -0.4;
        if (this.modelParts.jaw) this.modelParts.jaw.rotation.x = 0.75;
        if (this.modelParts.acidLight) this.modelParts.acidLight.intensity = 3.5;
      } else {
        // Violent expulsion forward
        if (this.modelParts.spine) this.modelParts.spine.rotation.x = 0.45;
        this.modelParts.head.rotation.x = 0.35;
        if (this.modelParts.acidLight) this.modelParts.acidLight.intensity = 4.5;
      }
    } else {
      if (this.modelParts.spine) this.modelParts.spine.rotation.x = -0.1;
    }
  }

  // 5. Patient Zero Abomination: Colossal stride, scythe sweeping slash, pulsating viral core
  private animateBoss(dt: number, isMoving: boolean): void {
    // Pulsating viral heart core
    if (this.modelParts.viralLight) {
      this.modelParts.viralLight.intensity = 2.0 + Math.sin(this.strideTimer * 3.5) * 1.5;
    }

    if (isMoving) {
      const animRate = this.state === 'chase' ? 5.2 : 2.8;
      this.strideTimer += dt * animRate;

      const legCycle = Math.sin(this.strideTimer);
      this.modelParts.leftLeg.rotation.x = legCycle * 0.55;
      this.modelParts.rightLeg.rotation.x = -legCycle * 0.55;
      if (this.modelParts.leftKnee) this.modelParts.leftKnee.rotation.x = 0.1 + Math.max(0, legCycle) * 0.85;
      if (this.modelParts.rightKnee) this.modelParts.rightKnee.rotation.x = 0.1 + Math.max(0, -legCycle) * 0.85;

      // Giant scythe arm raised in ready sweep
      this.modelParts.leftArm.rotation.x = -Math.PI / 2.2 + Math.sin(this.strideTimer * 0.8) * 0.15;
      this.modelParts.rightArm.rotation.x = -0.6 + Math.sin(this.strideTimer * 0.8) * 0.2;
      if (this.modelParts.leftElbow) this.modelParts.leftElbow.rotation.x = 0.45;
      if (this.modelParts.rightElbow) this.modelParts.rightElbow.rotation.x = 0.6;
    } else if (this.state === 'attack') {
      // Devastating scythe cleave & sweeping smash
      if (this.stateTimer > 0.4) {
        // Windup: pull scythe arm laterally back
        this.modelParts.leftArm.rotation.y = 0.85;
        this.modelParts.leftArm.rotation.x = -Math.PI / 2;
        if (this.modelParts.viralLight) this.modelParts.viralLight.intensity = 4.0;
      } else {
        // Horrendous sweeping horizontal cleave
        this.modelParts.leftArm.rotation.y = -1.15;
        this.modelParts.leftArm.rotation.x = -0.3;
        if (this.modelParts.spine) this.modelParts.spine.rotation.y = -0.4;
        if (this.modelParts.viralLight) this.modelParts.viralLight.intensity = 5.0;
      }
    } else {
      this.strideTimer += dt * 1.2;
      if (this.modelParts.spine) this.modelParts.spine.rotation.x = 0.1 + Math.sin(this.strideTimer) * 0.05;
    }
  }

  public dispose(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
