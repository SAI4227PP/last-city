import * as THREE from 'three';
import { MathUtils } from '@/core/utils/MathUtils';

export class CameraManager {
  public readonly camera: THREE.PerspectiveCamera;
  private trauma: number = 0; // Shake trauma (0 to 1)
  private shakeOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(fov: number = 65, near: number = 0.1, far: number = 1000) {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, 5, 10);
  }

  public updateAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public addTrauma(amount: number): void {
    this.trauma = MathUtils.clamp(this.trauma + amount, 0, 1);
  }

  public update(deltaTime: number): void {
    // Process screen shake trauma decay
    if (this.trauma > 0) {
      const shakePower = Math.pow(this.trauma, 2) * 0.4;
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * shakePower,
        (Math.random() * 2 - 1) * shakePower,
        (Math.random() * 2 - 1) * shakePower
      );
      this.camera.position.add(this.shakeOffset);
      this.trauma = Math.max(0, this.trauma - deltaTime * 1.5);
    }
  }
}
