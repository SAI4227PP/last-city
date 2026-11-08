import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ZombieAnimationController, ZombieClips } from '@/features/zombies/ZombieAnimationController';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';
import { ZombieManager } from '@/features/zombies/ZombieManager';

function createMockZombieClips(): ZombieClips {
  const tPos = new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 0, 0, 0]);
  const tRot = new THREE.QuaternionKeyframeTrack('.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
  const tHips = new THREE.VectorKeyframeTrack(
    'Hips.position',
    [0, 1, 2, 3, 4.4],
    [
      0, 0.85, 0,
      0, 0.83, 0,
      0, 0.44, 0,
      0, 0.12, 0,
      0, 0.12, 0
    ]
  );

  return {
    idle: new THREE.AnimationClip('idle', 1, [tPos, tRot]),
    walk: new THREE.AnimationClip('walk', 1, [tPos, tRot]),
    run: new THREE.AnimationClip('run', 1, [tPos, tRot]),
    attack: new THREE.AnimationClip('attack', 1, [tPos, tRot]),
    death: new THREE.AnimationClip('death', 4.4, [tHips, tRot])
  };
}

describe('Zombie Death Animation & State Pipeline', () => {
  let scene: THREE.Scene;
  let survival: SurvivalSystem;
  let manager: ZombieManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    survival = new SurvivalSystem();
    manager = new ZombieManager(scene, survival);
  });

  it('1. triggers death state and disables hitboxes when zombie health reaches 0', () => {
    const zombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 2))!;
    expect(zombie.isDead).toBe(false);
    expect(zombie.currentHealth).toBe(zombie.maxHealth);
    expect(zombie.hitRadius).toBeGreaterThan(0);

    // Fatal damage
    const res = zombie.takeDamage(zombie.maxHealth + 50, new THREE.Vector3(0, 1.2, 2), 'torso');
    expect(res.isDead).toBe(true);
    expect(res.remainingHealth).toBe(0);
    expect(zombie.isDead).toBe(true);
    expect(zombie.state).toBe('dead');
    expect(zombie.hitRadius).toBe(0);
    expect(zombie.hitHeight).toBe(0);

    // Raycast and melee sweeps must ignore dead zombie
    const rayHit = zombie.testRayHit(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0, 0, 1), 10);
    expect(rayHit).toBeNull();

    const meleeHit = zombie.testMeleeSweep(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0, 0, 1), 2.0, Math.PI / 3);
    expect(meleeHit).toBeNull();
  });

  it('2. continues ticking AnimationMixer so the 3D death animation plays through and clamps', () => {
    const zombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 2))!;
    const clips = createMockZombieClips();
    const skeletalRoot = new THREE.Group();
    const hips = new THREE.Group();
    hips.name = 'Hips';
    skeletalRoot.add(hips);
    scene.add(skeletalRoot);

    const animController = new ZombieAnimationController(skeletalRoot, clips);
    zombie.animationController = animController;

    // Start in attack pose (matching user report where zombie was frozen mid-attack)
    animController.triggerAttack();
    expect(animController.getCurrentState()).toBe('attack');

    // Zombie dies from lethal blow
    zombie.takeDamage(100, new THREE.Vector3(0, 1.2, 2), 'torso');
    expect(zombie.isDead).toBe(true);
    expect(animController.getCurrentState()).toBe('death');

    const deathAction = (animController as any).actions.get('death');
    expect(deathAction).toBeDefined();
    expect(deathAction.clampWhenFinished).toBe(true);

    const playerPos = new THREE.Vector3(0, 0, 0);
    let attackDamageDealt = 0;

    // Tick forward 1.0 second
    zombie.update(1.0, playerPos, (dmg) => { attackDamageDealt += dmg; });
    // Zombie must NOT deal damage while dead
    expect(attackDamageDealt).toBe(0);

    // Tick forward past the end of the 4.4s death animation (total 5.0 seconds)
    zombie.update(4.0, playerPos, (dmg) => { attackDamageDealt += dmg; });
    expect(attackDamageDealt).toBe(0);

    // The death action should have completed and paused clamped on the last frame
    expect(deathAction.paused).toBe(true);

    // Hips should be at ground level (Y = 0.12)
    expect(hips.position.y).toBeCloseTo(0.12, 2);

    // Subsequent updates continue to hold the clamped death pose without throwing
    zombie.update(1.0, playerPos, () => {});
    expect(hips.position.y).toBeCloseTo(0.12, 2);
    expect(deathAction.paused).toBe(true);
  });

  it('3. setting zombie.health = 0 directly triggers death animation and mixer execution', () => {
    const zombie = manager.spawnZombie('runner', new THREE.Vector3(5, 0, 5))!;
    const clips = createMockZombieClips();
    const skeletalRoot = new THREE.Group();
    const hips = new THREE.Group();
    hips.name = 'Hips';
    skeletalRoot.add(hips);

    const animController = new ZombieAnimationController(skeletalRoot, clips);
    zombie.animationController = animController;

    expect(zombie.isDead).toBe(false);
    zombie.health = 0;

    expect(zombie.isDead).toBe(true);
    expect(animController.getCurrentState()).toBe('death');

    // Mixer updates properly
    zombie.update(0.5, new THREE.Vector3(0, 0, 0), () => {});
    expect((animController as any).mixer.time).toBeGreaterThan(0);
  });

  it('4. ZombieAnimationController.reset() restores idle state when zombie is recycled', () => {
    const zombie = manager.spawnZombie('walker', new THREE.Vector3(0, 0, 0))!;
    const clips = createMockZombieClips();
    const skeletalRoot = new THREE.Group();
    const hips = new THREE.Group();
    hips.name = 'Hips';
    skeletalRoot.add(hips);
    const animController = new ZombieAnimationController(skeletalRoot, clips);
    zombie.animationController = animController;

    // Kill zombie
    zombie.die();
    expect(animController.getCurrentState()).toBe('death');
    expect(animController.isDead).toBe(true);

    // Recycle and reset
    zombie.reset(new THREE.Vector3(10, 0, 10));
    expect(zombie.isDead).toBe(false);
    expect(animController.isDead).toBe(false);
    expect(animController.getCurrentState()).toBe('idle');
  });
});
