import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceManager } from '@/core/performance/PerformanceManager';

describe('PerformanceManager', () => {
  let perf: PerformanceManager;

  beforeEach(() => {
    perf = PerformanceManager.getInstance();
    perf.setProfile('auto');
  });

  it('correctly configures profiles: Low, Medium, High', () => {
    perf.setProfile('low');
    const lowConfig = perf.getConfig();
    expect(lowConfig.renderScale).toBe(0.70);
    expect(lowConfig.maxDpr).toBe(1.0);
    expect(lowConfig.shadows).toBe(false);
    expect(lowConfig.maxActiveZombies).toBe(8);

    perf.setProfile('medium');
    const medConfig = perf.getConfig();
    expect(medConfig.renderScale).toBe(0.85);
    expect(medConfig.maxDpr).toBe(1.25);
    expect(medConfig.shadows).toBe(true);
    expect(medConfig.maxActiveZombies).toBe(14);

    perf.setProfile('high');
    const highConfig = perf.getConfig();
    expect(highConfig.renderScale).toBe(1.0);
    expect(highConfig.maxDpr).toBe(1.5);
    expect(highConfig.shadows).toBe(true);
    expect(highConfig.maxActiveZombies).toBe(24);
  });

  it('records frame times and computes accurate average FPS', () => {
    // 60 FPS = ~16.66ms per frame
    for (let i = 0; i < 30; i++) {
      perf.recordFrame(0.01666, i * 0.01666);
    }
    expect(perf.getAverageFps()).toBeGreaterThanOrEqual(58);
    expect(perf.getAverageFps()).toBeLessThanOrEqual(62);
    expect(perf.getAverageFrameTime()).toBeCloseTo(16.7, 1);
  });

  it('auto-adapts profile under sustained low frame rate', () => {
    (perf as any).frameTimes = [];
    perf.setProfile('auto');
    (perf as any).currentResolvedProfile = 'medium';
    (perf as any).lastEvaluationTime = 0;

    // Simulate low performance: 45ms per frame (~22 FPS)
    for (let i = 0; i < 40; i++) {
      perf.recordFrame(0.045, i * 0.045);
    }
    // Advance total time past evaluation cooldown (5s)
    perf.recordFrame(0.045, 6.0);

    expect(perf.currentResolvedProfile).toBe('low');
    expect(perf.getConfig().shadows).toBe(false);
    expect(perf.getConfig().renderScale).toBe(0.70);
  });
});
