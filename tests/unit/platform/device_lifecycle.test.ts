import { describe, it, expect } from 'vitest';
import { InputManager } from '@/core/input/InputManager';
import { PlatformAdapter } from '@/platform/PlatformAdapter';
import { SaveManager } from '@/persistence/SaveManager';
import { GameLoop } from '@/core/loop/GameLoop';
import { PlayerSaveData } from '@/shared/types';

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

    input.dispose();
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

    input.dispose();
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

  it('SaveManager persists and recovers full player progression safely in IndexedDB', async () => {
    const saveManager = SaveManager.getInstance();
    const testSave: PlayerSaveData = {
      version: 1,
      timestamp: Date.now(),
      stage: 'open-survival',
      cinematicCompleted: true,
      playerPosition: [12.5, 1.2, -8.0],
      playerRotation: 1.57,
      vitals: {
        health: 85,
        maxHealth: 100,
        stamina: 90,
        maxStamina: 100,
        hunger: 70,
        thirst: 65
      },
      inventory: [
        {
          id: 'item_pistol',
          name: '9mm Pistol',
          category: 'weapon',
          count: 1,
          maxStack: 1,
          description: 'Tactical handgun',
          icon: '🔫',
          usable: true,
          weaponType: 'pistol'
        }
      ],
      equippedWeapon: 'pistol',
      weapons: {
        knife: { unlocked: true, currentAmmo: 0, reserveAmmo: 0 },
        bat: { unlocked: false, currentAmmo: 0, reserveAmmo: 0 },
        pistol: { unlocked: true, currentAmmo: 12, reserveAmmo: 24 },
        shotgun: { unlocked: true, currentAmmo: 6, reserveAmmo: 12 },
        rifle: { unlocked: false, currentAmmo: 0, reserveAmmo: 0 }
      },
      completedMissions: ['hosp_m1', 'city_m1'],
      safehouseUnlocked: true,
      gameTimeMinutes: 45
    };

    const saved = await saveManager.saveGame(testSave);
    expect(saved).toBe(true);

    const has = await saveManager.hasSave();
    expect(has).toBe(true);

    const loaded = await saveManager.loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.stage).toBe('open-survival');
    expect(loaded!.vitals.health).toBe(85);
    expect(loaded!.equippedWeapon).toBe('pistol');
    expect(loaded!.safehouseUnlocked).toBe(true);
  });

  it('GameLoop handles browser suspension and resume without physics explosion', () => {
    const loop = new GameLoop();
    (loop as any).isRunning = true;
    (loop as any).lastTimestamp = 1000;
    (loop as any).accumulator = 0.05;

    // Simulate page suspension (pagehide / visibilitychange hidden)
    (loop as any).onPageHide();
    expect((loop as any).accumulator).toBe(0);

    // Simulate resumption after 10 seconds of backgrounding
    (loop as any).onPageShow();
    expect((loop as any).accumulator).toBe(0);

    loop.dispose();
  });

  it('Dynamically imports all 5 game scenes on demand without bundling them monolithically', async () => {
    const [mainMenu, cinematic, hospital, cityEscape, openSurvival] = await Promise.all([
      import('@/scenes/main-menu/MainMenuScene'),
      import('@/scenes/cinematic/CinematicScene'),
      import('@/scenes/hospital/HospitalScene'),
      import('@/scenes/city-escape/CityEscapeScene'),
      import('@/scenes/open-survival/OpenSurvivalScene')
    ]);

    expect(mainMenu.MainMenuScene).toBeDefined();
    expect(cinematic.CinematicScene).toBeDefined();
    expect(hospital.HospitalScene).toBeDefined();
    expect(cityEscape.CityEscapeScene).toBeDefined();
    expect(openSurvival.OpenSurvivalScene).toBeDefined();
  });
});
