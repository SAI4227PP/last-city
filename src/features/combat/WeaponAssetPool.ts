import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { WeaponType } from '@/shared/types';
import { Logger } from '@/core/utils/Logger';
import { ModelFactory } from '@/core/assets/ModelFactory';

export interface WeaponTransformDef {
  modelUrl: string;
  handScale: number;
  handPosition: [number, number, number];
  handRotation: [number, number, number];
  muzzleOffset: [number, number, number];
  dropScale: number;
}

export const WEAPON_TRANSFORM_CONFIGS: Record<WeaponType, WeaponTransformDef> = {
  pistol: {
    modelUrl: '/assets/Guns/Pistol/base_basic_shaded.glb',
    handScale: 0.48,
    handPosition: [0, -0.065, -0.04],
    handRotation: [0, 0, 0],
    muzzleOffset: [0, 0.08, 0.18],
    dropScale: 0.85
  },
  shotgun: {
    modelUrl: '/assets/Guns/Shotgun/shotgun.glb',
    handScale: 0.92,
    handPosition: [0, -0.08, -0.15],
    handRotation: [0, Math.PI / 2, 0], // Rotates -X barrel into +Z forward
    muzzleOffset: [0, 0.12, 0.65],
    dropScale: 0.85
  },
  rifle: {
    modelUrl: '/assets/Guns/Assault_Rifle/base_basic_shaded.glb',
    handScale: 0.40,
    handPosition: [0, -0.12, -0.10],
    handRotation: [0, 0, 0],
    muzzleOffset: [0, 0.12, 0.60],
    dropScale: 0.50
  },
  sniper: {
    modelUrl: '/assets/Guns/Sniper_Rifle/sniper_rifle.glb',
    handScale: 0.95,
    handPosition: [0, -0.06, -0.12],
    handRotation: [0, -Math.PI / 2, 0], // Rotates +X barrel into +Z forward
    muzzleOffset: [0, 0.12, 0.85],
    dropScale: 0.85
  },
  machinegun: {
    modelUrl: '/assets/Guns/Machine_Gun/base_basic_shaded.glb',
    handScale: 0.60,
    handPosition: [0, -0.10, -0.12],
    handRotation: [0, 0, 0],
    muzzleOffset: [0, 0.10, 0.70],
    dropScale: 0.60
  },
  knife: {
    modelUrl: '',
    handScale: 1.0,
    handPosition: [0, 0, 0],
    handRotation: [0, 0, 0],
    muzzleOffset: [0, 0, 0.3],
    dropScale: 1.0
  },
  bat: {
    modelUrl: '',
    handScale: 1.0,
    handPosition: [0, 0, 0],
    handRotation: [0, 0, 0],
    muzzleOffset: [0, 0, 0.6],
    dropScale: 1.0
  }
};

export class WeaponAssetPool {
  private static instance: WeaponAssetPool | null = null;
  private loader: GLTFLoader = new GLTFLoader();
  private cache: Map<WeaponType, THREE.Object3D> = new Map();
  private loadPromises: Map<WeaponType, Promise<THREE.Object3D | null>> = new Map();

  private constructor() {}

  public static getInstance(): WeaponAssetPool {
    if (!WeaponAssetPool.instance) {
      WeaponAssetPool.instance = new WeaponAssetPool();
    }
    return WeaponAssetPool.instance;
  }

  /**
   * Preloads all five firearms asynchronously into the weapon model cache.
   */
  public async preloadAll(): Promise<void> {
    const guns: WeaponType[] = ['pistol', 'shotgun', 'rifle', 'sniper', 'machinegun'];
    await Promise.all(guns.map((w) => this.loadModel(w)));
    Logger.info(`WeaponAssetPool: Preloaded ${this.cache.size} 3D weapon models.`);
  }

  /**
   * Loads or returns a cached master 3D model for the requested weapon.
   */
  public async loadModel(type: WeaponType): Promise<THREE.Object3D | null> {
    if (this.cache.has(type)) {
      return this.cache.get(type)!;
    }

    if (this.loadPromises.has(type)) {
      return this.loadPromises.get(type)!;
    }

    const cfg = WEAPON_TRANSFORM_CONFIGS[type];
    if (!cfg || !cfg.modelUrl) {
      return null;
    }

    const p = new Promise<THREE.Object3D | null>((resolve) => {
      this.loader.load(
        cfg.modelUrl,
        (gltf) => {
          const model = gltf.scene;
          model.name = `MasterWeapon_${type}`;
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          this.cache.set(type, model);
          resolve(model);
        },
        undefined,
        (err) => {
          Logger.warn(`WeaponAssetPool: Failed loading weapon model for "${type}" (${cfg.modelUrl}): ${err}`);
          resolve(null);
        }
      );
    });

    this.loadPromises.set(type, p);
    return p;
  }

  /**
   * Clones and attaches the authentic 3D weapon model configured with proper grip offset and scale.
   */
  public createWeaponHandMesh(type: WeaponType): THREE.Group {
    const root = new THREE.Group();
    root.name = `HandWeaponSocket_${type}`;

    const cfg = WEAPON_TRANSFORM_CONFIGS[type];
    const cached = this.cache.get(type);

    if (cached && cfg) {
      const clone = SkeletonUtils.clone(cached);
      clone.scale.setScalar(cfg.handScale);
      clone.position.set(...cfg.handPosition);
      clone.rotation.set(...cfg.handRotation);

      root.add(clone);
    } else {
      // Fallback procedural mesh from ModelFactory if asset is still loading or melee
      const fallback = ModelFactory.createWeaponMesh(type);
      root.add(fallback);

      // If firearm, trigger background load to upgrade mesh when ready
      if (cfg && cfg.modelUrl) {
        this.loadModel(type).then((loaded) => {
          if (loaded && root.children.length > 0) {
            root.clear();
            const upgraded = SkeletonUtils.clone(loaded);
            upgraded.scale.setScalar(cfg.handScale);
            upgraded.position.set(...cfg.handPosition);
            upgraded.rotation.set(...cfg.handRotation);
            root.add(upgraded);
          }
        });
      }
    }

    return root;
  }

  /**
   * Clones and formats the authentic 3D weapon model for physical world loot drops.
   */
  public createWeaponDropMesh(type: WeaponType): THREE.Group {
    const root = new THREE.Group();
    root.name = `DropWeapon_${type}`;

    const cfg = WEAPON_TRANSFORM_CONFIGS[type];
    const cached = this.cache.get(type);

    if (cached && cfg) {
      const clone = SkeletonUtils.clone(cached);
      clone.scale.setScalar(cfg.dropScale);

      // Center the drop model's bounding box at origin
      const box = new THREE.Box3().setFromObject(clone);
      const center = box.getCenter(new THREE.Vector3());
      clone.position.sub(center);
      clone.position.y += (box.max.y - box.min.y) * 0.25;

      root.add(clone);
    } else {
      const fallback = ModelFactory.createWeaponMesh(type);
      root.add(fallback);
    }

    return root;
  }

  /**
   * Returns barrel tip offset in weapon forward vector coordinates for muzzle flashes and tracers.
   */
  public getMuzzleOffset(type: WeaponType): THREE.Vector3 {
    const cfg = WEAPON_TRANSFORM_CONFIGS[type];
    if (cfg) {
      return new THREE.Vector3(...cfg.muzzleOffset);
    }
    return new THREE.Vector3(0, 0.05, 0.5);
  }

  public dispose(): void {
    this.cache.clear();
    this.loadPromises.clear();
  }
}
