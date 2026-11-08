import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WeaponType } from '@/shared/types';
import {
  PlayerAnimationId,
  ActionPriority,
  LocomotionParams,
  ANIMATION_REGISTRY,
  AnimationMetadata
} from './PlayerAnimationTypes';
import { Logger } from '@/core/utils/Logger';

export class PlayerAnimationController {
  private root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private loader: GLTFLoader;

  private clips: Map<PlayerAnimationId, THREE.AnimationClip> = new Map();
  private actions: Map<PlayerAnimationId, THREE.AnimationAction> = new Map();
  private loadingPromises: Map<PlayerAnimationId, Promise<THREE.AnimationClip | null>> = new Map();

  private currentBaseId: PlayerAnimationId | null = null;
  private currentBaseAction: THREE.AnimationAction | null = null;

  private currentActionId: PlayerAnimationId | null = null;
  private currentActionAction: THREE.AnimationAction | null = null;
  private currentActionPriority: ActionPriority = ActionPriority.Locomotion;

  public isDead: boolean = false;
  private isDisposed: boolean = false;

  private readonly assetBasePath = '/assets/characters/player/animations/';

  constructor(
    root: THREE.Object3D,
    mixer?: THREE.AnimationMixer,
    initialClips?: Map<PlayerAnimationId, THREE.AnimationClip>
  ) {
    this.root = root;
    this.mixer = mixer ?? new THREE.AnimationMixer(this.root);
    this.loader = new GLTFLoader();

    if (initialClips) {
      for (const [id, clip] of initialClips.entries()) {
        this.clips.set(id, clip);
      }
    }

    // Hook up mixer finish listener to restore base locomotion after one-shots
    this.mixer.addEventListener('finished', (e: any) => {
      this.onActionFinished(e.action);
    });
  }

  public getMixer(): THREE.AnimationMixer {
    return this.mixer;
  }

  public getCurrentBaseId(): PlayerAnimationId | null {
    return this.currentBaseId;
  }

  public getCurrentActionId(): PlayerAnimationId | null {
    return this.currentActionId;
  }

  /**
   * Preload core animation clips needed immediately at startup
   */
  public async preloadCoreAnimations(): Promise<void> {
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
      'rifle_walk',
      'rifle_run',
      'rifle_fire',
      'rifle_reload',
      'pistol_idle',
      'pistol_walk',
      'pistol_run',
      'pistol_fire',
      'sword_idle',
      'sword_slash',
      'hit_front',
      'hit_back',
      'death_forward',
      'death_backward'
    ];

    await Promise.all(coreIds.map((id) => this.loadClip(id)));
    Logger.info(`PlayerAnimationController: Preloaded ${coreIds.length} core animation clips.`);
  }

  /**
   * Loads an individual animation GLB file, applying in-place root motion stripping if configured.
   */
  public async loadClip(id: PlayerAnimationId): Promise<THREE.AnimationClip | null> {
    if (this.clips.has(id)) {
      return this.clips.get(id)!;
    }

    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id)!;
    }

    const meta: AnimationMetadata = ANIMATION_REGISTRY[id];
    if (!meta) {
      Logger.warn(`PlayerAnimationController: Unknown animation ID "${id}"`);
      return null;
    }

    const loadPromise = new Promise<THREE.AnimationClip | null>((resolve) => {
      const url = `${this.assetBasePath}${meta.file}`;
      this.loader.load(
        url,
        (gltf) => {
          if (this.isDisposed) {
            resolve(null);
            return;
          }

          if (!gltf.animations || gltf.animations.length === 0) {
            Logger.warn(`PlayerAnimationController: No animations found in "${meta.file}"`);
            resolve(null);
            return;
          }

          let clip = gltf.animations[0];
          clip.name = id;

          // Strip root motion translation from Hips to enforce Rapier physics authoritativeness
          if (meta.inPlace) {
            clip = PlayerAnimationController.processClipForInPlace(clip);
          }

          this.clips.set(id, clip);
          resolve(clip);
        },
        undefined,
        (err) => {
          Logger.warn(`PlayerAnimationController: Could not load "${url}": ${err}`);
          resolve(null);
        }
      );
    });

    this.loadingPromises.set(id, loadPromise);
    return loadPromise;
  }

  /**
   * Strips horizontal X and Z displacement from Hips.position while preserving vertical Y oscillation.
   */
  public static processClipForInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
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
            values[i] = initialX;
            // values[i + 1] (Y) is preserved for vertical breathing, bobbing, ducking
            values[i + 2] = initialZ;
          }
        }
      }
    }
    return cloned;
  }

  /**
   * Retrieves or creates the AnimationAction for an animation ID.
   */
  public async getAction(id: PlayerAnimationId): Promise<THREE.AnimationAction | null> {
    if (this.actions.has(id)) {
      return this.actions.get(id)!;
    }

    const clip = await this.loadClip(id);
    if (!clip || this.isDisposed) return null;

    const meta = ANIMATION_REGISTRY[id];
    const action = this.mixer.clipAction(clip);

    action.setLoop(
      meta.isLoop ? THREE.LoopRepeat : THREE.LoopOnce,
      meta.isLoop ? Infinity : 1
    );
    action.clampWhenFinished = meta.clampWhenFinished;
    if (meta.timeScale !== undefined) {
      action.timeScale = meta.timeScale;
    }

    this.actions.set(id, action);
    return action;
  }

  /**
   * Transitions to a looping base locomotion animation with smooth cross-fading.
   */
  public async playBaseLocomotion(
    id: PlayerAnimationId,
    customFadeDuration?: number
  ): Promise<THREE.AnimationAction | null> {
    if (this.isDead || this.isDisposed) return null;
    if (this.currentBaseId === id) {
      if (this.currentBaseAction?.isRunning()) {
        return this.currentBaseAction;
      }
      if (this.loadingPromises.has(id)) {
        return null;
      }
    }
    this.currentBaseId = id;

    const nextAction = await this.getAction(id);
    if (!nextAction || this.isDisposed || this.isDead) return null;

    // Check if another locomotion requested while we were awaiting
    if (this.currentBaseId !== id) {
      return null;
    }

    const meta = ANIMATION_REGISTRY[id];
    const fadeDuration = customFadeDuration ?? meta.fadeDuration;

    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);

    if (this.currentBaseAction && this.currentBaseAction !== nextAction) {
      nextAction.crossFadeFrom(this.currentBaseAction, fadeDuration, true);
    }

    nextAction.play();
    this.currentBaseId = id;
    this.currentBaseAction = nextAction;

    return nextAction;
  }

  /**
   * Plays a one-shot or high-priority action (fire, reload, slash, hit, death, interaction).
   */
  public async playAction(
    id: PlayerAnimationId,
    customPriority?: ActionPriority,
    customFadeDuration?: number
  ): Promise<THREE.AnimationAction | null> {
    if (this.isDead || this.isDisposed) return null;

    const meta = ANIMATION_REGISTRY[id];
    const priority = customPriority ?? meta.priority;

    // Check if current action has higher priority
    if (this.currentActionAction && this.currentActionAction.isRunning()) {
      if (this.currentActionPriority > priority) {
        return null;
      }
    }

    const action = await this.getAction(id);
    if (!action || this.isDisposed) return null;

    if (priority === ActionPriority.Death) {
      this.isDead = true;
    }

    const fadeDuration = customFadeDuration ?? meta.fadeDuration;

    action.reset();
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);

    if (this.currentActionAction && this.currentActionAction !== action) {
      action.crossFadeFrom(this.currentActionAction, fadeDuration, true);
    } else if (this.currentBaseAction) {
      action.fadeIn(fadeDuration);
    }

    action.play();
    this.currentActionId = id;
    this.currentActionAction = action;
    this.currentActionPriority = priority;

    return action;
  }

  private onActionFinished(action: THREE.AnimationAction): void {
    if (this.currentActionAction === action) {
      if (this.isDead) {
        // Keep death clamped on last frame
        return;
      }

      this.currentActionId = null;
      this.currentActionAction = null;
      this.currentActionPriority = ActionPriority.Locomotion;

      // Restore base locomotion weight if active
      if (this.currentBaseAction && !this.isDead) {
        this.currentBaseAction.setEffectiveWeight(1);
      }
    }
  }

  /**
   * Deterministically resolves the correct locomotion animation ID based on player input & combat state.
   */
  public resolveLocomotionId(params: LocomotionParams): PlayerAnimationId {
    const { isMoving, isSprinting, isCrouching, isAirborne, isAiming, moveAxis, weapon } = params;

    // 1. Airborne state
    if (isAirborne) {
      return 'jump_air';
    }

    // 2. Stationary stance
    if (!isMoving) {
      if (weapon === 'rifle') {
        if (isCrouching) return 'rifle_crouch_aim';
        if (isAiming) return 'rifle_aim';
        return 'rifle_idle';
      }
      if (weapon === 'pistol') {
        if (isAiming) return 'pistol_aim';
        return 'pistol_idle';
      }
      if (weapon === 'knife' || weapon === 'bat') {
        return 'sword_idle';
      }
      return 'idle';
    }

    // 3. Backward movement (moveAxis.y < -0.3)
    if (moveAxis.y < -0.3) {
      if (weapon === 'rifle') return 'rifle_walk_back';
      return 'walk_back';
    }

    // 4. Dominant lateral strafing (|x| > |y|)
    if (Math.abs(moveAxis.x) > Math.abs(moveAxis.y) + 0.1) {
      if (moveAxis.x < -0.3) {
        // Strafing left
        if (weapon === 'rifle') return 'rifle_strafe_left';
        if (weapon === 'pistol') return 'pistol_strafe_left';
        return 'strafe_left';
      }
      if (moveAxis.x > 0.3) {
        // Strafing right
        if (weapon === 'rifle') return 'rifle_strafe_right';
        if (weapon === 'pistol') return 'pistol_strafe_right';
        return 'strafe_right';
      }
    }

    // 5. Forward movement
    if (weapon === 'rifle') {
      if (isCrouching) return 'rifle_crouch_walk';
      if (isSprinting) return 'rifle_sprint';
      return 'rifle_walk';
    }

    if (weapon === 'pistol') {
      if (isSprinting) return 'pistol_sprint';
      return 'pistol_run';
    }

    if (isSprinting) {
      return 'run';
    }

    return 'walk';
  }

  /**
   * Updates player locomotion state each frame.
   */
  public updateLocomotion(params: LocomotionParams): void {
    if (this.isDead || this.isDisposed) return;
    const targetId = this.resolveLocomotionId(params);
    this.playBaseLocomotion(targetId);
  }

  /**
   * Gameplay Event: Weapon fire
   */
  public triggerFire(weapon: WeaponType): Promise<THREE.AnimationAction | null> {
    if (weapon === 'rifle') {
      return this.playAction('rifle_fire', ActionPriority.Action, 0.04);
    } else if (weapon === 'pistol') {
      return this.playAction('pistol_fire', ActionPriority.Action, 0.04);
    } else if (weapon === 'knife' || weapon === 'bat') {
      return this.playAction('sword_slash', ActionPriority.Action, 0.08);
    } else {
      return this.playAction('punch', ActionPriority.Action, 0.08);
    }
  }

  /**
   * Gameplay Event: Weapon reload
   */
  public triggerReload(weapon: WeaponType): Promise<THREE.AnimationAction | null> {
    if (weapon === 'rifle' || weapon === 'shotgun') {
      return this.playAction('rifle_reload', ActionPriority.Action, 0.15);
    } else if (weapon === 'pistol') {
      return this.playAction('rifle_reload', ActionPriority.Action, 0.15);
    }
    return Promise.resolve(null);
  }

  /**
   * Gameplay Event: Melee attack
   */
  public triggerMelee(): Promise<THREE.AnimationAction | null> {
    return this.playAction('sword_slash', ActionPriority.Action, 0.08);
  }

  /**
   * Gameplay Event: Jump start
   */
  public triggerJump(): Promise<THREE.AnimationAction | null> {
    return this.playAction('jump_start', ActionPriority.Action, 0.08);
  }

  /**
   * Gameplay Event: Jump landing
   */
  public triggerLand(): Promise<THREE.AnimationAction | null> {
    return this.playAction('jump_land', ActionPriority.Action, 0.08);
  }

  /**
   * Gameplay Event: Taking damage (directional flinch)
   */
  public triggerDamage(dir?: 'front' | 'back' | 'left' | 'right'): Promise<THREE.AnimationAction | null> {
    if (this.isDead) return Promise.resolve(null);
    let hitAnim: PlayerAnimationId = 'hit_front';
    if (dir === 'back') hitAnim = 'hit_back';
    else if (dir === 'left') hitAnim = 'hit_left';
    else if (dir === 'right') hitAnim = 'hit_right';

    return this.playAction(hitAnim, ActionPriority.Damage, 0.06);
  }

  /**
   * Gameplay Event: Knockdown
   */
  public triggerKnockdown(): Promise<THREE.AnimationAction | null> {
    return this.playAction('knockdown', ActionPriority.Knockdown, 0.15);
  }

  /**
   * Gameplay Event: Recovery / Get up
   */
  public triggerGetUp(fromBack: boolean = false): Promise<THREE.AnimationAction | null> {
    const anim: PlayerAnimationId = fromBack ? 'get_up_face_up' : 'get_up_face_down';
    return this.playAction(anim, ActionPriority.Knockdown, 0.2);
  }

  /**
   * Gameplay Event: Death
   */
  public triggerDeath(fallBackward: boolean = false): Promise<THREE.AnimationAction | null> {
    const deathAnim: PlayerAnimationId = fallBackward ? 'death_backward' : 'death_forward';
    return this.playAction(deathAnim, ActionPriority.Death, 0.15);
  }

  /**
   * Gameplay Event: Interaction (pickup, button press, door)
   */
  public triggerInteract(type: 'pickup' | 'door' | 'press' = 'press'): Promise<THREE.AnimationAction | null> {
    if (type === 'pickup') {
      return this.playAction('pick_up', ActionPriority.Action, 0.15);
    } else if (type === 'door') {
      return this.playAction('open_door', ActionPriority.Action, 0.15);
    } else {
      return this.playAction('use_press', ActionPriority.Action, 0.15);
    }
  }

  /**
   * Per-frame update to step the Three.js AnimationMixer.
   */
  public update(dt: number): void {
    if (this.isDisposed) return;
    this.mixer.update(dt);
  }

  /**
   * Clean disposal of all animation actions, mixer, and resources.
   */
  public dispose(): void {
    this.isDisposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
    this.clips.clear();
    this.loadingPromises.clear();
  }
}
