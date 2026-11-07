import * as THREE from 'three';
import { ZombieVariantType, ZombieState } from '@/shared/types';
import { ZOMBIE_CONFIGS, ZombieConfig } from '@/data/zombies';
import { ModelFactory } from '@/core/assets/ModelFactory';
import { EventBus } from '@/core/events/EventBus';

export class ZombieAI {
  public readonly id: string;
  public readonly variant: ZombieVariantType;
  public readonly config: ZombieConfig;
  public readonly group: THREE.Group;
  private modelParts: ReturnType<typeof ModelFactory.createZombieModel>;

  public state: ZombieState = 'idle';
  public health: number;
  public isDead: boolean = false;

  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private patrolOrigin: THREE.Vector3;
  private patrolTarget: THREE.Vector3 = new THREE.Vector3();
  private stateTimer: number = 0;
  private attackCooldownTimer: number = 0;
  private strideTimer: number = 0;
  private eventBus: EventBus;

  // Collision bounding cylinder/sphere
  public readonly hitRadius: number;
  public readonly hitHeight: number;

  constructor(
    id: string,
    variant: ZombieVariantType,
    spawnPosition: THREE.Vector3,
    scene: THREE.Scene
  ) {
    this.id = id;
    this.variant = variant;
    this.config = ZOMBIE_CONFIGS[variant];
    this.health = this.config.maxHealth;
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
    return this.group.position.clone();
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

  public takeDamage(amount: number, _hitPoint: THREE.Vector3, _isHeadshot: boolean): void {
    if (this.isDead) return;

    this.health -= amount;
    this.state = 'chase'; // Instantly enraged and turns to attack

    if (this.health <= 0) {
      this.die();
    } else {
      // Stagger reaction
      this.stateTimer = 0.25;
      this.group.position.addScaledVector(this.getForwardVector(), -0.2);
      this.eventBus.emit('audio:play_sfx', { sound: 'zombie_groan', volume: 0.7 });
    }
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.state = 'dead';
    this.eventBus.emit('audio:play_sfx', { sound: 'zombie_death', volume: 0.9 });
    this.eventBus.emit('zombie:killed', {
      id: this.id,
      variant: this.variant,
      position: [this.group.position.x, this.group.position.y, this.group.position.z]
    });

    // Knockdown collapse animation
    this.group.rotation.x = Math.PI / 2;
    this.group.position.y = 0.15;

    // Dim eyes
    this.modelParts.eyeLights.forEach((light) => {
      light.intensity = 0;
    });
  }

  public getForwardVector(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyEuler(this.group.rotation);
    return forward.normalize();
  }

  public update(dt: number, playerPos: THREE.Vector3, onAttackPlayer: (dmg: number) => void): void {
    if (this.isDead) return;

    const distToPlayer = this.group.position.distanceTo(playerPos);
    this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);

    // 1. Perception & State Evaluation
    switch (this.state) {
      case 'idle':
        this.stateTimer -= dt;
        if (distToPlayer <= this.config.detectionRadius) {
          this.state = 'chase';
          this.eventBus.emit('audio:play_sfx', { sound: 'zombie_attack', volume: 0.8 });
        } else if (this.stateTimer <= 0) {
          // Switch to patrol
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
        if (distToPlayer <= this.config.detectionRadius) {
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
        if (distToPlayer <= this.config.detectionRadius) {
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
          // Lost player
          this.state = 'idle';
          this.stateTimer = 4.0;
        } else {
          this.moveTo(playerPos, this.config.runSpeed, dt);
        }
        break;

      case 'attack':
        this.stateTimer -= dt;
        // Face player
        this.lookAt(playerPos);

        if (this.attackCooldownTimer <= 0) {
          this.attackCooldownTimer = this.config.attackCooldown;
          if (distToPlayer <= this.config.attackRange + 0.5) {
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

    // 2. Animate Limbs based on state
    this.animate(dt);
  }

  private moveTo(target: THREE.Vector3, speed: number, dt: number): void {
    const dir = new THREE.Vector3().subVectors(target, this.group.position);
    dir.y = 0;
    const len = dir.length();
    if (len > 0.1) {
      dir.normalize();
      this.group.position.addScaledVector(dir, speed * dt);
      const targetAngle = Math.atan2(dir.x, dir.z);
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetAngle, dt * 8.0);
    }
  }

  private lookAt(target: THREE.Vector3): void {
    const dir = new THREE.Vector3().subVectors(target, this.group.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.01) {
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  private animate(dt: number): void {
    const isMoving = this.state === 'patrol' || this.state === 'investigate' || this.state === 'chase';
    if (isMoving) {
      const animRate = this.state === 'chase' ? 12 : 7;
      this.strideTimer += dt * animRate;

      // Unsteady limping zombie stride
      const leftLegAngle = Math.sin(this.strideTimer) * 0.55;
      const rightLegAngle = -Math.sin(this.strideTimer + 0.3) * 0.45;
      this.modelParts.leftLeg.rotation.x = leftLegAngle;
      this.modelParts.rightLeg.rotation.x = rightLegAngle;

      // Aggressive arm swiping
      this.modelParts.leftArm.rotation.x = -Math.PI / 3 + Math.sin(this.strideTimer * 1.2) * 0.3;
      this.modelParts.rightArm.rotation.x = -Math.PI / 3 - Math.sin(this.strideTimer * 1.2) * 0.3;
    } else if (this.state === 'attack') {
      // Lunging strike
      this.modelParts.leftArm.rotation.x = -Math.PI / 2 + Math.sin(this.stateTimer * 15) * 0.5;
      this.modelParts.rightArm.rotation.x = -Math.PI / 2 + Math.cos(this.stateTimer * 15) * 0.5;
    }
  }

  public dispose(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
