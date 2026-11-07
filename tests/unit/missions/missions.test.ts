import { describe, it, expect, beforeEach } from 'vitest';
import { MissionManager } from '@/features/missions/MissionManager';

describe('MissionManager', () => {
  let missions: MissionManager;

  beforeEach(() => {
    missions = new MissionManager();
  });

  it('activates initial hospital mission correctly', () => {
    missions.startStageMissions('hospital');
    const active = missions.getActiveMission();
    expect(active).toBeDefined();
    expect(active?.id).toBe('hosp_m1');
    expect(active?.title).toBe('AWAKENING');
  });

  it('progresses to next mission when objectives complete', () => {
    missions.startStageMissions('hospital');
    missions.completeObjective('hosp_m1', 'obj_wake');

    // M1 complete -> transitions to M2 Search For Supplies
    const active = missions.getActiveMission();
    expect(active?.id).toBe('hosp_m2');
    expect(missions.getCompletedMissions()).toContain('hosp_m1');
  });
});
