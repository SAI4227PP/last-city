import * as THREE from 'three';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { AudioManager } from '@/core/audio/AudioManager';
import { EventBus } from '@/core/events/EventBus';
import { HOSPITAL_LEVEL_CONFIG, DoorDef } from './HospitalLevelConfig';

export interface ActiveDoor {
  def: DoorDef;
  meshGroup: THREE.Group;
  collider: any;
  isOpen: boolean;
  isOpening: boolean;
  openProgress: number;
}

export class HospitalDoors {
  private scene: THREE.Scene;
  private physicsWorld: PhysicsWorld;
  private doorsGroup: THREE.Group;
  private doors: Map<string, ActiveDoor> = new Map();

  private doorMat: THREE.MeshStandardMaterial;
  private fireDoorMat: THREE.MeshStandardMaterial;
  private handleMat: THREE.MeshStandardMaterial;
  private glassMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, physicsWorld: PhysicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.doorsGroup = new THREE.Group();
    this.doorsGroup.name = 'HospitalDoors';
    this.scene.add(this.doorsGroup);

    this.doorMat = new THREE.MeshStandardMaterial({
      color: 0x5e7080,
      roughness: 0.55,
      metalness: 0.15
    });

    this.fireDoorMat = new THREE.MeshStandardMaterial({
      color: 0xb53535,
      metalness: 0.5,
      roughness: 0.35
    });

    this.handleMat = new THREE.MeshStandardMaterial({
      color: 0xd8e0e8,
      metalness: 0.95,
      roughness: 0.15
    });

    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x6699aa,
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
      metalness: 0.8
    });

    this.buildDoors();
  }

  private buildDoors(): void {
    for (const def of HOSPITAL_LEVEL_CONFIG.doors) {
      const grp = new THREE.Group();
      grp.position.copy(def.position);

      const isFireDoor = def.id === 'door_emergency_exit';
      const mat = isFireDoor ? this.fireDoorMat : this.doorMat;

      // Main door panel
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z),
        mat
      );
      panel.castShadow = true;
      panel.receiveShadow = true;
      grp.add(panel);

      // Observation window
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(
          def.size.x > def.size.z ? 0.6 : def.size.x * 1.05,
          0.8,
          def.size.z > def.size.x ? 0.6 : def.size.z * 1.05
        ),
        this.glassMat
      );
      win.position.y = 0.35;
      grp.add(win);

      // Push bar or lever handle
      const pushBar = new THREE.Mesh(
        new THREE.BoxGeometry(
          def.size.x > def.size.z ? 1.6 : def.size.x * 1.4,
          0.08,
          def.size.z > def.size.x ? 1.6 : def.size.z * 1.4
        ),
        this.handleMat
      );
      pushBar.position.y = -0.15;
      grp.add(pushBar);

      this.doorsGroup.add(grp);

      // Physics box collider
      const collider = this.physicsWorld.createStaticBox(
        def.position,
        new THREE.Vector3(def.size.x / 2, def.size.y / 2, def.size.z / 2)
      );

      this.doors.set(def.id, {
        def,
        meshGroup: grp,
        collider,
        isOpen: false,
        isOpening: false,
        openProgress: 0
      });
    }
  }

  public tryOpenDoor(doorId: string, hasKeycard: boolean): { success: boolean; message?: string } {
    const door = this.doors.get(doorId);
    if (!door) return { success: false };
    if (door.isOpen || door.isOpening) return { success: true };

    if (door.def.isLocked) {
      if (!hasKeycard) {
        AudioManager.getInstance().playSound('click');
        EventBus.getInstance().emit('subtitle:show', {
          speaker: 'SYSTEM',
          text: door.def.lockedMessage ?? 'DOOR LOCKED',
          durationMs: 2500
        });
        return { success: false, message: door.def.lockedMessage };
      }
    }

    // Door unlocks and opens
    door.isOpening = true;
    AudioManager.getInstance().playSound('door_open');

    // Remove physics barrier immediately or once opening starts
    if (door.collider && door.collider.body) {
      this.physicsWorld.removeRigidBody(door.collider.body);
      door.collider = null;
    }

    return { success: true };
  }

  public update(dt: number): void {
    for (const door of this.doors.values()) {
      if (door.isOpening && !door.isOpen) {
        door.openProgress = Math.min(1.0, door.openProgress + dt * 1.8);

        if (door.def.opensDirection === 'slide_up') {
          // Slide upwards into overhead cavity
          door.meshGroup.position.y = door.def.position.y + door.openProgress * 3.2;
        } else {
          // Swing open 90 degrees
          door.meshGroup.rotation.y = door.openProgress * (Math.PI / 2);
        }

        if (door.openProgress >= 1.0) {
          door.isOpen = true;
          door.isOpening = false;
        }
      }
    }
  }

  public getDoor(id: string): ActiveDoor | undefined {
    return this.doors.get(id);
  }

  public dispose(): void {
    for (const door of this.doors.values()) {
      if (door.collider && door.collider.body) {
        this.physicsWorld.removeRigidBody(door.collider.body);
      }
    }
    this.doors.clear();

    if (this.doorsGroup.parent) {
      this.doorsGroup.parent.remove(this.doorsGroup);
    }
  }
}
