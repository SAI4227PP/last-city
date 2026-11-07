import { describe, it, expect, beforeEach } from 'vitest';
import { SurvivalSystem } from '@/features/survival/SurvivalSystem';

describe('SurvivalSystem', () => {
  let survival: SurvivalSystem;

  beforeEach(() => {
    survival = new SurvivalSystem();
  });

  it('initializes with full vitals', () => {
    const vitals = survival.getVitals();
    expect(vitals.health).toBe(100);
    expect(vitals.stamina).toBe(100);
    expect(vitals.hunger).toBe(100);
    expect(vitals.thirst).toBe(100);
  });

  it('correctly reduces health on damage and clamps to zero', () => {
    survival.damage(40, 'Zombie');
    expect(survival.getVitals().health).toBe(60);

    survival.damage(100, 'Zombie');
    expect(survival.getVitals().health).toBe(0);
  });

  it('correctly heals up to maxHealth', () => {
    survival.damage(50);
    survival.heal(25);
    expect(survival.getVitals().health).toBe(75);

    survival.heal(100);
    expect(survival.getVitals().health).toBe(100);
  });

  it('drains stamina when sprinting and regenerates when idle', () => {
    survival.update(1.0, true); // 1 second sprint
    expect(survival.getVitals().stamina).toBeLessThan(100);

    const drained = survival.getVitals().stamina;
    survival.update(1.0, false); // 1 second idle/walk
    expect(survival.getVitals().stamina).toBeGreaterThan(drained);
  });

  it('restores hunger and thirst when consuming rations', () => {
    survival.setVitals({ hunger: 50, thirst: 40 });
    survival.consumeFood(30);
    survival.consumeWater(40);
    expect(survival.getVitals().hunger).toBe(80);
    expect(survival.getVitals().thirst).toBe(80);
  });
});
