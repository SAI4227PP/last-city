import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ZombieManager } from '@/features/zombies/ZombieManager';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';

describe('Zombie Hitbox Dimensions, Raycast & Melee Detection Suite', () => {
  let scene: THREE.Scene;
  let survival: SurvivalSystem;
  let zombieManager: ZombieManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    survival = new SurvivalSystem();
    zombieManager = new ZombieManager(scene, survival);
  });

  // 1. Configured Hitbox Dimensions per Variant
  it('1. configures unique, appropriately scaled hitboxes for all 5 zombie variants', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;
    const runner = zombieManager.spawnZombie('runner', new THREE.Vector3(5, 0, 5))!;
    const brute = zombieManager.spawnZombie('brute', new THREE.Vector3(10, 0, 5))!;
    const spitter = zombieManager.spawnZombie('spitter', new THREE.Vector3(15, 0, 5))!;
    const boss = zombieManager.spawnZombie('boss', new THREE.Vector3(20, 0, 5))!;

    // Walker (humanoid baseline)
    expect(walker.hitbox.bodyRadius).toBe(0.44);
    expect(walker.hitbox.bodyHeight).toBe(1.85);
    expect(walker.hitbox.headRadius).toBe(0.24);
    expect(walker.hitbox.headCenterY).toBe(1.62);

    // Runner (slender, agile humanoid)
    expect(runner.hitbox.bodyRadius).toBe(0.38);
    expect(runner.hitbox.bodyHeight).toBe(1.75);
    expect(runner.hitbox.headRadius).toBe(0.20);
    expect(runner.hitbox.headCenterY).toBe(1.50);

    // Brute (heavy, bulky tank)
    expect(brute.hitbox.bodyRadius).toBe(0.72);
    expect(brute.hitbox.bodyHeight).toBe(2.50);
    expect(brute.hitbox.headRadius).toBe(0.34);
    expect(brute.hitbox.headCenterY).toBe(2.18);

    // Spitter (stalker)
    expect(spitter.hitbox.bodyRadius).toBe(0.46);
    expect(spitter.hitbox.bodyHeight).toBe(1.85);
    expect(spitter.hitbox.headRadius).toBe(0.24);

    // Boss (massive abomination)
    expect(boss.hitbox.bodyRadius).toBe(0.98);
    expect(boss.hitbox.bodyHeight).toBe(3.25);
    expect(boss.hitbox.headRadius).toBe(0.44);
    expect(boss.hitbox.headCenterY).toBe(2.85);

    // Larger variants have larger hitboxes than standard walker
    expect(brute.hitbox.bodyRadius).toBeGreaterThan(walker.hitbox.bodyRadius);
    expect(boss.hitbox.bodyRadius).toBeGreaterThan(brute.hitbox.bodyRadius);
    expect(boss.hitbox.bodyHeight).toBeGreaterThan(walker.hitbox.bodyHeight);
  });

  // 2. Headshot Precision & Head Sphere Hitbox
  it('2. accurately registers headshots when aiming at the head sphere volume', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;

    // Ray aimed directly at head center height (y = 1.62)
    const rayOrigin = new THREE.Vector3(0, 1.62, 0);
    const rayDir = new THREE.Vector3(0, 0, 1);

    const hit = walker.testRayHit(rayOrigin, rayDir, 20);
    expect(hit).not.toBeNull();
    expect(hit!.isHeadshot).toBe(true);
    expect(hit!.hitLocation).toBe('head');
    expect(hit!.distance).toBeCloseTo(5 - (walker.hitbox.headRadius + walker.hitbox.bulletTolerance), 1);
  });

  // 3. Torso Center Hit
  it('3. registers torso hit when aiming at chest height', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;

    // Ray aimed at chest level (y = 1.1)
    const rayOrigin = new THREE.Vector3(0, 1.1, 0);
    const rayDir = new THREE.Vector3(0, 0, 1);

    const hit = walker.testRayHit(rayOrigin, rayDir, 20);
    expect(hit).not.toBeNull();
    expect(hit!.isHeadshot).toBe(false);
    expect(hit!.hitLocation).toBe('torso');
    expect(hit!.distance).toBeCloseTo(5 - (walker.hitbox.bodyRadius + walker.hitbox.bulletTolerance), 1);
  });

  // 4. Leg Hit
  it('4. registers leg hit when aiming at lower body', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;

    // Ray aimed at shin/ankle level (y = 0.35)
    const rayOrigin = new THREE.Vector3(0, 0.35, 0);
    const rayDir = new THREE.Vector3(0, 0, 1);

    const hit = walker.testRayHit(rayOrigin, rayDir, 20);
    expect(hit).not.toBeNull();
    expect(hit!.isHeadshot).toBe(false);
    expect(hit!.hitLocation).toBe('legs');
  });

  // 5. Arm Hit on Lateral Silhouette
  it('5. registers arm hit on lateral edge of body cylinder', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;

    // Ray offset horizontally to outer shoulder/arm (x = 0.38)
    const rayOrigin = new THREE.Vector3(0.38, 1.25, 0);
    const rayDir = new THREE.Vector3(0, 0, 1);

    const hit = walker.testRayHit(rayOrigin, rayDir, 20);
    expect(hit).not.toBeNull();
    expect(hit!.hitLocation).toBe('arms');
  });

  // 6. Bullet Tolerance Buffer
  it('6. connects near-miss shots within bulletTolerance margin without phantom hits', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;

    // Body radius is 0.44. Tolerance is 0.12. Outer bound is 0.56m.
    // Ray passing at x = 0.50m (inside tolerance) should connect:
    const rayOriginClose = new THREE.Vector3(0.50, 1.2, 0);
    const rayDir = new THREE.Vector3(0, 0, 1);
    const hitClose = walker.testRayHit(rayOriginClose, rayDir, 20);
    expect(hitClose).not.toBeNull();

    // Ray passing at x = 0.70m (outside tolerance) should cleanly miss:
    const rayOriginFar = new THREE.Vector3(0.70, 1.2, 0);
    const hitFar = walker.testRayHit(rayOriginFar, rayDir, 20);
    expect(hitFar).toBeNull();
  });

  // 7. Point-Blank Range Shooting
  it('7. registers point-blank shots when muzzle is directly touching or inside cylinder', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 1.0))!;

    // Ray origin right in front of chest (z = 0.85, distance 0.15m)
    const rayOrigin = new THREE.Vector3(0, 1.2, 0.85);
    const rayDir = new THREE.Vector3(0, 0, 1);

    const hit = walker.testRayHit(rayOrigin, rayDir, 10);
    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeLessThanOrEqual(0.15);
  });

  // 8. Melee Sweep Hit Detection with Tolerance
  it('8. registers melee swing within weapon range plus body radius and tolerance', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 2.2))!;

    const swingOrigin = new THREE.Vector3(0, 1.3, 0);
    const forwardDir = new THREE.Vector3(0, 0, 1);

    // Knife range is 2.0m. Effective reach = 2.0 + 0.44 + 0.25 = 2.69m.
    // Walker at 2.2m is within effective reach:
    const hit = walker.testMeleeSweep(swingOrigin, forwardDir, 2.0, 1.6);
    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeCloseTo(2.2, 1);
    expect(hit!.hitLocation).toBe('torso');
  });

  // 9. Melee Sweep Range and Angle Limits
  it('9. misses melee sweep when zombie is beyond range or outside forward arc', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 3.5))!;

    const swingOrigin = new THREE.Vector3(0, 1.3, 0);
    const forwardDir = new THREE.Vector3(0, 0, 1);

    // Beyond range (3.5m > 2.69m reach)
    const hitOutOfRange = walker.testMeleeSweep(swingOrigin, forwardDir, 2.0, 1.6);
    expect(hitOutOfRange).toBeNull();

    // In range (1.5m), but directly behind the player (angle = 180 deg)
    walker.group.position.set(0, 0, -1.5);
    const hitBehind = walker.testMeleeSweep(swingOrigin, forwardDir, 2.0, 1.2);
    expect(hitBehind).toBeNull();
  });

  // 10. Melee Point-Blank Proximity Auto-Pass
  it('10. guarantees melee hit when player and zombie are in point-blank contact range', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0.1, 0, 0.2))!;

    const swingOrigin = new THREE.Vector3(0, 1.3, 0);
    const forwardDir = new THREE.Vector3(0, 0, 1);

    // Distance is ~0.22m (touching range)
    const hit = walker.testMeleeSweep(swingOrigin, forwardDir, 2.0, 1.0);
    expect(hit).not.toBeNull();
  });

  // 11. Melee Vertical Span Check
  it('11. prevents melee hits when zombie is vertically out of reach (too high or too low)', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 5.0, 1.5))!; // 5 meters up

    const swingOrigin = new THREE.Vector3(0, 1.3, 0);
    const forwardDir = new THREE.Vector3(0, 0, 1);

    const hit = walker.testMeleeSweep(swingOrigin, forwardDir, 2.0, 1.6);
    expect(hit).toBeNull();
  });

  // 12. Wall Obstruction Checks for Firearms & Melee
  it('12. ensures solid environmental walls block both firearm rays and melee sweeps', () => {
    const zombie = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 6))!;

    // Mock physics world with walls
    const mockPhysicsWorld = {
      raycast: (_origin: THREE.Vector3, _dir: THREE.Vector3, maxDist: number) => {
        // For firearm ray (maxDist >= 5.0), wall is at 3.0m
        if (maxDist >= 5.0) {
          return {
            distance: 3.0,
            point: new THREE.Vector3(0, 1.3, 3.0),
            collider: {},
            rigidBody: {}
          };
        }
        // For melee sweep (maxDist >= 1.0), wall is at 1.0m
        if (maxDist >= 1.0) {
          return {
            distance: 1.0,
            point: new THREE.Vector3(0, 1.3, 1.0),
            collider: {},
            rigidBody: {}
          };
        }
        return null;
      }
    } as any;

    zombieManager.setPhysicsWorld(mockPhysicsWorld);

    // Firearm raycast: zombie is at 6.0m, wall is at 3.0m -> blocked!
    const rayHit = zombieManager.checkRayHit(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, 1), 50);
    expect(rayHit).toBeNull();

    // Melee sweep: move zombie to 2.2m, wall at 1.0m -> blocked!
    zombie.group.position.set(0, 0, 2.2);
    const meleeHit = zombieManager.checkMeleeSweep(new THREE.Vector3(0, 1.3, 0), new THREE.Vector3(0, 0, 1), 2.5, 1.6);
    expect(meleeHit).toBeNull();
  });

  // 13. Crosshair Raycast Tracing Alignment
  it('13. traces hits via third-person camera crosshair ray aligning with screen center', () => {
    const zombie = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;

    // Player muzzle position slightly offset to shoulder
    const muzzleOrigin = new THREE.Vector3(0.4, 1.45, 0);
    const muzzleDir = new THREE.Vector3(0, 0, 1);

    // Camera is over the left shoulder at (-0.45, 1.7, -2.3), crosshair looking directly at zombie head
    const camOrigin = new THREE.Vector3(0, 1.62, -2.3);
    const camDir = new THREE.Vector3(0, 0, 1);

    const hit = zombieManager.checkRayHit(muzzleOrigin, muzzleDir, 50, camOrigin, camDir);
    expect(hit).not.toBeNull();
    expect(hit!.zombie).toBe(zombie);
    expect(hit!.isHeadshot).toBe(true);
    expect(hit!.hitLocation).toBe('head');
  });

  // 14. Dead Zombie Hitbox Inactivation
  it('14. inactivates hitboxes immediately upon zombie death to prevent corpse damage', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 3))!;
    expect(walker.isDead).toBe(false);

    walker.die();
    expect(walker.isDead).toBe(true);
    expect(walker.hitRadius).toBe(0);
    expect(walker.hitHeight).toBe(0);

    const rayHit = walker.testRayHit(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0, 0, 1), 10);
    expect(rayHit).toBeNull();

    const meleeHit = walker.testMeleeSweep(new THREE.Vector3(0, 1.3, 0), new THREE.Vector3(0, 0, 1), 2.0, 1.6);
    expect(meleeHit).toBeNull();
  });
});
