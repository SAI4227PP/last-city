import { Time } from './Time';
import { Logger } from '@/core/utils/Logger';
import { AudioManager } from '@/core/audio/AudioManager';

export type UpdateCallback = (deltaTime: number, totalTime: number) => void;
export type FixedUpdateCallback = (fixedDelta: number) => void;

export class GameLoop {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;

  // Fixed timestep for physics simulation (60Hz = 1/60 = 0.01666s)
  private readonly fixedDeltaTime: number = 1 / 60;
  // Maximum substeps allowed in a single frame to prevent spiral of death (2 for low-end, 3 for mid/high)
  private maxSubSteps: number = 3;
  private accumulator: number = 0;

  private updateCallbacks: Set<UpdateCallback> = new Set();
  private fixedUpdateCallbacks: Set<FixedUpdateCallback> = new Set();
  private renderCallbacks: Set<() => void> = new Set();
  private onVisibilityChangeBound: () => void;
  private onPageHideBound: () => void;
  private onPageShowBound: () => void;

  constructor() {
    this.tick = this.tick.bind(this);
    this.lastTimestamp = typeof performance !== 'undefined' ? performance.now() : 0;
    this.onVisibilityChangeBound = this.onVisibilityChange.bind(this);
    this.onPageHideBound = this.onPageHide.bind(this);
    this.onPageShowBound = this.onPageShow.bind(this);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChangeBound);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onPageHideBound);
      window.addEventListener('pageshow', this.onPageShowBound);
    }
  }

  public setMaxSubSteps(substeps: number): void {
    this.maxSubSteps = Math.max(1, Math.min(substeps, 5));
  }

  public getMaxSubSteps(): number {
    return this.maxSubSteps;
  }

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

  public resetTimers(): void {
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
  }

  private onVisibilityChange(): void {
    if (document.hidden) {
      // Tab hidden or backgrounded on mobile: reset accumulator and suspend audio context
      this.accumulator = 0;
      AudioManager.getInstance().suspendContext();
    } else {
      // Resumed: synchronize timestamps to prevent sudden huge delta and resume audio
      this.lastTimestamp = performance.now();
      this.accumulator = 0;
      AudioManager.getInstance().resumeContext();
    }
  }

  private onPageHide(): void {
    this.accumulator = 0;
    AudioManager.getInstance().suspendContext();
  }

  private onPageShow(): void {
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    AudioManager.getInstance().resumeContext();
  }

  private tick(currentTimestamp: number): void {
    if (!this.isRunning) return;

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = currentTimestamp;
      this.animationFrameId = requestAnimationFrame(this.tick);
      return;
    }

    const rawDelta = (currentTimestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = currentTimestamp;

    // Safety clamp rawDelta to 0.1s to prevent spiral of death
    const clampedDelta = Math.min(rawDelta, 0.1);
    const totalTime = currentTimestamp / 1000;

    Time.update(clampedDelta, totalTime);

    if (!this.isPaused) {
      // Fixed updates with hard substep limit
      this.accumulator += clampedDelta;
      let substeps = 0;

      while (this.accumulator >= this.fixedDeltaTime && substeps < this.maxSubSteps) {
        for (const fixedCb of this.fixedUpdateCallbacks) {
          fixedCb(this.fixedDeltaTime);
        }
        this.accumulator -= this.fixedDeltaTime;
        substeps++;
      }

      // If accumulator still exceeds threshold after max substeps, discard it to avoid frame lag lock
      if (this.accumulator > this.fixedDeltaTime) {
        this.accumulator = 0;
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

  public dispose(): void {
    this.stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHideBound);
      window.removeEventListener('pageshow', this.onPageShowBound);
    }
  }
}
