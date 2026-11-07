import { describe, it, expect } from 'vitest';
import { WEAPON_DEFINITIONS } from '@/data/weapons';

describe('Weapon Definitions', () => {
  it('defines valid statistics for all 5 core weapons', () => {
    const keys = ['knife', 'bat', 'pistol', 'shotgun', 'rifle'] as const;
    for (const key of keys) {
      const w = WEAPON_DEFINITIONS[key];
      expect(w).toBeDefined();
      expect(w.damage).toBeGreaterThan(0);
      expect(w.fireRate).toBeGreaterThan(0);
      expect(w.range).toBeGreaterThan(0);
    }
  });

  it('marks firearms as ranged with ammo budgets', () => {
    expect(WEAPON_DEFINITIONS.pistol.isRanged).toBe(true);
    expect(WEAPON_DEFINITIONS.shotgun.isRanged).toBe(true);
    expect(WEAPON_DEFINITIONS.rifle.isRanged).toBe(true);
    expect(WEAPON_DEFINITIONS.knife.isRanged).toBe(false);
    expect(WEAPON_DEFINITIONS.bat.isRanged).toBe(false);
  });
});
