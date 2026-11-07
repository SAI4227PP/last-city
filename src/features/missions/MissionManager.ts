import { StageId, MissionData } from '@/shared/types';
import { MISSIONS_DATA } from '@/data/missions';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { EventBus } from '@/core/events/EventBus';
import { Logger } from '@/core/utils/Logger';

export class MissionManager {
  private missions: Record<string, MissionData>;
  private activeMissionId: string | null = null;
  private completedMissionIds: Set<string> = new Set();
  private eventBus: EventBus;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.missions = JSON.parse(JSON.stringify(MISSIONS_DATA));
  }

  public getActiveMission(): MissionData | null {
    return this.activeMissionId ? this.missions[this.activeMissionId] : null;
  }

  public getCompletedMissions(): string[] {
    return Array.from(this.completedMissionIds);
  }

  public setCompletedMissions(ids: string[]): void {
    this.completedMissionIds = new Set(ids);
  }

  public startStageMissions(stageId: StageId): void {
    // Find the first uncompleted mission for this stage
    const stageMissions = Object.values(this.missions).filter((m) => m.stageId === stageId);
    const nextMission = stageMissions.find((m) => !this.completedMissionIds.has(m.id));

    if (nextMission) {
      this.activateMission(nextMission.id);
    }
  }

  public activateMission(missionId: string): void {
    const mission = this.missions[missionId];
    if (!mission) {
      Logger.warn(`Mission "${missionId}" not found.`);
      return;
    }

    this.activeMissionId = missionId;
    Logger.info(`Active mission set: ${mission.title}`);
    this.syncToHUD();
  }

  public completeObjective(missionId: string, objectiveId: string): void {
    const mission = this.missions[missionId];
    if (!mission) return;

    const obj = mission.objectives.find((o) => o.id === objectiveId);
    if (obj && !obj.completed) {
      obj.completed = true;
      Logger.info(`Objective completed: "${obj.description}"`);
      this.eventBus.emit('audio:play_sfx', { sound: 'pickup', volume: 0.9 });

      // Check if all objectives in mission are complete
      const allDone = mission.objectives.every((o) => o.completed);
      if (allDone) {
        this.completeMission(missionId);
      } else {
        this.syncToHUD();
      }
    }
  }

  public completeMission(missionId: string): void {
    const mission = this.missions[missionId];
    if (!mission) return;

    mission.completed = true;
    this.completedMissionIds.add(missionId);
    Logger.info(`MISSION COMPLETE: ${mission.title}`);

    this.eventBus.emit('mission:completed', { missionId, title: mission.title });
    this.eventBus.emit('audio:play_sfx', { sound: 'pickup', volume: 1.0 });

    // Look for next mission in current stage
    const stageMissions = Object.values(this.missions).filter((m) => m.stageId === mission.stageId);
    const nextMission = stageMissions.find((m) => !this.completedMissionIds.has(m.id));

    if (nextMission) {
      this.activateMission(nextMission.id);
    } else {
      // Stage missions all completed
      this.eventBus.emit('stage:completed', { stageId: mission.stageId });
    }
  }

  public syncToHUD(): void {
    const active = this.getActiveMission();
    if (active) {
      const currentObj = active.objectives.find((o) => !o.completed) || active.objectives[active.objectives.length - 1];
      useGameUIStore.getState().setActiveMission({
        title: active.title,
        objective: currentObj ? currentObj.description : 'Stage Objectives Complete'
      });
    }
  }
}
