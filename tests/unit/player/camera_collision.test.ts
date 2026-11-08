import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';

describe('Third-Person Camera Collision & Obstruction Avoidance', () => {
  let physics: PhysicsWorld;

  beforeEach(async () => {
    await PhysicsWorld.init();
    physics = new PhysicsWorld();
    await physics.initWorld();
  });

  it('maintains full camera distance in open unobstructed space', () => {
    const origin = new THREE.Vector3(0, 1.45, 0); // Player shoulder pivot
    const dir = new THREE.Vector3(0, 0, -1); // Behind player
    const maxDist = 2.35;

    const safeDist = physics.cameraCollisionQuery(origin, dir, maxDist, 0.20);
    expect(safeDist).toBe(maxDist);
  });

  it('smoothly reduces camera distance when approaching a solid wall', () => {
    const origin = new THREE.Vector3(0, 1.45, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    const maxDist = 2.35;

    // Place a solid wall 1.2m behind player (at Z = -1.2)
    physics.createStaticBox(new THREE.Vector3(0, 1.45, -1.2), new THREE.Vector3(3.0, 2.0, 0.15));
    physics.step(0.016);

    const safeDist = physics.cameraCollisionQuery(origin, dir, maxDist, 0.20);

    // Safe distance must be less than wall distance (with clearance buffer) and >= 0.55m min clamp
    expect(safeDist).toBeLessThan(1.2);
    expect(safeDist).toBeGreaterThanOrEqual(0.55);
  });

  it('ignores the player capsule collider so the player does not obstruct their own camera', () => {
    const origin = new THREE.Vector3(0, 1.45, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    const maxDist = 2.35;

    // Create player dynamic capsule at origin
    const { body, collider } = physics.createDynamicCapsule(new THREE.Vector3(0, 0.95, 0), 0.65, 0.35);
    physics.step(0.016);

    // Without exclusion, camera ray would intersect player capsule at origin
    const safeDist = physics.cameraCollisionQuery(origin, dir, maxDist, 0.20, body, collider);

    // Player collider is excluded, so in open space it returns full max distance
    expect(safeDist).toBe(maxDist);
  });

  it('clamps to minimum distance when pressed tightly against a surface', () => {
    const origin = new THREE.Vector3(0, 1.45, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    const maxDist = 2.35;

    // Wall right behind shoulder at 0.3m
    physics.createStaticBox(new THREE.Vector3(0, 1.45, -0.3), new THREE.Vector3(2.0, 2.0, 0.1));
    physics.step(0.016);

    const safeDist = physics.cameraCollisionQuery(origin, dir, maxDist, 0.20);
    expect(safeDist).toBe(0.55); // Clamped to min safe distance so camera never penetrates inside player body
  });
});
