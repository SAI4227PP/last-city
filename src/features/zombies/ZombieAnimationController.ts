import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Logger } from '@/core/utils/Logger';

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
  private baseModel: THREE.Object3D | null = null;
  private clips: ZombieClips | null = null;
  private loadPromise: Promise<boolean> | null = null;

  public static getInstance(): ZombieAssetPool {
    if (!this.instance) {
      this.instance = new ZombieAssetPool();
    }
    return this.instance;
  }

  public async preload(): Promise<boolean> {
    if (this.baseModel && this.clips) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.doPreload();
    return this.loadPromise;
  }

  private async doPreload(): Promise<boolean> {
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
        Logger.warn('ZombieAssetPool: One or more zombie animation GLBs could not be loaded.');
        return false;
      }

      // Use the rigged scene from idle as the authoritative base model
      this.baseModel = idleGltf.scene;
      if (this.baseModel) {
        this.baseModel.traverse((child) => {
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

      Logger.info('ZombieAssetPool: Successfully preloaded 3D zombie model and 5 animations.');
      return true;
    } catch (err) {
      Logger.warn(`ZombieAssetPool: Asset loading failed (${err}). Using procedural fallback.`);
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

  public cloneModel(): THREE.Object3D | null {
    if (!this.baseModel) return null;
    return SkeletonUtils.clone(this.baseModel);
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
    deathAction.setEffectiveWeight(1);
    deathAction.fadeIn(fadeDuration);
    deathAction.play();

    this.currentAction = deathAction;
    this.currentState = 'death';
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

