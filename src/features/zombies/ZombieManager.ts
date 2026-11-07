import * as THREE from 'three';
import { ZombieAI } from './ai/ZombieAI';
import { ZombieVariantType } from '@/shared/types';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';

export interface ZombieRayHit {
  zombie: ZombieAI;
  hitPoint: THREE.Vector3;
  distance: number;
  isHeadshot: boolean;
}

export class ZombieManager {
  private zombies: ZombieAI[] = [];
  private scene: THREE.Scene;
  private survivalSystem: SurvivalSystem;
  private nextId: number = 1;

  constructor(scene: THREE.Scene, survivalSystem: SurvivalSystem) {
    this.scene = scene;
    this.survivalSystem = survivalSystem;
  }

  public spawnZombie(variant: ZombieVariantType, position: THREE.Vector3): ZombieAI {
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
      // Test cylinder/sphere intersection
      const toZombie = zPos.clone().add(new THREE.Vector3(0, 0.9, 0)).sub(rayOrigin);
      const proj = toZombie.dot(rayDir);

      if (proj > 0 && proj < closestDist) {
        const closestPointOnRay = rayOrigin.clone().add(rayDir.clone().multiplyScalar(proj));
        const lateralDist = closestPointOnRay.distanceTo(zPos.clone().add(new THREE.Vector3(0, 0.9, 0)));

        if (lateralDist <= zombie.hitRadius + 0.3) {
          const hitPoint = closestPointOnRay;
          const hitHeightOnZombie = hitPoint.y - zPos.y;
          // Headshot if hit in top 25% of height
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
      const toZombie = zPos.clone().sub(sweepOrigin);
      toZombie.y = 0;
      const dist = toZombie.length();

      if (dist <= range + zombie.hitRadius) {
        toZombie.normalize();
        const angle = forwardDir.angleTo(toZombie);

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

  public update(dt: number, playerPos: THREE.Vector3): void {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const zombie = this.zombies[i];
      const dist = zombie.getPosition().distanceTo(playerPos);

      // Distance-based optimization:
      // If very far (> 60m), skip processing to save frame time
      if (dist > 60) continue;

      zombie.update(dt, playerPos, (dmg) => {
        this.survivalSystem.damage(dmg, zombie.config.name);
      });
    }
  }

  public dispose(): void {
    for (const z of this.zombies) {
      z.dispose();
    }
    this.zombies = [];
  }
}
