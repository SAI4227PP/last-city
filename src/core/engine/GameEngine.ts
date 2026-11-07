import { Renderer } from './Renderer';
import { CameraManager } from './CameraManager';
import { SceneManager } from './SceneManager';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { GameLoop } from '@/core/loop/GameLoop';
import { InputManager } from '@/core/input/InputManager';
import { Logger } from '@/core/utils/Logger';

export class GameEngine {
  public readonly renderer: Renderer;
  public readonly cameraManager: CameraManager;
  public readonly sceneManager: SceneManager;
  public readonly physicsWorld: PhysicsWorld;
  public readonly gameLoop: GameLoop;
  public readonly inputManager: InputManager;

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container);
    this.cameraManager = new CameraManager();
    this.physicsWorld = new PhysicsWorld();
    this.inputManager = new InputManager(this.renderer.webglRenderer.domElement);
    this.sceneManager = new SceneManager(this);
    this.gameLoop = new GameLoop();

    // Hook game loop updates
    this.gameLoop.registerUpdate((dt, totalTime) => {
      this.sceneManager.update(dt, totalTime);
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
    await PhysicsWorld.init();
    this.gameLoop.start();
    Logger.info('GameEngine running.');
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
