import * as THREE from 'three';
import { ZombieVariantType, ZombieState } from '@/shared/types';
import { ZOMBIE_CONFIGS, ZombieConfig, ZombieHitboxConfig } from '@/data/zombies';
import { ModelFactory } from '@/core/assets/ModelFactory';
import { EventBus } from '@/core/events/EventBus';
import { HitLocation, ARMOR_RESISTANCE_MODIFIERS } from '@/data/combat';
import { ZombieAnimationController, ZombieAssetPool, ZombieClips } from '../ZombieAnimationController';

export interface ZombieDamageResult {
  damageDealt: number;
  remainingHealth: number;
  isDead: boolean;
  isHeadshot: boolean;
  hitLocation: HitLocation;
  armorReduced: number;
}

export interface ZombieRayHitResult {
  hitPoint: THREE.Vector3;
  distance: number;
  isHeadshot: boolean;
  hitLocation: HitLocation;
}

export interface ZombieMeleeHitResult {
  hitPoint: THREE.Vector3;
  distance: number;
  hitLocation: HitLocation;
}

export class ZombieAI {
  public readonly id: string;
  public readonly variant: ZombieVariantType;
  public readonly config: ZombieConfig;
  public readonly group: THREE.Group;
  public readonly hitbox: ZombieHitboxConfig;
  private modelParts: ReturnType<typeof ModelFactory.createZombieModel>;

  public state: ZombieState = 'idle';
  public maxHealth: number;
  public currentHealth: number;
  public isDead: boolean = false;

  // Real 3D Rigged Humanoid Skeletal Animation Controller
  public animationController: ZombieAnimationController | null = null;
  private skeletalModel: THREE.Object3D | null = null;

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
  private hasDealtAttackDamage: boolean = false;
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
  private static readonly _scratchAimDir: THREE.Vector3 = new THREE.Vector3();

  // Collision bounding cylinder (dynamic, disabled when dead)
  public hitRadius: number;
  public hitHeight: number;

  // 3D Billboard Blood/Health Sprite
  private bloodSprite: THREE.Sprite;
  private bloodCanvas: HTMLCanvasElement;
  private bloodCtx: CanvasRenderingContext2D;
  private bloodTexture: THREE.CanvasTexture;
  private spriteMaterial: THREE.SpriteMaterial;

  constructor(
    id: string,
    variant: ZombieVariantType,
    spawnPosition: THREE.Vector3,
    scene: THREE.Scene
  ) {
    this.id = id;
    this.variant = variant;
    this.config = ZOMBIE_CONFIGS[variant];
    this.hitbox = this.config.hitbox;
    this.maxHealth = this.config.maxHealth;
    this.currentHealth = this.maxHealth;
    this.eventBus = EventBus.getInstance();

    this.patrolOrigin = spawnPosition.clone();
    this.patrolTarget.copy(spawnPosition);

    this.hitRadius = this.hitbox.bodyRadius;
    this.hitHeight = this.hitbox.bodyHeight;

    this.modelParts = ModelFactory.createZombieModel(variant);
    this.group = this.modelParts.root;
    this.group.position.copy(spawnPosition);
    scene.add(this.group);

    // Dynamic 2D Canvas Billboard Sprite showing remaining Blood
    this.bloodCanvas = document.createElement('canvas');
    this.bloodCanvas.width = 256;
    this.bloodCanvas.height = 64;
    this.bloodCtx = this.bloodCanvas.getContext('2d')!;
    this.bloodTexture = new THREE.CanvasTexture(this.bloodCanvas);
    this.bloodTexture.minFilter = THREE.LinearFilter;
    this.bloodTexture.magFilter = THREE.LinearFilter;

    this.renderBloodBarTexture(this.currentHealth, this.maxHealth);

    this.spriteMaterial = new THREE.SpriteMaterial({
      map: this.bloodTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    this.bloodSprite = new THREE.Sprite(this.spriteMaterial);
    // Position comfortably floating above zombie head based on actual hitbox height
    this.bloodSprite.position.set(0, this.hitbox.bodyHeight + 0.35, 0);
    this.bloodSprite.scale.set(1.5 * Math.max(0.9, this.config.scale[0]), 0.38 * Math.max(0.9, this.config.scale[1]), 1.0);
    this.bloodSprite.renderOrder = 9999;
    this.group.add(this.bloodSprite);

    // Initialize 3D skinned mesh model with skeletal animations if available
    this.initSkeletalModel();
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  private renderBloodBarTexture(current: number, max: number): void {
    const ctx = this.bloodCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 64);

    // 1. Dark Container Pill with glowing border
    ctx.fillStyle = 'rgba(12, 16, 24, 0.92)';
    ctx.beginPath();
    this.drawRoundedRect(ctx, 4, 4, 248, 56, 8);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.drawRoundedRect(ctx, 4, 4, 248, 56, 8);
    ctx.stroke();

    // 2. Zombie Variant Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#edf2f7';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(`🧟 ${this.config.name.toUpperCase()}`, 128, 18);

    // 3. Blood Bar Background Track
    const trackX = 14;
    const trackY = 32;
    const trackW = 228;
    const trackH = 20;

    ctx.fillStyle = 'rgba(35, 10, 10, 0.85)';
    ctx.beginPath();
    this.drawRoundedRect(ctx, trackX, trackY, trackW, trackH, 5);
    ctx.fill();

    // 4. Crimson Blood Fill Bar
    const ratio = Math.max(0, Math.min(1, current / max));
    const fillW = Math.max(0, ratio * trackW);

    if (fillW > 0) {
      const grad = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
      if (ratio > 0.5) {
        grad.addColorStop(0, '#990c0c');
        grad.addColorStop(1, '#ff2222');
      } else if (ratio > 0.25) {
        grad.addColorStop(0, '#c05621');
        grad.addColorStop(1, '#dd6b20');
      } else {
        grad.addColorStop(0, '#742a2a');
        grad.addColorStop(1, '#e53e3e');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      this.drawRoundedRect(ctx, trackX, trackY, fillW, trackH, 5);
      ctx.fill();
    }

    // 5. Blood Text Counter: "BLOOD: 75 / 100"
    ctx.font = '900 12px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(`BLOOD: ${Math.round(current)} / ${max}`, 128, 42);
    ctx.shadowBlur = 0;

    this.bloodTexture.needsUpdate = true;
  }

  private initSkeletalModel(): void {
    const pool = ZombieAssetPool.getInstance();
    const clips = pool.getClips();
    const model = pool.cloneModel();
    if (clips && model) {
      this.attachSkeletalModel(model, clips);
    } else {
      pool.preload().then((ok) => {
        if (ok && !this.isDead) {
          const c = pool.getClips();
          const m = pool.cloneModel();
          if (c && m) {
            this.attachSkeletalModel(m, c);
          }
        }
      }).catch(() => {});
    }
  }

  private attachSkeletalModel(model: THREE.Object3D, clips: ZombieClips): void {
    if (this.animationController || this.skeletalModel) return;
    this.skeletalModel = model;
    this.skeletalModel.scale.set(1, 1, 1);
    this.group.add(this.skeletalModel);
    this.animationController = new ZombieAnimationController(this.skeletalModel, clips);

    // Hide procedural placeholder meshes while preserving node hierarchy
    this.modelParts.head.visible = false;
    this.modelParts.body.visible = false;
    this.modelParts.leftArm.visible = false;
    this.modelParts.rightArm.visible = false;
    this.modelParts.leftLeg.visible = false;
    this.modelParts.rightLeg.visible = false;
    if (this.modelParts.jaw) this.modelParts.jaw.visible = false;
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
    this.hasDealtAttackDamage = false;
    this.strideTimer = 0;
    this.damageFlinchTimer = 0;
    this.patrolOrigin.copy(spawnPosition);
    this.patrolTarget.copy(spawnPosition);
    this.group.position.copy(spawnPosition);
    this.group.rotation.set(0, 0, 0);

    if (this.animationController) {
      this.animationController.isDead = false;
      this.animationController.playLocomotion('idle', 0.1);
    }

    // Reset blood sprite
    this.renderBloodBarTexture(this.currentHealth, this.maxHealth);
    this.bloodSprite.visible = true;

    // Restore collision bounds
    this.hitRadius = this.hitbox.bodyRadius;
    this.hitHeight = this.hitbox.bodyHeight;

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

    // Update 3D blood billboard
    this.renderBloodBarTexture(this.currentHealth, this.maxHealth);

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
    this.bloodSprite.visible = false;

    this.eventBus.emit('audio:play_sfx', { sound: 'zombie_death', volume: 0.9 });
    this.eventBus.emit('zombie:killed', {
      id: this.id,
      variant: this.variant,
      position: [this.group.position.x, this.group.position.y, this.group.position.z]
    });

    if (this.animationController) {
      this.animationController.triggerDeath();
      this.group.position.y = 0;
    } else {
      // Realistic skeletal collapse crumple fallback
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
    }

    this.modelParts.eyeLights.forEach((light) => {
      light.intensity = 0;
    });
    if (this.modelParts.acidLight) this.modelParts.acidLight.intensity = 0;
    if (this.modelParts.viralLight) this.modelParts.viralLight.intensity = 0;
  }

  /**
   * Tests a 3D ray against this zombie's structured hitbox:
   * 1. Head sphere at (zPos.x, zPos.y + headCenterY, zPos.z)
   * 2. Body cylinder/capsule along vertical axis with radius (bodyRadius + bulletTolerance)
   * Returns precise hit point, distance, isHeadshot flag, and HitLocation ('head', 'torso', 'arms', 'legs').
   */
  public testRayHit(
    rayOrigin: THREE.Vector3,
    rayDir: THREE.Vector3,
    maxDist: number
  ): ZombieRayHitResult | null {
    if (this.isDead) return null;

    const zPos = this.group.position;
    const hitbox = this.hitbox;

    // 1. Head Sphere Collision Test
    const headRadius = hitbox.headRadius + hitbox.bulletTolerance;
    const headRadiusSq = headRadius * headRadius;
    const headCenterX = zPos.x;
    const headCenterY = zPos.y + hitbox.headCenterY;
    const headCenterZ = zPos.z;

    const vHeadX = headCenterX - rayOrigin.x;
    const vHeadY = headCenterY - rayOrigin.y;
    const vHeadZ = headCenterZ - rayOrigin.z;

    const tProjHead = vHeadX * rayDir.x + vHeadY * rayDir.y + vHeadZ * rayDir.z;
    let headHit: ZombieRayHitResult | null = null;

    if (tProjHead > 0 && tProjHead <= maxDist + headRadius) {
      const dSq = (vHeadX * vHeadX + vHeadY * vHeadY + vHeadZ * vHeadZ) - (tProjHead * tProjHead);
      if (dSq <= headRadiusSq) {
        const offset = Math.sqrt(Math.max(0, headRadiusSq - dSq));
        const tHit = Math.max(0.01, tProjHead - offset);
        if (tHit <= maxDist) {
          headHit = {
            hitPoint: new THREE.Vector3(
              rayOrigin.x + rayDir.x * tHit,
              rayOrigin.y + rayDir.y * tHit,
              rayOrigin.z + rayDir.z * tHit
            ),
            distance: tHit,
            isHeadshot: true,
            hitLocation: 'head'
          };
        }
      }
    }

    // 2. Body Cylinder/Capsule Collision Test (covers legs, torso, and shoulders up to neck)
    const bodyRadius = hitbox.bodyRadius + hitbox.bulletTolerance;
    const bodyRadiusSq = bodyRadius * bodyRadius;
    const yMin = zPos.y - 0.05;
    const yMax = zPos.y + (hitbox.headCenterY - hitbox.headRadius * 0.35);

    let bodyHit: ZombieRayHitResult | null = null;

    const ox = rayOrigin.x - zPos.x;
    const oz = rayOrigin.z - zPos.z;
    const dx = rayDir.x;
    const dz = rayDir.z;

    const a = dx * dx + dz * dz;
    const b = 2 * (ox * dx + oz * dz);
    const c = ox * ox + oz * oz - bodyRadiusSq;

    if (c <= 0 && rayOrigin.y >= yMin && rayOrigin.y <= yMax) {
      // Point-blank shot with muzzle inside or touching cylinder
      const hitY = rayOrigin.y;
      const hitFraction = (hitY - zPos.y) / hitbox.bodyHeight;
      const isHead = hitFraction >= 0.72;
      const hitLoc: HitLocation = isHead ? 'head' : hitFraction < 0.38 ? 'legs' : 'torso';

      bodyHit = {
        hitPoint: new THREE.Vector3(
          rayOrigin.x + rayDir.x * 0.05,
          rayOrigin.y + rayDir.y * 0.05,
          rayOrigin.z + rayDir.z * 0.05
        ),
        distance: 0.05,
        isHeadshot: isHead,
        hitLocation: hitLoc
      };
    } else if (a > 0.000001) {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);

        for (const t of [t1, t2]) {
          if (t > 0 && t <= maxDist) {
            const hitY = rayOrigin.y + t * rayDir.y;
            if (hitY >= yMin && hitY <= yMax) {
              const hitX = rayOrigin.x + t * dx;
              const hitZ = rayOrigin.z + t * dz;
              const hitFraction = (hitY - zPos.y) / hitbox.bodyHeight;

              let hitLoc: HitLocation;
              let isHead = false;

              if (hitFraction >= 0.72) {
                hitLoc = 'head';
                isHead = true;
              } else if (hitFraction < 0.38) {
                hitLoc = 'legs';
              } else {
                // Perpendicular distance of ray path from vertical axis
                const rayLenXZ = Math.sqrt(dx * dx + dz * dz);
                const perpDist = rayLenXZ > 0.0001 ? Math.abs(ox * dz - oz * dx) / rayLenXZ : 0;
                if (perpDist > hitbox.bodyRadius * 0.65) {
                  hitLoc = 'arms';
                } else {
                  hitLoc = 'torso';
                }
              }

              bodyHit = {
                hitPoint: new THREE.Vector3(hitX, hitY, hitZ),
                distance: t,
                isHeadshot: isHead,
                hitLocation: hitLoc
              };
              break;
            }
          }
        }
      }
    }

    // Return the closest hit (giving priority to headshot if head sphere was pierced)
    if (headHit && bodyHit) {
      if (headHit.distance <= bodyHit.distance + 0.35) {
        return headHit;
      }
      return bodyHit;
    }
    return headHit || bodyHit || null;
  }

  /**
   * Tests a melee weapon sweep against this zombie's body radius and melee tolerance.
   * Accounts for horizontal distance, vertical height span, and forward swing arc.
   */
  public testMeleeSweep(
    sweepOrigin: THREE.Vector3,
    forwardDir: THREE.Vector3,
    range: number,
    angleSpreadRad: number
  ): ZombieMeleeHitResult | null {
    if (this.isDead) return null;

    const zPos = this.group.position;
    const hitbox = this.hitbox;

    // 1. Vertical reach check
    const yMin = zPos.y - 0.45;
    const yMax = zPos.y + hitbox.bodyHeight + 0.45;
    if (sweepOrigin.y < yMin || sweepOrigin.y > yMax) {
      return null;
    }

    // 2. Horizontal distance check with melee tolerance
    const dx = zPos.x - sweepOrigin.x;
    const dz = zPos.z - sweepOrigin.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const effectiveReach = range + hitbox.bodyRadius + hitbox.meleeTolerance;

    if (dist > effectiveReach) {
      return null;
    }

    // 3. Direction and angle sweep check
    // If player is extremely close (<= 0.35m), auto-pass angle check for point-blank contact
    if (dist > 0.35) {
      const dirX = dx / dist;
      const dirZ = dz / dist;

      const fwdLen = Math.sqrt(forwardDir.x * forwardDir.x + forwardDir.z * forwardDir.z);
      if (fwdLen > 0.0001) {
        const fwdX = forwardDir.x / fwdLen;
        const fwdZ = forwardDir.z / fwdLen;

        const dot = Math.max(-1, Math.min(1, fwdX * dirX + fwdZ * dirZ));
        const angle = Math.acos(dot);
        if (angle > angleSpreadRad) {
          return null;
        }
      }
    }

    // Contact point at chest height between player and zombie
    const contactDist = Math.max(0.1, dist - hitbox.bodyRadius);
    const contactRatio = dist > 0.001 ? Math.min(1.0, contactDist / dist) : 0;
    const hitPoint = new THREE.Vector3(
      sweepOrigin.x + dx * contactRatio,
      Math.max(zPos.y + 0.6, Math.min(zPos.y + hitbox.bodyHeight * 0.75, sweepOrigin.y)),
      sweepOrigin.z + dz * contactRatio
    );

    return {
      hitPoint,
      distance: dist,
      hitLocation: 'torso'
    };
  }

  public getForwardVector(): THREE.Vector3 {
    ZombieAI._scratchForward.set(0, 0, 1).applyEuler(this.group.rotation);
    return ZombieAI._scratchForward.normalize();
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    onAttackPlayer: (dmg: number) => void,
    hasLineOfSight?: (from: THREE.Vector3, to: THREE.Vector3) => boolean,
    _camera?: THREE.Camera,
    isPlayerDead: boolean = false
  ): void {
    if (this.isDead) return;

    const distToPlayer = this.group.position.distanceTo(playerPos);
    this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    this.updateFrameCounter++;

    // 3D Billboard Blood Sprite visibility
    if (this.bloodSprite) {
      this.bloodSprite.visible = !this.isDead && distToPlayer <= 25;
    }

    // Multi-tier distance optimization:
    // Distant zombies (> 35m) only run AI every 12th frame (~5Hz)
    if (distToPlayer > 35 && this.updateFrameCounter % 12 !== 0) {
      return;
    }
    // Mid-distance zombies (15m - 35m) run AI every 3rd frame (~20Hz)
    if (distToPlayer > 15 && distToPlayer <= 35 && this.updateFrameCounter % 3 !== 0) {
      // Step movement forward if chasing
      if (this.state === 'chase' && !isPlayerDead) {
        this.moveTo(playerPos, this.config.runSpeed, dt);
      }
      return;
    }

    const canSeePlayer = (): boolean => {
      if (!hasLineOfSight) return true;
      // Raycast to player's center/chest (Y + 1.2m), matching eye level
      ZombieAI._scratchAimDir.copy(playerPos);
      ZombieAI._scratchAimDir.y += 1.2;
      return hasLineOfSight(this.getEyePosition(), ZombieAI._scratchAimDir);
    };

    // 1. Perception & State Evaluation (Near or Scheduled frame)
    switch (this.state) {
      case 'idle':
        this.stateTimer -= dt;
        if (!isPlayerDead && distToPlayer <= this.config.detectionRadius && canSeePlayer()) {
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
        if (!isPlayerDead && distToPlayer <= this.config.detectionRadius && canSeePlayer()) {
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
        if (!isPlayerDead && distToPlayer <= this.config.detectionRadius && canSeePlayer()) {
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
        if (isPlayerDead) {
          this.state = 'idle';
          this.stateTimer = 3.0;
          break;
        }

        if (distToPlayer <= this.config.attackRange) {
          if (this.attackCooldownTimer <= 0) {
            this.state = 'attack';
            this.stateTimer = 0.9;
            this.hasDealtAttackDamage = false;
            this.eventBus.emit('audio:play_sfx', { sound: 'zombie_attack', volume: 0.85 });
            if (this.animationController) {
              this.animationController.triggerAttack();
            }
          } else {
            this.lookAt(playerPos);
          }
        } else if (distToPlayer > this.config.detectionRadius * 2.2) {
          this.state = 'idle';
          this.stateTimer = 4.0;
        } else {
          this.moveTo(playerPos, this.config.runSpeed, dt);
        }
        break;

      case 'attack':
        if (isPlayerDead) {
          this.state = 'idle';
          this.stateTimer = 3.0;
          break;
        }

        this.stateTimer -= dt;
        this.lookAt(playerPos);

        if (this.animationController) {
          this.animationController.triggerAttack();
        }

        // Apply attack damage once per swing if cooldown is ready and player is within reach
        if (this.attackCooldownTimer <= 0 && !this.hasDealtAttackDamage) {
          if (distToPlayer <= this.config.attackRange + 0.6 && canSeePlayer()) {
            this.hasDealtAttackDamage = true;
            this.attackCooldownTimer = this.config.attackCooldown;
            onAttackPlayer(this.config.attackDamage);
            this.eventBus.emit('audio:play_sfx', { sound: 'zombie_attack', volume: 0.95 });
          }
        }

        if (this.stateTimer <= 0) {
          this.hasDealtAttackDamage = false;
          if (distToPlayer <= this.config.attackRange && this.attackCooldownTimer <= 0) {
            this.state = 'attack';
            this.stateTimer = 0.9;
            if (this.animationController) {
              this.animationController.triggerAttack();
            }
          } else {
            this.state = 'chase';
            this.stateTimer = 0;
          }
        }
        break;
    }

    // 2. Animate Limbs or Skeletal Controller
    if (this.animationController) {
      if (this.state === 'attack') {
        this.animationController.triggerAttack();
      } else if (this.state === 'chase') {
        this.animationController.playLocomotion('run');
      } else if (this.state === 'patrol' || this.state === 'investigate') {
        this.animationController.playLocomotion('walk');
      } else {
        this.animationController.playLocomotion('idle');
      }
      this.animationController.update(dt);
    } else if (distToPlayer <= 32) {
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
    if (this.bloodSprite.parent) {
      this.bloodSprite.parent.remove(this.bloodSprite);
    }
    this.bloodTexture.dispose();
    this.spriteMaterial.dispose();

    if (this.animationController) {
      this.animationController.dispose();
      this.animationController = null;
    }
    if (this.skeletalModel && this.skeletalModel.parent) {
      this.skeletalModel.parent.remove(this.skeletalModel);
      this.skeletalModel = null;
    }
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
