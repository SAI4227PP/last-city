import * as THREE from 'three';
import { Logger } from '@/core/utils/Logger';

export class Renderer {
  public readonly webglRenderer: THREE.WebGLRenderer;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    this.webglRenderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });

    this.webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.webglRenderer.toneMappingExposure = 1.1;

    // High quality shadow maps
    this.webglRenderer.shadowMap.enabled = true;
    this.webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.updateSize();
    this.container.appendChild(this.webglRenderer.domElement);

    window.addEventListener('resize', this.onResize.bind(this));
    Logger.info('WebGL Renderer initialized successfully.');
  }

  public updateSize(): { width: number; height: number; aspect: number } {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);

    this.webglRenderer.setSize(width, height);
    this.webglRenderer.setPixelRatio(pixelRatio);

    return {
      width,
      height,
      aspect: width / height
    };
  }

  private onResize(): void {
    this.updateSize();
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.webglRenderer.render(scene, camera);
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
