import { WeaponType, WeaponStats } from '@/shared/types';
import { WEAPON_COMBAT_CONFIGS } from './combat';

export interface ExtendedWeaponStats extends WeaponStats {
  headDamage: number;
  headMultiplier: number;
  pelletCount?: number;
  pelletBodyDamage?: number;
  pelletHeadDamage?: number;
  spreadAngleRad?: number;
}

export const WEAPON_DEFINITIONS: Record<WeaponType, ExtendedWeaponStats> = {
  knife: {
    ...WEAPON_COMBAT_CONFIGS.knife,
    damage: WEAPON_COMBAT_CONFIGS.knife.bodyDamage
  },
  bat: {
    ...WEAPON_COMBAT_CONFIGS.bat,
    damage: WEAPON_COMBAT_CONFIGS.bat.bodyDamage
  },
  pistol: {
    ...WEAPON_COMBAT_CONFIGS.pistol,
    damage: WEAPON_COMBAT_CONFIGS.pistol.bodyDamage
  },
  shotgun: {
    ...WEAPON_COMBAT_CONFIGS.shotgun,
    damage: WEAPON_COMBAT_CONFIGS.shotgun.bodyDamage
  },
  rifle: {
    ...WEAPON_COMBAT_CONFIGS.rifle,
    damage: WEAPON_COMBAT_CONFIGS.rifle.bodyDamage
  },
  sniper: {
    ...WEAPON_COMBAT_CONFIGS.sniper,
    damage: WEAPON_COMBAT_CONFIGS.sniper.bodyDamage
  },
  machinegun: {
    ...WEAPON_COMBAT_CONFIGS.machinegun,
    damage: WEAPON_COMBAT_CONFIGS.machinegun.bodyDamage
  }
};
