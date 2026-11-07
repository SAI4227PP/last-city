import * as THREE from 'three';
import { ZombieManager } from '@/features/zombies/ZombieManager';
import { MissionManager } from '@/features/missions/MissionManager';
import { EventBus } from '@/core/events/EventBus';
import { HOSPITAL_LEVEL_CONFIG, ZombieTriggerDef } from './HospitalLevelConfig';

export class HospitalZombieSpawns {
  private zombieManager: ZombieManager;
  private missionManager: MissionManager;
  private triggers: ZombieTriggerDef[] = [];
  private triggeredIds: Set<string> = new Set();
  private orderlyEncounterCompleted: boolean = false;

  constructor(zombieManager: ZombieManager, missionManager: MissionManager) {
    this.zombieManager = zombieManager;
    this.missionManager = missionManager;
    this.triggers = [...HOSPITAL_LEVEL_CONFIG.zombieTriggers];

    // Initial pre-spawned hallway zombie so there's an immediate presence down the hall
    this.zombieManager.spawnZombie('walker', new THREE.Vector3(0, 0, 18));
  }

  public update(playerPos: THREE.Vector3): void {
    // Check encounter proximity triggers
    for (const trig of this.triggers) {
      if (this.triggeredIds.has(trig.id)) continue;

      const dist = playerPos.distanceTo(trig.triggerCenter);
      if (dist <= trig.triggerDistance) {
        this.triggeredIds.add(trig.id);
        this.zombieManager.spawnZombie(trig.variant, trig.spawnPos);

        if (trig.id === 'trigger_orderly_ward') {
          EventBus.getInstance().emit('subtitle:show', {
            speaker: 'SURVIVOR',
            text: 'God... what happened to him?! It looks like an infected orderly...',
            durationMs: 3500
          });
        }
      }
    }

    // Complete obj_encounter when player has passed the Emergency Ward (Z > 36)
    if (!this.orderlyEncounterCompleted && playerPos.z > 36) {
      this.orderlyEncounterCompleted = true;
      this.missionManager.completeObjective('hosp_m3', 'obj_encounter');
    }
  }

  public dispose(): void {
    this.triggers = [];
    this.triggeredIds.clear();
  }
}
