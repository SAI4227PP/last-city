import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ZombieManager } from '@/features/zombies/ZombieManager';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';
import { EventBus } from '@/core/events/EventBus';
import { CombatConfigManager, WEAPON_COMBAT_CONFIGS } from '@/data/combat';

describe('Zombie Health, Weapon Damage and Combat System Audit', () => {
  let scene: THREE.Scene;
  let survival: SurvivalSystem;
  let zombieManager: ZombieManager;
  let eventBus: EventBus;

  beforeEach(() => {
    scene = new THREE.Scene();
    survival = new SurvivalSystem();
    zombieManager = new ZombieManager(scene, survival);
    eventBus = EventBus.getInstance();
    CombatConfigManager.getInstance().setDifficulty('normal');
  });

  // A. Individual zombie health initialization
  it('A. initializes individual zombies with distinct configurable maxHealth', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 10))!;
    const runner = zombieManager.spawnZombie('runner', new THREE.Vector3(5, 0, 10))!;
    const brute = zombieManager.spawnZombie('brute', new THREE.Vector3(10, 0, 10))!;
    const spitter = zombieManager.spawnZombie('spitter', new THREE.Vector3(15, 0, 10))!;
    const boss = zombieManager.spawnZombie('boss', new THREE.Vector3(20, 0, 10))!;

    expect(walker.maxHealth).toBe(100);
    expect(walker.getHealth()).toBe(100);

    expect(runner.maxHealth).toBe(80);
    expect(runner.getHealth()).toBe(80);

    expect(brute.maxHealth).toBe(250);
    expect(brute.getHealth()).toBe(250);

    expect(spitter.maxHealth).toBe(120);
    expect(spitter.getHealth()).toBe(120);

    expect(boss.maxHealth).toBe(600);
    expect(boss.getHealth()).toBe(600);
  });

  // B. Individual health independence
  it('B. ensures damage to one zombie does not affect another zombie', () => {
    const zombie1 = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;
    const zombie2 = zombieManager.spawnZombie('walker', new THREE.Vector3(5, 0, 5))!;

    // Damage zombie1 by 35 HP
    zombie1.takeDamage(35, new THREE.Vector3(0, 1, 5), 'torso');

    expect(zombie1.getHealth()).toBe(65);
    expect(zombie2.getHealth()).toBe(100); // Unaffected!
  });

  // C. Weapon body damage calculation
  it('C. applies distinct weapon body damage values accurately', () => {
    const combat = CombatConfigManager.getInstance();

    const knifeDmg = combat.calculateDamage('knife', 'torso', 'walker', false);
    expect(knifeDmg.finalDamage).toBe(35);

    const batDmg = combat.calculateDamage('bat', 'torso', 'walker', false);
    expect(batDmg.finalDamage).toBe(45);

    const pistolDmg = combat.calculateDamage('pistol', 'torso', 'walker', false);
    expect(pistolDmg.finalDamage).toBe(25);

    const shotgunDmg = combat.calculateDamage('shotgun', 'torso', 'walker', false);
    expect(shotgunDmg.finalDamage).toBe(80);

    const rifleDmg = combat.calculateDamage('rifle', 'torso', 'walker', false);
    expect(rifleDmg.finalDamage).toBe(30);
  });

  // D. Headshot damage multipliers
  it('D. applies enhanced damage on headshots', () => {
    const combat = CombatConfigManager.getInstance();

    const knifeHead = combat.calculateDamage('knife', 'head', 'walker', false);
    expect(knifeHead.finalDamage).toBe(70);
    expect(knifeHead.isHeadshot).toBe(true);

    const batHead = combat.calculateDamage('bat', 'head', 'walker', false);
    expect(batHead.finalDamage).toBe(90);

    const pistolHead = combat.calculateDamage('pistol', 'head', 'walker', false);
    expect(pistolHead.finalDamage).toBe(75);

    const shotgunHead = combat.calculateDamage('shotgun', 'head', 'walker', false);
    expect(shotgunHead.finalDamage).toBe(160);

    const rifleHead = combat.calculateDamage('rifle', 'head', 'walker', false);
    expect(rifleHead.finalDamage).toBe(90);
  });

  // E. Armor damage reduction on Armored Brute
  it('E. applies ceramic riot armor damage reduction on Armored Brute torso and limbs', () => {
    const combat = CombatConfigManager.getInstance();

    // Against standard unarmored walker: rifle deals 30 damage to torso
    const walkerTorso = combat.calculateDamage('rifle', 'torso', 'walker', false);
    expect(walkerTorso.finalDamage).toBe(30);
    expect(walkerTorso.armorReduction).toBe(0);

    // Against Armored Brute: torso armor absorbs 50% damage
    const bruteTorso = combat.calculateDamage('rifle', 'torso', 'brute', false);
    expect(bruteTorso.finalDamage).toBe(15); // 30 * 0.50 = 15
    expect(bruteTorso.armorReduction).toBe(15);

    // Against Armored Brute arms: pauldrons/gauntlets absorb 35% damage (0.65x multiplier)
    const bruteArms = combat.calculateDamage('rifle', 'arms', 'brute', false);
    // Base arms damage = 30 * 0.75 = 22.5. Armored arms = 22.5 * 0.65 = ~15
    expect(bruteArms.finalDamage).toBeLessThan(walkerTorso.finalDamage);
    expect(bruteArms.armorReduction).toBeGreaterThan(0);
  });

  // F. Shotgun individual pellet simulation
  it('F. simulates shotgun multi-pellet spread and damage calculation', () => {
    const combat = CombatConfigManager.getInstance();
    const shotgunConfig = WEAPON_COMBAT_CONFIGS.shotgun;

    expect(shotgunConfig.pelletCount).toBe(8);
    expect(shotgunConfig.pelletBodyDamage).toBe(10);
    expect(shotgunConfig.pelletHeadDamage).toBe(20);

    // 1 pellet to torso
    const onePelletBody = combat.calculateDamage('shotgun', 'torso', 'walker', true);
    expect(onePelletBody.finalDamage).toBe(10);

    // 1 pellet to head
    const onePelletHead = combat.calculateDamage('shotgun', 'head', 'walker', true);
    expect(onePelletHead.finalDamage).toBe(20);

    // 8 pellets all hitting body total 80 damage
    const totalBody = onePelletBody.finalDamage * shotgunConfig.pelletCount!;
    expect(totalBody).toBe(80);

    // 8 pellets all hitting head total 160 damage
    const totalHead = onePelletHead.finalDamage * shotgunConfig.pelletCount!;
    expect(totalHead).toBe(160);
  });

  // G. Missed shots deal zero damage
  it('G. registers no hit or damage when raycast misses the target', () => {
    const zombie = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 10))!;
    const rayOrigin = new THREE.Vector3(0, 1.5, 0);

    // Aim 90 degrees away to the right (+X)
    const rayDir = new THREE.Vector3(1, 0, 0);
    const hit = zombieManager.checkRayHit(rayOrigin, rayDir, 50);

    expect(hit).toBeNull();
    expect(zombie.getHealth()).toBe(100); // No damage applied
  });

  // H. Wall-blocked shots
  it('H. prevents damage when a solid wall blocks line of fire', () => {
    const zombie = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 10))!;

    // Mock physicsWorld with a solid wall at z = 4 (between player at z=0 and zombie at z=10)
    const mockPhysicsWorld = {
      raycast: (_origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) => {
        // Intersects wall at distance 4.0m
        if (dir.z > 0.9 && maxDist >= 4.0) {
          return { distance: 4.0, point: new THREE.Vector3(0, 1.5, 4.0) };
        }
        return null;
      }
    } as any;

    zombieManager.setPhysicsWorld(mockPhysicsWorld);

    const rayOrigin = new THREE.Vector3(0, 1.5, 0);
    const rayDir = new THREE.Vector3(0, 0, 1); // Pointed directly at zombie

    // Raycast distance to zombie is 10.0m, but wall is at 4.0m
    const hit = zombieManager.checkRayHit(rayOrigin, rayDir, 50);

    expect(hit).toBeNull(); // Blocked by wall!
    expect(zombie.getHealth()).toBe(100);
  });

  // I. Melee range validation
  it('I. registers melee hit only within valid weapon range and angle spread', () => {
    const nearZombie = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 1.8))!;
    const farZombie = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 4.5))!;

    const playerPos = new THREE.Vector3(0, 1.3, 0);
    const forwardDir = new THREE.Vector3(0, 0, 1);

    // Knife range is 2.0m: nearZombie (dist 1.8m) should be hit
    const hitNear = zombieManager.checkMeleeSweep(playerPos, forwardDir, 2.0, 1.2);
    expect(hitNear).not.toBeNull();
    expect(hitNear!.zombie).toBe(nearZombie);

    // Far zombie is at 4.5m, outside knife range (2.0m)
    expect(farZombie.getPosition().z).toBe(4.5);
    nearZombie.group.position.set(0, 0, 10);
    const hitFar = zombieManager.checkMeleeSweep(playerPos, forwardDir, 2.0, 1.2);
    expect(hitFar).toBeNull(); // Out of range!
  });

  // J. Zombie death at exactly zero health and no negative health
  it('J. eliminates zombie only when health reaches zero and clamps health to 0', () => {
    const zombie = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;
    expect(zombie.isDead).toBe(false);

    // Hit 1: 35 damage -> 65 HP
    zombie.takeDamage(35, new THREE.Vector3(0, 1, 5), 'torso');
    expect(zombie.getHealth()).toBe(65);
    expect(zombie.isDead).toBe(false);

    // Hit 2: 35 damage -> 30 HP
    zombie.takeDamage(35, new THREE.Vector3(0, 1, 5), 'torso');
    expect(zombie.getHealth()).toBe(30);
    expect(zombie.isDead).toBe(false);

    // Hit 3: 50 damage -> exceeds remaining 30 HP
    zombie.takeDamage(50, new THREE.Vector3(0, 1, 5), 'torso');
    expect(zombie.getHealth()).toBe(0); // Clamped to zero
    expect(zombie.isDead).toBe(true);
    expect(zombie.state).toBe('dead');
  });

  // K. Prevention of duplicate death events
  it('K. prevents duplicate death events if damaged while already dead', () => {
    const zombie = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 5))!;
    let killEventsEmitted = 0;

    const unsub = eventBus.on('zombie:killed', () => {
      killEventsEmitted++;
    });

    // Fatal hit
    zombie.takeDamage(150, new THREE.Vector3(0, 1, 5), 'head');
    expect(zombie.isDead).toBe(true);
    expect(killEventsEmitted).toBe(1);

    // Further hits to dead corpse should not trigger additional death events
    zombie.takeDamage(50, new THREE.Vector3(0, 1, 5), 'torso');
    zombie.die(); // Direct call should also be ignored
    expect(killEventsEmitted).toBe(1);

    unsub();
  });

  // L. Pooled zombie health reset
  it('L. completely restores health and alive state when recycling from object pool', () => {
    const zombie = zombieManager.spawnZombie('runner', new THREE.Vector3(0, 0, 5))!;
    expect(zombie.getHealth()).toBe(80);

    // Kill the zombie
    zombie.takeDamage(100, new THREE.Vector3(0, 1, 5), 'torso');
    expect(zombie.isDead).toBe(true);
    expect(zombie.getHealth()).toBe(0);

    // Recycle into pool
    zombieManager.recycleZombie(zombie);
    expect(zombieManager.getZombies().length).toBe(0);

    // Respawn runner from pool
    const respawned = zombieManager.spawnZombie('runner', new THREE.Vector3(10, 0, 10))!;
    expect(respawned).toBe(zombie);
    expect(respawned.isDead).toBe(false);
    expect(respawned.getHealth()).toBe(80);
    expect(respawned.state).toBe('idle');
    expect(respawned.hitRadius).toBeGreaterThan(0);
  });

  // M. Mission and reward events after death
  it('M. emits zombie:killed event with complete identifier and variant payload', () => {
    const zombie = zombieManager.spawnZombie('boss', new THREE.Vector3(12, 0, 18))!;
    let receivedPayload: any = null;

    const unsub = eventBus.on('zombie:killed', (payload) => {
      receivedPayload = payload;
    });

    // Slay the boss
    zombie.takeDamage(600, new THREE.Vector3(12, 1, 18), 'head');
    expect(zombie.isDead).toBe(true);

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload.id).toBe(zombie.id);
    expect(receivedPayload.variant).toBe('boss');
    expect(receivedPayload.position[0]).toBe(12);
    expect(receivedPayload.position[2]).toBe(18);

    unsub();
  });

  // N. Zombie-to-player damage pipeline
  it('N. decreases player HP and emits player:damage when a zombie attacks', () => {
    const walker = zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 1.2))!;
    const playerPos = new THREE.Vector3(0, 0, 0);

    expect(survival.getVitals().health).toBe(100);

    let damageEventFired = false;
    let damageAmountReceived = 0;
    const unsub = eventBus.on('player:damage', (e) => {
      damageEventFired = true;
      damageAmountReceived = e.amount;
    });

    // Zombie updates in melee attack range with clear line of sight
    walker.state = 'attack';
    (walker as any).attackCooldownTimer = 0;

    zombieManager.update(0.016, playerPos, undefined, false);

    expect(damageEventFired).toBe(true);
    expect(damageAmountReceived).toBe(15); // Walker attack damage is 15
    expect(survival.getVitals().health).toBe(85);

    unsub();
  });

  // O. Multiple attacks reduce player HP to zero and trigger death
  it('O. reduces player HP to zero across multiple attacks and triggers death', () => {
    const brute = zombieManager.spawnZombie('brute', new THREE.Vector3(0, 0, 1.2))!; // 35 damage per hit
    const playerPos = new THREE.Vector3(0, 0, 0);

    let deathEventFired = false;
    const unsub = eventBus.on('player:death', () => {
      deathEventFired = true;
    });

    // 1st hit: 100 -> 65
    brute.state = 'attack';
    (brute as any).attackCooldownTimer = 0;
    zombieManager.update(0.016, playerPos, undefined, false);
    expect(survival.getVitals().health).toBe(65);

    // 2nd hit: 65 -> 30
    (brute as any).attackCooldownTimer = 0;
    (brute as any).hasDealtAttackDamage = false;
    (survival as any).damageCooldownTimer = 0;
    zombieManager.update(0.016, playerPos, undefined, false);
    expect(survival.getVitals().health).toBe(30);

    // 3rd hit: 30 -> 0 (death!)
    (brute as any).attackCooldownTimer = 0;
    (brute as any).hasDealtAttackDamage = false;
    (survival as any).damageCooldownTimer = 0;
    zombieManager.update(0.016, playerPos, undefined, false);
    expect(survival.getVitals().health).toBe(0);
    expect(deathEventFired).toBe(true);

    // Post-death: dead player cannot be further damaged below 0
    (brute as any).attackCooldownTimer = 0;
    (brute as any).hasDealtAttackDamage = false;
    zombieManager.update(0.016, playerPos, undefined, true);
    expect(survival.getVitals().health).toBe(0);

    unsub();
  });
});
