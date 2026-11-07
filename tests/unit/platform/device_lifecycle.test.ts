import { describe, it, expect } from 'vitest';
import { InputManager } from '@/core/input/InputManager';
import { PlatformAdapter } from '@/platform/PlatformAdapter';

describe('Cross-Device & Mobile Input Handling', () => {
  it('InputManager sets normalized analog move vector from virtual joystick', () => {
    const dummyEl = document.createElement('div');
    const input = new InputManager(dummyEl);

    // Joystick tilted up-right
    input.setVirtualMoveAxis(0.6, -0.8);
    const state = input.getState();

    expect(state.moveAxis.x).toBe(0.6);
    expect(state.moveAxis.y).toBe(-0.8);
    expect(state.forward).toBe(true);
    expect(state.right).toBe(true);
    expect(state.backward).toBe(false);
  });

  it('InputManager handles touch action button triggers', () => {
    const dummyEl = document.createElement('div');
    const input = new InputManager(dummyEl);

    input.triggerAction('attack', true);
    expect(input.getState().attack).toBe(true);

    input.triggerAction('attack', false);
    expect(input.getState().attack).toBe(false);

    input.triggerAction('sprint', true);
    expect(input.getState().sprint).toBe(true);
  });

  it('PlatformAdapter operates gracefully in standalone browser environment', async () => {
    const platform = new PlatformAdapter();
    await platform.init();

    expect(platform.isCrazyGamesEnvironment()).toBe(false);

    // Calling lifecycle hooks in standard browser should not throw
    expect(() => {
      platform.gameplayStart();
      platform.happyTime();
      platform.gameplayStop();
    }).not.toThrow();

    const adResult = await platform.showAd('midgame');
    expect(adResult).toBe(true);
  });
});
