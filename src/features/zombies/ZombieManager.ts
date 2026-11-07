import * as THREE from 'three';
import { ZombieAI } from './ai/ZombieAI';
import { ZombieVariantType } from '@/shared/types';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';
import { PerformanceManager } from '@/core/performance/PerformanceManager';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';

export interface ZombieRayHit {
  zombie: ZombieAI;
  hitPoint: THREE.Vector3;
  distance: number;
  isHeadshot: boolean;
}

export class ZombieManager {
  private zombies: ZombieAI[] = [];
  private zombiePool: Map<ZombieVariantType, ZombieAI[]> = new Map();
  private scene: THREE.Scene;
  private survivalSystem: SurvivalSystem;
  private physicsWorld: PhysicsWorld | null = null;
  private nextId: number = 1;

  // Scratch vectors to eliminate GC in hit detection
  private static readonly _scratchToZombie: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchRayPoint: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchZombiePos: THREE.Vector3 = new THREE.Vector3();
  private static readonly _scratchRayDir: THREE.Vector3 = new THREE.Vector3();

  constructor(scene: THREE.Scene, survivalSystem: SurvivalSystem, physicsWorld?: PhysicsWorld) {
    this.scene = scene;
    this.survivalSystem = survivalSystem;
    this.physicsWorld = physicsWorld || null;
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

  public checkRayHit(rayOrigin: THREE.Vector3, rayDir: THREE.Vector3, maxDist: number): ZombieRayHit | null {
    let closestHit: ZombieRayHit | null = null;
    let closestDist = maxDist;

    for (const zombie of this.zombies) {
      if (zombie.isDead) continue;

      const zPos = zombie.getPosition();
      ZombieManager._scratchZombiePos.copy(zPos).add(new THREE.Vector3(0, 0.9, 0));
      ZombieManager._scratchToZombie.subVectors(ZombieManager._scratchZombiePos, rayOrigin);

      const proj = ZombieManager._scratchToZombie.dot(rayDir);

      if (proj > 0 && proj < closestDist) {
        ZombieManager._scratchRayPoint.copy(rayOrigin).addScaledVector(rayDir, proj);
        const lateralDist = ZombieManager._scratchRayPoint.distanceTo(ZombieManager._scratchZombiePos);

        if (lateralDist <= zombie.hitRadius + 0.3) {
          const hitPoint = ZombieManager._scratchRayPoint.clone();
          const hitHeightOnZombie = hitPoint.y - zPos.y;
          const isHeadshot = hitHeightOnZombie >= zombie.hitHeight * 0.72;

          closestDist = proj;
          closestHit = {
            zombie,
            hitPoint,
            distance: proj,
            isHeadshot
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
  ): { zombie: ZombieAI; hitPoint: THREE.Vector3 } | null {
    let closest: { zombie: ZombieAI; hitPoint: THREE.Vector3; dist: number } | null = null;

    for (const zombie of this.zombies) {
      if (zombie.isDead) continue;

      const zPos = zombie.getPosition();
      ZombieManager._scratchToZombie.subVectors(zPos, sweepOrigin);
      ZombieManager._scratchToZombie.y = 0;
      const dist = ZombieManager._scratchToZombie.length();

      if (dist <= range + zombie.hitRadius) {
        ZombieManager._scratchToZombie.divideScalar(dist);
        const angle = forwardDir.angleTo(ZombieManager._scratchToZombie);

        if (angle <= angleSpreadRad) {
          if (!closest || dist < closest.dist) {
            closest = {
              zombie,
              hitPoint: zPos.clone().add(new THREE.Vector3(0, 1.2, 0)),
              dist
            };
          }
        }
      }
    }

    return closest ? { zombie: closest.zombie, hitPoint: closest.hitPoint } : null;
  }

  public hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    if (!this.physicsWorld) return true;

    ZombieManager._scratchRayDir.subVectors(to, from);
    const dist = ZombieManager._scratchRayDir.length();
    if (dist < 0.1) return true;
    ZombieManager._scratchRayDir.divideScalar(dist);

    const hit = this.physicsWorld.raycast(from, ZombieManager._scratchRayDir, dist, true);
    // If raycast hit something solid closer than the target, line of sight is obstructed
    if (hit && hit.distance < dist - 0.4) {
      return false;
    }
    return true;
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
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
          this.survivalSystem.damage(dmg, zombie.config.name);
        },
        boundLos
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
