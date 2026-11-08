import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { WEAPON_COMBAT_CONFIGS, WEAPON_AMMO_CAPACITIES } from '@/data/combat';
import { CombatManager } from '@/features/combat/CombatManager';
import { WeaponLootManager } from '@/features/loot/WeaponLootManager';
import { InventoryManager } from '@/features/inventory/InventoryManager';
import { SaveManager } from '@/persistence/SaveManager';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { PlayerSaveData } from '@/shared/types';

describe('Ammunition Capacity Configuration', () => {
  it('configures initial magazine and maximum reserve capacities for all five weapons', () => {
    // 1. Pistol: 15 Mag, 150 Max Reserve
    expect(WEAPON_COMBAT_CONFIGS.pistol.maxAmmo).toBe(15);
    expect(WEAPON_COMBAT_CONFIGS.pistol.maxReserveAmmo).toBe(150);
    expect(WEAPON_AMMO_CAPACITIES.pistol.magazineCapacity).toBe(15);
    expect(WEAPON_AMMO_CAPACITIES.pistol.maxReserveAmmo).toBe(150);

    // 2. Shotgun: 6 Mag, 48 Max Reserve
    expect(WEAPON_COMBAT_CONFIGS.shotgun.maxAmmo).toBe(6);
    expect(WEAPON_COMBAT_CONFIGS.shotgun.maxReserveAmmo).toBe(48);
    expect(WEAPON_AMMO_CAPACITIES.shotgun.magazineCapacity).toBe(6);
    expect(WEAPON_AMMO_CAPACITIES.shotgun.maxReserveAmmo).toBe(48);

    // 3. Assault Rifle: 30 Mag, 180 Max Reserve
    expect(WEAPON_COMBAT_CONFIGS.rifle.maxAmmo).toBe(30);
    expect(WEAPON_COMBAT_CONFIGS.rifle.maxReserveAmmo).toBe(180);
    expect(WEAPON_AMMO_CAPACITIES.rifle.magazineCapacity).toBe(30);
    expect(WEAPON_AMMO_CAPACITIES.rifle.maxReserveAmmo).toBe(180);

    // 4. Sniper Rifle: 5 Mag, 30 Max Reserve
    expect(WEAPON_COMBAT_CONFIGS.sniper.maxAmmo).toBe(5);
    expect(WEAPON_COMBAT_CONFIGS.sniper.maxReserveAmmo).toBe(30);
    expect(WEAPON_AMMO_CAPACITIES.sniper.magazineCapacity).toBe(5);
    expect(WEAPON_AMMO_CAPACITIES.sniper.maxReserveAmmo).toBe(30);

    // 5. Machine Gun: 100 Mag, 300 Max Reserve
    expect(WEAPON_COMBAT_CONFIGS.machinegun.maxAmmo).toBe(100);
    expect(WEAPON_COMBAT_CONFIGS.machinegun.maxReserveAmmo).toBe(300);
    expect(WEAPON_AMMO_CAPACITIES.machinegun.magazineCapacity).toBe(100);
    expect(WEAPON_AMMO_CAPACITIES.machinegun.maxReserveAmmo).toBe(300);
  });
});

describe('Pickup Capacity Validation & Partial Pickups', () => {
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

  it('1. collects ammunition normally when below maximum capacity', () => {
    // Unlock pistol with 15 in mag and 50 in reserve (max is 150)
    combatManager.unlockWeapon('pistol', 15, 50);

    // Drop 30 pistol rounds at (0, 0, 0)
    const drop = lootManager.spawnWeaponDrop('pistol', new THREE.Vector3(0, 0, 0), 0, 30);
    expect(drop).not.toBeNull();

    lootManager.update(0.016, new THREE.Vector3(0, 0, 0));
    const pickedUp = lootManager.tryPickup(new THREE.Vector3(0, 0, 0));

    expect(pickedUp).toBe(true);
    // Added all 30 rounds: 50 + 30 = 80
    expect(combatManager.getWeaponStats('pistol').reserveAmmo).toBe(80);
    // Drop is fully collected and removed from world
    expect(lootManager.getDroppedItems().length).toBe(0);
  });

  it('2. collects ammunition exactly to maximum capacity', () => {
    // Current reserve is 120 (available space is 150 - 120 = 30)
    combatManager.unlockWeapon('pistol', 15, 120);

    lootManager.spawnWeaponDrop('pistol', new THREE.Vector3(0, 0, 0), 0, 30);
    lootManager.update(0.016, new THREE.Vector3(0, 0, 0));

    const pickedUp = lootManager.tryPickup(new THREE.Vector3(0, 0, 0));
    expect(pickedUp).toBe(true);
    expect(combatManager.getWeaponStats('pistol').reserveAmmo).toBe(150);
    expect(lootManager.getDroppedItems().length).toBe(0);
  });

  it('3. executes partial pickup and leaves leftover ammunition in world pickup when exceeding capacity', () => {
    // Example from user requirement:
    // Maximum pistol reserve: 150
    // Current reserve: 140
    // Pickup quantity: 30
    // Result: Added 10, Remaining in world pickup: 20
    combatManager.unlockWeapon('pistol', 15, 140);
    expect(combatManager.getWeaponStats('pistol').reserveAmmo).toBe(140);
    expect(combatManager.getAvailableReserveSpace('pistol')).toBe(10);

    const drop = lootManager.spawnWeaponDrop('pistol', new THREE.Vector3(0, 0, 0), 0, 30);
    expect(drop).not.toBeNull();
    expect(drop!.reserveAmmo).toBe(30);

    lootManager.update(0.016, new THREE.Vector3(0, 0, 0));
    const pickedUp = lootManager.tryPickup(new THREE.Vector3(0, 0, 0));

    expect(pickedUp).toBe(true);
    // Reserve must be clamped to 150
    expect(combatManager.getWeaponStats('pistol').reserveAmmo).toBe(150);

    // World pickup must NOT disappear; 20 rounds must remain in world
    expect(lootManager.getDroppedItems().length).toBe(1);
    expect(drop!.reserveAmmo).toBe(20);
    expect(drop!.group.parent).toBe(scene);
  });

  it('4. refuses to collect ammunition when reserve is already full and leaves world pickup intact', () => {
    // Current reserve is at maximum (150/150)
    combatManager.unlockWeapon('pistol', 15, 150);
    expect(combatManager.getAvailableReserveSpace('pistol')).toBe(0);

    const drop = lootManager.spawnWeaponDrop('pistol', new THREE.Vector3(0, 0, 0), 0, 30);

    lootManager.update(0.016, new THREE.Vector3(0, 0, 0));
    const pickedUp = lootManager.tryPickup(new THREE.Vector3(0, 0, 0));

    // Must not collect
    expect(pickedUp).toBe(false);
    expect(combatManager.getWeaponStats('pistol').reserveAmmo).toBe(150);

    // World pickup must remain completely intact with all 30 rounds
    expect(lootManager.getDroppedItems().length).toBe(1);
    expect(drop!.reserveAmmo).toBe(30);
  });

  it('5. updates HUD interaction prompt to reflect full capacity or partial amount available', () => {
    // Current reserve is 145 / 150 (only 5 rounds fit)
    combatManager.unlockWeapon('pistol', 15, 145);
    lootManager.spawnWeaponDrop('pistol', new THREE.Vector3(2, 0.5, 2), 0, 20);

    lootManager.update(0.016, new THREE.Vector3(2, 0.5, 2));
    const promptText = useGameUIStore.getState().interactionPrompt.text;
    expect(promptText).toContain('+5 of 20');

    // Fill reserve to 150
    combatManager.setReserveAmmo('pistol', 150);
    lootManager.update(0.016, new THREE.Vector3(2, 0.5, 2));
    const fullPromptText = useGameUIStore.getState().interactionPrompt.text;
    expect(fullPromptText).toContain('[FULL]');
    expect(fullPromptText).toContain('Reserve Maxed (150/150)');
  });
});

describe('Inventory & Reloading Behaviour', () => {
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
  });

  it('maintains independent capacity limits for each weapon type', () => {
    combatManager.unlockWeapon('pistol', 15, 150);
    combatManager.unlockWeapon('shotgun', 6, 48);
    combatManager.unlockWeapon('rifle', 30, 180);
    combatManager.unlockWeapon('sniper', 5, 30);
    combatManager.unlockWeapon('machinegun', 100, 300);

    // Fill pistol reserve attempts to add more: must not exceed 150
    const pistolResult = combatManager.addAmmo('pistol', 50);
    expect(pistolResult.added).toBe(0);
    expect(combatManager.getWeaponStats('pistol').reserveAmmo).toBe(150);

    // Rifle reserve still has its own capacity of 180
    expect(combatManager.getWeaponStats('rifle').reserveAmmo).toBe(180);
    expect(combatManager.getWeaponStats('sniper').reserveAmmo).toBe(30);
    expect(combatManager.getWeaponStats('machinegun').reserveAmmo).toBe(300);
  });

  it('reloading transfers ammunition from reserve to magazine without increasing total ammunition', () => {
    // Pistol mag capacity is 15. Start with 5 in mag, 4 in reserve.
    combatManager.unlockWeapon('pistol', 5, 4);

    const totalBefore = combatManager.getWeaponStats('pistol').currentAmmo + combatManager.getWeaponStats('pistol').reserveAmmo;
    expect(totalBefore).toBe(9);

    combatManager.equipWeapon('pistol');
    combatManager.reload();
    expect(combatManager.getIsReloading()).toBe(true);

    // Advance time past reload duration
    combatManager.update(2.0);
    expect(combatManager.getIsReloading()).toBe(false);

    const stats = combatManager.getWeaponStats('pistol');
    // Transferred all 4 from reserve to magazine: 5 + 4 = 9
    expect(stats.currentAmmo).toBe(9);
    expect(stats.reserveAmmo).toBe(0);

    const totalAfter = stats.currentAmmo + stats.reserveAmmo;
    expect(totalAfter).toBe(9);
    expect(totalAfter).toBe(totalBefore); // Total ammunition owned is strictly conserved
  });

  it('weapon switching preserves all ammunition values independently', () => {
    combatManager.unlockWeapon('pistol', 15, 120);
    combatManager.unlockWeapon('rifle', 30, 180);

    combatManager.equipWeapon('pistol');
    expect(combatManager.getWeaponStats('pistol').currentAmmo).toBe(15);
    expect(combatManager.getWeaponStats('pistol').reserveAmmo).toBe(120);

    // Switch to rifle
    combatManager.equipWeapon('rifle');
    expect(combatManager.getWeaponStats('rifle').currentAmmo).toBe(30);
    expect(combatManager.getWeaponStats('rifle').reserveAmmo).toBe(180);

    // Switch back to pistol: ammunition values must remain intact
    combatManager.equipWeapon('pistol');
    expect(combatManager.getWeaponStats('pistol').currentAmmo).toBe(15);
    expect(combatManager.getWeaponStats('pistol').reserveAmmo).toBe(120);
  });

  it('dropping ammunition correctly reduces reserve inventory and spawns physical pickup', () => {
    combatManager.unlockWeapon('rifle', 30, 100);
    inventoryManager.addItem('ammo_rifle', 100);

    const playerPos = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3(0, 0, 1);

    const drop = lootManager.dropAmmo('rifle', 40, playerPos, forward);
    expect(drop).not.toBeNull();
    expect(drop!.reserveAmmo).toBe(40);

    // Combat manager reserve must be reduced by 40
    expect(combatManager.getWeaponStats('rifle').reserveAmmo).toBe(60);
    // Inventory item count must be reduced by 40
    expect(inventoryManager.getItemCount('ammo_rifle')).toBe(60);
  });

  it('dropping a weapon does not automatically delete reserve ammunition', () => {
    combatManager.unlockWeapon('shotgun', 6, 48);

    const playerPos = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3(0, 0, 1);

    const drop = lootManager.dropWeapon('shotgun', playerPos, forward, 6, 48);
    expect(drop).not.toBeNull();
    expect(drop!.ammo).toBe(6);
    expect(drop!.reserveAmmo).toBe(0); // Dropped weapon only holds chambered ammo

    // Player's reserve ammo is NOT deleted
    expect(combatManager.getWeaponStats('shotgun').reserveAmmo).toBe(48);
  });
});

describe('Save and Load Validation & Capacity Clamping', () => {
  it('clamps saved reserve ammunition that exceeds configured maximum limits upon loading', async () => {
    const saveManager = SaveManager.getInstance();

    // Create a save with hacked / invalid values exceeding configured limits
    const corruptedSave: PlayerSaveData = {
      version: 1,
      timestamp: Date.now(),
      stage: 'hospital',
      cinematicCompleted: true,
      playerPosition: [0, 1, 0],
      playerRotation: 0,
      vitals: { health: 100, maxHealth: 100, stamina: 100, maxStamina: 100, hunger: 100, thirst: 100 },
      inventory: [],
      equippedWeapon: 'pistol',
      weapons: {
        knife: { unlocked: true, currentAmmo: 0, reserveAmmo: 0 },
        bat: { unlocked: false, currentAmmo: 0, reserveAmmo: 0 },
        pistol: { unlocked: true, currentAmmo: 99, reserveAmmo: 999 }, // Max is 15 Mag / 150 Reserve
        shotgun: { unlocked: true, currentAmmo: 50, reserveAmmo: 500 }, // Max is 6 Mag / 48 Reserve
        rifle: { unlocked: true, currentAmmo: 300, reserveAmmo: 1000 }, // Max is 30 Mag / 180 Reserve
        sniper: { unlocked: true, currentAmmo: 20, reserveAmmo: 100 },  // Max is 5 Mag / 30 Reserve
        machinegun: { unlocked: true, currentAmmo: 500, reserveAmmo: 2000 } // Max is 100 Mag / 300 Reserve
      },
      completedMissions: [],
      safehouseUnlocked: false,
      gameTimeMinutes: 10
    };

    // Save game
    await saveManager.saveGame(corruptedSave);

    // Load game: must validate and clamp all values safely
    const loaded = await saveManager.loadGame();
    expect(loaded).not.toBeNull();

    // Verify Pistol clamped to 15 / 150
    expect(loaded!.weapons.pistol.currentAmmo).toBe(15);
    expect(loaded!.weapons.pistol.reserveAmmo).toBe(150);
    expect(loaded!.weapons.pistol.maxReserveAmmo).toBe(150);

    // Verify Shotgun clamped to 6 / 48
    expect(loaded!.weapons.shotgun.currentAmmo).toBe(6);
    expect(loaded!.weapons.shotgun.reserveAmmo).toBe(48);

    // Verify Rifle clamped to 30 / 180
    expect(loaded!.weapons.rifle.currentAmmo).toBe(30);
    expect(loaded!.weapons.rifle.reserveAmmo).toBe(180);

    // Verify Sniper clamped to 5 / 30
    expect(loaded!.weapons.sniper.currentAmmo).toBe(5);
    expect(loaded!.weapons.sniper.reserveAmmo).toBe(30);

    // Verify Machine Gun clamped to 100 / 300
    expect(loaded!.weapons.machinegun.currentAmmo).toBe(100);
    expect(loaded!.weapons.machinegun.reserveAmmo).toBe(300);
  });
});
