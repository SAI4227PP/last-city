import { WeaponType, WeaponRarity, ZombieVariantType } from '@/shared/types';

export type CombatDifficulty = 'easy' | 'normal' | 'hard';
export type HitLocation = 'head' | 'torso' | 'arms' | 'legs';

export interface DifficultyModifier {
  zombieHealthMultiplier: number;
  zombieDamageMultiplier: number;
  playerDamageMultiplier: number;
}

export const DIFFICULTY_SETTINGS: Record<CombatDifficulty, DifficultyModifier> = {
  easy: {
    zombieHealthMultiplier: 0.8,
    zombieDamageMultiplier: 0.75,
    playerDamageMultiplier: 1.25
  },
  normal: {
    zombieHealthMultiplier: 1.0,
    zombieDamageMultiplier: 1.0,
    playerDamageMultiplier: 1.0
  },
  hard: {
    zombieHealthMultiplier: 1.3,
    zombieDamageMultiplier: 1.4,
    playerDamageMultiplier: 0.85
  }
};

export const BASE_HIT_LOCATION_MULTIPLIERS: Record<HitLocation, number> = {
  head: 2.0,
  torso: 1.0,
  arms: 0.75,
  legs: 0.75
};

// Armored Brute damage resistance modifiers per hit location
export const ARMOR_RESISTANCE_MODIFIERS: Record<ZombieVariantType, Record<HitLocation, number>> = {
  walker: { head: 1.0, torso: 1.0, arms: 1.0, legs: 1.0 },
  runner: { head: 1.0, torso: 1.0, arms: 1.0, legs: 1.0 },
  brute: {
    head: 1.0,   // Helmet visor has cracked opening for precision headshots
    torso: 0.50, // Ceramic SWAT riot chest armor absorbs 50% damage
    arms: 0.65,  // Heavy ballistic pauldrons and steel gauntlets absorb 35% damage
    legs: 0.75   // Reinforced tactical greaves absorb 25% damage
  },
  spitter: { head: 1.0, torso: 1.0, arms: 1.0, legs: 1.0 },
  boss: {
    head: 1.0,   // Demonic cranium
    torso: 1.0,  // Exposed viral heart core takes standard damage
    arms: 0.85,  // Chitinous scythe blade deflection
    legs: 0.90   // Dense muscular legs
  }
};

export interface WeaponCombatData {
  id: WeaponType;
  name: string;
  isRanged: boolean;
  bodyDamage: number;
  headDamage: number;
  headMultiplier: number;
  fireRate: number; // shots/swings per second
  range: number;
  maxAmmo: number;        // Magazine capacity
  maxReserveAmmo: number; // Maximum reserve ammunition capacity
  currentAmmo: number;
  reserveAmmo: number;
  reloadTime: number;
  recoil: number;
  rarity?: WeaponRarity;
  pelletCount?: number;
  pelletBodyDamage?: number;
  pelletHeadDamage?: number;
  spreadAngleRad?: number;
}

export const WEAPON_COMBAT_CONFIGS: Record<WeaponType, WeaponCombatData> = {
  knife: {
    id: 'knife',
    name: 'Tactical Combat Knife',
    isRanged: false,
    bodyDamage: 35,
    headDamage: 70,
    headMultiplier: 2.0,
    fireRate: 2.2,
    range: 2.0,
    maxAmmo: 0,
    maxReserveAmmo: 0,
    currentAmmo: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    recoil: 0,
    rarity: 'common'
  },
  bat: {
    id: 'bat',
    name: 'Reinforced Baseball Bat',
    isRanged: false,
    bodyDamage: 45,
    headDamage: 90,
    headMultiplier: 2.0,
    fireRate: 1.4,
    range: 2.4,
    maxAmmo: 0,
    maxReserveAmmo: 0,
    currentAmmo: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    recoil: 0,
    rarity: 'common'
  },
  pistol: {
    id: 'pistol',
    name: '9mm Service Pistol',
    isRanged: true,
    bodyDamage: 25,
    headDamage: 75,
    headMultiplier: 3.0,
    fireRate: 3.5,
    range: 45,
    maxAmmo: 15,
    maxReserveAmmo: 150,
    currentAmmo: 15,
    reserveAmmo: 30,
    reloadTime: 1.6,
    recoil: 0.05,
    rarity: 'common'
  },
  shotgun: {
    id: 'shotgun',
    name: '12-Gauge Pump-Action Shotgun',
    isRanged: true,
    bodyDamage: 80,
    headDamage: 160,
    headMultiplier: 2.0,
    fireRate: 1.1,
    range: 22,
    pelletCount: 8,
    pelletBodyDamage: 10,  // 8 pellets x 10 = 80 total
    pelletHeadDamage: 20,  // 8 pellets x 20 = 160 total
    spreadAngleRad: 0.075, // ~4.3 degree spread cone
    maxAmmo: 6,
    maxReserveAmmo: 48,
    currentAmmo: 6,
    reserveAmmo: 18,
    reloadTime: 2.4,
    recoil: 0.12,
    rarity: 'uncommon'
  },
  rifle: {
    id: 'rifle',
    name: 'M4A1 Assault Rifle',
    isRanged: true,
    bodyDamage: 30,
    headDamage: 90,
    headMultiplier: 3.0,
    fireRate: 8.5,
    range: 65,
    maxAmmo: 30,
    maxReserveAmmo: 180,
    currentAmmo: 30,
    reserveAmmo: 60,
    reloadTime: 2.0,
    recoil: 0.04,
    rarity: 'rare'
  },
  sniper: {
    id: 'sniper',
    name: 'Barrett .50 High-Caliber Sniper',
    isRanged: true,
    bodyDamage: 120,
    headDamage: 360,
    headMultiplier: 3.0,
    fireRate: 0.85,
    range: 120,
    maxAmmo: 5,
    maxReserveAmmo: 30,
    currentAmmo: 5,
    reserveAmmo: 15,
    reloadTime: 2.6,
    recoil: 0.20,
    rarity: 'epic'
  },
  machinegun: {
    id: 'machinegun',
    name: 'M249 Heavy Machine Gun',
    isRanged: true,
    bodyDamage: 36,
    headDamage: 108,
    headMultiplier: 3.0,
    fireRate: 11.0,
    range: 75,
    maxAmmo: 100,
    maxReserveAmmo: 300,
    currentAmmo: 100,
    reserveAmmo: 150,
    reloadTime: 3.2,
    recoil: 0.065,
    rarity: 'legendary'
  }
};

/**
 * Centralized ammunition capacity limits configuration.
 */
export const WEAPON_AMMO_CAPACITIES: Record<WeaponType, { magazineCapacity: number; maxReserveAmmo: number }> = {
  knife: { magazineCapacity: 0, maxReserveAmmo: 0 },
  bat: { magazineCapacity: 0, maxReserveAmmo: 0 },
  pistol: { magazineCapacity: 15, maxReserveAmmo: 150 },
  shotgun: { magazineCapacity: 6, maxReserveAmmo: 48 },
  rifle: { magazineCapacity: 30, maxReserveAmmo: 180 },
  sniper: { magazineCapacity: 5, maxReserveAmmo: 30 },
  machinegun: { magazineCapacity: 100, maxReserveAmmo: 300 }
};

export const WEAPON_AMMO_ITEM_MAP: Record<WeaponType, string> = {
  knife: '',
  bat: '',
  pistol: 'ammo_9mm',
  shotgun: 'ammo_shotgun',
  rifle: 'ammo_rifle',
  sniper: 'ammo_sniper',
  machinegun: 'ammo_machinegun'
};

export const AMMO_ITEM_TO_WEAPON_MAP: Record<string, WeaponType> = {
  ammo_9mm: 'pistol',
  item_ammo_9mm: 'pistol',
  ammo_shotgun: 'shotgun',
  ammo_rifle: 'rifle',
  ammo_sniper: 'sniper',
  ammo_machinegun: 'machinegun'
};

export class CombatConfigManager {
  private static instance: CombatConfigManager | null = null;
  private currentDifficulty: CombatDifficulty = 'normal';

  private constructor() {}

  public static getInstance(): CombatConfigManager {
    if (!CombatConfigManager.instance) {
      CombatConfigManager.instance = new CombatConfigManager();
    }
    return CombatConfigManager.instance;
  }

  public setDifficulty(diff: CombatDifficulty): void {
    this.currentDifficulty = diff;
  }

  public getDifficulty(): CombatDifficulty {
    return this.currentDifficulty;
  }

  public getDifficultyModifier(): DifficultyModifier {
    return DIFFICULTY_SETTINGS[this.currentDifficulty];
  }

  public calculateDamage(
    weaponId: WeaponType,
    hitLocation: HitLocation,
    targetVariant: ZombieVariantType,
    isPellet: boolean = false
  ): { finalDamage: number; isHeadshot: boolean; armorReduction: number } {
    const weapon = WEAPON_COMBAT_CONFIGS[weaponId];
    const diff = this.getDifficultyModifier();

    let baseDamage: number;
    const isHeadshot = hitLocation === 'head';

    if (isPellet && weapon.pelletBodyDamage && weapon.pelletHeadDamage) {
      baseDamage = isHeadshot ? weapon.pelletHeadDamage : weapon.pelletBodyDamage;
    } else {
      if (isHeadshot) {
        baseDamage = weapon.headDamage;
      } else {
        baseDamage = weapon.bodyDamage * (BASE_HIT_LOCATION_MULTIPLIERS[hitLocation] || 1.0);
      }
    }

    // Apply zombie variant armor resistance for this location
    const armorMod = ARMOR_RESISTANCE_MODIFIERS[targetVariant][hitLocation] ?? 1.0;
    const damageAfterArmor = baseDamage * armorMod;

    // Apply difficulty multiplier on player damage dealt
    const finalDamage = Math.max(1, Math.round(damageAfterArmor * diff.playerDamageMultiplier));
    const armorReduction = Math.max(0, Math.round((baseDamage - damageAfterArmor) * diff.playerDamageMultiplier));

    return {
      finalDamage,
      isHeadshot,
      armorReduction
    };
  }
}
