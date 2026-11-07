import * as THREE from 'three';
import { Logger } from '@/core/utils/Logger';
import { PerformanceManager, PerformanceConfig } from '@/core/performance/PerformanceManager';

export class Renderer {
  public readonly webglRenderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private currentConfig: PerformanceConfig;

  // Realtime rendering metrics
  public drawCalls: number = 0;
  public triangles: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    const perfManager = PerformanceManager.getInstance();
    this.currentConfig = perfManager.getConfig();

    this.webglRenderer = new THREE.WebGLRenderer({
      antialias: this.currentConfig.profile !== 'low',
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });

    this.webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.webglRenderer.toneMappingExposure = 1.1;

    // Apply shadow settings based on performance profile
    this.webglRenderer.shadowMap.enabled = this.currentConfig.shadows;
    this.webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.updateSize();
    this.container.appendChild(this.webglRenderer.domElement);

    // Listen to adaptive performance changes
    perfManager.onConfigChanged = (newConfig) => {
      this.onPerformanceConfigChanged(newConfig);
    };

    window.addEventListener('resize', this.onResize.bind(this));
    Logger.info('WebGL Renderer initialized with adaptive performance profiling.');
  }

  public updateSize(): { width: number; height: number; aspect: number } {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Apply pixel ratio clamp from active performance profile (e.g. 1.0 on low/mobile, 1.25 on med)
    const effectiveDpr = Math.min(window.devicePixelRatio, this.currentConfig.maxDpr);
    this.webglRenderer.setPixelRatio(effectiveDpr);

    // Dynamic resolution scaling: scales the internal canvas buffer without altering CSS display dimensions
    const scaledWidth = Math.round(width * this.currentConfig.renderScale);
    const scaledHeight = Math.round(height * this.currentConfig.renderScale);

    this.webglRenderer.setSize(scaledWidth, scaledHeight, false);
    this.webglRenderer.domElement.style.width = '100%';
    this.webglRenderer.domElement.style.height = '100%';

    return {
      width,
      height,
      aspect: width / height
    };
  }

  private onResize(): void {
    this.updateSize();
  }

  private onPerformanceConfigChanged(newConfig: PerformanceConfig): void {
    this.currentConfig = newConfig;
    this.webglRenderer.shadowMap.enabled = newConfig.shadows;
    this.updateSize();
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.webglRenderer.render(scene, camera);

    // Capture render metrics from WebGL info
    this.drawCalls = this.webglRenderer.info.render.calls;
    this.triangles = this.webglRenderer.info.render.triangles;
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize.bind(this));
    this.webglRenderer.dispose();
    if (this.webglRenderer.domElement.parentElement) {
      this.webglRenderer.domElement.parentElement.removeChild(this.webglRenderer.domElement);
    }
    Logger.info('WebGL Renderer disposed.');
  }
}
