import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameLoop } from '@/core/loop/GameLoop';

describe('GameLoop & Physics Timestep Protection', () => {
  let loop: GameLoop;

  beforeEach(() => {
    loop = new GameLoop();
  });

  afterEach(() => {
    loop.dispose();
  });

  it('executes fixed updates in 60Hz intervals', () => {
    (loop as any).isRunning = true;
    (loop as any).lastTimestamp = 1000;
    let fixedTicks = 0;

    loop.registerFixedUpdate((dt) => {
      fixedTicks++;
      expect(dt).toBeCloseTo(1 / 60, 4);
    });

    // Advance 0.034s (2 ticks at 1/60 = 0.01666s)
    (loop as any).tick(1034);

    expect(fixedTicks).toBe(2);
  });

  it('clamps maximum substeps to 3 during large lag spikes to prevent spiral of death', () => {
    (loop as any).isRunning = true;
    (loop as any).lastTimestamp = 1000;
    let fixedTicks = 0;

    loop.registerFixedUpdate(() => {
      fixedTicks++;
    });

    // Simulate huge frame delay: 500ms lag spike
    (loop as any).tick(1500);

    // Hard limit is 3 substeps per frame
    expect(fixedTicks).toBe(3);
  });

  it('resets accumulator and timestamp when document visibility changes', () => {
    (loop as any).accumulator = 0.08;
    loop.resetTimers();

    expect((loop as any).accumulator).toBe(0);
  });
});
