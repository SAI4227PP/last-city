import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PlayerAssetPool } from '@/features/player/PlayerAssetPool';
import { PlayerController } from '@/features/player/PlayerController';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { InputManager } from '@/core/input/InputManager';
import { CameraManager } from '@/core/engine/CameraManager';

describe('Player Character Loading & Demo Mannequin Elimination', () => {
  let scene: THREE.Scene;
  let physicsWorld: PhysicsWorld;
  let inputManager: InputManager;
  let cameraManager: CameraManager;

  // Helper to build a mock Athletic_man skeletal rig with required meshes & bones
  function createMockAthleticMan(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'AthleticManVisual';

    const hips = new THREE.Bone();
    hips.name = 'Hips';
    const spine = new THREE.Bone();
    spine.name = 'Spine';
    const chest = new THREE.Bone();
    chest.name = 'Chest';
    const rightArm = new THREE.Bone();
    rightArm.name = 'RightArm';
    const weaponR = new THREE.Bone();
    weaponR.name = 'WeaponR';

    rightArm.add(weaponR);
    chest.add(rightArm);
    spine.add(chest);
    hips.add(spine);
    root.add(hips);

    // Built-in rifle skinned meshes
    const rifleMesh1 = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
    rifleMesh1.name = 'Athletic_man_11';
    const rifleMesh2 = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
    rifleMesh2.name = 'Athletic_man_12';
    const rifleMesh3 = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
    rifleMesh3.name = 'Athletic_man_13';

    // Body anatomy meshes
    const bodyMesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
    bodyMesh.name = 'Athletic_man_1';

    const bones = [hips, spine, chest, rightArm, weaponR];
    const skeleton = new THREE.Skeleton(bones);
    rifleMesh1.bind(skeleton);
    rifleMesh2.bind(skeleton);
    rifleMesh3.bind(skeleton);
    bodyMesh.bind(skeleton);

    root.add(rifleMesh1, rifleMesh2, rifleMesh3, bodyMesh);
    return root;
  }

  beforeEach(async () => {
    scene = new THREE.Scene();
    await PhysicsWorld.init();
    physicsWorld = new PhysicsWorld();
    await physicsWorld.initWorld();
    inputManager = new InputManager(document.createElement('div'));
    cameraManager = new CameraManager();
  });

  it('1. PlayerAssetPool is a singleton with correct asset paths', () => {
    const pool1 = PlayerAssetPool.getInstance();
    const pool2 = PlayerAssetPool.getInstance();
    expect(pool1).toBe(pool2);
    expect(pool1.modelUrl).toBe('/assets/characters/player/model/Athletic_man.glb');
    expect(pool1.animationBasePath).toBe('/assets/characters/player/animations/');
  });

  it('2. Directly attaches preloaded Athletic_man model without creating demo mannequin', () => {
    const pool = PlayerAssetPool.getInstance();
    const mockModel = createMockAthleticMan();
    // Simulate pool having preloaded model
    (pool as any).baseModel = mockModel;

    const player = new PlayerController(
      scene,
      physicsWorld,
      inputManager,
      cameraManager,
      new THREE.Vector3(0, 1.2, 0)
    );

    expect(player.athleticModel).toBeDefined();
    expect(player.animationController).toBeDefined();

    // Verify demo/procedural model is NOT added to player group
    const proceduralRoot = player.group.getObjectByName('MannequinRoot') || player.group.getObjectByName('Player_Body');
    expect(proceduralRoot).toBeUndefined();

    // Verify real athletic model is a child of player group
    const visual = player.group.getObjectByName('AthleticManVisual');
    expect(visual).toBeDefined();

    player.dispose();
  });

  it('3. Sets up initial weapon attachment and toggles rifle meshes cleanly', () => {
    const pool = PlayerAssetPool.getInstance();
    const mockModel = createMockAthleticMan();
    (pool as any).baseModel = mockModel;

    const player = new PlayerController(
      scene,
      physicsWorld,
      inputManager,
      cameraManager,
      new THREE.Vector3(0, 1.2, 0)
    );

    // Initial starting weapon is knife: built-in rifle meshes must be hidden
    const rifle1 = player.group.getObjectByName('Athletic_man_11') as THREE.Mesh;
    const rifle2 = player.group.getObjectByName('Athletic_man_12') as THREE.Mesh;
    const rifle3 = player.group.getObjectByName('Athletic_man_13') as THREE.Mesh;

    expect(rifle1.visible).toBe(false);
    expect(rifle2.visible).toBe(false);
    expect(rifle3.visible).toBe(false);

    // Knife mesh attached to WeaponR bone
    const weaponR = player.group.getObjectByName('WeaponR');
    expect(weaponR).toBeDefined();
    expect(weaponR!.children.length).toBeGreaterThan(0);

    // Switch to rifle: rifle meshes must become visible, WeaponR prop removed
    player.attachWeaponMesh('rifle');
    expect(rifle1.visible).toBe(true);
    expect(rifle2.visible).toBe(true);
    expect(rifle3.visible).toBe(true);
    expect(weaponR!.children.length).toBe(0);

    // Switch back to knife: rifle meshes hidden, knife prop restored
    player.attachWeaponMesh('knife');
    expect(rifle1.visible).toBe(false);
    expect(weaponR!.children.length).toBeGreaterThan(0);

    player.dispose();
  });

  it('4. Allows explicit development debug mannequin only when useDebugModel is set', () => {
    const pool = PlayerAssetPool.getInstance();
    const mockModel = createMockAthleticMan();
    (pool as any).baseModel = mockModel;

    // Explicitly request debug model
    const player = new PlayerController(
      scene,
      physicsWorld,
      inputManager,
      cameraManager,
      new THREE.Vector3(0, 1.2, 0),
      { useDebugModel: true }
    );

    // Athletic model should NOT be attached
    expect(player.athleticModel).toBeUndefined();

    // Procedural mannequin should be present
    expect((player as any).modelParts).toBeDefined();

    player.dispose();
  });

  it('5. Cloned player models maintain independent bone hierarchies and materials', () => {
    const pool = PlayerAssetPool.getInstance();
    const mockModel = createMockAthleticMan();
    (pool as any).baseModel = mockModel;

    const clone1 = pool.cloneModel()!;
    const clone2 = pool.cloneModel()!;

    expect(clone1).not.toBe(clone2);
    expect(clone1.uuid).not.toBe(clone2.uuid);

    const weaponR1 = clone1.getObjectByName('WeaponR');
    const weaponR2 = clone2.getObjectByName('WeaponR');
    expect(weaponR1).not.toBe(weaponR2);
  });

  it('6. Does not duplicate physics capsule or player body across scene life cycle', () => {
    const pool = PlayerAssetPool.getInstance();
    (pool as any).baseModel = createMockAthleticMan();

    const initialBodyCount = physicsWorld.getBodyCount();

    const player1 = new PlayerController(scene, physicsWorld, inputManager, cameraManager);
    expect(physicsWorld.getBodyCount()).toBe(initialBodyCount + 1);

    player1.dispose();
    expect(physicsWorld.getBodyCount()).toBe(initialBodyCount);
  });
});
