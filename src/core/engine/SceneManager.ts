import { StageId } from '@/shared/types';
import { BaseScene } from '@/scenes/BaseScene';
import { GameEngine } from '@/core/engine/GameEngine';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { EventBus } from '@/core/events/EventBus';
import { Logger } from '@/core/utils/Logger';
import { DisposableManager } from '@/core/utils/Disposable';
import { PlayerAssetPool } from '@/features/player/PlayerAssetPool';

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

    // Show loading progress overlay for gameplay scenes
    if (stageId !== 'main-menu') {
      const stageTitles: Record<string, string> = {
        cinematic: 'PREPARING PROLOGUE',
        hospital: 'ENTERING ST. JUDE HOSPITAL',
        'city-escape': 'EXPEDITION TO VERIDIA BOULEVARD',
        'open-survival': 'LOADING SURVIVAL DISTRICT'
      };
      useGameUIStore.getState().setLoadingScreen({
        visible: true,
        title: stageTitles[stageId] || 'LOADING SECTOR',
        progress: 20,
        statusText: 'Streaming district assets...'
      });
    }

    // 1. Dispose previous scene and clear residual physics colliders
    if (this.currentScene) {
      try {
        DisposableManager.disposeObject3D(this.currentScene.scene);
        this.currentScene.dispose();
      } catch (err) {
        Logger.error('Error during scene disposal:', err);
      }
      this.currentScene = null;
    }

    // Clear residual physics bodies from previous scene
    this.engine.physicsWorld.clearBodies();
    this.engine.gameLoop.resetTimers();

    // 2. Ensure physics engine is initialized for gameplay stages
    if (stageId !== 'main-menu' && stageId !== 'cinematic') {
      useGameUIStore.getState().setLoadingScreen({ progress: 35, statusText: 'Initializing Rapier physics...' });
      await this.engine.physicsWorld.initWorld();

      // Preload authoritative Athletic_man player character model and core animations
      useGameUIStore.getState().setLoadingScreen({
        progress: 55,
        statusText: 'Streaming survivor character (Athletic Man)...'
      });
      await PlayerAssetPool.getInstance().preload((prog, text) => {
        useGameUIStore.getState().setLoadingScreen({
          progress: 55 + Math.round(prog * 0.3), // 55% -> 85%
          statusText: text
        });
      });
    }

    // 3. Dynamically import target scene (Enables Code Splitting & on-demand loading)
    useGameUIStore.getState().setLoadingScreen({ progress: 88, statusText: 'Compiling shaders & entities...' });
    let newScene: BaseScene;

    try {
      switch (stageId) {
        case 'main-menu': {
          const { MainMenuScene } = await import('@/scenes/main-menu/MainMenuScene');
          newScene = new MainMenuScene(this.engine);
          break;
        }
        case 'cinematic': {
          const { CinematicScene } = await import('@/scenes/cinematic/CinematicScene');
          newScene = new CinematicScene(this.engine);
          break;
        }
        case 'hospital': {
          const { HospitalScene } = await import('@/scenes/hospital/HospitalScene');
          newScene = new HospitalScene(this.engine);
          break;
        }
        case 'city-escape': {
          const { CityEscapeScene } = await import('@/scenes/city-escape/CityEscapeScene');
          newScene = new CityEscapeScene(this.engine);
          break;
        }
        case 'open-survival': {
          const { OpenSurvivalScene } = await import('@/scenes/open-survival/OpenSurvivalScene');
          newScene = new OpenSurvivalScene(this.engine);
          break;
        }
        default: {
          const { MainMenuScene } = await import('@/scenes/main-menu/MainMenuScene');
          newScene = new MainMenuScene(this.engine);
          break;
        }
      }

      // 4. Initialize scene
      await newScene.init();
      this.currentScene = newScene;

      useGameUIStore.getState().setLoadingScreen({ progress: 100, statusText: 'Ready' });

      // Hide loading screen after short fade
      setTimeout(() => {
        useGameUIStore.getState().setLoadingScreen({ visible: false });
      }, 250);

      // Update UI Store
      useGameUIStore.getState().setStage(stageId);
      useGameUIStore.getState().setShowMainMenu(stageId === 'main-menu');

      // Emit typed lifecycle event
      EventBus.getInstance().emit('stage:change', { from: prevStage, to: stageId });
      Logger.info(`Scene "${stageId}" loaded successfully.`);
    } catch (err) {
      Logger.error(`Failed to load scene "${stageId}":`, err);
      useGameUIStore.getState().setLoadingScreen({
        visible: true,
        statusText: 'Failed to load sector. Retrying...'
      });
      setTimeout(() => {
        this.loadScene('main-menu');
      }, 1500);
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
