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

export class CombatManager {
  private weapons: Record<WeaponType, ExtendedWeaponStats>;
  private equippedWeapon: WeaponType = 'knife';
  private fireTimer: number = 0;
  private isReloading: boolean = false;
  private reloadTimer: number = 0;

  private eventBus: EventBus;
  private cameraManager: CameraManager;
  private particleSystem: ParticleSystem;
  private zombieManager?: ZombieManager;

  // Flashlight / muzzle flash
  private muzzleFlashLight: THREE.PointLight;

  constructor(
    scene: THREE.Scene,
    cameraManager: CameraManager,
    particleSystem: ParticleSystem
  ) {
    this.eventBus = EventBus.getInstance();
    this.cameraManager = cameraManager;
    this.particleSystem = particleSystem;

    // Deep clone weapon definitions
    this.weapons = JSON.parse(JSON.stringify(WEAPON_DEFINITIONS));

    // Muzzle flash point light
    this.muzzleFlashLight = new THREE.PointLight(0xffaa22, 0, 10);
    scene.add(this.muzzleFlashLight);

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

  public unlockWeapon(type: WeaponType, initialAmmo?: number, initialReserve?: number): void {
    if (initialAmmo !== undefined) this.weapons[type].currentAmmo = initialAmmo;
    if (initialReserve !== undefined) this.weapons[type].reserveAmmo = initialReserve;
    this.equipWeapon(type);
  }

  public addAmmo(type: WeaponType, amount: number): void {
    this.weapons[type].reserveAmmo += amount;
    this.syncToStore();
  }

  public equipWeapon(type: WeaponType): void {
    if (this.equippedWeapon === type) return;
    this.equippedWeapon = type;
    this.isReloading = false;
    this.eventBus.emit('weapon:switch', { weapon: type });
    this.syncToStore();
  }

  public attack(playerPos: THREE.Vector3, forwardDir: THREE.Vector3): boolean {
    if (this.fireTimer > 0 || this.isReloading) return false;

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

    // Audio SFX
    const sfx = weapon.id === 'shotgun' ? 'gunshot_shotgun' : weapon.id === 'rifle' ? 'gunshot_rifle' : 'gunshot_pistol';
    this.eventBus.emit('audio:play_sfx', { sound: sfx, volume: 1.0 });

    // Emit weapon fire event for UI, audio, and player recoil animation
    this.eventBus.emit('weapon:fire', {
      weapon: weapon.id,
      currentAmmo: weapon.currentAmmo,
      reserveAmmo: weapon.reserveAmmo
    });

    // Camera recoil & screen trauma
    this.cameraManager.addTrauma(weapon.recoil);

    // Muzzle flash visual
    const flashPos = playerPos.clone().add(forwardDir.clone().multiplyScalar(0.9)).add(new THREE.Vector3(0, 1.4, 0));
    this.muzzleFlashLight.position.copy(flashPos);
    this.muzzleFlashLight.intensity = 3.5;
    setTimeout(() => {
      this.muzzleFlashLight.intensity = 0;
    }, 60);

    // Hit detection against zombies
    if (this.zombieManager) {
      const rayOrigin = playerPos.clone().add(new THREE.Vector3(0, 1.5, 0));

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

            this.particleSystem.spawnBloodSplatter(hit.hitPoint, hit.isHeadshot ? 16 : 8);
          }
        }

        if (anyHit) {
          useGameUIStore.getState().setCrosshairHit(true, anyHeadshot);
          if (anyHeadshot) {
            this.eventBus.emit('audio:play_sfx', { sound: 'headshot_hit', volume: 1.0 });
          }

          hitMap.forEach((entry) => {
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
              hitLocation: entry.hitLocation
            });
          });
        }
      } else {
        // Single projectile / raycast weapon (pistol, rifle)
        const hit = this.zombieManager.checkRayHit(rayOrigin, forwardDir, weapon.range);

        if (hit) {
          const dmgCalc = CombatConfigManager.getInstance().calculateDamage(
            weapon.id,
            hit.hitLocation,
            hit.zombie.variant,
            false
          );

          const result = hit.zombie.takeDamage(dmgCalc.finalDamage, hit.hitPoint, hit.hitLocation);

          this.particleSystem.spawnBloodSplatter(hit.hitPoint, hit.isHeadshot ? 35 : 18);
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
            armorReduced: result.armorReduced
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
      const hit = this.zombieManager.checkMeleeSweep(swingOrigin, forwardDir, weapon.range, 1.2);

      if (hit) {
        const dmgCalc = CombatConfigManager.getInstance().calculateDamage(
          weapon.id,
          hit.hitLocation,
          hit.zombie.variant,
          false
        );

        const result = hit.zombie.takeDamage(dmgCalc.finalDamage, hit.hitPoint, hit.hitLocation);

        this.particleSystem.spawnBloodSplatter(hit.hitPoint, 15);
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
          armorReduced: result.armorReduced
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
    useGameUIStore.getState().setWeapon({
      name: current.name,
      currentAmmo: current.currentAmmo,
      reserveAmmo: current.reserveAmmo,
      isRanged: current.isRanged
    });
  }

  public dispose(): void {
    if (this.muzzleFlashLight.parent) {
      this.muzzleFlashLight.parent.remove(this.muzzleFlashLight);
    }
  }
}
