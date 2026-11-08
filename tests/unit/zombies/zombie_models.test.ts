import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ZombieManager } from '@/features/zombies/ZombieManager';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';
import { ZombieAssetPool } from '@/features/zombies/ZombieAnimationController';
import { ZOMBIE_CONFIGS } from '@/data/zombies';

describe('Zombie Model Integration (patient, zombie1, zombie2)', () => {
  let scene: THREE.Scene;
  let survival: SurvivalSystem;
  let manager: ZombieManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    survival = new SurvivalSystem();
    manager = new ZombieManager(scene, survival);
  });

  it('1. configures appropriate default 3D models for all 5 zombie variants based on appearance', () => {
    expect(ZOMBIE_CONFIGS.walker.modelType).toBe('zombie1'); // Decayed civilian infected Shambler
    expect(ZOMBIE_CONFIGS.runner.modelType).toBe('patient'); // Hospital patient agile runner
    expect(ZOMBIE_CONFIGS.brute.modelType).toBe('zombie2');  // Hulking broad-shouldered brute
    expect(ZOMBIE_CONFIGS.spitter.modelType).toBe('zombie1'); // Toxic pustule infected
    expect(ZOMBIE_CONFIGS.boss.modelType).toBe('zombie2');   // Massive apex abomination
  });

  it('2. spawns zombies with their configured default model types', () => {
    const walker = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 0))!;
    const runner = manager.spawnZombie('runner', new THREE.Vector3(5, 0, 0))!;
    const brute = manager.spawnZombie('brute', new THREE.Vector3(10, 0, 0))!;

    expect(walker.modelType).toBe('zombie1');
    expect(runner.modelType).toBe('patient');
    expect(brute.modelType).toBe('zombie2');
  });

  it('3. allows manual model overrides for diverse scene encounters', () => {
    // Spawn walker as patient (e.g. infected patient in hospital corridor)
    const patientWalker = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 5), 'patient')!;
    // Spawn walker as zombie1 (e.g. infected orderly in hospital ward)
    const orderlyWalker = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 10), 'zombie1')!;
    // Spawn runner as zombie2 (heavy mutated runner)
    const heavyRunner = manager.spawnZombie('runner', new THREE.Vector3(0, 0, 15), 'zombie2')!;

    expect(patientWalker.modelType).toBe('patient');
    expect(orderlyWalker.modelType).toBe('zombie1');
    expect(heavyRunner.modelType).toBe('zombie2');
  });

  it('4. ZombieAssetPool recognizes and manages all 3 model types', () => {
    const pool = ZombieAssetPool.getInstance();

    expect(pool.isSkeletal('patient')).toBe(true);
    expect(pool.isSkeletal('zombie1')).toBe(false);
    expect(pool.isSkeletal('zombie2')).toBe(false);

    // Mock models can be attached and cloned
    const mockMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    (pool as any).zombie1Model = mockMesh;
    (pool as any).zombie2Model = mockMesh.clone();

    const clone1 = pool.cloneModel('zombie1');
    const clone2 = pool.cloneModel('zombie2');

    expect(clone1).not.toBeNull();
    expect(clone2).not.toBeNull();
    expect(clone1).not.toBe(clone2);
  });

  it('5. drives dynamic procedural locomotion, attack, and flinch on OBJ models', () => {
    const zombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 0), 'zombie1')!;
    const modelMesh = new THREE.Group();
    zombie.attached3DModel = modelMesh;
    zombie.group.add(modelMesh);

    // Initial neutral transforms
    expect(modelMesh.position.y).toBe(0);
    expect(modelMesh.rotation.z).toBe(0);

    const playerPos = new THREE.Vector3(0, 0, 5);

    // 1. Moving state (chase)
    zombie.state = 'chase';
    zombie.update(0.1, playerPos, () => {});

    // Must have applied organic gait bobbing & tilt
    expect(modelMesh.rotation.z).not.toBe(0);
    expect(modelMesh.position.y).toBeGreaterThan(0);

    // 2. Attack state
    zombie.state = 'attack';
    (zombie as any).stateTimer = 0.45;
    zombie.update(0.016, playerPos, () => {});
    // Must pitch forward in attack lunge
    expect(modelMesh.rotation.x).toBeGreaterThan(0.2);

    // 3. Damage flinch
    (zombie as any).damageFlinchTimer = 0.2;
    zombie.update(0.016, playerPos, () => {});
    expect(modelMesh.rotation.x).toBeLessThan(0.4); // Recoils backward
  });

  it('6. correctly executes death crumple on OBJ models and clamps on floor', () => {
    const zombie = manager.spawnZombie('brute', new THREE.Vector3(0, 0, 0), 'zombie2')!;
    const modelMesh = new THREE.Group();
    zombie.attached3DModel = modelMesh;
    zombie.group.add(modelMesh);

    // Take fatal damage
    zombie.takeDamage(500, new THREE.Vector3(0, 1.2, 0), 'torso');
    expect(zombie.isDead).toBe(true);
    expect(zombie.state).toBe('dead');

    // Group rotates flat onto the ground
    expect(zombie.group.rotation.x).toBeCloseTo(Math.PI / 2.15, 2);
    expect(zombie.group.position.y).toBe(0.15);

    // Updating while dead holds position without error
    zombie.update(1.0, new THREE.Vector3(0, 0, 0), () => {});
    expect(zombie.group.rotation.x).toBeCloseTo(Math.PI / 2.15, 2);
  });

  it('7. pool recycling preserves or matches model types cleanly', () => {
    const z1 = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 0), 'zombie1')!;
    const z2 = manager.spawnZombie('walker', new THREE.Vector3(5, 0, 0), 'patient')!;

    z1.die();
    z2.die();

    manager.recycleZombie(z1);
    manager.recycleZombie(z2);

    // Spawning with modelOverride picks matching recycled instance
    const respawnedPatient = manager.spawnZombie('walker', new THREE.Vector3(10, 0, 0), 'patient')!;
    expect(respawnedPatient.modelType).toBe('patient');
    expect(respawnedPatient.isDead).toBe(false);

    const respawnedZombie1 = manager.spawnZombie('walker', new THREE.Vector3(20, 0, 0), 'zombie1')!;
    expect(respawnedZombie1.modelType).toBe('zombie1');
    expect(respawnedZombie1.isDead).toBe(false);
  });
});
