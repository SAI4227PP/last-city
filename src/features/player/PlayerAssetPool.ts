import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Logger } from '@/core/utils/Logger';
import {
  PlayerAnimationId,
  ANIMATION_REGISTRY,
  AnimationMetadata
} from './PlayerAnimationTypes';
import { PlayerAnimationController } from './PlayerAnimationController';

export class PlayerAssetPool {
  private static instance: PlayerAssetPool;
  private loader: GLTFLoader = new GLTFLoader();
  private baseModel: THREE.Object3D | null = null;
  private clips: Map<PlayerAnimationId, THREE.AnimationClip> = new Map();
  private isPreloading: boolean = false;
  private preloadPromise: Promise<boolean> | null = null;

  public readonly modelUrl = '/assets/characters/player/model/Athletic_man.glb';
  public readonly animationBasePath = '/assets/characters/player/animations/';

  public static getInstance(): PlayerAssetPool {
    if (!this.instance) {
      this.instance = new PlayerAssetPool();
    }
    return this.instance;
  }

  public isReady(): boolean {
    return this.baseModel !== null;
  }

  public getClips(): Map<PlayerAnimationId, THREE.AnimationClip> {
    return this.clips;
  }

  public getBaseModel(): THREE.Object3D | null {
    return this.baseModel;
  }

  /**
   * Preloads Athletic_man.glb character model and core locomotion/combat animations.
   * Reports streaming progress through the optional onProgress callback.
   */
  public async preload(
    onProgress?: (progress: number, statusText: string) => void
  ): Promise<boolean> {
    if (this.baseModel) {
      onProgress?.(100, 'Survivor assets ready');
      return true;
    }

    if (this.isPreloading && this.preloadPromise) {
      return this.preloadPromise;
    }

    this.isPreloading = true;
    this.preloadPromise = this.doPreload(onProgress);
    return this.preloadPromise;
  }

  private async doPreload(
    onProgress?: (progress: number, statusText: string) => void
  ): Promise<boolean> {
    try {
      onProgress?.(10, 'Streaming survivor model (Athletic Man)...');

      // 1. Load Athletic_man.glb base character
      const gltf = await this.loadGltf(this.modelUrl);
      if (!gltf || !gltf.scene) {
        Logger.warn('PlayerAssetPool: Athletic_man.glb could not be loaded; development fallback available.');
        this.isPreloading = false;
        return false;
      }

      this.baseModel = gltf.scene;
      if (this.baseModel) {
        this.baseModel.name = 'AthleticManAuthoritative';
        this.baseModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      }

      onProgress?.(50, 'Streaming core survivor animations...');

      // 2. Preload essential core locomotion, combat, and reaction animation clips
      const coreIds: PlayerAnimationId[] = [
        'idle',
        'walk',
        'run',
        'walk_back',
        'strafe_left',
        'strafe_right',
        'jump_start',
        'jump_air',
        'jump_land',
        'rifle_idle',
        'rifle_aim',
        'rifle_crouch_aim',
        'rifle_crouch_walk',
        'rifle_walk',
        'rifle_walk_back',
        'rifle_run',
        'rifle_sprint',
        'rifle_strafe_left',
        'rifle_strafe_right',
        'rifle_fire',
        'rifle_fire_auto',
        'rifle_reload',
        'pistol_idle',
        'pistol_aim',
        'pistol_walk',
        'pistol_run',
        'pistol_sprint',
        'pistol_strafe_left',
        'pistol_strafe_right',
        'pistol_fire',
        'sword_idle',
        'sword_slash',
        'pick_up',
        'hit_front',
        'hit_back',
        'death_forward',
        'death_backward'
      ];

      let loadedCount = 0;
      await Promise.all(
        coreIds.map(async (id) => {
          const meta: AnimationMetadata | undefined = ANIMATION_REGISTRY[id];
          if (!meta) return;

          const url = `${this.animationBasePath}${meta.file}`;
          const animGltf = await this.loadGltf(url);
          if (animGltf && animGltf.animations && animGltf.animations.length > 0) {
            let clip = animGltf.animations[0];
            clip.name = id;
            if (meta.inPlace) {
              clip = PlayerAnimationController.processClipForInPlace(clip);
            }
            this.clips.set(id, clip);
          }
          loadedCount++;
          const pct = 50 + Math.round((loadedCount / coreIds.length) * 50);
          onProgress?.(pct, `Streaming animations: ${id} (${loadedCount}/${coreIds.length})...`);
        })
      );

      Logger.info(`PlayerAssetPool: Successfully preloaded Athletic_man model and ${this.clips.size} core animation clips.`);
      onProgress?.(100, 'Survivor assets initialized');
      this.isPreloading = false;
      return true;
    } catch (err) {
      Logger.warn(`PlayerAssetPool: Asset loading error: ${err}`);
      this.isPreloading = false;
      return false;
    }
  }

  private loadGltf(url: string): Promise<any> {
    return new Promise((resolve) => {
      this.loader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (err) => {
          Logger.warn(`PlayerAssetPool: Failed loading ${url}: ${err}`);
          resolve(null);
        }
      );
    });
  }

  /**
   * Clones the authoritative Athletic_man 3D model with its complete bone hierarchy and skinned meshes.
   */
  public cloneModel(): THREE.Object3D | null {
    if (!this.baseModel) return null;
    try {
      const cloned = SkeletonUtils.clone(this.baseModel);
      cloned.name = 'AthleticManVisual';
      cloned.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return cloned;
    } catch (err) {
      Logger.warn(`PlayerAssetPool: Skeleton clone fallback: ${err}`);
      const cloned = this.baseModel.clone(true);
      cloned.name = 'AthleticManVisual';
      return cloned;
    }
  }

  /**
   * Clears in-memory models and animation clips.
   */
  public dispose(): void {
    this.baseModel = null;
    this.clips.clear();
    this.isPreloading = false;
    this.preloadPromise = null;
  }
}
