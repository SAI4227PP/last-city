import { MissionData } from '@/shared/types';

export const MISSIONS_DATA: Record<string, MissionData> = {
  // Stage 2: Hospital Outbreak
  hosp_m1: {
    id: 'hosp_m1',
    stageId: 'hospital',
    title: 'AWAKENING',
    description: 'You awaken in a derelict hospital room with no recollection of recent events. Survey your surroundings and locate an exit.',
    objectives: [
      { id: 'obj_wake', description: 'Investigate the hospital room', completed: false }
    ],
    completed: false
  },
  hosp_m2: {
    id: 'hosp_m2',
    stageId: 'hospital',
    title: 'SEARCH FOR SUPPLIES',
    description: 'Find medical supplies to treat your wounds and locate the St. Jude Security Keycard in the nurse station.',
    objectives: [
      { id: 'obj_meds', description: 'Scavenge medical cabinet for bandages', completed: false },
      { id: 'obj_keycard', description: 'Find the Emergency Keycard at reception', completed: false }
    ],
    completed: false
  },
  hosp_m3: {
    id: 'hosp_m3',
    stageId: 'hospital',
    title: 'FIRST CONTACT',
    description: 'An infected orderly blocks the corridor ahead. Neutralize the threat or slip past undetected.',
    objectives: [
      { id: 'obj_encounter', description: 'Overcome or evade the infected hospital worker', completed: false }
    ],
    completed: false
  },
  hosp_m4: {
    id: 'hosp_m4',
    stageId: 'hospital',
    title: 'HOSPITAL ESCAPE',
    description: 'Use the security keycard to unlock the emergency fire doors and escape into the courtyard.',
    objectives: [
      { id: 'obj_unlock', description: 'Swipe keycard at emergency exit scanner', completed: false },
      { id: 'obj_exit', description: 'Escape through the St. Jude emergency exit', completed: false }
    ],
    completed: false
  },

  // Stage 3: City Escape
  city_m1: {
    id: 'city_m1',
    stageId: 'city-escape',
    title: 'SEARCH PATROL VEHICLE',
    description: 'Check the abandoned police interceptor in the hospital courtyard for weapons and ammunition.',
    objectives: [
      { id: 'obj_police_car', description: 'Search the police vehicle trunk', completed: false }
    ],
    completed: false
  },
  city_m2: {
    id: 'city_m2',
    stageId: 'city-escape',
    title: 'URBAN GAUNTLET',
    description: 'Navigate the devastated avenue toward the evacuation bridge, avoiding or engaging roaming zombie packs.',
    objectives: [
      { id: 'obj_cross_streets', description: 'Move past the burning barricade', completed: false }
    ],
    completed: false
  },
  city_m3: {
    id: 'city_m3',
    stageId: 'city-escape',
    title: 'CHECKPOINT ALPHA',
    description: 'Reach the fortified military evacuation checkpoint and make contact with armed forces.',
    objectives: [
      { id: 'obj_reach_checkpoint', description: 'Inspect the military command terminal', completed: false }
    ],
    completed: false
  },

  // Stage 4: Open Survival
  surv_m1: {
    id: 'surv_m1',
    stageId: 'open-survival',
    title: 'ESTABLISH SAFEHOUSE',
    description: 'Locate the reinforced brick building on 4th Avenue and secure it as your base of operations.',
    objectives: [
      { id: 'obj_find_safehouse', description: 'Find and unlock the safehouse deadbolt', completed: false },
      { id: 'obj_secure_bed', description: 'Inspect the safehouse bed & storage locker', completed: false }
    ],
    completed: false
  },
  surv_side_pharmacy: {
    id: 'surv_side_pharmacy',
    stageId: 'open-survival',
    title: 'SIDE OPS: APOTHECARY RAID',
    description: 'Scavenge the abandoned Green Cross Pharmacy across the plaza for antibiotics and sterile bandages.',
    objectives: [
      { id: 'obj_pharmacy_loot', description: 'Loot the pharmacy medicine cache', completed: false }
    ],
    completed: false
  }
};
