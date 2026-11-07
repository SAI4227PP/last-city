import { WeaponType } from '@/shared/types';

export enum ActionPriority {
  Locomotion = 0,
  Action = 1,
  Damage = 2,
  Knockdown = 3,
  Death = 4
}

export type PlayerAnimationId =
  // Locomotion (Unarmed / General)
  | 'idle'
  | 'walk'
  | 'run'
  | 'walk_back'
  | 'walk_slouch'
  | 'model_walk'
  | 'strafe_left'
  | 'strafe_right'
  // Jump / Fall
  | 'jump'
  | 'jump_start'
  | 'jump_air'
  | 'jump_land'
  | 'jump_running'
  | 'fall'
  // Rifle
  | 'rifle_idle'
  | 'rifle_aim'
  | 'rifle_crouch_aim'
  | 'rifle_crouch_walk'
  | 'rifle_fire'
  | 'rifle_fire_auto'
  | 'rifle_reload'
  | 'rifle_walk'
  | 'rifle_walk_back'
  | 'rifle_strafe_left'
  | 'rifle_strafe_right'
  | 'rifle_run'
  | 'rifle_sprint'
  // Pistol
  | 'pistol_idle'
  | 'pistol_aim'
  | 'pistol_aim_one_hand'
  | 'pistol_fire'
  | 'pistol_walk'
  | 'pistol_run'
  | 'pistol_sprint'
  | 'pistol_strafe_left'
  | 'pistol_strafe_right'
  // Melee & Unarmed Combat
  | 'punch'
  | 'punch_low'
  | 'sword_idle'
  | 'sword_slash'
  | 'sword_block'
  // Damage & Reactions
  | 'hit'
  | 'hit_front'
  | 'hit_back'
  | 'hit_left'
  | 'hit_right'
  | 'knockdown'
  | 'get_up_face_up'
  | 'get_up_face_down'
  | 'death_forward'
  | 'death_backward'
  // Interactions & Utilities
  | 'pick_up'
  | 'put_down'
  | 'use_press'
  | 'open_door'
  | 'push'
  | 'carry_idle'
  | 'carry_walk'
  | 'throw_grenade';

export interface AnimationMetadata {
  id: PlayerAnimationId;
  file: string;
  isLoop: boolean;
  clampWhenFinished: boolean;
  inPlace: boolean;
  priority: ActionPriority;
  fadeDuration: number;
  timeScale?: number;
}

export interface LocomotionParams {
  isMoving: boolean;
  isSprinting: boolean;
  isCrouching: boolean;
  isAirborne: boolean;
  isAiming?: boolean;
  moveAxis: { x: number; y: number };
  weapon: WeaponType | 'unarmed';
}

export const ANIMATION_REGISTRY: Record<PlayerAnimationId, AnimationMetadata> = {
  // Locomotion
  idle: {
    id: 'idle',
    file: 'Athletic_man@idle.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.25
  },
  walk: {
    id: 'walk',
    file: 'Athletic_man@walk.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  run: {
    id: 'run',
    file: 'Athletic_man@run.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  walk_back: {
    id: 'walk_back',
    file: 'Athletic_man@walk_back.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  walk_slouch: {
    id: 'walk_slouch',
    file: 'Athletic_man@walk_slouch.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  model_walk: {
    id: 'model_walk',
    file: 'Athletic_man@model_walk.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  strafe_left: {
    id: 'strafe_left',
    file: 'Athletic_man@strafe_left.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  strafe_right: {
    id: 'strafe_right',
    file: 'Athletic_man@strafe_right.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },

  // Jump / Fall
  jump: {
    id: 'jump',
    file: 'Athletic_man@jump.glb',
    isLoop: false,
    clampWhenFinished: true,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.15
  },
  jump_start: {
    id: 'jump_start',
    file: 'Athletic_man@jump_start.glb',
    isLoop: false,
    clampWhenFinished: true,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.1
  },
  jump_air: {
    id: 'jump_air',
    file: 'Athletic_man@jump_air.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.15
  },
  jump_land: {
    id: 'jump_land',
    file: 'Athletic_man@jump_land.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.1
  },
  jump_running: {
    id: 'jump_running',
    file: 'Athletic_man@jump_running.glb',
    isLoop: false,
    clampWhenFinished: true,
    inPlace: true,
    priority: ActionPriority.Action,
    fadeDuration: 0.15
  },
  fall: {
    id: 'fall',
    file: 'Athletic_man@fall.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },

  // Rifle
  rifle_idle: {
    id: 'rifle_idle',
    file: 'Athletic_man@rifle_idle.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.25
  },
  rifle_aim: {
    id: 'rifle_aim',
    file: 'Athletic_man@rifle_aim.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  rifle_crouch_aim: {
    id: 'rifle_crouch_aim',
    file: 'Athletic_man@rifle_crouch_aim.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  rifle_crouch_walk: {
    id: 'rifle_crouch_walk',
    file: 'Athletic_man@rifle_crouch_walk.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  rifle_fire: {
    id: 'rifle_fire',
    file: 'Athletic_man@rifle_fire.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.05
  },
  rifle_fire_auto: {
    id: 'rifle_fire_auto',
    file: 'Athletic_man@rifle_fire_auto.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.05
  },
  rifle_reload: {
    id: 'rifle_reload',
    file: 'Athletic_man@rifle_reload.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.15
  },
  rifle_walk: {
    id: 'rifle_walk',
    file: 'Athletic_man@rifle_walk.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  rifle_walk_back: {
    id: 'rifle_walk_back',
    file: 'Athletic_man@rifle_walk_back.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  rifle_strafe_left: {
    id: 'rifle_strafe_left',
    file: 'Athletic_man@rifle_strafe_left.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  rifle_strafe_right: {
    id: 'rifle_strafe_right',
    file: 'Athletic_man@rifle_strafe_right.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  rifle_run: {
    id: 'rifle_run',
    file: 'Athletic_man@rifle_run.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  rifle_sprint: {
    id: 'rifle_sprint',
    file: 'Athletic_man@rifle_sprint.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },

  // Pistol
  pistol_idle: {
    id: 'pistol_idle',
    file: 'Athletic_man@pistol_idle.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.25
  },
  pistol_aim: {
    id: 'pistol_aim',
    file: 'Athletic_man@pistol_aim.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  pistol_aim_one_hand: {
    id: 'pistol_aim_one_hand',
    file: 'Athletic_man@pistol_aim_one_hand.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  pistol_fire: {
    id: 'pistol_fire',
    file: 'Athletic_man@pistol_fire.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.05
  },
  pistol_walk: {
    id: 'pistol_walk',
    file: 'Athletic_man@pistol_walk.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  pistol_run: {
    id: 'pistol_run',
    file: 'Athletic_man@pistol_run.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  pistol_sprint: {
    id: 'pistol_sprint',
    file: 'Athletic_man@pistol_sprint.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  pistol_strafe_left: {
    id: 'pistol_strafe_left',
    file: 'Athletic_man@pistol_strafe_left.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  pistol_strafe_right: {
    id: 'pistol_strafe_right',
    file: 'Athletic_man@pistol_strafe_right.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },

  // Melee & Unarmed
  punch: {
    id: 'punch',
    file: 'Athletic_man@punch.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.1
  },
  punch_low: {
    id: 'punch_low',
    file: 'Athletic_man@punch_low.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.1
  },
  sword_idle: {
    id: 'sword_idle',
    file: 'Athletic_man@sword_idle.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.25
  },
  sword_slash: {
    id: 'sword_slash',
    file: 'Athletic_man@sword_slash.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.08
  },
  sword_block: {
    id: 'sword_block',
    file: 'Athletic_man@sword_block.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.1
  },

  // Damage & Reactions
  hit: {
    id: 'hit',
    file: 'Athletic_man@hit.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Damage,
    fadeDuration: 0.08
  },
  hit_front: {
    id: 'hit_front',
    file: 'Athletic_man@hit_front.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Damage,
    fadeDuration: 0.08
  },
  hit_back: {
    id: 'hit_back',
    file: 'Athletic_man@hit_back.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Damage,
    fadeDuration: 0.08
  },
  hit_left: {
    id: 'hit_left',
    file: 'Athletic_man@hit_left.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Damage,
    fadeDuration: 0.08
  },
  hit_right: {
    id: 'hit_right',
    file: 'Athletic_man@hit_right.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Damage,
    fadeDuration: 0.08
  },
  knockdown: {
    id: 'knockdown',
    file: 'Athletic_man@knockdown.glb',
    isLoop: false,
    clampWhenFinished: true,
    inPlace: true,
    priority: ActionPriority.Knockdown,
    fadeDuration: 0.15
  },
  get_up_face_up: {
    id: 'get_up_face_up',
    file: 'Athletic_man@get_up_face_up.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Knockdown,
    fadeDuration: 0.2
  },
  get_up_face_down: {
    id: 'get_up_face_down',
    file: 'Athletic_man@get_up_face_down.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Knockdown,
    fadeDuration: 0.2
  },
  death_forward: {
    id: 'death_forward',
    file: 'Athletic_man@death_forward.glb',
    isLoop: false,
    clampWhenFinished: true,
    inPlace: true,
    priority: ActionPriority.Death,
    fadeDuration: 0.15
  },
  death_backward: {
    id: 'death_backward',
    file: 'Athletic_man@death_backward.glb',
    isLoop: false,
    clampWhenFinished: true,
    inPlace: true,
    priority: ActionPriority.Death,
    fadeDuration: 0.15
  },

  // Interactions & Utilities
  pick_up: {
    id: 'pick_up',
    file: 'Athletic_man@pick_up.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.15
  },
  put_down: {
    id: 'put_down',
    file: 'Athletic_man@put_down.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.15
  },
  use_press: {
    id: 'use_press',
    file: 'Athletic_man@use_press.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.15
  },
  open_door: {
    id: 'open_door',
    file: 'Athletic_man@open_door.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.15
  },
  push: {
    id: 'push',
    file: 'Athletic_man@push.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.15
  },
  carry_idle: {
    id: 'carry_idle',
    file: 'Athletic_man@carry_idle.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.25
  },
  carry_walk: {
    id: 'carry_walk',
    file: 'Athletic_man@carry_walk.glb',
    isLoop: true,
    clampWhenFinished: false,
    inPlace: true,
    priority: ActionPriority.Locomotion,
    fadeDuration: 0.2
  },
  throw_grenade: {
    id: 'throw_grenade',
    file: 'Athletic_man@throw_grenade.glb',
    isLoop: false,
    clampWhenFinished: false,
    inPlace: false,
    priority: ActionPriority.Action,
    fadeDuration: 0.12
  }
};
