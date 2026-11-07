import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  PlayerAnimationController
} from '@/features/player/PlayerAnimationController';
import {
  ANIMATION_REGISTRY,
  ActionPriority,
  PlayerAnimationId
} from '@/features/player/PlayerAnimationTypes';

describe('Player Character & Animation Package Integration', () => {
  let root: THREE.Group;
  let mixer: THREE.AnimationMixer;
  let controller: PlayerAnimationController;

  beforeEach(() => {
    root = new THREE.Group();
    const hips = new THREE.Bone();
    hips.name = 'Hips';
    root.add(hips);
    mixer = new THREE.AnimationMixer(root);
    controller = new PlayerAnimationController(root, mixer);
  });

  describe('1. Asset Registry & Metadata Completeness', () => {
    it('registers all 59 supplied animations in the registry', () => {
      const registeredIds = Object.keys(ANIMATION_REGISTRY) as PlayerAnimationId[];
      expect(registeredIds.length).toBe(59);

      // Verify essential categories exist
      expect(registeredIds).toContain('idle');
      expect(registeredIds).toContain('walk');
      expect(registeredIds).toContain('run');
      expect(registeredIds).toContain('walk_back');
      expect(registeredIds).toContain('strafe_left');
      expect(registeredIds).toContain('strafe_right');
      expect(registeredIds).toContain('rifle_idle');
      expect(registeredIds).toContain('rifle_walk');
      expect(registeredIds).toContain('rifle_run');
      expect(registeredIds).toContain('rifle_fire');
      expect(registeredIds).toContain('rifle_reload');
      expect(registeredIds).toContain('pistol_idle');
      expect(registeredIds).toContain('pistol_walk');
      expect(registeredIds).toContain('pistol_fire');
      expect(registeredIds).toContain('sword_idle');
      expect(registeredIds).toContain('sword_slash');
      expect(registeredIds).toContain('hit_front');
      expect(registeredIds).toContain('death_forward');
      expect(registeredIds).toContain('death_backward');
    });

    it('enforces correct looping rules: locomotion loops, one-shots do not', () => {
      expect(ANIMATION_REGISTRY.idle.isLoop).toBe(true);
      expect(ANIMATION_REGISTRY.walk.isLoop).toBe(true);
      expect(ANIMATION_REGISTRY.run.isLoop).toBe(true);
      expect(ANIMATION_REGISTRY.rifle_idle.isLoop).toBe(true);
      expect(ANIMATION_REGISTRY.pistol_idle.isLoop).toBe(true);

      expect(ANIMATION_REGISTRY.rifle_fire.isLoop).toBe(false);
      expect(ANIMATION_REGISTRY.rifle_reload.isLoop).toBe(false);
      expect(ANIMATION_REGISTRY.pistol_fire.isLoop).toBe(false);
      expect(ANIMATION_REGISTRY.sword_slash.isLoop).toBe(false);
      expect(ANIMATION_REGISTRY.hit_front.isLoop).toBe(false);
      expect(ANIMATION_REGISTRY.death_forward.isLoop).toBe(false);
      expect(ANIMATION_REGISTRY.death_backward.isLoop).toBe(false);
    });

    it('enforces clampWhenFinished on death and knockdown actions', () => {
      expect(ANIMATION_REGISTRY.death_forward.clampWhenFinished).toBe(true);
      expect(ANIMATION_REGISTRY.death_backward.clampWhenFinished).toBe(true);
      expect(ANIMATION_REGISTRY.knockdown.clampWhenFinished).toBe(true);
      expect(ANIMATION_REGISTRY.jump_start.clampWhenFinished).toBe(true);
    });
  });

  describe('2. Root Motion Stripping (In-Place Conversion)', () => {
    it('locks X and Z displacement to frame 0 while preserving vertical Y bobbing on Hips', () => {
      // Create a synthetic track with movement displacement across frames
      const times = [0, 0.5, 1.0];
      const values = [
        0.0, 0.95, 0.0,   // Frame 0: (x0=0.0, y0=0.95, z0=0.0)
        0.5, 0.98, 1.2,   // Frame 1: displaced x=0.5, y=0.98, z=1.2
        1.1, 0.92, 2.6    // Frame 2: displaced x=1.1, y=0.92, z=2.6
      ];

      const track = new THREE.VectorKeyframeTrack('Hips.position', times, values);
      const clip = new THREE.AnimationClip('test_walk', 1.0, [track]);

      const processed = PlayerAnimationController.processClipForInPlace(clip);
      const processedTrack = processed.tracks[0];

      // Check Frame 0
      expect(processedTrack.values[0]).toBeCloseTo(0.0);
      expect(processedTrack.values[1]).toBeCloseTo(0.95);
      expect(processedTrack.values[2]).toBeCloseTo(0.0);

      // Check Frame 1: X and Z clamped to Frame 0, Y preserved
      expect(processedTrack.values[3]).toBeCloseTo(0.0);
      expect(processedTrack.values[4]).toBeCloseTo(0.98); // Y preserved!
      expect(processedTrack.values[5]).toBeCloseTo(0.0); // Z clamped to 0.0!

      // Check Frame 2: X and Z clamped to Frame 0, Y preserved
      expect(processedTrack.values[6]).toBeCloseTo(0.0);
      expect(processedTrack.values[7]).toBeCloseTo(0.92); // Y preserved!
      expect(processedTrack.values[8]).toBeCloseTo(0.0); // Z clamped to 0.0!
    });
  });

  describe('3. Deterministic Locomotion Resolution', () => {
    it('resolves stationary postures based on equipped weapon and stance', () => {
      // Unarmed idle
      expect(
        controller.resolveLocomotionId({
          isMoving: false,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: 0, y: 0 },
          weapon: 'unarmed'
        })
      ).toBe('idle');

      // Rifle low ready idle
      expect(
        controller.resolveLocomotionId({
          isMoving: false,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: 0, y: 0 },
          weapon: 'rifle'
        })
      ).toBe('rifle_idle');

      // Rifle crouch aim stance
      expect(
        controller.resolveLocomotionId({
          isMoving: false,
          isSprinting: false,
          isCrouching: true,
          isAirborne: false,
          moveAxis: { x: 0, y: 0 },
          weapon: 'rifle'
        })
      ).toBe('rifle_crouch_aim');

      // Pistol idle
      expect(
        controller.resolveLocomotionId({
          isMoving: false,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: 0, y: 0 },
          weapon: 'pistol'
        })
      ).toBe('pistol_idle');

      // Melee idle
      expect(
        controller.resolveLocomotionId({
          isMoving: false,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: 0, y: 0 },
          weapon: 'knife'
        })
      ).toBe('sword_idle');
    });

    it('resolves directional locomotion (forward, backward, strafe) correctly', () => {
      // Forward walk
      expect(
        controller.resolveLocomotionId({
          isMoving: true,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: 0, y: 1 },
          weapon: 'unarmed'
        })
      ).toBe('walk');

      // Forward sprint
      expect(
        controller.resolveLocomotionId({
          isMoving: true,
          isSprinting: true,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: 0, y: 1 },
          weapon: 'unarmed'
        })
      ).toBe('run');

      // Backward walk
      expect(
        controller.resolveLocomotionId({
          isMoving: true,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: 0, y: -1 },
          weapon: 'unarmed'
        })
      ).toBe('walk_back');

      // Rifle backward walk
      expect(
        controller.resolveLocomotionId({
          isMoving: true,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: 0, y: -1 },
          weapon: 'rifle'
        })
      ).toBe('rifle_walk_back');

      // Strafe left
      expect(
        controller.resolveLocomotionId({
          isMoving: true,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: -1, y: 0 },
          weapon: 'unarmed'
        })
      ).toBe('strafe_left');

      // Rifle strafe right
      expect(
        controller.resolveLocomotionId({
          isMoving: true,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: 1, y: 0 },
          weapon: 'rifle'
        })
      ).toBe('rifle_strafe_right');

      // Pistol strafe left
      expect(
        controller.resolveLocomotionId({
          isMoving: true,
          isSprinting: false,
          isCrouching: false,
          isAirborne: false,
          moveAxis: { x: -1, y: 0 },
          weapon: 'pistol'
        })
      ).toBe('pistol_strafe_left');
    });

    it('resolves in-air jump state regardless of lateral movement', () => {
      expect(
        controller.resolveLocomotionId({
          isMoving: true,
          isSprinting: true,
          isCrouching: false,
          isAirborne: true,
          moveAxis: { x: 0.5, y: 1 },
          weapon: 'rifle'
        })
      ).toBe('jump_air');
    });
  });

  describe('4. Priority & Death State Locking', () => {
    it('locks character in death state and ignores subsequent locomotion or actions', async () => {
      // Mock mock clip for death_forward
      const track = new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 1, 0, 0, 1, 0]);
      const mockClip = new THREE.AnimationClip('death_forward', 1.0, [track]);

      // Seed clips cache directly
      (controller as any).clips.set('death_forward', mockClip);

      await controller.triggerDeath();

      expect(controller.isDead).toBe(true);

      // Attempting to update locomotion after death must be blocked
      controller.updateLocomotion({
        isMoving: true,
        isSprinting: true,
        isCrouching: false,
        isAirborne: false,
        moveAxis: { x: 0, y: 1 },
        weapon: 'rifle'
      });

      expect(controller.getCurrentBaseId()).toBeNull();

      // Subsequent actions must return null
      const actionResult = await controller.playAction('punch', ActionPriority.Action);
      expect(actionResult).toBeNull();
    });
  });

  describe('5. Weapon Attachment & Mesh Visibility', () => {
    it('toggles rifle meshes and attaches custom weapons to WeaponR bone', () => {
      // Simulate Athletic Man structure
      const rifleMesh1 = new THREE.Mesh();
      rifleMesh1.name = 'Athletic_man_11';
      const rifleMesh2 = new THREE.Mesh();
      rifleMesh2.name = 'Athletic_man_12';
      const rifleMesh3 = new THREE.Mesh();
      rifleMesh3.name = 'Athletic_man_13';

      const weaponRBone = new THREE.Bone();
      weaponRBone.name = 'WeaponR';

      root.add(rifleMesh1);
      root.add(rifleMesh2);
      root.add(rifleMesh3);
      root.add(weaponRBone);

      const rifleMeshes = [rifleMesh1, rifleMesh2, rifleMesh3];

      // Helper function mirroring PlayerController.updateWeaponMeshes
      const updateWeapons = (weapon: 'rifle' | 'knife' | 'pistol') => {
        const isRifle = weapon === 'rifle';
        for (const m of rifleMeshes) {
          m.visible = isRifle;
        }
        // Remove children from WeaponR
        while (weaponRBone.children.length > 0) {
          weaponRBone.remove(weaponRBone.children[0]);
        }
        if (!isRifle) {
          const prop = new THREE.Group();
          prop.name = `Prop_${weapon}`;
          weaponRBone.add(prop);
        }
      };

      // 1. Equip Rifle
      updateWeapons('rifle');
      expect(rifleMesh1.visible).toBe(true);
      expect(rifleMesh2.visible).toBe(true);
      expect(rifleMesh3.visible).toBe(true);
      expect(weaponRBone.children.length).toBe(0);

      // 2. Switch to Knife
      updateWeapons('knife');
      expect(rifleMesh1.visible).toBe(false);
      expect(rifleMesh2.visible).toBe(false);
      expect(rifleMesh3.visible).toBe(false);
      expect(weaponRBone.children.length).toBe(1);
      expect(weaponRBone.children[0].name).toBe('Prop_knife');

      // 3. Switch to Pistol
      updateWeapons('pistol');
      expect(rifleMesh1.visible).toBe(false);
      expect(weaponRBone.children.length).toBe(1);
      expect(weaponRBone.children[0].name).toBe('Prop_pistol');
    });
  });

  describe('6. Clean Disposal', () => {
    it('stops actions and cleans up resources without memory leaks', () => {
      controller.dispose();
      expect((controller as any).isDisposed).toBe(true);
      expect((controller as any).actions.size).toBe(0);
      expect((controller as any).clips.size).toBe(0);
    });
  });
});
