import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { WEAPON_DEFINITIONS } from '@/data/weapons';
import { WEAPON_COMBAT_CONFIGS } from '@/data/combat';
import { WeaponAssetPool } from '@/features/combat/WeaponAssetPool';
import { CombatManager } from '@/features/combat/CombatManager';
import { WeaponLootManager, WEAPON_RARITY_MAP } from '@/features/loot/WeaponLootManager';
import { InventoryManager } from '@/features/inventory/InventoryManager';
import { WeaponType } from '@/shared/types';
import { useGameUIStore } from '@/ui/store/gameUIStore';

describe('Five Weapon Integration & Combat System', () => {
  it('defines valid statistics, rarities, and combat configs for all 5 firearms', () => {
    const firearms: WeaponType[] = ['pistol', 'shotgun', 'rifle', 'sniper', 'machinegun'];

    for (const weapon of firearms) {
      // 1. Definition check
      const def = WEAPON_DEFINITIONS[weapon];
      expect(def).toBeDefined();
      expect(def.isRanged).toBe(true);
      expect(def.damage).toBeGreaterThan(0);
      expect(def.maxAmmo).toBeGreaterThan(0);
      expect(def.rarity).toBeDefined();

      // 2. Combat Config check
      const cfg = WEAPON_COMBAT_CONFIGS[weapon];
      expect(cfg).toBeDefined();
      expect(cfg.bodyDamage).toBeGreaterThan(0);
      expect(cfg.headDamage).toBeGreaterThan(0);
      expect(cfg.headMultiplier).toBeGreaterThanOrEqual(1.5);
      expect(cfg.fireRate).toBeGreaterThan(0);
      expect(cfg.range).toBeGreaterThan(0);
      expect(cfg.maxAmmo).toBeGreaterThan(0);
      expect(cfg.reloadTime).toBeGreaterThan(0);
      expect(cfg.rarity).toBe(WEAPON_RARITY_MAP[weapon]);
    }
  });

  it('configures distinct ballistic and role profiles for all 5 firearms', () => {
    // Pistol: Mobile, reliable standard sidearm
    expect(WEAPON_COMBAT_CONFIGS.pistol.fireRate).toBe(3.5);
    expect(WEAPON_COMBAT_CONFIGS.pistol.maxAmmo).toBe(15);
    expect(WEAPON_COMBAT_CONFIGS.pistol.maxReserveAmmo).toBe(150);

    // Shotgun: Devastating multi-pellet close range
    expect(WEAPON_COMBAT_CONFIGS.shotgun.pelletCount).toBe(8);
    expect(WEAPON_COMBAT_CONFIGS.shotgun.range).toBe(22);
    expect(WEAPON_COMBAT_CONFIGS.shotgun.maxReserveAmmo).toBe(48);

    // Assault Rifle: Rapid medium-long range burst
    expect(WEAPON_COMBAT_CONFIGS.rifle.fireRate).toBe(8.5);
    expect(WEAPON_COMBAT_CONFIGS.rifle.maxAmmo).toBe(30);
    expect(WEAPON_COMBAT_CONFIGS.rifle.maxReserveAmmo).toBe(180);

    // Sniper Rifle: Extreme high-damage single shot precision
    expect(WEAPON_COMBAT_CONFIGS.sniper.bodyDamage).toBe(120);
    expect(WEAPON_COMBAT_CONFIGS.sniper.headMultiplier).toBe(3.0);
    expect(WEAPON_COMBAT_CONFIGS.sniper.range).toBe(120);
    expect(WEAPON_COMBAT_CONFIGS.sniper.maxReserveAmmo).toBe(30);

    // Machine Gun: Massive capacity sustained suppression
    expect(WEAPON_COMBAT_CONFIGS.machinegun.maxAmmo).toBe(100);
    expect(WEAPON_COMBAT_CONFIGS.machinegun.maxReserveAmmo).toBe(300);
    expect(WEAPON_COMBAT_CONFIGS.machinegun.fireRate).toBe(11.0);
  });
});

describe('WeaponAssetPool Hand Attachments & Drop Meshes', () => {
  const pool = WeaponAssetPool.getInstance();

  it('provides precise muzzle offsets for bullet tracers and muzzle flash', () => {
    const pistolMuzzle = pool.getMuzzleOffset('pistol');
    const shotgunMuzzle = pool.getMuzzleOffset('shotgun');
    const rifleMuzzle = pool.getMuzzleOffset('rifle');
    const sniperMuzzle = pool.getMuzzleOffset('sniper');
    const machinegunMuzzle = pool.getMuzzleOffset('machinegun');

    expect(pistolMuzzle.z).toBeGreaterThan(0.1);
    expect(shotgunMuzzle.z).toBeGreaterThan(0.3);
    expect(rifleMuzzle.z).toBeGreaterThan(0.4);
    expect(sniperMuzzle.z).toBeGreaterThan(0.5);
    expect(machinegunMuzzle.z).toBeGreaterThan(0.4);
  });

  it('creates functional weapon hand meshes with child hierarchy and socket name', () => {
    const firearms: WeaponType[] = ['pistol', 'shotgun', 'rifle', 'sniper', 'machinegun'];
    for (const weapon of firearms) {
      const mesh = pool.createWeaponHandMesh(weapon);
      expect(mesh).toBeInstanceOf(THREE.Group);
      expect(mesh.name).toBe(`HandWeaponSocket_${weapon}`);
      expect(mesh.children.length).toBeGreaterThan(0);
    }
  });

  it('creates clean standalone drop meshes for ground loot', () => {
    const firearms: WeaponType[] = ['pistol', 'shotgun', 'rifle', 'sniper', 'machinegun'];
    for (const weapon of firearms) {
      const dropMesh = pool.createWeaponDropMesh(weapon);
      expect(dropMesh).toBeInstanceOf(THREE.Group);
      expect(dropMesh.name).toBe(`DropWeapon_${weapon}`);
    }
  });
});

describe('CombatManager 6-Weapon Slot Handling & Ammo Cycling', () => {
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let combatManager: CombatManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const mockCameraManager = {
      camera,
      addTrauma: vi.fn(),
      getAimRay: () => new THREE.Ray(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, 1))
    } as any;
    combatManager = new CombatManager(scene, mockCameraManager);
    useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });
  });

  it('supports weapon slots 1 through 6', () => {
    // Unlock all weapons
    combatManager.unlockWeapon('knife');
    combatManager.unlockWeapon('pistol', 12, 24);
    combatManager.unlockWeapon('shotgun', 6, 12);
    combatManager.unlockWeapon('rifle', 30, 60);
    combatManager.unlockWeapon('sniper', 5, 15);
    combatManager.unlockWeapon('machinegun', 60, 120);

    // Slot 1: knife
    combatManager.equipSlot(1);
    expect(combatManager.getEquippedWeapon()).toBe('knife');

    // Slot 2: pistol
    combatManager.equipSlot(2);
    expect(combatManager.getEquippedWeapon()).toBe('pistol');

    // Slot 3: shotgun
    combatManager.equipSlot(3);
    expect(combatManager.getEquippedWeapon()).toBe('shotgun');

    // Slot 4: rifle
    combatManager.equipSlot(4);
    expect(combatManager.getEquippedWeapon()).toBe('rifle');

    // Slot 5: sniper
    combatManager.equipSlot(5);
    expect(combatManager.getEquippedWeapon()).toBe('sniper');

    // Slot 6: machinegun
    combatManager.equipSlot(6);
    expect(combatManager.getEquippedWeapon()).toBe('machinegun');
  });

  it('tracks ammo consumption and reload for sniper rifle', () => {
    combatManager.unlockWeapon('sniper', 5, 15);
    combatManager.equipWeapon('sniper');

    const statsInitial = combatManager.getWeaponStats('sniper');
    expect(statsInitial.currentAmmo).toBe(5);
    expect(statsInitial.reserveAmmo).toBe(15);

    // Attack once
    const fired = combatManager.attack(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
    expect(fired).toBe(true);

    const statsAfterFire = combatManager.getWeaponStats('sniper');
    expect(statsAfterFire.currentAmmo).toBe(4);

    // Trigger Reload
    combatManager.reload();
    expect(combatManager.getIsReloading()).toBe(true);

    // Advance time past reload duration (2.6s)
    combatManager.update(2.7);
    expect(combatManager.getIsReloading()).toBe(false);

    const statsAfterReload = combatManager.getWeaponStats('sniper');
    expect(statsAfterReload.currentAmmo).toBe(5);
    expect(statsAfterReload.reserveAmmo).toBe(14);
  });

  it('tracks rapid ammo consumption and reload for heavy machine gun', () => {
    combatManager.unlockWeapon('machinegun', 60, 120);
    combatManager.equipWeapon('machinegun');

    // Fire 5 rounds
    for (let i = 0; i < 5; i++) {
      combatManager.update(0.12); // Advance time past fire rate cooldown (1 / 11.0 ~ 0.09s)
      combatManager.attack(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
    }

    const stats = combatManager.getWeaponStats('machinegun');
    expect(stats.currentAmmo).toBe(55);
  });
});

describe('WeaponLootManager Drops & Random Loot Mechanics', () => {
  let scene: THREE.Scene;
  let combatManager: CombatManager;
  let inventoryManager: InventoryManager;
  let lootManager: WeaponLootManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    const mockCamera = new THREE.PerspectiveCamera();
    combatManager = new CombatManager(scene, { camera: mockCamera, addTrauma: vi.fn() } as any);
    inventoryManager = new InventoryManager();
    lootManager = new WeaponLootManager(scene, combatManager, inventoryManager);
    useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });
  });

  it('rolls valid weapons according to weighted probabilities', () => {
    const rolledWeapons: Set<WeaponType> = new Set();

    // Roll military crate multiple times (guaranteed weapon drop)
    for (let i = 0; i < 50; i++) {
      const w = lootManager.rollRandomWeapon('crate_military');
      if (w) rolledWeapons.add(w);
    }

    expect(rolledWeapons.size).toBeGreaterThan(0);
    // Military crate rolls tactical weapons: shotgun, rifle, sniper, machinegun
    for (const w of rolledWeapons) {
      expect(['shotgun', 'rifle', 'sniper', 'machinegun']).toContain(w);
    }
  });

  it('spawns a 3D weapon drop in world and adds it to scene', () => {
    const spawnPos = new THREE.Vector3(10, 1.5, 20);
    const drop = lootManager.spawnWeaponDrop('sniper', spawnPos, 5, 15, 'test_sniper_drop');

    expect(drop).not.toBeNull();
    expect(drop!.weapon).toBe('sniper');
    expect(drop!.rarity).toBe('epic');
    expect(drop!.ammo).toBe(5);
    expect(drop!.group.parent).toBe(scene);
    expect(lootManager.getDroppedItems().length).toBe(1);
  });

  it('settles and hovers weapon drops over time', () => {
    const spawnPos = new THREE.Vector3(0, 2.0, 0);
    const drop = lootManager.spawnWeaponDrop('rifle', spawnPos);

    expect(drop!.isSettled).toBe(false);

    // Update with delta time
    lootManager.update(0.5, new THREE.Vector3(0, 0, 0));
    expect(drop!.settlingTimer).toBeGreaterThan(0);

    // Finish settling
    lootManager.update(1.0, new THREE.Vector3(0, 0, 0));
    expect(drop!.isSettled).toBe(true);
  });

  it('detects proximity and triggers interaction prompt', () => {
    const dropPos = new THREE.Vector3(5, 0.5, 5);
    lootManager.spawnWeaponDrop('shotgun', dropPos);

    // Player far away (10m)
    lootManager.update(0.016, new THREE.Vector3(15, 0.5, 5));
    expect(useGameUIStore.getState().interactionPrompt.visible).toBe(false);

    // Player close (1.2m)
    lootManager.update(0.016, new THREE.Vector3(5, 0.5, 6.2));
    expect(useGameUIStore.getState().interactionPrompt.visible).toBe(true);
    expect(useGameUIStore.getState().interactionPrompt.text).toContain('12-Gauge Pump-Action Shotgun');
    expect(useGameUIStore.getState().interactionPrompt.text).toContain('UNCOMMON');

    // Player walks away (12m)
    lootManager.update(0.016, new THREE.Vector3(17, 0.5, 5));
    expect(useGameUIStore.getState().interactionPrompt.visible).toBe(false);
  });

  it('picks up weapon, unlocks it in CombatManager, and gives inventory item', () => {
    const dropPos = new THREE.Vector3(2, 0.5, 2);
    lootManager.spawnWeaponDrop('machinegun', dropPos, 60, 120, 'unique_mg');

    expect(combatManager.isWeaponUnlocked('machinegun')).toBe(false);

    // Player steps close and presses E
    lootManager.update(0.016, new THREE.Vector3(2, 0.5, 2));
    const pickedUp = lootManager.tryPickup(new THREE.Vector3(2, 0.5, 2));

    expect(pickedUp).toBe(true);
    expect(combatManager.isWeaponUnlocked('machinegun')).toBe(true);
    expect(combatManager.getWeaponStats('machinegun').currentAmmo).toBe(60);
    expect(combatManager.getWeaponStats('machinegun').reserveAmmo).toBe(120);
    expect(inventoryManager.hasItem('item_machinegun', 1)).toBe(true);
    expect(lootManager.getDroppedItems().length).toBe(0);
  });

  it('grants reserve ammo when picking up duplicate weapon', () => {
    // Unlock rifle with 30 / 60
    combatManager.unlockWeapon('rifle', 30, 60);

    // Spawn duplicate rifle with 30 / 60
    lootManager.spawnWeaponDrop('rifle', new THREE.Vector3(0, 0, 0), 30, 60);
    lootManager.update(0.016, new THREE.Vector3(0, 0, 0));

    const pickedUp = lootManager.tryPickup(new THREE.Vector3(0, 0, 0));
    expect(pickedUp).toBe(true);

    // Reserve ammo increases by 30 + 60 = 90
    const stats = combatManager.getWeaponStats('rifle');
    expect(stats.reserveAmmo).toBe(60 + 90);
  });

  it('spawns a 3D drop when dropping equipped weapon', () => {
    const playerPos = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3(0, 0, 1);

    const dropped = lootManager.dropWeapon('shotgun', playerPos, forward, 6, 24);
    expect(dropped).not.toBeNull();
    expect(dropped!.weapon).toBe('shotgun');
    expect(dropped!.ammo).toBe(6);
    expect(dropped!.reserveAmmo).toBe(0); // Player keeps reserve ammo; weapon drops with chambered ammo only
    expect(dropped!.position.z).toBeCloseTo(1.2, 0.1);
  });

  it('prevents dropping knife', () => {
    const playerPos = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3(0, 0, 1);

    const dropped = lootManager.dropWeapon('knife', playerPos, forward, 0, 0);
    expect(dropped).toBeNull();
  });
});
