import { ZombieVariantType } from '@/shared/types';
import { ARMOR_RESISTANCE_MODIFIERS, HitLocation } from './combat';

export interface ZombieHitboxConfig {
  bodyRadius: number;       // Cylinder/capsule radius for torso & limbs
  bodyHeight: number;       // Total height of body collision
  headRadius: number;       // Sphere radius for head
  headCenterY: number;      // Y height of head center relative to zombie base
  meleeTolerance: number;   // Extra forgiveness buffer for melee sweeps (0.15 - 0.35m)
  bulletTolerance: number;  // Extra forgiveness buffer for raycasts (0.08 - 0.20m)
}

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
  hitbox: ZombieHitboxConfig;
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
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.walker,
    hitbox: {
      bodyRadius: 0.44,
      bodyHeight: 1.85,
      headRadius: 0.24,
      headCenterY: 1.62,
      meleeTolerance: 0.25,
      bulletTolerance: 0.12
    }
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
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.runner,
    hitbox: {
      bodyRadius: 0.38,
      bodyHeight: 1.75,
      headRadius: 0.20,
      headCenterY: 1.50,
      meleeTolerance: 0.28,
      bulletTolerance: 0.14
    }
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
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.brute,
    hitbox: {
      bodyRadius: 0.72,
      bodyHeight: 2.50,
      headRadius: 0.34,
      headCenterY: 2.18,
      meleeTolerance: 0.32,
      bulletTolerance: 0.16
    }
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
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.spitter,
    hitbox: {
      bodyRadius: 0.46,
      bodyHeight: 1.85,
      headRadius: 0.24,
      headCenterY: 1.60,
      meleeTolerance: 0.25,
      bulletTolerance: 0.12
    }
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
    armorMultipliers: ARMOR_RESISTANCE_MODIFIERS.boss,
    hitbox: {
      bodyRadius: 0.98,
      bodyHeight: 3.25,
      headRadius: 0.44,
      headCenterY: 2.85,
      meleeTolerance: 0.35,
      bulletTolerance: 0.20
    }
  }
};
