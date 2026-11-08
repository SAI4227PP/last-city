import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';
import { ZombieManager } from '@/features/zombies/ZombieManager';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { EventBus } from '@/core/events/EventBus';
import { ZOMBIE_CONFIGS } from '@/data/zombies';

describe('Player Damage & Combat Pipeline Test Suite', () => {
  let physics: PhysicsWorld;
  let survival: SurvivalSystem;
  let manager: ZombieManager;
  let scene: THREE.Scene;

  beforeEach(async () => {
    await PhysicsWorld.init();
    physics = new PhysicsWorld();
    await physics.initWorld();
    scene = new THREE.Scene();
    survival = new SurvivalSystem();
    manager = new ZombieManager(scene, survival, physics);
    useGameUIStore.getState().setShowGameOver(false);
  });

  it('1. verifies ZombieManager.hasLineOfSight detects player collider and body handle', () => {
    const playerMesh = new THREE.Group();
    playerMesh.position.set(0, 0, 1.4);
    const { body, collider } = physics.createDynamicCapsule(
      new THREE.Vector3(0, 0.95, 1.4),
      0.85,
      0.40,
      playerMesh,
      'player'
    );
    physics.step(0.016);

    manager.setPlayer({ rigidBody: body, collider });

    const zombieEye = new THREE.Vector3(0, 1.57, 0);
    const playerChest = new THREE.Vector3(0, 1.2, 1.4);

    const canSee = manager.hasLineOfSight(zombieEye, playerChest);
    expect(canSee).toBe(true);
  });

  it('2. blocks attack when solid wall obstructs line of sight', () => {
    // Wall between zombie (Z=0) and player (Z=3.0)
    physics.createStaticBox(new THREE.Vector3(0, 1.5, 1.5), new THREE.Vector3(5.0, 2.0, 0.15));
    physics.step(0.016);

    const zombieEye = new THREE.Vector3(0, 1.57, 0);
    const playerChest = new THREE.Vector3(0, 1.2, 3.0);

    const canSee = manager.hasLineOfSight(zombieEye, playerChest);
    expect(canSee).toBe(false);
  });

  it('3. applies attack damage at swing apex (~0.4s into swing), not at frame 0', () => {
    const playerPos = new THREE.Vector3(0, 0, 1.2);
    const zombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 0))!;

    expect(survival.getVitals().health).toBe(100);

    // Enter attack state at frame 0 (stateTimer = 0.9s)
    zombie.state = 'attack';
    (zombie as any).stateTimer = 0.9;
    (zombie as any).attackCooldownTimer = 0;
    (zombie as any).hasDealtAttackDamage = false;

    // Step 0.1s: windup phase (stateTimer = 0.8s) -> no damage yet!
    manager.update(0.1, playerPos);
    expect(survival.getVitals().health).toBe(100);
    expect((zombie as any).hasDealtAttackDamage).toBe(false);

    // Step 0.35s: reaches apex (stateTimer = 0.45s <= 0.50s) -> damage lands!
    manager.update(0.35, playerPos);
    expect(survival.getVitals().health).toBe(85); // 100 - 15 = 85
    expect(useGameUIStore.getState().vitals.health).toBe(85);
    expect((zombie as any).hasDealtAttackDamage).toBe(true);

    // Further updates in the same swing must NOT deal damage again
    manager.update(0.1, playerPos);
    expect(survival.getVitals().health).toBe(85);
  });

  it('4. reduces player HP stepwise and clamps at 0 without going negative', () => {
    const playerPos = new THREE.Vector3(0, 0, 1.2);
    const zombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 0))!;

    let currentExpectedHealth = 100;
    const damagePerHit = ZOMBIE_CONFIGS.walker.attackDamage; // 15

    for (let swing = 1; swing <= 7; swing++) {
      zombie.state = 'attack';
      (zombie as any).stateTimer = 0.45; // At apex
      (zombie as any).attackCooldownTimer = 0;
      (zombie as any).hasDealtAttackDamage = false;

      manager.update(0.016, playerPos);

      currentExpectedHealth = Math.max(0, currentExpectedHealth - damagePerHit);
      expect(survival.getVitals().health).toBe(currentExpectedHealth);
      expect(useGameUIStore.getState().vitals.health).toBe(currentExpectedHealth);
    }

    // Health reached 0 (100 -> 85 -> 70 -> 55 -> 40 -> 25 -> 10 -> 0)
    expect(survival.getVitals().health).toBe(0);
    expect(useGameUIStore.getState().vitals.health).toBe(0);

    // Additional hit after 0 does not reduce below 0
    survival.damage(20, 'walker');
    expect(survival.getVitals().health).toBe(0);
  });

  it('5. triggers player death event, shows Game Over screen, and stops zombie attacks', () => {
    let playerDeathFired = false;
    const unsub = EventBus.getInstance().on('player:death', () => {
      playerDeathFired = true;
    });

    const playerPos = new THREE.Vector3(0, 0, 1.2);
    const zombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 0))!;

    // Kill player
    survival.damage(100, 'Infected Shambler');

    expect(playerDeathFired).toBe(true);
    expect(survival.getVitals().health).toBe(0);
    expect(useGameUIStore.getState().showGameOver).toBe(true);
    expect(useGameUIStore.getState().gameOverReason).toContain('Infected Shambler');

    // With isPlayerDead = true, zombie update transitions attack to idle
    zombie.state = 'attack';
    manager.update(0.016, playerPos, undefined, true);

    expect(zombie.state).toBe('idle');

    unsub();
  });

  it('6. starts attack cooldown after swing completes and prevents continuous damage', () => {
    const playerPos = new THREE.Vector3(0, 0, 1.2);
    const zombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 0))!;

    zombie.state = 'attack';
    (zombie as any).stateTimer = 0.01; // Final frame of swing
    (zombie as any).hasDealtAttackDamage = true;

    // Step across the end of swing
    manager.update(0.02, playerPos);

    expect(zombie.state).toBe('chase');
    expect((zombie as any).attackCooldownTimer).toBeCloseTo(ZOMBIE_CONFIGS.walker.attackCooldown, 1);
    expect((zombie as any).hasDealtAttackDamage).toBe(false);
  });

  it('7. multiple zombies can engage and damage player independently', () => {
    const playerPos = new THREE.Vector3(0, 0, 0);
    const z1 = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 1.2))!;
    const z2 = manager.spawnZombie('runner', new THREE.Vector3(1.2, 0, 0))!;

    expect(survival.getVitals().health).toBe(100);

    // Z1 strikes at apex
    z1.state = 'attack';
    (z1 as any).stateTimer = 0.45;
    (z1 as any).hasDealtAttackDamage = false;

    // Z2 is still winding up (stateTimer = 0.85)
    z2.state = 'attack';
    (z2 as any).stateTimer = 0.85;
    (z2 as any).hasDealtAttackDamage = false;

    manager.update(0.016, playerPos);

    // Z1 dealt 15 damage
    expect(survival.getVitals().health).toBe(85);

    // Advance 0.4s: Z2 strikes at apex
    z2.state = 'attack';
    (z2 as any).stateTimer = 0.45;
    (z2 as any).hasDealtAttackDamage = false;

    manager.update(0.016, playerPos);

    // Z2 dealt 12 damage: 85 - 12 = 73
    expect(survival.getVitals().health).toBe(73);
  });
});
