import * as THREE from 'three';
import { MissionManager } from '@/features/missions/MissionManager';
import { EventBus } from '@/core/events/EventBus';

export class HospitalMission {
  private missionManager: MissionManager;
  private hasAwoken: boolean = false;
  private hasReachedExit: boolean = false;

  public onStageComplete?: () => void;

  constructor(missionManager: MissionManager) {
    this.missionManager = missionManager;
    this.missionManager.startStageMissions('hospital');

    // Initial awakening subtitle
    setTimeout(() => {
      EventBus.getInstance().emit('subtitle:show', {
        speaker: 'SURVIVOR',
        text: 'Where am I...? My head is pounding. I need to get on my feet and find a way out.',
        durationMs: 4000
      });
    }, 1200);
  }

  public update(playerPos: THREE.Vector3): void {
    // 1. Mission 1: Awakening (complete when player leaves Room 104 into corridor)
    if (!this.hasAwoken && playerPos.z > 4.5) {
      this.hasAwoken = true;
      this.missionManager.completeObjective('hosp_m1', 'obj_wake');

      EventBus.getInstance().emit('subtitle:show', {
        speaker: 'SURVIVOR',
        text: 'The entire ward has been torn apart... Blood everywhere. I need medical supplies and a keycard.',
        durationMs: 4000
      });
    }

    // 2. Mission 4: Final Escape (when player walks through the unlocked exit at Z >= 62.5)
    if (!this.hasReachedExit && playerPos.z >= 62.5) {
      this.hasReachedExit = true;
      this.missionManager.completeObjective('hosp_m4', 'obj_exit');

      EventBus.getInstance().emit('subtitle:show', {
        speaker: 'SURVIVOR',
        text: 'I made it out... but the city is in ruins. I need to find a vehicle.',
        durationMs: 3500
      });

      if (this.onStageComplete) {
        this.onStageComplete();
      }
    }
  }

  public dispose(): void {
    // Mission states are persisted in MissionManager
  }
}
