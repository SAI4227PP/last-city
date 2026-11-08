import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Logger } from '@/core/utils/Logger';
import { ZombieModelType } from '@/shared/types';

export type ZombieAnimState = 'idle' | 'walk' | 'run' | 'attack' | 'death';

export interface ZombieClips {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
  attack: THREE.AnimationClip;
  death: THREE.AnimationClip;
}

export class ZombieAssetPool {
  private static instance: ZombieAssetPool;
  private loader: GLTFLoader = new GLTFLoader();
  private objLoader: OBJLoader = new OBJLoader();
  private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();

  private patientModel: THREE.Object3D | null = null;
  private zombie1Model: THREE.Object3D | null = null;
  private zombie2Model: THREE.Object3D | null = null;
  private clips: ZombieClips | null = null;
  private loadPromise: Promise<boolean> | null = null;

  public get baseModel(): THREE.Object3D | null {
    return this.patientModel;
  }

  public static getInstance(): ZombieAssetPool {
    if (!this.instance) {
      this.instance = new ZombieAssetPool();
    }
    return this.instance;
  }

  public async preload(): Promise<boolean> {
    if (this.patientModel && this.zombie1Model && this.zombie2Model && this.clips) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.doPreload();
    return this.loadPromise;
  }

  private async doPreload(): Promise<boolean> {
    await Promise.allSettled([
      this.preloadPatient(),
      this.preloadZombie1(),
      this.preloadZombie2()
    ]);

    const loadedCount = [this.patientModel, this.zombie1Model, this.zombie2Model].filter(Boolean).length;
    Logger.info(`ZombieAssetPool: Preload finished. Loaded ${loadedCount}/3 zombie 3D models.`);
    return loadedCount > 0;
  }

  private async preloadPatient(): Promise<boolean> {
    try {
      const basePath = '/assets/characters/zombie/animations/';
      // Load all 5 animation GLBs in parallel
      const [idleGltf, walkGltf, runGltf, attackGltf, deathGltf] = await Promise.all([
        this.loadGltf(`${basePath}idle/base_basic_shaded.glb`),
        this.loadGltf(`${basePath}walking/base_basic_shaded.glb`),
        this.loadGltf(`${basePath}running/base_basic_shaded.glb`),
        this.loadGltf(`${basePath}attack/base_basic_shaded.glb`),
        this.loadGltf(`${basePath}death/base_basic_shaded.glb`)
      ]);

      if (!idleGltf || !walkGltf || !runGltf || !attackGltf || !deathGltf) {
        Logger.warn('ZombieAssetPool: One or more patient zombie animation GLBs could not be loaded.');
        return false;
      }

      // Use the rigged scene from idle as the authoritative base model
      this.patientModel = idleGltf.scene;
      if (this.patientModel) {
        this.patientModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      }

      // Extract clips and strip horizontal root motion for strict in-place physics authoritativeness
      const idleClip = idleGltf.animations[0];
      const walkClip = this.processClipForInPlace(walkGltf.animations[0]);
      const runClip = this.processClipForInPlace(runGltf.animations[0]);
      const attackClip = attackGltf.animations[0];
      const deathClip = deathGltf.animations[0];

      idleClip.name = 'idle';
      walkClip.name = 'walk';
      runClip.name = 'run';
      attackClip.name = 'attack';
      deathClip.name = 'death';

      this.clips = {
        idle: idleClip,
        walk: walkClip,
        run: runClip,
        attack: attackClip,
        death: deathClip
      };

      Logger.info('ZombieAssetPool: Successfully preloaded Patient zombie model and 5 animations.');
      return true;
    } catch (err) {
      Logger.warn(`ZombieAssetPool: Patient asset loading failed (${err}).`);
      return false;
    }
  }

  private async preloadZombie1(): Promise<boolean> {
    try {
      const basePath = '/assets/characters/zombies/model/Zombie_1/';
      const [obj, diffuse, normal, roughness, metallic] = await Promise.all([
        this.loadObj(`${basePath}base.obj`),
        this.loadTexture(`${basePath}texture_diffuse.png`, true),
        this.loadTexture(`${basePath}texture_normal.png`),
        this.loadTexture(`${basePath}texture_roughness.png`),
        this.loadTexture(`${basePath}texture_metallic.png`)
      ]);

      if (!obj) {
        Logger.warn('ZombieAssetPool: Zombie_1 base.obj could not be loaded.');
        return false;
      }

      const material = new THREE.MeshStandardMaterial({
        map: diffuse ?? undefined,
        normalMap: normal ?? undefined,
        roughnessMap: roughness ?? undefined,
        metalnessMap: metallic ?? undefined,
        roughness: 0.82,
        metalness: 0.12
      });

      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = material;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.zombie1Model = obj;
      Logger.info('ZombieAssetPool: Successfully preloaded Zombie_1 model and 2K PBR textures.');
      return true;
    } catch (err) {
      Logger.warn(`ZombieAssetPool: Failed preloading Zombie_1: ${err}`);
      return false;
    }
  }

  private async preloadZombie2(): Promise<boolean> {
    try {
      const basePath = '/assets/characters/zombies/model/Zombie_2/';
      const [obj, diffuse, normal, roughness, metallic] = await Promise.all([
        this.loadObj(`${basePath}base.obj`),
        this.loadTexture(`${basePath}texture_diffuse.png`, true),
        this.loadTexture(`${basePath}texture_normal.png`),
        this.loadTexture(`${basePath}texture_roughness.png`),
        this.loadTexture(`${basePath}texture_metallic.png`)
      ]);

      if (!obj) {
        Logger.warn('ZombieAssetPool: Zombie_2 base.obj could not be loaded.');
        return false;
      }

      const material = new THREE.MeshStandardMaterial({
        map: diffuse ?? undefined,
        normalMap: normal ?? undefined,
        roughnessMap: roughness ?? undefined,
        metalnessMap: metallic ?? undefined,
        roughness: 0.88,
        metalness: 0.15
      });

      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = material;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.zombie2Model = obj;
      Logger.info('ZombieAssetPool: Successfully preloaded Zombie_2 model and 2K PBR textures.');
      return true;
    } catch (err) {
      Logger.warn(`ZombieAssetPool: Failed preloading Zombie_2: ${err}`);
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
          Logger.warn(`ZombieAssetPool: Failed loading ${url}: ${err}`);
          resolve(null);
        }
      );
    });
  }

  private loadObj(url: string): Promise<THREE.Group | null> {
    return new Promise((resolve) => {
      this.objLoader.load(
        url,
        (obj) => resolve(obj),
        undefined,
        (err) => {
          Logger.warn(`ZombieAssetPool: Failed loading OBJ ${url}: ${err}`);
          resolve(null);
        }
      );
    });
  }

  private loadTexture(url: string, isColor: boolean = false): Promise<THREE.Texture | null> {
    return new Promise((resolve) => {
      this.textureLoader.load(
        url,
        (tex) => {
          tex.flipY = true;
          if (isColor) {
            tex.colorSpace = THREE.SRGBColorSpace;
          }
          resolve(tex);
        },
        undefined,
        (err) => {
          Logger.warn(`ZombieAssetPool: Failed loading texture ${url}: ${err}`);
          resolve(null);
        }
      );
    });
  }

  /**
   * Clamps horizontal X and Z translation on Hips to frame 0 while preserving vertical Y pelvic oscillation.
   */
  public processClipForInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
    const cloned = clip.clone();
    for (const track of cloned.tracks) {
      if (
        track.name.endsWith('.position') &&
        (track.name.includes('Hips') || track.name.includes('Pelvis') || track.name.includes('Root'))
      ) {
        const values = track.values;
        if (values.length >= 3) {
          const initialX = values[0];
          const initialZ = values[2];
          for (let i = 0; i < values.length; i += 3) {
            values[i] = initialX;     // Clamped X to frame 0
            // values[i + 1] (Y) preserved for natural gait bounce
            values[i + 2] = initialZ; // Clamped Z to frame 0
          }
        }
      }
    }
    return cloned;
  }

  public cloneModel(type: ZombieModelType = 'patient'): THREE.Object3D | null {
    if (type === 'zombie1') {
      if (this.zombie1Model) return this.zombie1Model.clone(true);
      if (this.patientModel) return SkeletonUtils.clone(this.patientModel);
      return null;
    }
    if (type === 'zombie2') {
      if (this.zombie2Model) return this.zombie2Model.clone(true);
      if (this.patientModel) return SkeletonUtils.clone(this.patientModel);
      return null;
    }
    // Default patient
    if (this.patientModel) return SkeletonUtils.clone(this.patientModel);
    if (this.zombie1Model) return this.zombie1Model.clone(true);
    if (this.zombie2Model) return this.zombie2Model.clone(true);
    return null;
  }

  public isSkeletal(type: ZombieModelType): boolean {
    return type === 'patient';
  }

  public hasModel(type: ZombieModelType): boolean {
    if (type === 'zombie1') return !!this.zombie1Model;
    if (type === 'zombie2') return !!this.zombie2Model;
    return !!this.patientModel;
  }

  public getClips(): ZombieClips | null {
    return this.clips;
  }
}

export class ZombieAnimationController {
  private root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions: Map<ZombieAnimState, THREE.AnimationAction> = new Map();

  private currentState: ZombieAnimState = 'idle';
  private currentAction: THREE.AnimationAction | null = null;
  public isDead: boolean = false;
  private isDisposed: boolean = false;

  constructor(root: THREE.Object3D, clips: ZombieClips) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(this.root);

    this.setupActions(clips);
  }

  private setupActions(clips: ZombieClips): void {
    // 1. Idle Action (Looping)
    const idleAction = this.mixer.clipAction(clips.idle);
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    this.actions.set('idle', idleAction);

    // 2. Walk Action (Looping)
    const walkAction = this.mixer.clipAction(clips.walk);
    walkAction.setLoop(THREE.LoopRepeat, Infinity);
    this.actions.set('walk', walkAction);

    // 3. Run Action (Looping)
    const runAction = this.mixer.clipAction(clips.run);
    runAction.setLoop(THREE.LoopRepeat, Infinity);
    this.actions.set('run', runAction);

    // 4. Attack Action (One-shot)
    const attackAction = this.mixer.clipAction(clips.attack);
    attackAction.setLoop(THREE.LoopOnce, 1);
    attackAction.clampWhenFinished = false;
    this.actions.set('attack', attackAction);

    // 5. Death Action (One-shot, clamp on last frame)
    const deathAction = this.mixer.clipAction(clips.death);
    deathAction.setLoop(THREE.LoopOnce, 1);
    deathAction.clampWhenFinished = true;
    this.actions.set('death', deathAction);

    // Default start in idle
    idleAction.play();
    this.currentAction = idleAction;
    this.currentState = 'idle';

    // Hook mixer finish listener to restore locomotion after attack finishes
    this.mixer.addEventListener('finished', (e: any) => {
      if (e.action === attackAction && !this.isDead) {
        this.currentState = 'idle';
        this.playLocomotion('walk', 0.2);
      }
    });
  }

  public playLocomotion(state: 'idle' | 'walk' | 'run', fadeDuration: number = 0.25): void {
    if (this.isDead || this.isDisposed) return;
    if (this.currentState === state && this.currentAction?.isRunning()) return;

    // Do not interrupt attack or death with locomotion
    if (this.currentState === 'attack' && this.currentAction?.isRunning()) return;
    if (this.currentState === 'death') return;

    const nextAction = this.actions.get(state);
    if (!nextAction) return;

    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);

    if (this.currentAction && this.currentAction !== nextAction) {
      nextAction.crossFadeFrom(this.currentAction, fadeDuration, true);
    } else {
      nextAction.fadeIn(fadeDuration);
    }

    nextAction.play();
    this.currentAction = nextAction;
    this.currentState = state;
  }

  public triggerAttack(fadeDuration: number = 0.15): void {
    if (this.isDead || this.isDisposed) return;
    if (this.currentState === 'death') return;

    const attackAction = this.actions.get('attack');
    if (!attackAction) return;

    // Do not reset attack animation if already running
    if (this.currentState === 'attack' && attackAction.isRunning()) return;

    attackAction.reset();
    attackAction.setEffectiveTimeScale(1.15);
    attackAction.setEffectiveWeight(1);

    if (this.currentAction && this.currentAction !== attackAction) {
      attackAction.crossFadeFrom(this.currentAction, fadeDuration, true);
    } else {
      attackAction.fadeIn(fadeDuration);
    }

    attackAction.play();
    this.currentAction = attackAction;
    this.currentState = 'attack';
  }

  public triggerDeath(fadeDuration: number = 0.18): void {
    if (this.isDead || this.isDisposed) return;
    this.isDead = true;

    const deathAction = this.actions.get('death');
    if (!deathAction) return;

    // Stop all other actions
    this.actions.forEach((act, key) => {
      if (key !== 'death') {
        act.fadeOut(fadeDuration);
      }
    });

    deathAction.reset();
    deathAction.setEffectiveTimeScale(1.0);
    deathAction.fadeIn(fadeDuration);
    deathAction.play();

    this.currentAction = deathAction;
    this.currentState = 'death';
  }

  public reset(): void {
    this.isDead = false;
    this.currentState = 'idle';
    this.actions.forEach((act) => {
      act.stop();
      act.reset();
    });
    const idleAction = this.actions.get('idle');
    if (idleAction) {
      idleAction.setEffectiveWeight(1);
      idleAction.play();
      this.currentAction = idleAction;
    }
  }

  public getCurrentState(): ZombieAnimState {
    return this.currentState;
  }

  public update(dt: number): void {
    if (this.isDisposed) return;
    this.mixer.update(dt);
  }

  public dispose(): void {
    this.isDisposed = true;
    this.mixer.stopAllAction();
    this.actions.clear();
  }
}

