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
  private static initPromise: Promise<void> | null = null;

  public world: RAPIER.World | null = null;
  public rapier: typeof RAPIER;
  private gravityY: number;
  private rigidBodies: Map<number, { body: RAPIER.RigidBody; mesh?: THREE.Object3D }> = new Map();

  public static async init(): Promise<void> {
    if (!PhysicsWorld.isInitialized) {
      if (!PhysicsWorld.initPromise) {
        PhysicsWorld.initPromise = RAPIER.init().then(() => {
          PhysicsWorld.isInitialized = true;
          Logger.info('Rapier 3D physics WASM engine initialized.');
        });
      }
      await PhysicsWorld.initPromise;
    }
  }

  constructor(gravityY: number = -9.81) {
    this.rapier = RAPIER;
    this.gravityY = gravityY;

    // If RAPIER WASM was already initialized, instantiate the world immediately
    if (PhysicsWorld.isInitialized) {
      this.createRapierWorld();
    }
  }

  public async initWorld(): Promise<void> {
    if (!this.world) {
      await PhysicsWorld.init();
      this.createRapierWorld();
    }
  }

  private createRapierWorld(): void {
    if (!this.world) {
      const gravity = new RAPIER.Vector3(0.0, this.gravityY, 0.0);
      this.world = new RAPIER.World(gravity);
      Logger.info('Rapier 3D simulation world created.');
    }
  }

  public step(fixedDelta: number): void {
    if (!this.world) return;

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
    if (!this.world) {
      throw new Error('Cannot create static box: PhysicsWorld has not been initialized. Call await physicsWorld.initWorld() first.');
    }

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
    if (!this.world) {
      throw new Error('Cannot create dynamic capsule: PhysicsWorld has not been initialized. Call await physicsWorld.initWorld() first.');
    }

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .lockRotations();
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
    if (!this.world) return null;

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
        normal: new THREE.Vector3(0, 1, 0),
        distance: hit.timeOfImpact,
        collider,
        rigidBody: collider.parent() || undefined
      };
    }
    return null;
  }

  public removeRigidBody(body: RAPIER.RigidBody): void {
    this.rigidBodies.delete(body.handle);
    if (this.world) {
      try {
        this.world.removeRigidBody(body);
      } catch (_) {}
    }
  }

  public clearBodies(): void {
    if (this.world) {
      this.rigidBodies.forEach(({ body }) => {
        try {
          this.world!.removeRigidBody(body);
        } catch (_) {}
      });
    }
    this.rigidBodies.clear();
    Logger.info('Cleared all physics rigid bodies and colliders.');
  }

  public dispose(): void {
    this.clearBodies();
    if (this.world) {
      try {
        this.world.free();
      } catch (_) {}
      this.world = null;
    }
    Logger.info('Rapier 3D physics world disposed.');
  }
}
