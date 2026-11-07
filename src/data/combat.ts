import { WeaponType, ZombieVariantType } from '@/shared/types';

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
  maxAmmo: number;
  currentAmmo: number;
  reserveAmmo: number;
  reloadTime: number;
  recoil: number;
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
    currentAmmo: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    recoil: 0
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
    currentAmmo: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    recoil: 0
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
    maxAmmo: 12,
    currentAmmo: 12,
    reserveAmmo: 24,
    reloadTime: 1.6,
    recoil: 0.05
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
    currentAmmo: 6,
    reserveAmmo: 18,
    reloadTime: 2.4,
    recoil: 0.12
  },
  rifle: {
    id: 'rifle',
    name: 'M4A1 Assault Rifle',
    isRanged: true,
    bodyDamage: 30,
    headDamage: 90,
    headMultiplier: 3.0,
    fireRate: 8.0,
    range: 65,
    maxAmmo: 30,
    currentAmmo: 30,
    reserveAmmo: 60,
    reloadTime: 2.0,
    recoil: 0.04
  }
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
