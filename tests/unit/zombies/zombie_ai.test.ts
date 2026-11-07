import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ZombieManager } from '@/features/zombies/ZombieManager';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';

describe('Zombie AI Distance Throttling & Line of Sight Occlusion', () => {
  let scene: THREE.Scene;
  let survival: SurvivalSystem;
  let manager: ZombieManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    survival = new SurvivalSystem();
    manager = new ZombieManager(scene, survival);
  });

  it('zombie throttles update frequency at medium and long distances', () => {
    const nearZombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 8))!;
    const farZombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 42))!;

    const playerPos = new THREE.Vector3(0, 0, 0);

    // Initial states are idle
    expect(nearZombie.state).toBe('idle');
    expect(farZombie.state).toBe('idle');

    // Run near zombie update - near (<15m) evaluates detection on first frame
    nearZombie.update(0.016, playerPos, () => {}, () => true);
    expect(nearZombie.state).toBe('chase');

    // Far zombie (>35m) evaluates only every 12th frame
    (farZombie as any).updateFrameCounter = 1; // Not 12
    farZombie.update(0.016, playerPos, () => {}, () => true);
    expect(farZombie.state).not.toBe('chase'); // Still not chasing because update was throttled

    // Advance to 12th frame
    (farZombie as any).updateFrameCounter = 11;
    farZombie.update(0.016, playerPos, () => {}, () => true);
    // Detection radius for walker is 14m, player is at 42m, so it remains not chasing
    expect(farZombie.state).not.toBe('chase');
  });

  it('zombies do not detect or attack player through solid walls (Line of Sight check)', () => {
    const zombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;
    const playerPos = new THREE.Vector3(0, 0, 0);

    // 1. Solid wall blocks line of sight
    const wallOccluded = () => false;

    zombie.update(0.016, playerPos, () => {}, wallOccluded);

    // Player is within detection radius (5m < 14m), but wall blocks line of sight
    expect(zombie.state).not.toBe('chase');

    // 2. Clear line of sight allows detection
    const clearView = () => true;

    zombie.update(0.016, playerPos, () => {}, clearView);
    expect(zombie.state).toBe('chase');

    // 3. Attack through wall test (place player in attack range: 1.2m away)
    const attackPlayerPos = new THREE.Vector3(0, 0, 3.8); // dist = 1.2m <= attackRange (1.6m)
    zombie.state = 'attack';
    (zombie as any).attackCooldownTimer = 0;
    let attackDamageApplied = 0;

    // Try to attack while wall is in between
    zombie.update(0.016, attackPlayerPos, (dmg) => { attackDamageApplied += dmg; }, wallOccluded);
    expect(attackDamageApplied).toBe(0); // Blocked by wall!

    // Attack with clear line of sight
    (zombie as any).attackCooldownTimer = 0;
    zombie.update(0.016, attackPlayerPos, (dmg) => { attackDamageApplied += dmg; }, clearView);
    expect(attackDamageApplied).toBeGreaterThan(0); // Attack lands!
  });

  it('ZombieManager object pool recycles dormant zombies efficiently', () => {
    const initialZombie = manager.spawnZombie('runner', new THREE.Vector3(10, 0, 10))!;
    expect(manager.getZombies().length).toBe(1);

    // Kill and recycle zombie
    initialZombie.die();
    manager.recycleZombie(initialZombie);
    expect(manager.getZombies().length).toBe(0);

    // Spawning another runner should recycle the existing instance from pool
    const recycledZombie = manager.spawnZombie('runner', new THREE.Vector3(20, 0, 20))!;
    expect(recycledZombie).toBe(initialZombie);
    expect(recycledZombie.isDead).toBe(false);
    expect(recycledZombie.getPosition().x).toBe(20);
    expect(manager.getZombies().length).toBe(1);
  });
});
