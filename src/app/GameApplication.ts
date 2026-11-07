import { GameEngine } from '@/core/engine/GameEngine';
import { UIManager } from '@/ui/UIManager';
import { AudioManager } from '@/core/audio/AudioManager';
import { SaveManager } from '@/persistence/SaveManager';
import { PlatformAdapter } from '@/platform/PlatformAdapter';
import { EventBus } from '@/core/events/EventBus';
import { ApplicationContext } from './ApplicationContext';
import { Logger } from '@/core/utils/Logger';

export class GameApplication {
  private static instance: GameApplication | null = null;
  public context!: ApplicationContext;

  private constructor() {}

  public static getInstance(): GameApplication {
    if (!GameApplication.instance) {
      GameApplication.instance = new GameApplication();
    }
    return GameApplication.instance;
  }

  public async start(): Promise<void> {
    Logger.info('Bootstrapping LAST CITY Application...');

    const gameContainer = document.getElementById('game-container');
    const uiRoot = document.getElementById('ui-root');

    if (!gameContainer || !uiRoot) {
      throw new Error('Required DOM containers (#game-container, #ui-root) not found.');
    }

    // 1. Core Engine
    const engine = new GameEngine(gameContainer);

    // 2. Audio Subsystem
    const audio = AudioManager.getInstance();
    audio.init();

    // 3. Persistence
    const save = SaveManager.getInstance();

    // 4. Platform (CrazyGames SDK)
    const platform = new PlatformAdapter();
    await platform.init();

    // 5. UI Presentation
    const ui = new UIManager(uiRoot, engine);

    // 6. Application Context
    this.context = {
      engine,
      ui,
      audio,
      save,
      platform,
      eventBus: EventBus.getInstance()
    };

    // Listen to generic audio sfx events
    this.context.eventBus.on('audio:play_sfx', ({ sound, volume }) => {
      audio.playSound(sound, volume);
    });

    // Start Engine
    await engine.start();

    // Load Initial Scene (Main Menu)
    await engine.sceneManager.loadScene('main-menu');

    Logger.info('LAST CITY Ready.');
  }

  public dispose(): void {
    if (this.context) {
      this.context.engine.dispose();
      this.context.ui.dispose();
    }
    GameApplication.instance = null;
  }
}
