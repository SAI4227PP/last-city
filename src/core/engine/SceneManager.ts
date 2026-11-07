import { StageId } from '@/shared/types';
import { BaseScene } from '@/scenes/BaseScene';
import { GameEngine } from '@/core/engine/GameEngine';
import { MainMenuScene } from '@/scenes/main-menu/MainMenuScene';
import { CinematicScene } from '@/scenes/cinematic/CinematicScene';
import { HospitalScene } from '@/scenes/hospital/HospitalScene';
import { CityEscapeScene } from '@/scenes/city-escape/CityEscapeScene';
import { OpenSurvivalScene } from '@/scenes/open-survival/OpenSurvivalScene';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { EventBus } from '@/core/events/EventBus';
import { Logger } from '@/core/utils/Logger';

export class SceneManager {
  private engine: GameEngine;
  private currentScene: BaseScene | null = null;
  private isTransitioning: boolean = false;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public getCurrentScene(): BaseScene | null {
    return this.currentScene;
  }

  public async loadScene(stageId: StageId): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    Logger.info(`Transitioning scene to: "${stageId}"`);

    const prevStage = this.currentScene?.id || 'main-menu';

    // 1. Dispose previous scene
    if (this.currentScene) {
      try {
        this.currentScene.dispose();
      } catch (err) {
        Logger.error('Error during scene disposal:', err);
      }
      this.currentScene = null;
    }

    // 2. Instantiate target scene
    let newScene: BaseScene;
    switch (stageId) {
      case 'main-menu':
        newScene = new MainMenuScene(this.engine);
        break;
      case 'cinematic':
        newScene = new CinematicScene(this.engine);
        break;
      case 'hospital':
        newScene = new HospitalScene(this.engine);
        break;
      case 'city-escape':
        newScene = new CityEscapeScene(this.engine);
        break;
      case 'open-survival':
        newScene = new OpenSurvivalScene(this.engine);
        break;
      default:
        newScene = new MainMenuScene(this.engine);
        break;
    }

    // 3. Initialize scene
    try {
      await newScene.init();
      this.currentScene = newScene;

      // Update UI Store
      useGameUIStore.getState().setStage(stageId);
      useGameUIStore.getState().setShowMainMenu(stageId === 'main-menu');

      // Emit typed lifecycle event
      EventBus.getInstance().emit('stage:change', { from: prevStage, to: stageId });
      Logger.info(`Scene "${stageId}" initialized successfully.`);
    } catch (err) {
      Logger.error(`Failed to initialize scene "${stageId}":`, err);
    } finally {
      this.isTransitioning = false;
    }
  }

  public update(dt: number, totalTime: number): void {
    if (this.currentScene) {
      this.currentScene.update(dt, totalTime);
    }
  }

  public fixedUpdate(fixedDelta: number): void {
    if (this.currentScene) {
      this.currentScene.fixedUpdate(fixedDelta);
    }
  }

  public render(): void {
    if (this.currentScene) {
      this.engine.renderer.render(this.currentScene.scene, this.engine.cameraManager.camera);
    }
  }

  public dispose(): void {
    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }
  }
}
