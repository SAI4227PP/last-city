import { useGameUIStore } from '@/ui/store/gameUIStore';
import { Logger } from '@/core/utils/Logger';
import { SaveManager } from '@/persistence/SaveManager';
import { GraphicsSettings } from '@/shared/types';

export type GraphicsProfile = 'auto' | 'low' | 'medium' | 'high';
export type ShadowQuality = 'off' | 'low' | 'high';
export type ParticleQuality = 'low' | 'medium' | 'high';
export type EnvironmentalDetail = 'low' | 'high';

export interface PerformanceConfig {
  profile: GraphicsProfile;
  resolvedProfile: 'low' | 'medium' | 'high';
  renderScale: number;
  maxDpr: number;
  shadows: boolean;
  shadowQuality: ShadowQuality;
  shadowMapSize: number;
  particleQuality: ParticleQuality;
  particleScale: number;
  environmentalDetail: EnvironmentalDetail;
  maxActiveZombies: number;
  maxSubSteps: number;
  showFps: boolean;
  showDiagnostics: boolean;
  isManualOverride: boolean;
}

export class PerformanceManager {
  private static instance: PerformanceManager | null = null;

  public activeProfile: GraphicsProfile = 'auto';
  public currentResolvedProfile: 'low' | 'medium' | 'high' = 'medium';

  private frameTimes: number[] = [];
  private readonly sampleSize: number = 60; // Sample last ~1 second
  private lastEvaluationTime: number = 0;
  private readonly evaluationCooldown: number = 4.0; // 4 seconds cooldown prevents flickering

  private config: PerformanceConfig = {
    profile: 'auto',
    resolvedProfile: 'medium',
    renderScale: 0.85,
    maxDpr: 1.25,
    shadows: true,
    shadowQuality: 'low',
    shadowMapSize: 1024,
    particleQuality: 'medium',
    particleScale: 0.7,
    environmentalDetail: 'high',
    maxActiveZombies: 14,
    maxSubSteps: 3,
    showFps: true,
    showDiagnostics: false,
    isManualOverride: false
  };

  private configListeners: Set<(config: PerformanceConfig) => void> = new Set();
  public onConfigChanged?: (config: PerformanceConfig) => void;

  public addConfigListener(listener: (config: PerformanceConfig) => void): () => void {
    this.configListeners.add(listener);
    return () => this.configListeners.delete(listener);
  }

  private constructor() {
    // Start with balanced medium profile as baseline; auto-adjuster or persisted settings will refine
    this.applyResolvedProfile('medium', false);
    this.initFromStorage();
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

  public async initFromStorage(): Promise<void> {
    try {
      const settings = await SaveManager.getInstance().loadSettings();
      if (settings && settings.graphics) {
        const g = settings.graphics;
        this.activeProfile = g.quality;
        this.config.showFps = g.showFps ?? true;
        this.config.showDiagnostics = g.showDiagnostics ?? false;

        if (g.quality === 'auto') {
          this.config.isManualOverride = false;
          this.evaluatePerformance(true);
        } else {
          this.config.isManualOverride = true;
          this.applyResolvedProfile(g.quality, true);
          if (g.shadows) this.setShadowQuality(g.shadows, false);
          if (g.renderScale) this.setRenderScale(g.renderScale, false);
          if (g.particleQuality) this.setParticleQuality(g.particleQuality, false);
          if (g.environmentalDetail) this.setEnvironmentalDetail(g.environmentalDetail, false);
        }

        useGameUIStore.getState().setGraphicsProfile(this.activeProfile);
        useGameUIStore.getState().setShowDiagnostics(this.config.showDiagnostics);
        Logger.info(`Performance Manager loaded persisted graphics settings: profile=${this.activeProfile}`);
      }
    } catch (err) {
      Logger.warn('Could not load graphics settings from storage:', err);
    }
  }

  public async persistSettings(): Promise<void> {
    try {
      const current = await SaveManager.getInstance().loadSettings();
      const updatedGraphics: GraphicsSettings = {
        quality: this.activeProfile,
        shadows: this.config.shadowQuality,
        renderScale: this.config.renderScale,
        particleQuality: this.config.particleQuality,
        environmentalDetail: this.config.environmentalDetail,
        showFps: this.config.showFps,
        showDiagnostics: this.config.showDiagnostics
      };

      await SaveManager.getInstance().saveSettings({
        audio: current?.audio || { masterVolume: 0.8, musicVolume: 0.6, sfxVolume: 0.8, muted: false },
        graphics: updatedGraphics,
        mouseSensitivity: current?.mouseSensitivity || 0.0022
      });
    } catch (err) {
      Logger.warn('Failed to persist performance settings:', err);
    }
  }

  public setProfile(profile: GraphicsProfile): void {
    this.activeProfile = profile;
    useGameUIStore.getState().setGraphicsProfile(profile);

    if (profile === 'auto') {
      this.config.isManualOverride = false;
      this.config.profile = 'auto';
      Logger.info('Graphics profile set to AUTO (Dynamic Adaptive Mode).');
      this.evaluatePerformance(true);
    } else {
      this.config.isManualOverride = true;
      Logger.info(`Graphics profile manually locked to: ${profile.toUpperCase()}`);
      this.applyResolvedProfile(profile, true);
    }

    this.persistSettings();
  }

  public setShadowQuality(quality: ShadowQuality, persist: boolean = true): void {
    this.config.shadowQuality = quality;
    if (quality === 'off') {
      this.config.shadows = false;
      this.config.shadowMapSize = 512;
    } else if (quality === 'low') {
      this.config.shadows = true;
      this.config.shadowMapSize = 1024;
    } else {
      this.config.shadows = true;
      this.config.shadowMapSize = 2048;
    }

    if (persist) {
      this.config.isManualOverride = true;
      this.notifyConfigChanged();
      this.persistSettings();
    }
  }

  public setRenderScale(scale: number, persist: boolean = true): void {
    this.config.renderScale = Math.max(0.5, Math.min(scale, 1.0));
    if (persist) {
      this.config.isManualOverride = true;
      this.notifyConfigChanged();
      this.persistSettings();
    }
  }

  public setParticleQuality(quality: ParticleQuality, persist: boolean = true): void {
    this.config.particleQuality = quality;
    if (quality === 'low') this.config.particleScale = 0.35;
    else if (quality === 'medium') this.config.particleScale = 0.7;
    else this.config.particleScale = 1.0;

    if (persist) {
      this.config.isManualOverride = true;
      this.notifyConfigChanged();
      this.persistSettings();
    }
  }

  public setEnvironmentalDetail(detail: EnvironmentalDetail, persist: boolean = true): void {
    this.config.environmentalDetail = detail;
    if (persist) {
      this.config.isManualOverride = true;
      this.notifyConfigChanged();
      this.persistSettings();
    }
  }

  public setShowFps(show: boolean): void {
    this.config.showFps = show;
    this.notifyConfigChanged();
    this.persistSettings();
  }

  public setShowDiagnostics(show: boolean): void {
    this.config.showDiagnostics = show;
    useGameUIStore.getState().setShowDiagnostics(show);
    this.notifyConfigChanged();
    this.persistSettings();
  }

  public recordFrame(deltaTime: number, totalTime: number): void {
    const frameTimeMs = deltaTime * 1000;
    this.frameTimes.push(frameTimeMs);

    if (this.frameTimes.length > this.sampleSize) {
      this.frameTimes.shift();
    }

    // Auto-adaptation evaluation
    if (this.activeProfile === 'auto' && !this.config.isManualOverride) {
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
    // Promote to High if FPS > 54
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
          ...this.config,
          profile: this.activeProfile,
          resolvedProfile: 'low',
          renderScale: 0.75,
          maxDpr: 1.0,
          shadows: false,
          shadowQuality: 'off',
          shadowMapSize: 512,
          particleQuality: 'low',
          particleScale: 0.35,
          environmentalDetail: 'low',
          maxActiveZombies: 8,
          maxSubSteps: 2
        };
        break;

      case 'medium':
        this.config = {
          ...this.config,
          profile: this.activeProfile,
          resolvedProfile: 'medium',
          renderScale: 0.85,
          maxDpr: 1.25,
          shadows: true,
          shadowQuality: 'low',
          shadowMapSize: 1024,
          particleQuality: 'medium',
          particleScale: 0.7,
          environmentalDetail: 'high',
          maxActiveZombies: 14,
          maxSubSteps: 3
        };
        break;

      case 'high':
        this.config = {
          ...this.config,
          profile: this.activeProfile,
          resolvedProfile: 'high',
          renderScale: 1.0,
          maxDpr: 1.5,
          shadows: true,
          shadowQuality: 'high',
          shadowMapSize: 2048,
          particleQuality: 'high',
          particleScale: 1.0,
          environmentalDetail: 'high',
          maxActiveZombies: 24,
          maxSubSteps: 3
        };
        break;
    }

    Logger.info(
      `Performance Manager applied profile [${profile.toUpperCase()}]: RenderScale=${this.config.renderScale}, MaxDPR=${this.config.maxDpr}, Shadows=${this.config.shadows}`
    );

    if (notify) {
      this.notifyConfigChanged();
    }
  }

  private notifyConfigChanged(): void {
    const cfg = this.getConfig();
    if (this.onConfigChanged) {
      this.onConfigChanged(cfg);
    }
    for (const listener of this.configListeners) {
      listener(cfg);
    }
  }
}
