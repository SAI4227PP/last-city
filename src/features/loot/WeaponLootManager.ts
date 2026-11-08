import * as THREE from 'three';
import { WeaponType, WeaponRarity } from '@/shared/types';
import { WEAPON_COMBAT_CONFIGS, WEAPON_AMMO_ITEM_MAP } from '@/data/combat';
import { WeaponAssetPool } from '@/features/combat/WeaponAssetPool';
import { CombatManager } from '@/features/combat/CombatManager';
import { InventoryManager } from '@/features/inventory/InventoryManager';
import { EventBus } from '@/core/events/EventBus';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { Logger } from '@/core/utils/Logger';

export type LootSourceType =
  | 'zombie_walker'
  | 'zombie_runner'
  | 'zombie_brute'
  | 'zombie_boss'
  | 'crate_civilian'
  | 'crate_police'
  | 'crate_military'
  | 'world_static'
  | 'player_drop';

export interface DroppedWeaponItem {
  id: string;
  weapon: WeaponType;
  rarity: WeaponRarity;
  name: string;
  ammo: number;
  reserveAmmo: number;
  position: THREE.Vector3;
  baseY: number;
  targetY: number;
  group: THREE.Group;
  settlingTimer: number; // 0 to 1 for dropping and settling on floor
  isSettled: boolean;
  pulseTimer: number;
  rarityLight?: THREE.PointLight;
  rarityRing?: THREE.Mesh;
}

export const RARITY_COLORS: Record<WeaponRarity, number> = {
  common: 0xd1d5db,     // Clean Light Steel
  uncommon: 0x22c55e,   // Tactical Green
  rare: 0x3b82f6,       // Military Blue
  epic: 0xa855f7,       // Spec-Ops Purple
  legendary: 0xf59e0b   // Mastercraft Amber Gold
};

export const WEAPON_RARITY_MAP: Record<WeaponType, WeaponRarity> = {
  knife: 'common',
  bat: 'common',
  pistol: 'common',
  shotgun: 'uncommon',
  rifle: 'rare',
  sniper: 'epic',
  machinegun: 'legendary'
};

export class WeaponLootManager {
  private scene: THREE.Scene;
  private combatManager: CombatManager;
  private inventoryManager: InventoryManager;
  private physicsWorld?: PhysicsWorld;
  private eventBus: EventBus;

  private droppedItems: Map<string, DroppedWeaponItem> = new Map();
  private collectedDropIds: Set<string> = new Set();
  private activeNearbyDrop: DroppedWeaponItem | null = null;
  private interactionRadius: number = 2.2;

  // Shared geometry & ring materials for performance
  private static ringGeometry = new THREE.RingGeometry(0.35, 0.45, 24);
  private ringMaterials: Map<WeaponRarity, THREE.MeshBasicMaterial> = new Map();
  private zombieKilledListener: (data: { id: string; variant: string; position: [number, number, number] }) => void;

  constructor(
    scene: THREE.Scene,
    combatManager: CombatManager,
    inventoryManager: InventoryManager,
    physicsWorld?: PhysicsWorld
  ) {
    this.scene = scene;
    this.combatManager = combatManager;
    this.inventoryManager = inventoryManager;
    this.physicsWorld = physicsWorld;
    this.eventBus = EventBus.getInstance();

    this.initMaterials();

    // Listen to zombie kill events for random zombie loot drops
    this.zombieKilledListener = (data: { id: string; variant: string; position: [number, number, number] }) => {
      this.handleZombieKilled(data.variant, new THREE.Vector3(...data.position));
    };
    this.eventBus.on('zombie:killed', this.zombieKilledListener);
  }

  private initMaterials(): void {
    (Object.keys(RARITY_COLORS) as WeaponRarity[]).forEach((rarity) => {
      const mat = new THREE.MeshBasicMaterial({
        color: RARITY_COLORS[rarity],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
      });
      this.ringMaterials.set(rarity, mat);
    });
  }

  /**
   * Evaluates weighted drop probabilities per loot source type.
   */
  public rollRandomWeapon(source: LootSourceType): WeaponType | null {
    // 1. Overall weapon drop chance check
    let dropChance = 0.12; // Default 12% for common zombies
    if (source === 'zombie_brute') dropChance = 0.45;
    else if (source === 'zombie_boss') dropChance = 0.95;
    else if (source.startsWith('crate_') || source === 'world_static') dropChance = 1.0;

    if (Math.random() > dropChance) {
      return null;
    }

    // 2. Weighted probability distribution
    const rand = Math.random() * 100;

    if (source === 'crate_military' || source === 'zombie_boss') {
      // High-tier loot source
      if (rand < 15) return 'machinegun';    // 15% Legendary
      if (rand < 40) return 'sniper';        // 25% Epic
      if (rand < 75) return 'rifle';         // 35% Rare
      return 'shotgun';                      // 25% Uncommon
    } else if (source === 'crate_police' || source === 'zombie_brute') {
      // Mid-tier tactical source
      if (rand < 5) return 'machinegun';     // 5%
      if (rand < 15) return 'sniper';        // 10%
      if (rand < 45) return 'rifle';         // 30%
      if (rand < 80) return 'shotgun';       // 35%
      return 'pistol';                       // 20%
    } else {
      // Standard world / civilian / zombie drops:
      // Pistol: 40%, Shotgun: 25%, Assault Rifle: 20%, Sniper: 10%, Machine Gun: 5%
      if (rand < 40) return 'pistol';
      if (rand < 65) return 'shotgun';
      if (rand < 85) return 'rifle';
      if (rand < 95) return 'sniper';
      return 'machinegun';
    }
  }

  /**
   * Automatically roll and drop loot when a zombie is eliminated.
   */
  private handleZombieKilled(variant: string, pos: THREE.Vector3): void {
    const source: LootSourceType =
      variant === 'boss'
        ? 'zombie_boss'
        : variant === 'brute'
        ? 'zombie_brute'
        : variant === 'runner'
        ? 'zombie_runner'
        : 'zombie_walker';

    const weapon = this.rollRandomWeapon(source);
    if (weapon) {
      // Offset slightly to drop beside the fallen body
      const dropPos = pos.clone();
      dropPos.x += (Math.random() - 0.5) * 0.8;
      dropPos.z += (Math.random() - 0.5) * 0.8;
      dropPos.y += 0.8; // Fall from zombie height

      this.spawnWeaponDrop(weapon, dropPos);
    }
  }

  /**
   * Spawns a physical 3D weapon drop in the world with authentic model,
   * ground detection, drop animation, and rarity indicator.
   */
  public spawnWeaponDrop(
    weapon: WeaponType,
    spawnPos: THREE.Vector3,
    initialAmmo?: number,
    initialReserve?: number,
    persistentId?: string
  ): DroppedWeaponItem | null {
    const id = persistentId || `drop_${weapon}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    if (this.collectedDropIds.has(id)) {
      return null;
    }

    const cfg = WEAPON_COMBAT_CONFIGS[weapon];
    const rarity = WEAPON_RARITY_MAP[weapon] || 'common';
    const ammo = initialAmmo !== undefined ? initialAmmo : cfg.maxAmmo;
    const reserve = initialReserve !== undefined ? initialReserve : Math.floor(cfg.maxAmmo * 1.5);

    // 1. Raycast downward to locate precise ground/floor level
    let targetGroundY = spawnPos.y;
    if (this.physicsWorld) {
      const rayStart = spawnPos.clone();
      rayStart.y += 1.0;
      const hit = this.physicsWorld.raycast(rayStart, new THREE.Vector3(0, -1, 0), 6.0, true);
      if (hit && hit.distance > 0.05) {
        targetGroundY = rayStart.y - hit.distance + 0.12;
      }
    }

    // 2. Create Root Group & 3D Model
    const dropGroup = new THREE.Group();
    dropGroup.name = `LootDrop_${id}`;
    dropGroup.position.copy(spawnPos);

    const modelMesh = WeaponAssetPool.getInstance().createWeaponDropMesh(weapon);
    dropGroup.add(modelMesh);

    // 3. Subtle Rarity Ring on the ground
    const ringMat = this.ringMaterials.get(rarity);
    let rarityRing: THREE.Mesh | undefined;
    if (ringMat) {
      rarityRing = new THREE.Mesh(WeaponLootManager.ringGeometry, ringMat);
      rarityRing.rotation.x = -Math.PI / 2;
      rarityRing.position.y = 0.02;
      dropGroup.add(rarityRing);
    }

    // 4. Subtle non-intrusive point light for rare/epic/legendary weapons
    let rarityLight: THREE.PointLight | undefined;
    if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
      rarityLight = new THREE.PointLight(RARITY_COLORS[rarity], 0.75, 2.0);
      rarityLight.position.set(0, 0.25, 0);
      dropGroup.add(rarityLight);
    }

    this.scene.add(dropGroup);

    const item: DroppedWeaponItem = {
      id,
      weapon,
      rarity,
      name: cfg.name,
      ammo,
      reserveAmmo: reserve,
      position: spawnPos.clone(),
      baseY: spawnPos.y,
      targetY: targetGroundY,
      group: dropGroup,
      settlingTimer: 0,
      isSettled: false,
      pulseTimer: Math.random() * Math.PI,
      rarityLight,
      rarityRing
    };

    this.droppedItems.set(id, item);
    return item;
  }

  /**
   * Per-frame update: handles ground settling, hovering, rotation,
   * distance culling, and player proximity prompt.
   */
  public update(dt: number, playerPos: THREE.Vector3): void {
    let closestDrop: DroppedWeaponItem | null = null;
    let closestDist = Infinity;

    for (const item of this.droppedItems.values()) {
      const distToPlayer = playerPos.distanceTo(item.group.position);

      // Distance culling: Skip animation/updates if beyond 40m
      if (distToPlayer > 40) continue;

      // 1. Drop & Settling animation
      if (!item.isSettled) {
        item.settlingTimer = Math.min(1.0, item.settlingTimer + dt * 2.8);
        const t = item.settlingTimer;
        // Ease-out with gentle bounce
        const currentY = THREE.MathUtils.lerp(item.baseY, item.targetY, Math.sin(t * (Math.PI / 2)));
        item.group.position.y = currentY;

        if (item.settlingTimer >= 1.0) {
          item.isSettled = true;
          item.group.position.y = item.targetY;
        }
      } else {
        // 2. Gentle hover & subtle rotation
        item.pulseTimer += dt * 1.8;
        const hoverOffset = Math.sin(item.pulseTimer) * 0.025;
        item.group.position.y = item.targetY + hoverOffset;
        item.group.rotation.y += dt * 0.75;

        // Subtle ring pulse
        if (item.rarityRing) {
          const ringMat = item.rarityRing.material as THREE.MeshBasicMaterial;
          ringMat.opacity = 0.35 + (Math.sin(item.pulseTimer * 1.5) + 1) * 0.15;
        }
      }

      // 3. Proximity check for interaction
      if (distToPlayer <= this.interactionRadius && distToPlayer < closestDist) {
        closestDist = distToPlayer;
        closestDrop = item;
      }
    }

    const hadNearby = this.activeNearbyDrop !== null;
    this.activeNearbyDrop = closestDrop;

    // 4. Update HUD prompt
    if (closestDrop) {
      const isUnlocked = this.combatManager.isWeaponUnlocked(closestDrop.weapon);
      const totalAmmo = closestDrop.ammo + closestDrop.reserveAmmo;
      if (isUnlocked && totalAmmo > 0) {
        const stats = this.combatManager.getWeaponStats(closestDrop.weapon);
        const available = Math.max(0, stats.maxReserveAmmo - stats.reserveAmmo);
        if (available <= 0) {
          useGameUIStore.getState().setInteractionPrompt({
            visible: true,
            text: `[FULL] ${closestDrop.name} Ammo (${totalAmmo} rounds) — Reserve Maxed (${stats.reserveAmmo}/${stats.maxReserveAmmo})`,
            key: 'E'
          });
        } else if (available < totalAmmo) {
          useGameUIStore.getState().setInteractionPrompt({
            visible: true,
            text: `Pick up ${closestDrop.name} Ammo (+${available} of ${totalAmmo}) [${closestDrop.rarity.toUpperCase()}]`,
            key: 'E'
          });
        } else {
          useGameUIStore.getState().setInteractionPrompt({
            visible: true,
            text: `Pick up ${closestDrop.name} Ammo (+${totalAmmo}) [${closestDrop.rarity.toUpperCase()}]`,
            key: 'E'
          });
        }
      } else {
        useGameUIStore.getState().setInteractionPrompt({
          visible: true,
          text: `Pick up ${closestDrop.name} [${closestDrop.rarity.toUpperCase()}]`,
          key: 'E'
        });
      }
    } else if (hadNearby) {
      useGameUIStore.getState().setInteractionPrompt({
        visible: false,
        text: '',
        key: 'E'
      });
    }
  }

  /**
   * Attempts to pick up the active weapon drop when player presses 'E'.
   * Validates reserve capacity:
   * - Never exceeds configured maximum reserve ammo.
   * - Never silently deletes excess ammunition.
   * - If inventory/reserve is full, does not collect and leaves pickup intact.
   * - Partial pickups take only what fits and leave the remainder in the world pickup.
   */
  public tryPickup(playerPos: THREE.Vector3): boolean {
    if (!this.activeNearbyDrop) return false;

    const item = this.activeNearbyDrop;
    const dist = playerPos.distanceTo(item.group.position);
    if (dist > this.interactionRadius + 0.5) return false;

    const isAlreadyUnlocked = this.combatManager.isWeaponUnlocked(item.weapon);
    const ammoItemId = WEAPON_AMMO_ITEM_MAP[item.weapon];

    // CASE 1: Weapon is not unlocked yet
    if (!isAlreadyUnlocked) {
      const cfg = WEAPON_COMBAT_CONFIGS[item.weapon];
      const maxMag = cfg.maxAmmo;
      const maxReserve = cfg.maxReserveAmmo;

      // Magazine gets filled first
      const magGiven = Math.min(item.ammo, maxMag);
      const leftoverMag = Math.max(0, item.ammo - magGiven);
      const totalAvailableReserve = leftoverMag + item.reserveAmmo;

      // Reserve gets filled up to maxReserve
      const reserveGiven = Math.min(totalAvailableReserve, maxReserve);
      const excessRemaining = totalAvailableReserve - reserveGiven;

      this.combatManager.unlockWeapon(item.weapon, magGiven, reserveGiven);
      this.inventoryManager.addItem(`item_${item.weapon}`, 1);
      if (reserveGiven > 0 && ammoItemId) {
        this.inventoryManager.addItem(ammoItemId, reserveGiven);
      }

      this.eventBus.emit('audio:play_sfx', { sound: 'pickup', volume: 0.9 });
      this.eventBus.emit('player:interact', undefined);

      if (excessRemaining > 0) {
        // Excess ammunition remains in the world pickup!
        item.ammo = 0;
        item.reserveAmmo = excessRemaining;
        this.eventBus.emit('subtitle:show', {
          speaker: 'EQUIPMENT',
          text: `Acquired: ${item.name} (${item.rarity.toUpperCase()}) — Ammo: +${magGiven} loaded, +${reserveGiven} reserve. Remainder in crate: ${excessRemaining}`,
          durationMs: 3500
        });
        Logger.info(`WeaponLootManager: Player unlocked ${item.name}; ${excessRemaining} excess ammo remains in world.`);
      } else {
        // Fully collected
        this.collectedDropIds.add(item.id);
        this.droppedItems.delete(item.id);
        if (item.group.parent) item.group.parent.remove(item.group);
        this.activeNearbyDrop = null;
        useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });

        this.eventBus.emit('subtitle:show', {
          speaker: 'EQUIPMENT',
          text: `Acquired: ${item.name} (${item.rarity.toUpperCase()}) — Ammo: +${magGiven + reserveGiven}`,
          durationMs: 3000
        });
        Logger.info(`WeaponLootManager: Player picked up ${item.name} (${item.weapon}).`);
      }

      return true;
    }

    // CASE 2: Weapon is already unlocked -> pickup acts as ammunition pickup for this weapon
    const totalOfferedAmmo = item.ammo + item.reserveAmmo;
    if (totalOfferedAmmo <= 0) {
      // Empty pickup, clean up
      this.collectedDropIds.add(item.id);
      this.droppedItems.delete(item.id);
      if (item.group.parent) item.group.parent.remove(item.group);
      this.activeNearbyDrop = null;
      useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });
      return true;
    }

    const currentStats = this.combatManager.getWeaponStats(item.weapon);
    const availableSpace = Math.max(0, currentStats.maxReserveAmmo - currentStats.reserveAmmo);

    // If reserve is ALREADY at maximum capacity, DO NOT collect
    if (availableSpace <= 0) {
      this.eventBus.emit('audio:play_sfx', { sound: 'empty_click', volume: 0.8 });
      this.eventBus.emit('subtitle:show', {
        speaker: 'INVENTORY',
        text: `${item.name} Ammo Reserve is FULL (${currentStats.reserveAmmo}/${currentStats.maxReserveAmmo})! Cannot carry more.`,
        durationMs: 2500
      });
      Logger.info(`WeaponLootManager: Cannot collect ${item.name} ammo - reserve at capacity (${currentStats.reserveAmmo}/${currentStats.maxReserveAmmo}).`);
      return false;
    }

    // Add only the amount that fits
    const addResult = this.combatManager.addAmmo(item.weapon, totalOfferedAmmo);
    const added = addResult.added;
    const remaining = addResult.remaining;

    if (ammoItemId && added > 0) {
      this.inventoryManager.addItem(ammoItemId, added);
    }

    this.eventBus.emit('audio:play_sfx', { sound: 'pickup', volume: 0.9 });
    this.eventBus.emit('player:interact', undefined);

    if (remaining > 0) {
      // PARTIAL PICKUP: Update remaining ammo on world pickup; DO NOT delete drop!
      item.ammo = 0;
      item.reserveAmmo = remaining;
      this.eventBus.emit('subtitle:show', {
        speaker: 'EQUIPMENT',
        text: `Acquired: +${added} ${item.name} Ammo (${currentStats.reserveAmmo}/${currentStats.maxReserveAmmo}) — Left in world: ${remaining}`,
        durationMs: 3000
      });
      Logger.info(`WeaponLootManager: Partial pickup of ${item.name} ammo: added ${added}, remaining in world: ${remaining}.`);
    } else {
      // FULL PICKUP: Remove drop from scene
      this.collectedDropIds.add(item.id);
      this.droppedItems.delete(item.id);
      if (item.group.parent) item.group.parent.remove(item.group);
      this.activeNearbyDrop = null;
      useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });

      this.eventBus.emit('subtitle:show', {
        speaker: 'EQUIPMENT',
        text: `Acquired: +${added} ${item.name} Ammo (Reserve: ${currentStats.reserveAmmo}/${currentStats.maxReserveAmmo})`,
        durationMs: 3000
      });
      Logger.info(`WeaponLootManager: Full pickup of ${item.name} ammo: added ${added}.`);
    }

    return true;
  }

  /**
   * Spawns a physical drop when player drops an equipped weapon.
   * Requirement: Dropping a weapon must NOT automatically delete reserve ammunition.
   */
  public dropWeapon(
    weapon: WeaponType,
    playerPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    currentAmmo: number,
    _reserveAmmo: number = 0
  ): DroppedWeaponItem | null {
    // Cannot drop default knife or bat
    if (weapon === 'knife' || weapon === 'bat') return null;

    const dropPos = playerPos.clone().addScaledVector(forwardDir, 1.2);
    dropPos.y += 0.8;

    // The dropped weapon carries its magazine ammo; player's reserve ammo remains intact
    return this.spawnWeaponDrop(weapon, dropPos, currentAmmo, 0);
  }

  /**
   * Drops ammunition from player reserve into a physical world pickup.
   * Requirement: Dropping ammunition must correctly reduce reserve inventory.
   */
  public dropAmmo(
    weapon: WeaponType,
    amount: number,
    playerPos: THREE.Vector3,
    forwardDir: THREE.Vector3
  ): DroppedWeaponItem | null {
    if (weapon === 'knife' || weapon === 'bat' || amount <= 0) return null;

    const currentStats = this.combatManager.getWeaponStats(weapon);
    const dropAmount = Math.min(currentStats.reserveAmmo, amount);
    if (dropAmount <= 0) return null;

    // Deduct from combat manager reserve
    this.combatManager.removeAmmo(weapon, dropAmount);

    // Deduct from inventory if matching item exists
    const ammoItemId = WEAPON_AMMO_ITEM_MAP[weapon];
    if (ammoItemId) {
      this.inventoryManager.removeItem(ammoItemId, dropAmount);
    }

    const dropPos = playerPos.clone().addScaledVector(forwardDir, 1.2);
    dropPos.y += 0.8;

    Logger.info(`WeaponLootManager: Dropped ${dropAmount} rounds of ${weapon} ammo into world.`);
    return this.spawnWeaponDrop(weapon, dropPos, 0, dropAmount);
  }

  public getDroppedItems(): DroppedWeaponItem[] {
    return Array.from(this.droppedItems.values());
  }

  public getCollectedDropIds(): string[] {
    return Array.from(this.collectedDropIds);
  }

  public setCollectedDropIds(ids: string[]): void {
    this.collectedDropIds = new Set(ids);
  }

  public dispose(): void {
    if (this.zombieKilledListener) {
      this.eventBus.off('zombie:killed', this.zombieKilledListener);
    }
    for (const item of this.droppedItems.values()) {
      if (item.group.parent) {
        item.group.parent.remove(item.group);
      }
    }
    this.droppedItems.clear();
    this.activeNearbyDrop = null;
    this.ringMaterials.forEach((m) => m.dispose());
    this.ringMaterials.clear();
  }
}
