import * as THREE from 'three';
import { WeaponType } from '@/shared/types';
import { WEAPON_DEFINITIONS, ExtendedWeaponStats } from '@/data/weapons';
import { CombatConfigManager, HitLocation } from '@/data/combat';
import { ZombieAI } from '@/features/zombies/ai/ZombieAI';
import { EventBus } from '@/core/events/EventBus';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { CameraManager } from '@/core/engine/CameraManager';
import { ParticleSystem } from '@/core/engine/ParticleSystem';
import { ZombieManager } from '@/features/zombies/ZombieManager';
import { WeaponAssetPool } from './WeaponAssetPool';

export class CombatManager {
  private weapons: Record<WeaponType, ExtendedWeaponStats>;
  private unlockedWeapons: Set<WeaponType> = new Set(['knife', 'pistol']);
  private equippedWeapon: WeaponType = 'knife';
  private fireTimer: number = 0;
  private isReloading: boolean = false;
  private reloadTimer: number = 0;
  private isPlayerDead: boolean = false;

  private eventBus: EventBus;
  private cameraManager: CameraManager;
  private particleSystem?: ParticleSystem;
  private zombieManager?: ZombieManager;

  // Flashlight / muzzle flash
  private muzzleFlashLight: THREE.PointLight;

  constructor(
    scene: THREE.Scene,
    cameraManager: CameraManager,
    particleSystem?: ParticleSystem
  ) {
    this.eventBus = EventBus.getInstance();
    this.cameraManager = cameraManager;
    this.particleSystem = particleSystem;

    // Deep clone weapon definitions
    this.weapons = JSON.parse(JSON.stringify(WEAPON_DEFINITIONS));
    this.weapons.pistol.currentAmmo = 15;
    this.weapons.pistol.reserveAmmo = 30;

    // Muzzle flash point light
    this.muzzleFlashLight = new THREE.PointLight(0xffaa22, 0, 10);
    scene.add(this.muzzleFlashLight);

    // Listen to slot select events from UI and InputManager
    this.eventBus.on('weapon:select_slot', (data: { slot: number }) => {
      this.equipSlot(data.slot);
    });

    this.eventBus.on('weapon:select', (data: { weapon: WeaponType }) => {
      this.equipWeapon(data.weapon);
    });

    this.eventBus.on('weapon:reload_request', () => {
      this.reload();
    });

    this.eventBus.on('player:death', () => {
      this.isPlayerDead = true;
      this.isReloading = false;
    });

    this.syncToStore();
  }

  public setZombieManager(manager: ZombieManager): void {
    this.zombieManager = manager;
  }

  public getEquippedWeapon(): WeaponType {
    return this.equippedWeapon;
  }

  public getWeaponStats(type: WeaponType): ExtendedWeaponStats {
    return this.weapons[type];
  }

  public isWeaponUnlocked(type: WeaponType): boolean {
    return this.unlockedWeapons.has(type);
  }

  public getUnlockedWeapons(): WeaponType[] {
    return Array.from(this.unlockedWeapons);
  }

  public unlockWeapon(type: WeaponType, initialAmmo?: number, initialReserve?: number): void {
    this.unlockedWeapons.add(type);
    const weapon = this.weapons[type];
    if (weapon) {
      if (initialAmmo !== undefined) {
        weapon.currentAmmo = Math.min(initialAmmo, weapon.maxAmmo);
      }
      if (initialReserve !== undefined) {
        weapon.reserveAmmo = Math.min(initialReserve, weapon.maxReserveAmmo);
      }
    }
    this.equipWeapon(type);
  }

  /**
   * Adds reserve ammunition for the specified weapon, clamped to its maximum reserve capacity.
   * Never exceeds configured maxReserveAmmo.
   * Returns the exact amount added and any leftover amount that could not fit.
   */
  public addAmmo(type: WeaponType, amount: number): { added: number; remaining: number } {
    const weapon = this.weapons[type];
    if (!weapon || !weapon.isRanged || amount <= 0) {
      return { added: 0, remaining: amount };
    }

    const availableSpace = Math.max(0, weapon.maxReserveAmmo - weapon.reserveAmmo);
    if (availableSpace <= 0) {
      return { added: 0, remaining: amount };
    }

    const added = Math.min(availableSpace, amount);
    const remaining = amount - added;

    weapon.reserveAmmo += added;
    this.syncToStore();

    return { added, remaining };
  }

  /**
   * Safely removes reserve ammunition (e.g. when dropping ammo).
   */
  public removeAmmo(type: WeaponType, amount: number): number {
    const weapon = this.weapons[type];
    if (!weapon || !weapon.isRanged || amount <= 0) return 0;
    const removed = Math.min(weapon.reserveAmmo, amount);
    weapon.reserveAmmo -= removed;
    this.syncToStore();
    return removed;
  }

  /**
   * Sets reserve ammunition directly, clamped to [0, maxReserveAmmo].
   */
  public setReserveAmmo(type: WeaponType, amount: number): void {
    const weapon = this.weapons[type];
    if (!weapon || !weapon.isRanged) return;
    weapon.reserveAmmo = Math.max(0, Math.min(amount, weapon.maxReserveAmmo));
    this.syncToStore();
  }

  public getAvailableReserveSpace(type: WeaponType): number {
    const weapon = this.weapons[type];
    if (!weapon || !weapon.isRanged) return 0;
    return Math.max(0, weapon.maxReserveAmmo - weapon.reserveAmmo);
  }

  public getMaxReserveAmmo(type: WeaponType): number {
    return this.weapons[type]?.maxReserveAmmo ?? 0;
  }

  public equipSlot(slotNumber: number): boolean {
    const slotMap: Record<number, WeaponType> = {
      1: 'knife',
      2: 'pistol',
      3: 'shotgun',
      4: 'rifle',
      5: 'sniper',
      6: 'machinegun'
    };

    const targetWeapon = slotMap[slotNumber];
    if (targetWeapon && this.unlockedWeapons.has(targetWeapon)) {
      this.equipWeapon(targetWeapon);
      return true;
    }
    return false;
  }

  public equipWeapon(type: WeaponType): void {
    if (!this.unlockedWeapons.has(type)) return;
    if (this.equippedWeapon === type) return;
    this.equippedWeapon = type;
    this.isReloading = false;
    this.eventBus.emit('weapon:switch', { weapon: type });
    this.syncToStore();
  }

  public attack(playerPos: THREE.Vector3, forwardDir: THREE.Vector3): boolean {
    if (this.isPlayerDead || this.fireTimer > 0 || this.isReloading) return false;

    const weapon = this.weapons[this.equippedWeapon];
    this.fireTimer = 1.0 / weapon.fireRate;

    if (weapon.isRanged) {
      return this.fireGun(playerPos, forwardDir, weapon);
    } else {
      return this.swingMelee(playerPos, forwardDir, weapon);
    }
  }

  private fireGun(playerPos: THREE.Vector3, forwardDir: THREE.Vector3, weapon: ExtendedWeaponStats): boolean {
    if (weapon.currentAmmo <= 0) {
      this.eventBus.emit('audio:play_sfx', { sound: 'click', volume: 0.6 });
      this.reload();
      return false;
    }

    weapon.currentAmmo--;

    // Distinct audio SFX for all five firearms
    const sfx =
      weapon.id === 'shotgun'
        ? 'gunshot_shotgun'
        : weapon.id === 'rifle'
        ? 'gunshot_rifle'
        : weapon.id === 'sniper'
        ? 'gunshot_sniper'
        : weapon.id === 'machinegun'
        ? 'gunshot_machinegun'
        : 'gunshot_pistol';
    this.eventBus.emit('audio:play_sfx', { sound: sfx, volume: 1.0 });

    // Emit weapon fire event for UI, audio, and player recoil animation
    this.eventBus.emit('weapon:fire', {
      weapon: weapon.id,
      currentAmmo: weapon.currentAmmo,
      reserveAmmo: weapon.reserveAmmo
    });

    // Camera recoil & screen trauma
    this.cameraManager.addTrauma(weapon.recoil);

    // Muzzle flash visual positioned at the actual barrel offset
    const muzzleOffset = WeaponAssetPool.getInstance().getMuzzleOffset(weapon.id);
    const flashPos = playerPos
      .clone()
      .add(new THREE.Vector3(0, 1.45, 0))
      .add(forwardDir.clone().multiplyScalar(muzzleOffset.z))
      .add(new THREE.Vector3(0, muzzleOffset.y, 0));
    this.muzzleFlashLight.position.copy(flashPos);
    this.muzzleFlashLight.intensity = weapon.id === 'sniper' ? 5.0 : weapon.id === 'shotgun' ? 4.5 : 3.5;
    setTimeout(() => {
      this.muzzleFlashLight.intensity = 0;
    }, 60);

    // Hit detection against zombies
    if (this.zombieManager) {
      const rayOrigin = playerPos.clone().add(new THREE.Vector3(0, 1.45, 0));
      const cam = this.cameraManager.camera;
      const camOrigin = cam ? cam.position.clone() : undefined;
      const camDir = cam ? cam.getWorldDirection(new THREE.Vector3()) : undefined;

      if (weapon.id === 'shotgun') {
        // Multi-pellet shotgun simulation
        const pelletCount = weapon.pelletCount ?? 8;
        const spread = weapon.spreadAngleRad ?? 0.075;
        let anyHit = false;
        let anyHeadshot = false;
        const hitMap = new Map<ZombieAI, { damage: number; isHeadshot: boolean; hitPoint: THREE.Vector3; hitLocation: HitLocation }>();

        for (let p = 0; p < pelletCount; p++) {
          const pelletDir = forwardDir.clone();
          if (p > 0) {
            pelletDir.x += (Math.random() - 0.5) * spread;
            pelletDir.y += (Math.random() - 0.5) * (spread * 0.7);
            pelletDir.z += (Math.random() - 0.5) * spread;
            pelletDir.normalize();
          }

          const hit = this.zombieManager.checkRayHit(rayOrigin, pelletDir, weapon.range);
          if (hit) {
            anyHit = true;
            if (hit.isHeadshot) anyHeadshot = true;

            const dmgCalc = CombatConfigManager.getInstance().calculateDamage(
              'shotgun',
              hit.hitLocation,
              hit.zombie.variant,
              true // isPellet
            );

            const result = hit.zombie.takeDamage(dmgCalc.finalDamage, hit.hitPoint, hit.hitLocation);

            if (!hitMap.has(hit.zombie)) {
              hitMap.set(hit.zombie, {
                damage: 0,
                isHeadshot: false,
                hitPoint: hit.hitPoint,
                hitLocation: hit.hitLocation
              });
            }
            const entry = hitMap.get(hit.zombie)!;
            entry.damage += result.damageDealt;
            if (hit.isHeadshot) entry.isHeadshot = true;
            entry.hitPoint = hit.hitPoint;

            this.particleSystem?.spawnBloodSplatter(hit.hitPoint, hit.isHeadshot ? 18 : 10, pelletDir.clone().negate(), hit.isHeadshot);
          }
        }

        if (anyHit) {
          useGameUIStore.getState().setCrosshairHit(true, anyHeadshot);
          if (anyHeadshot) {
            this.eventBus.emit('audio:play_sfx', { sound: 'headshot_hit', volume: 1.0 });
          }

          hitMap.forEach((entry, zombie) => {
            this.eventBus.emit('weapon:hit', {
              targetType: 'zombie',
              damage: entry.damage,
              isHeadshot: entry.isHeadshot,
              position: [entry.hitPoint.x, entry.hitPoint.y, entry.hitPoint.z]
            });

            this.eventBus.emit('combat:damage_number', {
              amount: entry.damage,
              position: [entry.hitPoint.x, entry.hitPoint.y, entry.hitPoint.z],
              isHeadshot: entry.isHeadshot,
              hitLocation: entry.hitLocation,
              remainingHealth: zombie.currentHealth,
              maxHealth: zombie.maxHealth,
              targetName: zombie.config.name
            });
          });
        }
      } else {
        // Single projectile / raycast weapon (pistol, rifle)
        const hit = this.zombieManager.checkRayHit(rayOrigin, forwardDir, weapon.range, camOrigin, camDir);

        if (hit) {
          const dmgCalc = CombatConfigManager.getInstance().calculateDamage(
            weapon.id,
            hit.hitLocation,
            hit.zombie.variant,
            false
          );

          const result = hit.zombie.takeDamage(dmgCalc.finalDamage, hit.hitPoint, hit.hitLocation);

          this.particleSystem?.spawnBloodSplatter(hit.hitPoint, hit.isHeadshot ? 40 : 22, forwardDir.clone().negate(), hit.isHeadshot);
          useGameUIStore.getState().setCrosshairHit(true, hit.isHeadshot);

          if (hit.isHeadshot) {
            this.eventBus.emit('audio:play_sfx', { sound: 'headshot_hit', volume: 1.0 });
          }

          this.eventBus.emit('weapon:hit', {
            targetType: 'zombie',
            damage: result.damageDealt,
            isHeadshot: hit.isHeadshot,
            position: [hit.hitPoint.x, hit.hitPoint.y, hit.hitPoint.z]
          });

          this.eventBus.emit('combat:damage_number', {
            amount: result.damageDealt,
            position: [hit.hitPoint.x, hit.hitPoint.y, hit.hitPoint.z],
            isHeadshot: hit.isHeadshot,
            hitLocation: hit.hitLocation,
            armorReduced: result.armorReduced,
            remainingHealth: result.remainingHealth,
            maxHealth: hit.zombie.maxHealth,
            targetName: hit.zombie.config.name
          });
        }
      }
    }

    // Alert nearby zombies with gunshot noise
    if (this.zombieManager) {
      this.zombieManager.alertNearbyZombies(playerPos, weapon.id === 'shotgun' ? 35 : 25);
    }

    this.syncToStore();
    return true;
  }

  private swingMelee(playerPos: THREE.Vector3, forwardDir: THREE.Vector3, weapon: ExtendedWeaponStats): boolean {
    this.eventBus.emit('audio:play_sfx', { sound: 'melee_swing', volume: 0.8 });

    if (this.zombieManager) {
      const swingOrigin = playerPos.clone().add(new THREE.Vector3(0, 1.3, 0));
      const hit = this.zombieManager.checkMeleeSweep(swingOrigin, forwardDir, weapon.range, 1.6);

      if (hit) {
        const dmgCalc = CombatConfigManager.getInstance().calculateDamage(
          weapon.id,
          hit.hitLocation,
          hit.zombie.variant,
          false
        );

        const result = hit.zombie.takeDamage(dmgCalc.finalDamage, hit.hitPoint, hit.hitLocation);

        this.particleSystem?.spawnBloodSplatter(hit.hitPoint, 18, forwardDir.clone().negate(), false);
        this.eventBus.emit('audio:play_sfx', { sound: 'melee_hit', volume: 1.0 });
        useGameUIStore.getState().setCrosshairHit(true, false);
        this.cameraManager.addTrauma(0.04);

        this.eventBus.emit('weapon:hit', {
          targetType: 'zombie',
          damage: result.damageDealt,
          isHeadshot: false,
          position: [hit.hitPoint.x, hit.hitPoint.y, hit.hitPoint.z]
        });

        this.eventBus.emit('combat:damage_number', {
          amount: result.damageDealt,
          position: [hit.hitPoint.x, hit.hitPoint.y, hit.hitPoint.z],
          isHeadshot: false,
          hitLocation: hit.hitLocation,
          armorReduced: result.armorReduced,
          remainingHealth: result.remainingHealth,
          maxHealth: hit.zombie.maxHealth,
          targetName: hit.zombie.config.name
        });
      }
    }

    this.syncToStore();
    return true;
  }

  public reload(): void {
    const weapon = this.weapons[this.equippedWeapon];
    if (!weapon.isRanged || this.isReloading) return;
    if (weapon.currentAmmo >= weapon.maxAmmo || weapon.reserveAmmo <= 0) return;

    this.isReloading = true;
    this.reloadTimer = weapon.reloadTime;
    this.eventBus.emit('audio:play_sfx', { sound: 'reload', volume: 0.8 });
    this.eventBus.emit('weapon:reload', { weapon: this.equippedWeapon });
    this.syncToStore();
  }

  public update(dt: number): void {
    if (this.fireTimer > 0) {
      this.fireTimer = Math.max(0, this.fireTimer - dt);
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const weapon = this.weapons[this.equippedWeapon];
        const needed = weapon.maxAmmo - weapon.currentAmmo;
        const amount = Math.min(needed, weapon.reserveAmmo);
        weapon.currentAmmo += amount;
        weapon.reserveAmmo -= amount;
        this.syncToStore();
      }
    }
  }

  public syncToStore(): void {
    const current = this.weapons[this.equippedWeapon];
    const slots = [
      {
        slot: 1,
        id: 'knife',
        name: 'Tactical Knife',
        icon: '🗡️',
        isUnlocked: this.unlockedWeapons.has('knife'),
        isEquipped: this.equippedWeapon === 'knife',
        ammoText: '∞'
      },
      {
        slot: 2,
        id: 'pistol',
        name: '9mm Pistol',
        icon: '🔫',
        isUnlocked: this.unlockedWeapons.has('pistol'),
        isEquipped: this.equippedWeapon === 'pistol',
        ammoText: `${this.weapons.pistol.currentAmmo} / ${this.weapons.pistol.reserveAmmo}`
      },
      {
        slot: 3,
        id: 'shotgun',
        name: '12G Shotgun',
        icon: '💥',
        isUnlocked: this.unlockedWeapons.has('shotgun'),
        isEquipped: this.equippedWeapon === 'shotgun',
        ammoText: `${this.weapons.shotgun.currentAmmo} / ${this.weapons.shotgun.reserveAmmo}`
      },
      {
        slot: 4,
        id: 'rifle',
        name: 'Assault Rifle',
        icon: '🎖️',
        isUnlocked: this.unlockedWeapons.has('rifle'),
        isEquipped: this.equippedWeapon === 'rifle',
        ammoText: `${this.weapons.rifle.currentAmmo} / ${this.weapons.rifle.reserveAmmo}`
      },
      {
        slot: 5,
        id: 'sniper',
        name: 'Barrett .50 Sniper',
        icon: '🔭',
        isUnlocked: this.unlockedWeapons.has('sniper'),
        isEquipped: this.equippedWeapon === 'sniper',
        ammoText: `${this.weapons.sniper.currentAmmo} / ${this.weapons.sniper.reserveAmmo}`
      },
      {
        slot: 6,
        id: 'machinegun',
        name: 'M249 Heavy MG',
        icon: '🛡️',
        isUnlocked: this.unlockedWeapons.has('machinegun'),
        isEquipped: this.equippedWeapon === 'machinegun',
        ammoText: `${this.weapons.machinegun.currentAmmo} / ${this.weapons.machinegun.reserveAmmo}`
      }
    ];

    useGameUIStore.getState().setWeapon({
      id: current.id,
      name: current.name,
      currentAmmo: current.currentAmmo,
      reserveAmmo: current.reserveAmmo,
      maxReserveAmmo: current.maxReserveAmmo,
      isRanged: current.isRanged,
      isReloading: this.isReloading,
      slots
    });
  }

  public getIsReloading(): boolean {
    return this.isReloading;
  }

  public dispose(): void {
    if (this.muzzleFlashLight.parent) {
      this.muzzleFlashLight.parent.remove(this.muzzleFlashLight);
    }
  }
}
