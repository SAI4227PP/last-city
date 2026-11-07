import * as THREE from 'three';

export interface IDisposable {
  dispose(): void;
}

export class DisposableManager implements IDisposable {
  private disposables: IDisposable[] = [];

  public add(item: IDisposable): void {
    this.disposables.push(item);
  }

  public static disposeObject3D(root: THREE.Object3D): void {
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
  }

  public dispose(): void {
    for (const item of this.disposables) {
      try {
        item.dispose();
      } catch (err) {
        console.error('Failed to dispose resource:', err);
      }
    }
    this.disposables = [];
  }
}
