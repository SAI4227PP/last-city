import { Time } from './Time';
import { Logger } from '@/core/utils/Logger';

export type UpdateCallback = (deltaTime: number, totalTime: number) => void;
export type FixedUpdateCallback = (fixedDelta: number) => void;

export class GameLoop {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;

  // Fixed timestep for physics simulation (e.g. 60Hz = 1/60 = 0.01666s)
  private readonly fixedDeltaTime: number = 1 / 60;
  private accumulator: number = 0;

  private updateCallbacks: Set<UpdateCallback> = new Set();
  private fixedUpdateCallbacks: Set<FixedUpdateCallback> = new Set();
  private renderCallbacks: Set<() => void> = new Set();

  public registerUpdate(cb: UpdateCallback): () => void {
    this.updateCallbacks.add(cb);
    return () => this.updateCallbacks.delete(cb);
  }

  public registerFixedUpdate(cb: FixedUpdateCallback): () => void {
    this.fixedUpdateCallbacks.add(cb);
    return () => this.fixedUpdateCallbacks.delete(cb);
  }

  public registerRender(cb: () => void): () => void {
    this.renderCallbacks.add(cb);
    return () => this.renderCallbacks.delete(cb);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    Logger.info('GameLoop started.');
    this.tick = this.tick.bind(this);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    Logger.info('GameLoop stopped.');
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (!paused) {
      this.lastTimestamp = performance.now();
      this.accumulator = 0;
    }
    Logger.info(`GameLoop pause state set to: ${paused}`);
  }

  public getPaused(): boolean {
    return this.isPaused;
  }

  private tick(currentTimestamp: number): void {
    if (!this.isRunning) return;

    const rawDelta = (currentTimestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = currentTimestamp;

    // Safety clamp rawDelta to 0.1s to prevent spiral of death
    const clampedDelta = Math.min(rawDelta, 0.1);
    const totalTime = currentTimestamp / 1000;

    Time.update(clampedDelta, totalTime);

    if (!this.isPaused) {
      // Fixed updates (e.g., Rapier physics)
      this.accumulator += clampedDelta;
      while (this.accumulator >= this.fixedDeltaTime) {
        for (const fixedCb of this.fixedUpdateCallbacks) {
          fixedCb(this.fixedDeltaTime);
        }
        this.accumulator -= this.fixedDeltaTime;
      }

      // Variable updates (gameplay, AI, animation)
      for (const updateCb of this.updateCallbacks) {
        updateCb(clampedDelta, totalTime);
      }
    }

    // Always render (so pause menu or debug overlays render smoothly)
    for (const renderCb of this.renderCallbacks) {
      renderCb();
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  }
}
