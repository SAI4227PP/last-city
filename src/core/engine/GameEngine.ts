import { Renderer } from './Renderer';
import { CameraManager } from './CameraManager';
import { SceneManager } from './SceneManager';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { GameLoop } from '@/core/loop/GameLoop';
import { InputManager } from '@/core/input/InputManager';
import { PerformanceManager } from '@/core/performance/PerformanceManager';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { Logger } from '@/core/utils/Logger';

export class GameEngine {
  public readonly renderer: Renderer;
  public readonly cameraManager: CameraManager;
  public readonly sceneManager: SceneManager;
  public readonly physicsWorld: PhysicsWorld;
  public readonly gameLoop: GameLoop;
  public readonly inputManager: InputManager;
  private diagnosticsTimer: number = 0;

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container);
    this.cameraManager = new CameraManager();
    this.physicsWorld = new PhysicsWorld();
    this.inputManager = new InputManager(this.renderer.webglRenderer.domElement);
    this.sceneManager = new SceneManager(this);
    this.gameLoop = new GameLoop();

    // Hook performance manager settings to game loop substeps
    PerformanceManager.getInstance().addConfigListener((config) => {
      this.gameLoop.setMaxSubSteps(config.maxSubSteps);
    });

    // Hook game loop updates
    this.gameLoop.registerUpdate((dt, totalTime) => {
      // 1. Record frame time metrics into PerformanceManager
      PerformanceManager.getInstance().recordFrame(dt, totalTime);

      // 2. Update Scene
      this.sceneManager.update(dt, totalTime);

      // 3. Update Diagnostics telemetry at 4Hz to avoid DOM thrashing
      this.diagnosticsTimer += dt;
      if (this.diagnosticsTimer >= 0.25) {
        this.diagnosticsTimer = 0;
        const perf = PerformanceManager.getInstance();
        const avgFps = perf.getAverageFps();
        useGameUIStore.getState().setFps(avgFps);

        if (useGameUIStore.getState().showDiagnostics) {
          const diag = `FPS: ${avgFps} | FT: ${perf.getAverageFrameTime()}ms | DC: ${this.renderer.drawCalls} | Tris: ${this.renderer.triangles.toLocaleString()} | Profile: ${perf.currentResolvedProfile.toUpperCase()} (Scale: ${perf.getConfig().renderScale}x)`;
          useGameUIStore.getState().setDiagnosticsText(diag);
        }
      }
    });

    this.gameLoop.registerFixedUpdate((fixedDelta) => {
      this.sceneManager.fixedUpdate(fixedDelta);
    });

    this.gameLoop.registerRender(() => {
      this.sceneManager.render();
    });

    Logger.info('GameEngine core architecture assembled.');
  }

  public async start(): Promise<void> {
    this.gameLoop.start();
    Logger.info('GameEngine running.');

    // Asynchronously pre-warm Rapier in background without blocking initial frame render
    PhysicsWorld.init().catch((err) => Logger.warn('Background physics pre-warm:', err));
  }

  public pause(): void {
    this.gameLoop.setPaused(true);
  }

  public resume(): void {
    this.gameLoop.setPaused(false);
  }

  public dispose(): void {
    this.gameLoop.stop();
    this.sceneManager.dispose();
    this.inputManager.dispose();
    this.physicsWorld.dispose();
    this.renderer.dispose();
    Logger.info('GameEngine disposed.');
  }
}
