import { ZombieVariantType } from '@/shared/types';
import { ARMOR_RESISTANCE_MODIFIERS, HitLocation } from './combat';

export interface ZombieConfig {
  variant: ZombieVariantType;
  name: string;
  maxHealth: number;
  walkSpeed: number;
  runSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  detectionRadius: number;
  hearingRadius: number;
  scale: [number, number, number];
  tintColor: number;
  armorMultipliers: Record<HitLocation, number>;
}

export const ZOMBIE_CONFIGS: Record<ZombieVariantType, ZombieConfig> = {
  walker: {
    variant: 'walker',
    name: 'Infected Shambler',
    maxHealth: 100,
    walkSpeed: 1.8,
    runSpeed: 3.2,
    attackDamage: 15,
    attackRange: 1.6,
    attackCooldown: 1.5,
    detectionRadius: 14,
    hearingRadius: 18,
    scale: [1, 1, 1],
    tintColor: 0x5a6351,
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.walker
  },
  runner: {
    variant: 'runner',
    name: 'Feral Runner',
    maxHealth: 80,
    walkSpeed: 2.5,
    runSpeed: 6.8,
    attackDamage: 12,
    attackRange: 1.5,
    attackCooldown: 1.1,
    detectionRadius: 20,
    hearingRadius: 26,
    scale: [0.95, 0.95, 0.95],
    tintColor: 0x8a4b38,
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.runner
  },
  brute: {
    variant: 'brute',
    name: 'Armored Brute',
    maxHealth: 250,
    walkSpeed: 1.3,
    runSpeed: 2.8,
    attackDamage: 35,
    attackRange: 2.2,
    attackCooldown: 2.0,
    detectionRadius: 12,
    hearingRadius: 15,
    scale: [1.4, 1.4, 1.4],
    tintColor: 0x3d434d,
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.brute
  },
  spitter: {
    variant: 'spitter',
    name: 'Toxic Spitter',
    maxHealth: 120,
    walkSpeed: 1.6,
    runSpeed: 3.8,
    attackDamage: 20,
    attackRange: 7.0,
    attackCooldown: 2.5,
    detectionRadius: 18,
    hearingRadius: 22,
    scale: [1.0, 1.0, 1.0],
    tintColor: 0x486b36,
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.spitter
  },
  boss: {
    variant: 'boss',
    name: 'Patient Zero Abomination',
    maxHealth: 600,
    walkSpeed: 1.8,
    runSpeed: 4.5,
    attackDamage: 45,
    attackRange: 2.8,
    attackCooldown: 1.8,
    detectionRadius: 25,
    hearingRadius: 35,
    scale: [1.8, 1.8, 1.8],
    tintColor: 0x2b1e22,
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.boss
  }
};
