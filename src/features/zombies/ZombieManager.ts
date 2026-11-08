import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { ZombieAI } from './ai/ZombieAI';
import { ZombieVariantType } from '@/shared/types';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';
import { PerformanceManager } from '@/core/performance/PerformanceManager';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { HitLocation } from '@/data/combat';
import { ZombieAssetPool } from './ZombieAnimationController';

export interface ZombieRayHit {
  zombie: ZombieAI;
  hitPoint: THREE.Vector3;
  distance: number;
  isHeadshot: boolean;
  hitLocation: HitLocation;
}

export interface ZombieMeleeHit {
  zombie: ZombieAI;
  hitPoint: THREE.Vector3;
  hitLocation: HitLocation;
}

export class ZombieManager {
  private zombies: ZombieAI[] = [];
  private zombiePool: Map<ZombieVariantType, ZombieAI[]> = new Map();
  private scene: THREE.Scene;
  private survivalSystem: SurvivalSystem;
  private physicsWorld: PhysicsWorld | null = null;
  private playerBody?: RAPIER.RigidBody;
  private playerCollider?: RAPIER.Collider;
  private nextId: number = 1;

  // Scratch vectors to eliminate GC in hit detection
  private static readonly _scratchToZombie: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchRayDir: THREE.Vector3 = new THREE.Vector3();

  constructor(scene: THREE.Scene, survivalSystem: SurvivalSystem, physicsWorld?: PhysicsWorld) {
    this.scene = scene;
    this.survivalSystem = survivalSystem;
    this.physicsWorld = physicsWorld || null;

    // Asynchronously preload 3D rigged zombie humanoid and animations
    ZombieAssetPool.getInstance().preload().catch(() => {});
  }

  public setPhysicsWorld(world: PhysicsWorld): void {
    this.physicsWorld = world;
  }

  public spawnZombie(variant: ZombieVariantType, position: THREE.Vector3): ZombieAI | null {
    const maxAllowed = PerformanceManager.getInstance().getConfig().maxActiveZombies;
    const activeCount = this.zombies.filter((z) => !z.isDead).length;

    // Respect graphics profile zombie population cap
    if (activeCount >= maxAllowed) {
      return null;
    }

    // 1. Check object pool for recyclable zombie
    const pool = this.zombiePool.get(variant);
    if (pool && pool.length > 0) {
      const recycledZombie = pool.pop()!;
      recycledZombie.reset(position);
      this.zombies.push(recycledZombie);
      return recycledZombie;
    }

    // 2. Otherwise instantiate new zombie
    const id = `zombie_${this.nextId++}`;
    const zombie = new ZombieAI(id, variant, position, this.scene);
    this.zombies.push(zombie);
    return zombie;
  }

  public getZombies(): ZombieAI[] {
    return this.zombies;
  }

  public alertNearbyZombies(noisePos: THREE.Vector3, intensity: number): void {
    for (const z of this.zombies) {
      z.alertToNoise(noisePos, intensity);
    }
  }

  public checkRayHit(
    rayOrigin: THREE.Vector3,
    rayDir: THREE.Vector3,
    maxDist: number,
    camOrigin?: THREE.Vector3,
    camDir?: THREE.Vector3
  ): ZombieRayHit | null {
    let closestHit: ZombieRayHit | null = null;
    let closestDist = maxDist;

    for (const zombie of this.zombies) {
      if (zombie.isDead) continue;

      // 1. If camera crosshair ray is available, test whether crosshair aligns with zombie hitbox
      let candidate = camOrigin && camDir ? zombie.testRayHit(camOrigin, camDir, maxDist) : null;

      // 2. If camera ray missed or not provided, test direct ray from rayOrigin (muzzle/player)
      if (!candidate) {
        candidate = zombie.testRayHit(rayOrigin, rayDir, maxDist);
      }

      if (candidate) {
        // Line-of-sight / wall obstruction verification from player rayOrigin to hitPoint
        if (this.physicsWorld) {
          ZombieManager._scratchRayDir.subVectors(candidate.hitPoint, rayOrigin);
          const distToHit = ZombieManager._scratchRayDir.length();
          if (distToHit > 0.05) {
            ZombieManager._scratchRayDir.divideScalar(distToHit);
            const wallHit = this.physicsWorld.raycast(rayOrigin, ZombieManager._scratchRayDir, distToHit, true);
            const isPlayer = !!(
              (this.playerBody && wallHit?.rigidBody === this.playerBody) ||
              (this.playerCollider && wallHit?.collider === this.playerCollider)
            );
            if (wallHit && !isPlayer && wallHit.distance > 0.45 && wallHit.distance < distToHit - 0.25) {
              // Obstructed by solid environment obstacle
              continue;
            }
          }
        }

        const effectiveDist = rayOrigin.distanceTo(candidate.hitPoint);
        if (effectiveDist < closestDist) {
          closestDist = effectiveDist;
          closestHit = {
            zombie,
            hitPoint: candidate.hitPoint,
            distance: candidate.distance,
            isHeadshot: candidate.isHeadshot,
            hitLocation: candidate.hitLocation
          };
        }
      }
    }

    return closestHit;
  }

  public checkMeleeSweep(
    sweepOrigin: THREE.Vector3,
    forwardDir: THREE.Vector3,
    range: number,
    angleSpreadRad: number
  ): ZombieMeleeHit | null {
    let closest: { zombie: ZombieAI; hitPoint: THREE.Vector3; dist: number; hitLocation: HitLocation } | null = null;

    for (const zombie of this.zombies) {
      if (zombie.isDead) continue;

      const hit = zombie.testMeleeSweep(sweepOrigin, forwardDir, range, angleSpreadRad);
      if (hit) {
        // Line-of-sight check between sweep origin and zombie hit point
        if (this.physicsWorld) {
          ZombieManager._scratchToZombie.subVectors(hit.hitPoint, sweepOrigin);
          const distToPoint = ZombieManager._scratchToZombie.length();
          if (distToPoint > 0.05) {
            ZombieManager._scratchToZombie.divideScalar(distToPoint);
            const wallHit = this.physicsWorld.raycast(sweepOrigin, ZombieManager._scratchToZombie, distToPoint, true);
            const isPlayer = !!(
              (this.playerBody && wallHit?.rigidBody === this.playerBody) ||
              (this.playerCollider && wallHit?.collider === this.playerCollider)
            );
            if (wallHit && !isPlayer && wallHit.distance > 0.45 && wallHit.distance < distToPoint - 0.25) {
              // Blocked by wall
              continue;
            }
          }
        }

        if (!closest || hit.distance < closest.dist) {
          closest = {
            zombie,
            hitPoint: hit.hitPoint,
            dist: hit.distance,
            hitLocation: hit.hitLocation
          };
        }
      }
    }

    return closest ? { zombie: closest.zombie, hitPoint: closest.hitPoint, hitLocation: closest.hitLocation } : null;
  }

  public setPlayer(player: { rigidBody?: RAPIER.RigidBody; collider?: RAPIER.Collider }): void {
    this.playerBody = player.rigidBody;
    this.playerCollider = player.collider;
  }

  public hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    if (!this.physicsWorld) return true;

    ZombieManager._scratchRayDir.subVectors(to, from);
    const dist = ZombieManager._scratchRayDir.length();
    if (dist < 0.1) return true;
    ZombieManager._scratchRayDir.divideScalar(dist);

    const hit = this.physicsWorld.raycast(from, ZombieManager._scratchRayDir, dist, true);
    if (!hit) return true;

    // If the ray directly hit the player's own physics body or collider, line of sight is clear
    if (this.playerBody && hit.rigidBody === this.playerBody) return true;
    if (this.playerCollider && hit.collider === this.playerCollider) return true;

    // If raycast hit an obstacle closer than the target player (with margin for player capsule radius)
    if (hit.distance < dist - 0.75) {
      return false;
    }
    return true;
  }

  public update(dt: number, playerPos: THREE.Vector3, camera?: THREE.Camera, isPlayerDead: boolean = false): void {
    const boundLos = this.physicsWorld ? this.hasLineOfSight.bind(this) : undefined;

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const zombie = this.zombies[i];
      const dist = zombie.getPosition().distanceTo(playerPos);

      // Distant culling optimization: Skip processing if beyond 55m
      if (dist > 55) continue;

      zombie.update(
        dt,
        playerPos,
        (dmg) => {
          this.survivalSystem.damage(dmg, zombie.config.name, true);
        },
        boundLos,
        camera,
        isPlayerDead
      );
    }
  }

  public recycleZombie(zombie: ZombieAI): void {
    const idx = this.zombies.indexOf(zombie);
    if (idx !== -1) {
      this.zombies.splice(idx, 1);
    }
    if (!this.zombiePool.has(zombie.variant)) {
      this.zombiePool.set(zombie.variant, []);
    }
    this.zombiePool.get(zombie.variant)!.push(zombie);
  }

  public dispose(): void {
    for (const z of this.zombies) {
      z.dispose();
    }
    this.zombies = [];
    this.zombiePool.forEach((pool) => {
      pool.forEach((z) => z.dispose());
    });
    this.zombiePool.clear();
  }
}
