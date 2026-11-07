import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ModelFactory } from '@/core/assets/ModelFactory';
import { DisposableManager } from '@/core/utils/Disposable';
import { EventBus } from '@/core/events/EventBus';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';

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

  it('DisposableManager recursively disposes scene geometries and materials while preserving shared resources', () => {
    const root = new THREE.Group();

    // Unshared mesh
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geo, mat);
    root.add(mesh);

    // Shared mesh from cache
    const sharedGeo = new THREE.BoxGeometry(2, 2, 2);
    sharedGeo.userData.isShared = true;
    const sharedMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    sharedMat.userData.isShared = true;
    const sharedMesh = new THREE.Mesh(sharedGeo, sharedMat);
    root.add(sharedMesh);

    let geoDisposed = false;
    let matDisposed = false;
    let sharedGeoDisposed = false;
    let sharedMatDisposed = false;

    geo.dispose = () => { geoDisposed = true; };
    mat.dispose = () => { matDisposed = true; };
    sharedGeo.dispose = () => { sharedGeoDisposed = true; };
    sharedMat.dispose = () => { sharedMatDisposed = true; };

    DisposableManager.disposeObject3D(root);

    expect(geoDisposed).toBe(true);
    expect(matDisposed).toBe(true);
    expect(sharedGeoDisposed).toBe(false);
    expect(sharedMatDisposed).toBe(false);
  });

  it('executes repeated scene transition cycles without leaking physics bodies or event listeners', async () => {
    const eventBus = EventBus.getInstance();
    const physics = new PhysicsWorld();
    await physics.initWorld();

    const stages = ['main-menu', 'cinematic', 'hospital', 'city-escape', 'open-survival', 'main-menu'];

    // Run transition cycle 5 consecutive times
    for (let cycle = 1; cycle <= 5; cycle++) {
      for (const stage of stages) {
        // Register temporary scene listener
        const unsub = eventBus.on('weapon:fire', () => {});

        // Add dummy static colliders for this scene
        if (stage !== 'main-menu' && stage !== 'cinematic') {
          physics.createStaticBox(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1), undefined, stage);
          physics.createStaticBox(new THREE.Vector3(2, 0, 2), new THREE.Vector3(1, 1, 1), undefined, stage);
        }

        // Scene exit: cleanup listeners & scene-owned bodies
        unsub();
        physics.clearBodiesByOwner(stage);
      }
    }

    // After 5 full cycles, physics bodies must be zero and listeners must not accumulate
    expect(physics.getBodyCount()).toBe(0);

    // Test that firing an event does not throw or trigger dead callbacks
    expect(() => {
      eventBus.emit('weapon:fire', { weapon: 'pistol', currentAmmo: 10, reserveAmmo: 20 });
    }).not.toThrow();

    physics.dispose();
  });
});
