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
      if ((child as THREE.Mesh).isMesh || (child as THREE.InstancedMesh).isInstancedMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry && !mesh.geometry.userData?.isShared) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              if (!mat.userData?.isShared) {
                mat.dispose();
              }
            });
          } else if (!mesh.material.userData?.isShared) {
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
