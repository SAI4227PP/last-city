import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Logger } from '@/core/utils/Logger';

export interface RaycastHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: RAPIER.Collider;
  rigidBody?: RAPIER.RigidBody;
}

export class PhysicsWorld {
  private static isInitialized = false;
  public world!: RAPIER.World;
  public rapier!: typeof RAPIER;
  private rigidBodies: Map<number, { body: RAPIER.RigidBody; mesh?: THREE.Object3D }> = new Map();

  public static async init(): Promise<void> {
    if (!PhysicsWorld.isInitialized) {
      await RAPIER.init();
      PhysicsWorld.isInitialized = true;
      Logger.info('Rapier 3D physics engine initialized.');
    }
  }

  constructor(gravityY: number = -9.81) {
    this.rapier = RAPIER;
    const gravity = new RAPIER.Vector3(0.0, gravityY, 0.0);
    this.world = new RAPIER.World(gravity);
  }

  public step(fixedDelta: number): void {
    this.world.timestep = fixedDelta;
    this.world.step();

    // Sync mesh transforms for dynamic bodies
    this.rigidBodies.forEach(({ body, mesh }) => {
      if (mesh && body.isDynamic()) {
        const trans = body.translation();
        const rot = body.rotation();
        mesh.position.set(trans.x, trans.y, trans.z);
        mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      }
    });
  }

  public createStaticBox(
    position: THREE.Vector3,
    halfExtents: THREE.Vector3,
    mesh?: THREE.Object3D
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    const collider = this.world.createCollider(colliderDesc, body);

    this.rigidBodies.set(body.handle, { body, mesh });
    return { body, collider };
  }

  public createDynamicCapsule(
    position: THREE.Vector3,
    halfHeight: number,
    radius: number,
    mesh?: THREE.Object3D
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .lockRotations(); // Keep character upright
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    const collider = this.world.createCollider(colliderDesc, body);

    this.rigidBodies.set(body.handle, { body, mesh });
    return { body, collider };
  }

  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number = 100,
    solid: boolean = true
  ): RaycastHit | null {
    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(origin.x, origin.y, origin.z),
      new RAPIER.Vector3(direction.x, direction.y, direction.z)
    );

    const hit = this.world.castRay(ray, maxDistance, solid);
    if (hit) {
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      const collider = hit.collider;
      return {
        point: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z),
        normal: new THREE.Vector3(0, 1, 0), // Default up normal
        distance: hit.timeOfImpact,
        collider,
        rigidBody: collider.parent() || undefined
      };
    }
    return null;
  }

  public removeRigidBody(body: RAPIER.RigidBody): void {
    this.rigidBodies.delete(body.handle);
    this.world.removeRigidBody(body);
  }

  public clearBodies(): void {
    this.rigidBodies.forEach(({ body }) => {
      try {
        this.world.removeRigidBody(body);
      } catch (_) {}
    });
    this.rigidBodies.clear();
    Logger.info('Cleared all physics rigid bodies and colliders.');
  }

  public dispose(): void {
    this.rigidBodies.clear();
    this.world.free();
    Logger.info('Rapier 3D physics world disposed.');
  }
}
