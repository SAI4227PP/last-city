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

export interface RigidBodyRecord {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh?: THREE.Object3D;
  ownerId?: string;
}

export class PhysicsWorld {
  private static isInitialized = false;
  private static initPromise: Promise<void> | null = null;

  public world: RAPIER.World | null = null;
  public rapier: typeof RAPIER;
  private gravityY: number;
  private rigidBodies: Map<number, RigidBodyRecord> = new Map();

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
    mesh?: THREE.Object3D,
    ownerId?: string
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    if (!this.world) {
      throw new Error('Cannot create static box: PhysicsWorld has not been initialized. Call await physicsWorld.initWorld() first.');
    }

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    const collider = this.world.createCollider(colliderDesc, body);

    this.rigidBodies.set(body.handle, { body, collider, mesh, ownerId });
    return { body, collider };
  }

  public createDynamicCapsule(
    position: THREE.Vector3,
    halfHeight: number,
    radius: number,
    mesh?: THREE.Object3D,
    ownerId?: string
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

    this.rigidBodies.set(body.handle, { body, collider, mesh, ownerId });
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

  /**
   * Casts a sphere / multi-ray collision bundle to find the nearest unobstructed camera distance.
   * Tests against walls, floors, ceilings, and furniture while excluding the player's own collider.
   */
  public cameraCollisionQuery(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    sphereRadius: number = 0.20,
    excludeBody?: RAPIER.RigidBody,
    excludeCollider?: RAPIER.Collider
  ): number {
    if (!this.world) return maxDistance;

    let nearestDistance = maxDistance;

    // 1. Center ray
    const centerRay = new RAPIER.Ray(
      new RAPIER.Vector3(origin.x, origin.y, origin.z),
      new RAPIER.Vector3(direction.x, direction.y, direction.z)
    );
    const centerHit = this.world.castRay(
      centerRay,
      maxDistance,
      true,
      undefined,
      undefined,
      excludeCollider,
      excludeBody
    );
    if (centerHit && centerHit.timeOfImpact < nearestDistance) {
      nearestDistance = centerHit.timeOfImpact;
    }

    // 2. 4-point perimeter sphere-approximation rays (Top, Bottom, Left, Right)
    const up = Math.abs(direction.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(direction, up).normalize().multiplyScalar(sphereRadius);
    const orthoUp = new THREE.Vector3().crossVectors(right, direction).normalize().multiplyScalar(sphereRadius);

    const perimeterOffsets = [right, right.clone().negate(), orthoUp, orthoUp.clone().negate()];

    for (const offset of perimeterOffsets) {
      const rayOrigin = new RAPIER.Vector3(origin.x + offset.x, origin.y + offset.y, origin.z + offset.z);
      const ray = new RAPIER.Ray(
        rayOrigin,
        new RAPIER.Vector3(direction.x, direction.y, direction.z)
      );
      const hit = this.world.castRay(
        ray,
        maxDistance,
        true,
        undefined,
        undefined,
        excludeCollider,
        excludeBody
      );
      if (hit && hit.timeOfImpact < nearestDistance) {
        nearestDistance = hit.timeOfImpact;
      }
    }

    // 3. Rapier castShape with Ball geometry if available
    try {
      if (this.rapier && (this.world as any).castShape) {
        const ball = new this.rapier.Ball(sphereRadius);
        const shapePos = new this.rapier.Vector3(origin.x, origin.y, origin.z);
        const shapeRot = new this.rapier.Quaternion(0, 0, 0, 1);
        const shapeVel = new this.rapier.Vector3(direction.x * maxDistance, direction.y * maxDistance, direction.z * maxDistance);
        const shapeHit = (this.world as any).castShape(
          shapePos,
          shapeRot,
          shapeVel,
          ball,
          maxDistance,
          1.0,
          true,
          undefined,
          undefined,
          excludeCollider,
          excludeBody
        );
        if (shapeHit && shapeHit.time_of_impact !== undefined) {
          const hitDist = shapeHit.time_of_impact * maxDistance;
          if (hitDist < nearestDistance) {
            nearestDistance = hitDist;
          }
        }
      }
    } catch (_) {
      // Fallback already covered by 5-ray multi-sample bundle
    }

    if (nearestDistance >= maxDistance) {
      return maxDistance;
    }

    // Leave safety clearance buffer from wall surface, clamped to keep camera outside player
    return Math.max(0.55, nearestDistance - 0.12);
  }

  public getBodyCount(): number {
    return this.rigidBodies.size;
  }

  public removeRigidBody(body: RAPIER.RigidBody): void {
    this.rigidBodies.delete(body.handle);
    if (this.world) {
      try {
        this.world.removeRigidBody(body);
      } catch (_) {}
    }
  }

  public clearBodiesByOwner(ownerId: string): void {
    if (!this.world) return;
    const toRemove: number[] = [];

    this.rigidBodies.forEach((record, handle) => {
      if (record.ownerId === ownerId) {
        try {
          this.world!.removeRigidBody(record.body);
        } catch (_) {}
        toRemove.push(handle);
      }
    });

    toRemove.forEach((h) => this.rigidBodies.delete(h));
    Logger.info(`Cleared ${toRemove.length} physics bodies for owner "${ownerId}".`);
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
