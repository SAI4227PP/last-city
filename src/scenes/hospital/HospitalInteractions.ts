import * as THREE from 'three';
import { InventoryManager } from '@/features/inventory/InventoryManager';
import { MissionManager } from '@/features/missions/MissionManager';
import { AudioManager } from '@/core/audio/AudioManager';
import { EventBus } from '@/core/events/EventBus';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { HOSPITAL_LEVEL_CONFIG, InteractableDef } from './HospitalLevelConfig';
import { HospitalDoors } from './HospitalDoors';

export class HospitalInteractions {
  private scene: THREE.Scene;
  private inventoryManager: InventoryManager;
  private missionManager: MissionManager;
  private hospitalDoors: HospitalDoors;

  private interactables: InteractableDef[] = [];
  private currentActive: InteractableDef | null = null;
  private propVisuals: Map<string, THREE.Object3D> = new Map();

  // Callback when hospital exit is successfully unlocked
  public onExitUnlocked?: () => void;

  constructor(
    scene: THREE.Scene,
    inventoryManager: InventoryManager,
    missionManager: MissionManager,
    hospitalDoors: HospitalDoors
  ) {
    this.scene = scene;
    this.inventoryManager = inventoryManager;
    this.missionManager = missionManager;
    this.hospitalDoors = hospitalDoors;

    this.interactables = [...HOSPITAL_LEVEL_CONFIG.interactables];
    this.spawnInteractableVisuals();
  }

  private spawnInteractableVisuals(): void {
    // 1. St. Jude Security Keycard golden card mesh on security console
    const cardGeo = new THREE.BoxGeometry(0.32, 0.04, 0.22);
    const cardMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b }); // Bright golden yellow
    const keycardMesh = new THREE.Mesh(cardGeo, cardMat);
    keycardMesh.position.set(8.5, 0.92, 55);
    this.scene.add(keycardMesh);
    this.propVisuals.set('security_keycard', keycardMesh);

    // 2. Emergency Exit Keycard Reader Terminal on wall next to exit
    const readerGrp = new THREE.Group();
    readerGrp.position.set(1.6, 1.35, 61.2);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.35, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.8 })
    );
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xef4444 }) // Red locked LED
    );
    led.position.set(0, 0.08, 0.045);
    led.name = 'scanner_led';
    readerGrp.add(box, led);
    this.scene.add(readerGrp);
    this.propVisuals.set('emergency_exit_scanner', readerGrp);

    // 3. Nurse Station Emergency Log Clipboard
    const clipGeo = new THREE.BoxGeometry(0.32, 0.03, 0.45);
    const clipMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
    const clipMesh = new THREE.Mesh(clipGeo, clipMat);
    clipMesh.position.set(6.5, 1.18, 20);
    this.scene.add(clipMesh);
    this.propVisuals.set('nurse_clipboard', clipMesh);
  }

  public update(playerPos: THREE.Vector3): void {
    let closest: InteractableDef | null = null;
    let closestDist = Infinity;

    // Check item interactables
    for (const item of this.interactables) {
      const dist = playerPos.distanceTo(item.position);
      if (dist <= item.radius && dist < closestDist) {
        closest = item;
        closestDist = dist;
      }
    }

    this.currentActive = closest;

    if (closest) {
      useGameUIStore.getState().setInteractionPrompt({
        visible: true,
        text: closest.prompt,
        key: 'E'
      });
    } else {
      useGameUIStore.getState().setInteractionPrompt({
        visible: false,
        text: '',
        key: 'E'
      });
    }
  }

  public triggerInteract(): void {
    if (!this.currentActive) return;
    const active = this.currentActive;

    switch (active.type) {
      case 'loot': {
        if (active.itemId) {
          this.inventoryManager.addItem(active.itemId, active.itemCount ?? 1);
          AudioManager.getInstance().playSound('pickup');
          EventBus.getInstance().emit('audio:play_sfx', { sound: 'pickup', volume: 0.7 });
        }
        if (active.missionHook) {
          this.missionManager.completeObjective(
            active.missionHook.missionId,
            active.missionHook.objectiveId
          );
        }
        // Remove one-time loot
        this.interactables = this.interactables.filter((i) => i.id !== active.id);
        useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });
        this.currentActive = null;
        break;
      }

      case 'keycard': {
        this.inventoryManager.addItem('hospital_keycard', 1);
        AudioManager.getInstance().playSound('pickup');
        EventBus.getInstance().emit('subtitle:show', {
          speaker: 'SURVIVOR',
          text: 'Found the St. Jude Security Keycard. The emergency fire doors should open now.',
          durationMs: 3500
        });

        if (active.missionHook) {
          this.missionManager.completeObjective(
            active.missionHook.missionId,
            active.missionHook.objectiveId
          );
        }

        // Remove visual card mesh
        const visual = this.propVisuals.get(active.id);
        if (visual && visual.parent) visual.parent.remove(visual);

        this.interactables = this.interactables.filter((i) => i.id !== active.id);
        useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });
        this.currentActive = null;
        break;
      }

      case 'door_scanner': {
        const hasKeycard = this.inventoryManager.hasItem('hospital_keycard', 1);
        const result = this.hospitalDoors.tryOpenDoor('door_emergency_exit', hasKeycard);

        if (result.success) {
          // Switch scanner LED to green
          const visual = this.propVisuals.get('emergency_exit_scanner');
          if (visual) {
            const led = visual.getObjectByName('scanner_led') as THREE.Mesh;
            if (led && (led.material as THREE.MeshBasicMaterial)) {
              (led.material as THREE.MeshBasicMaterial).color.setHex(0x22c55e);
            }
          }

          if (active.missionHook) {
            this.missionManager.completeObjective(
              active.missionHook.missionId,
              active.missionHook.objectiveId
            );
          }

          EventBus.getInstance().emit('subtitle:show', {
            speaker: 'SYSTEM',
            text: 'SECURITY CLEARANCE GRANTED — Emergency Fire Doors Disengaged.',
            durationMs: 3000
          });

          if (this.onExitUnlocked) {
            this.onExitUnlocked();
          }

          // Remove prompt
          this.interactables = this.interactables.filter((i) => i.id !== active.id);
          useGameUIStore.getState().setInteractionPrompt({ visible: false, text: '', key: 'E' });
          this.currentActive = null;
        }
        break;
      }

      case 'note': {
        AudioManager.getInstance().playSound('click');
        if (active.noteText) {
          EventBus.getInstance().emit('subtitle:show', {
            speaker: 'MEMO',
            text: active.noteText,
            durationMs: 4500
          });
        }
        break;
      }
    }
  }

  public dispose(): void {
    for (const v of this.propVisuals.values()) {
      if (v.parent) v.parent.remove(v);
    }
    this.propVisuals.clear();
    this.interactables = [];
    this.currentActive = null;
  }
}
