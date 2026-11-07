import { useGameUIStore } from '@/ui/store/gameUIStore';
import { Logger } from '@/core/utils/Logger';

export type GraphicsProfile = 'auto' | 'low' | 'medium' | 'high';

export interface PerformanceConfig {
  profile: GraphicsProfile;
  renderScale: number;
  maxDpr: number;
  shadows: boolean;
  shadowMapSize: number;
  maxActiveZombies: number;
  particleScale: number;
}

export class PerformanceManager {
  private static instance: PerformanceManager | null = null;

  public activeProfile: GraphicsProfile = 'auto';
  public currentResolvedProfile: 'low' | 'medium' | 'high' = 'medium';

  private frameTimes: number[] = [];
  private readonly sampleSize: number = 60; // Sample last ~1 second
  private lastEvaluationTime: number = 0;
  private readonly evaluationCooldown: number = 4.0; // 4 seconds between auto-adjustments

  // Current applied config
  private config: PerformanceConfig = {
    profile: 'auto',
    renderScale: 0.85,
    maxDpr: 1.25,
    shadows: true,
    shadowMapSize: 1024,
    maxActiveZombies: 14,
    particleScale: 0.7
  };

  public onConfigChanged?: (config: PerformanceConfig) => void;

  private constructor() {
    // Detect mobile device
    const isMobile = typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      Logger.info('Mobile environment detected. Setting default profile to Low/Adaptive.');
      this.currentResolvedProfile = 'low';
    } else {
      this.currentResolvedProfile = 'medium';
    }

    this.applyResolvedProfile(this.currentResolvedProfile, false);
  }

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  public getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  public setProfile(profile: GraphicsProfile): void {
    this.activeProfile = profile;
    useGameUIStore.getState().setGraphicsProfile(profile);

    if (profile === 'auto') {
      Logger.info('Graphics profile set to AUTO (Dynamic Adaptive Mode).');
      this.evaluatePerformance(true);
    } else {
      Logger.info(`Graphics profile manually locked to: ${profile.toUpperCase()}`);
      this.applyResolvedProfile(profile, true);
    }
  }

  public recordFrame(deltaTime: number, totalTime: number): void {
    const frameTimeMs = deltaTime * 1000;
    this.frameTimes.push(frameTimeMs);

    if (this.frameTimes.length > this.sampleSize) {
      this.frameTimes.shift();
    }

    // Auto-adaptation evaluation
    if (this.activeProfile === 'auto') {
      if (totalTime - this.lastEvaluationTime >= this.evaluationCooldown) {
        this.evaluatePerformance(false);
        this.lastEvaluationTime = totalTime;
      }
    }
  }

  public getAverageFps(): number {
    if (this.frameTimes.length === 0) return 60;
    const avgMs = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return avgMs > 0 ? Math.round(1000 / avgMs) : 60;
  }

  public getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 16.6;
    return Number((this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length).toFixed(1));
  }

  private evaluatePerformance(force: boolean): void {
    if (this.frameTimes.length < 20 && !force) return;

    const avgFps = this.getAverageFps();

    // Hysteresis thresholds:
    // Drop to Low if FPS < 28 for sustained period
    // Promote to High if FPS > 55
    let target: 'low' | 'medium' | 'high' = this.currentResolvedProfile;

    if (avgFps < 28) {
      if (this.currentResolvedProfile === 'high') target = 'medium';
      else if (this.currentResolvedProfile === 'medium') target = 'low';
    } else if (avgFps > 54) {
      if (this.currentResolvedProfile === 'low') target = 'medium';
      else if (this.currentResolvedProfile === 'medium') target = 'high';
    }

    if (target !== this.currentResolvedProfile || force) {
      this.applyResolvedProfile(target, true);
    }
  }

  private applyResolvedProfile(profile: 'low' | 'medium' | 'high', notify: boolean): void {
    this.currentResolvedProfile = profile;

    switch (profile) {
      case 'low':
        this.config = {
          profile: this.activeProfile,
          renderScale: 0.70,
          maxDpr: 1.0,
          shadows: false,
          shadowMapSize: 512,
          maxActiveZombies: 8,
          particleScale: 0.35
        };
        break;

      case 'medium':
        this.config = {
          profile: this.activeProfile,
          renderScale: 0.85,
          maxDpr: 1.25,
          shadows: true,
          shadowMapSize: 1024,
          maxActiveZombies: 14,
          particleScale: 0.7
        };
        break;

      case 'high':
        this.config = {
          profile: this.activeProfile,
          renderScale: 1.0,
          maxDpr: 1.5,
          shadows: true,
          shadowMapSize: 2048,
          maxActiveZombies: 24,
          particleScale: 1.0
        };
        break;
    }

    Logger.info(`Performance Manager applied profile [${profile.toUpperCase()}]: RenderScale=${this.config.renderScale}, MaxDPR=${this.config.maxDpr}, Shadows=${this.config.shadows}`);

    if (notify && this.onConfigChanged) {
      this.onConfigChanged(this.config);
    }
  }
}
