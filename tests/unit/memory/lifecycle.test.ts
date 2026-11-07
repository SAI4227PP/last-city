import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ModelFactory } from '@/core/assets/ModelFactory';
import { DisposableManager } from '@/core/utils/Disposable';

describe('Memory & Lifecycle Management', () => {
  it('ModelFactory reuses shared geometry buffers across multiple character creations', () => {
    const playerA = ModelFactory.createPlayerModel();
    const playerB = ModelFactory.createPlayerModel();

    // Check that Torso geometries share the exact same buffer instance
    const torsoMeshA = playerA.body.children[0] as THREE.Mesh;
    const torsoMeshB = playerB.body.children[0] as THREE.Mesh;

    expect(torsoMeshA.geometry).toBe(torsoMeshB.geometry);
    expect(torsoMeshA.material).toBe(torsoMeshB.material);
  });

  it('ModelFactory reuses shared zombie materials and geometries per variant', () => {
    const z1 = ModelFactory.createZombieModel('walker');
    const z2 = ModelFactory.createZombieModel('walker');

    const head1 = z1.head;
    const head2 = z2.head;

    expect(head1.geometry).toBe(head2.geometry);
    expect(head1.material).toBe(head2.material);
  });

  it('DisposableManager recursively disposes scene geometries and materials', () => {
    const root = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geo, mat);
    root.add(mesh);

    let geoDisposed = false;
    let matDisposed = false;

    geo.dispose = () => { geoDisposed = true; };
    mat.dispose = () => { matDisposed = true; };

    DisposableManager.disposeObject3D(root);

    expect(geoDisposed).toBe(true);
    expect(matDisposed).toBe(true);
  });
});
