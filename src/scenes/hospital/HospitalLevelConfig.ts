import * as THREE from 'three';

export interface RoomBounds {
  id: string;
  name: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  center: THREE.Vector3;
}

export interface WallSegment {
  position: THREE.Vector3;
  halfExtents: THREE.Vector3;
  color?: number;
  roughness?: number;
}

export interface DoorDef {
  id: string;
  name: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  rotationY?: number;
  isLocked: boolean;
  requiredItem?: string;
  lockedMessage?: string;
  opensDirection?: 'slide_up' | 'swing_y';
}

export interface PropDef {
  type:
    | 'bed'
    | 'bed_overturned'
    | 'iv_stand'
    | 'wheelchair'
    | 'cabinet'
    | 'med_monitor'
    | 'reception_desk'
    | 'security_console'
    | 'pharmacy_shelf'
    | 'filing_cabinet'
    | 'crash_cart'
    | 'stretcher'
    | 'debris'
    | 'blood_splatter'
    | 'wall_sign'
    | 'curtain'
    | 'window'
    | 'nightstand'
    | 'oxygen_tank'
    | 'medicine_crate'
    | 'cctv_wall_monitor';
  position: THREE.Vector3;
  rotationY?: number;
  scale?: number;
  signText?: string;
}

export interface LightDef {
  id: string;
  type: 'point' | 'spot';
  color: number;
  intensity: number;
  distance: number;
  decay?: number;
  position: THREE.Vector3;
  flickers?: boolean;
  pulse?: boolean;
  castShadow?: boolean;
}

export interface InteractableDef {
  id: string;
  position: THREE.Vector3;
  radius: number;
  prompt: string;
  type: 'loot' | 'keycard' | 'door_scanner' | 'note';
  itemId?: string;
  itemCount?: number;
  missionHook?: { missionId: string; objectiveId: string };
  noteText?: string;
}

export interface ZombieTriggerDef {
  id: string;
  variant: 'walker' | 'runner' | 'brute';
  spawnPos: THREE.Vector3;
  triggerDistance: number;
  triggerCenter: THREE.Vector3;
  missionHook?: { missionId: string; objectiveId: string };
}

export const HOSPITAL_LEVEL_CONFIG = {
  // Global hospital bounds
  bounds: {
    min: new THREE.Vector3(-16, 0, -6),
    max: new THREE.Vector3(16, 3.6, 64),
    ceilingHeight: 3.6
  },

  // Rooms and zones for navigation & spatial storytelling
  rooms: [
    {
      id: 'room_104',
      name: 'Patient Room 104 (Awakening)',
      min: new THREE.Vector3(-4.5, 0, -5),
      max: new THREE.Vector3(4.5, 3.6, 5),
      center: new THREE.Vector3(0, 1.8, 0)
    },
    {
      id: 'corridor_main',
      name: 'Main Central Corridor',
      min: new THREE.Vector3(-3.0, 0, 5),
      max: new THREE.Vector3(3.0, 3.6, 62),
      center: new THREE.Vector3(0, 1.8, 33.5)
    },
    {
      id: 'room_101',
      name: 'Patient Room 101',
      min: new THREE.Vector3(-12, 0, 6),
      max: new THREE.Vector3(-3, 3.6, 16),
      center: new THREE.Vector3(-7.5, 1.8, 11)
    },
    {
      id: 'room_102',
      name: 'Patient Room 102',
      min: new THREE.Vector3(-12, 0, 18),
      max: new THREE.Vector3(-3, 3.6, 28),
      center: new THREE.Vector3(-7.5, 1.8, 23)
    },
    {
      id: 'nurse_station',
      name: 'Nurse Station & Reception',
      min: new THREE.Vector3(3, 0, 14),
      max: new THREE.Vector3(13, 3.6, 28),
      center: new THREE.Vector3(8, 1.8, 21)
    },
    {
      id: 'emergency_ward',
      name: 'Emergency Trauma Ward',
      min: new THREE.Vector3(3, 0, 30),
      max: new THREE.Vector3(15, 3.6, 46),
      center: new THREE.Vector3(9, 1.8, 38)
    },
    {
      id: 'pharmacy',
      name: 'Hospital Pharmacy',
      min: new THREE.Vector3(-14, 0, 32),
      max: new THREE.Vector3(-3, 3.6, 46),
      center: new THREE.Vector3(-8.5, 1.8, 39)
    },
    {
      id: 'security_room',
      name: 'Security Command Office',
      min: new THREE.Vector3(3, 0, 48),
      max: new THREE.Vector3(13, 3.6, 58),
      center: new THREE.Vector3(8, 1.8, 53)
    },
    {
      id: 'staircase_junction',
      name: 'Stairwell Blockade',
      min: new THREE.Vector3(-13, 0, 48),
      max: new THREE.Vector3(-3, 3.6, 58),
      center: new THREE.Vector3(-8, 1.8, 53)
    },
    {
      id: 'emergency_exit',
      name: 'Courtyard Emergency Exit',
      min: new THREE.Vector3(-3.5, 0, 58),
      max: new THREE.Vector3(3.5, 3.6, 64),
      center: new THREE.Vector3(0, 1.8, 61)
    }
  ] as RoomBounds[],

  // Interactive doors throughout the facility
  doors: [
    {
      id: 'door_ward',
      name: 'Emergency Ward Double Doors',
      position: new THREE.Vector3(3.0, 1.3, 34),
      size: new THREE.Vector3(0.2, 2.6, 2.4),
      rotationY: 0,
      isLocked: false,
      opensDirection: 'swing_y'
    },
    {
      id: 'door_pharmacy',
      name: 'Pharmacy Grate Door',
      position: new THREE.Vector3(-3.0, 1.3, 38),
      size: new THREE.Vector3(0.2, 2.6, 2.0),
      rotationY: 0,
      isLocked: false,
      opensDirection: 'swing_y'
    },
    {
      id: 'door_security',
      name: 'Security Office Door',
      position: new THREE.Vector3(3.0, 1.3, 52),
      size: new THREE.Vector3(0.2, 2.6, 1.8),
      rotationY: 0,
      isLocked: false,
      opensDirection: 'swing_y'
    },
    {
      id: 'door_emergency_exit',
      name: 'Hospital Fire Exit',
      position: new THREE.Vector3(0, 1.3, 62),
      size: new THREE.Vector3(3.2, 2.6, 0.3),
      rotationY: 0,
      isLocked: true,
      requiredItem: 'hospital_keycard',
      lockedMessage: 'ACCESS DENIED — St. Jude Security Keycard Required.',
      opensDirection: 'slide_up'
    }
  ] as DoorDef[],

  // Props distributed for environmental storytelling
  props: [
    // Room 104 (Awakening)
    { type: 'bed', position: new THREE.Vector3(-1.8, 0, -1.5), rotationY: 0 },
    { type: 'med_monitor', position: new THREE.Vector3(-1.8, 1.4, -0.8), rotationY: Math.PI / 4 },
    { type: 'iv_stand', position: new THREE.Vector3(-2.6, 0, -1.2), rotationY: 0 },
    { type: 'nightstand', position: new THREE.Vector3(-2.8, 0, -2.5), rotationY: 0 },
    { type: 'curtain', position: new THREE.Vector3(-0.5, 0, -1.5), rotationY: Math.PI / 2 },
    { type: 'window', position: new THREE.Vector3(0, 1.8, -4.95), rotationY: 0 },
    { type: 'cabinet', position: new THREE.Vector3(3.8, 1.2, -1.0), rotationY: -Math.PI / 2 },
    { type: 'oxygen_tank', position: new THREE.Vector3(-3.4, 0, -4.0), rotationY: 0 },
    { type: 'wall_sign', position: new THREE.Vector3(0, 2.6, 4.9), rotationY: 0, signText: 'ROOM 104 - QUARANTINE' },

    // Corridor Section 1 (Z: 5 to 16)
    { type: 'wall_sign', position: new THREE.Vector3(-2.85, 2.5, 8), rotationY: Math.PI / 2, signText: '<- ROOMS 101-103' },
    { type: 'wheelchair', position: new THREE.Vector3(-1.5, 0, 13), rotationY: 0.4 },
    { type: 'blood_splatter', position: new THREE.Vector3(0.6, 0.02, 11), rotationY: 0.8, scale: 1.8 },
    { type: 'blood_splatter', position: new THREE.Vector3(-0.2, 0.02, 15), rotationY: 0.2, scale: 1.5 },
    { type: 'debris', position: new THREE.Vector3(1.8, 0, 15), rotationY: -0.3 },

    // Room 101 (Overturned & Loot)
    { type: 'bed_overturned', position: new THREE.Vector3(-7.5, 0, 10.5), rotationY: 0.5 },
    { type: 'iv_stand', position: new THREE.Vector3(-9.2, 0, 8.5), rotationY: 0 },
    { type: 'nightstand', position: new THREE.Vector3(-9.5, 0, 12.0), rotationY: 0 },
    { type: 'window', position: new THREE.Vector3(-11.95, 1.8, 11), rotationY: Math.PI / 2 },
    { type: 'curtain', position: new THREE.Vector3(-5.5, 0, 11), rotationY: 0 },
    { type: 'blood_splatter', position: new THREE.Vector3(-7.0, 0.02, 11.5), scale: 2.2 },

    // Room 102 (Quarantine Ward)
    { type: 'bed', position: new THREE.Vector3(-7.5, 0, 22.5), rotationY: 0 },
    { type: 'iv_stand', position: new THREE.Vector3(-9.2, 0, 21.0), rotationY: 0 },
    { type: 'med_monitor', position: new THREE.Vector3(-7.5, 1.4, 24.5), rotationY: Math.PI },
    { type: 'window', position: new THREE.Vector3(-11.95, 1.8, 23), rotationY: Math.PI / 2 },

    // Nurse Station & Reception (Z: 14 to 28)
    { type: 'reception_desk', position: new THREE.Vector3(6.5, 0, 20), rotationY: 0 },
    { type: 'filing_cabinet', position: new THREE.Vector3(11.8, 0, 16), rotationY: -Math.PI / 2 },
    { type: 'filing_cabinet', position: new THREE.Vector3(11.8, 0, 18), rotationY: -Math.PI / 2 },
    { type: 'wall_sign', position: new THREE.Vector3(2.85, 2.5, 17), rotationY: -Math.PI / 2, signText: 'NURSE STATION' },
    { type: 'debris', position: new THREE.Vector3(4.5, 0, 24), rotationY: 0.6 },

    // Corridor Section 2 (Z: 20 to 32)
    { type: 'wall_sign', position: new THREE.Vector3(2.85, 2.5, 29), rotationY: -Math.PI / 2, signText: 'EMERGENCY WARD ->' },
    { type: 'stretcher', position: new THREE.Vector3(-1.2, 0, 27), rotationY: 0.15 },
    { type: 'blood_splatter', position: new THREE.Vector3(-0.5, 0.02, 29), scale: 2.4 },
    { type: 'blood_splatter', position: new THREE.Vector3(1.2, 0.02, 32), scale: 2.8 },

    // Emergency Ward (Z: 30 to 46)
    { type: 'bed', position: new THREE.Vector3(6.5, 0, 33), rotationY: Math.PI / 2 },
    { type: 'bed_overturned', position: new THREE.Vector3(11.5, 0, 34), rotationY: -0.7 },
    { type: 'bed', position: new THREE.Vector3(6.5, 0, 41), rotationY: Math.PI / 2 },
    { type: 'bed', position: new THREE.Vector3(11.5, 0, 41), rotationY: -Math.PI / 2 },
    { type: 'curtain', position: new THREE.Vector3(9.0, 0, 37), rotationY: 0 },
    { type: 'crash_cart', position: new THREE.Vector3(9.0, 0, 37.5), rotationY: 0.3 },
    { type: 'iv_stand', position: new THREE.Vector3(5.2, 0, 35), rotationY: 0 },
    { type: 'oxygen_tank', position: new THREE.Vector3(13.8, 0, 32.5), rotationY: 0 },
    { type: 'med_monitor', position: new THREE.Vector3(7.8, 1.4, 32.5), rotationY: 0 },
    { type: 'cabinet', position: new THREE.Vector3(14.2, 1.2, 38), rotationY: -Math.PI / 2 },
    { type: 'window', position: new THREE.Vector3(14.95, 1.8, 38), rotationY: -Math.PI / 2 },
    { type: 'blood_splatter', position: new THREE.Vector3(9.2, 0.02, 36), scale: 3.2 },

    // Pharmacy (Z: 32 to 46)
    { type: 'pharmacy_shelf', position: new THREE.Vector3(-12.8, 0, 35), rotationY: 0 },
    { type: 'pharmacy_shelf', position: new THREE.Vector3(-12.8, 0, 39), rotationY: 0 },
    { type: 'pharmacy_shelf', position: new THREE.Vector3(-12.8, 0, 43), rotationY: 0 },
    { type: 'pharmacy_shelf', position: new THREE.Vector3(-7.5, 0, 44), rotationY: Math.PI / 2 },
    { type: 'medicine_crate', position: new THREE.Vector3(-10.5, 0, 36), rotationY: 0.4 },
    { type: 'medicine_crate', position: new THREE.Vector3(-9.2, 0, 42), rotationY: -0.2 },
    { type: 'window', position: new THREE.Vector3(-13.95, 1.8, 39), rotationY: Math.PI / 2 },
    { type: 'wall_sign', position: new THREE.Vector3(-2.85, 2.5, 36), rotationY: Math.PI / 2, signText: '<- PHARMACY' },
    { type: 'debris', position: new THREE.Vector3(-6.5, 0, 36), rotationY: 0.5 },

    // Security Room (Z: 48 to 58)
    { type: 'security_console', position: new THREE.Vector3(8.5, 0, 56), rotationY: Math.PI },
    { type: 'cctv_wall_monitor', position: new THREE.Vector3(8.5, 2.2, 57.8), rotationY: Math.PI },
    { type: 'filing_cabinet', position: new THREE.Vector3(4.2, 0, 56.5), rotationY: 0 },
    { type: 'wall_sign', position: new THREE.Vector3(2.85, 2.5, 50), rotationY: -Math.PI / 2, signText: 'SECURITY COMMAND' },

    // Staircase Blockade (Z: 48 to 58)
    { type: 'debris', position: new THREE.Vector3(-7.5, 0, 52), rotationY: 0.2, scale: 2.0 },
    { type: 'wall_sign', position: new THREE.Vector3(-2.85, 2.5, 50), rotationY: Math.PI / 2, signText: 'STAIRS - BLOCKED' },

    // Corridor Approach to Exit (Z: 50 to 62)
    { type: 'wheelchair', position: new THREE.Vector3(1.2, 0, 55), rotationY: 1.2 },
    { type: 'blood_splatter', position: new THREE.Vector3(0, 0.02, 58), scale: 2.0 },
    { type: 'debris', position: new THREE.Vector3(-1.4, 0, 59), rotationY: 0.7 },
    { type: 'wall_sign', position: new THREE.Vector3(0, 3.2, 61.8), rotationY: 0, signText: 'EMERGENCY EXIT' }
  ] as PropDef[],

  // Atmospheric, highly visible, cinematic horror lighting setup
  lights: [
    // Room 104 (Awakening) - Bright multi-source hospital room lighting
    {
      id: 'light_room104',
      type: 'point',
      color: 0xeaf4ff,
      intensity: 3.8,
      distance: 18,
      decay: 1.1,
      position: new THREE.Vector3(0, 3.2, 0),
      castShadow: true
    },
    {
      id: 'light_room104_door',
      type: 'point',
      color: 0xdef0fc,
      intensity: 2.8,
      distance: 14,
      decay: 1.1,
      position: new THREE.Vector3(0, 3.1, 3.2)
    },
    {
      id: 'light_room104_meds',
      type: 'point',
      color: 0xe5f2ff,
      intensity: 2.6,
      distance: 12,
      decay: 1.1,
      position: new THREE.Vector3(2.5, 2.8, -1.0)
    },
    {
      id: 'light_monitor104',
      type: 'point',
      color: 0x38ef7d,
      intensity: 1.8,
      distance: 8,
      position: new THREE.Vector3(-1.8, 1.4, -0.8)
    },

    // Patient Room 101
    {
      id: 'light_room101',
      type: 'point',
      color: 0xe6f3ff,
      intensity: 3.4,
      distance: 16,
      decay: 1.1,
      position: new THREE.Vector3(-7.5, 3.1, 11)
    },

    // Patient Room 102
    {
      id: 'light_room102',
      type: 'point',
      color: 0xe6f3ff,
      intensity: 3.4,
      distance: 16,
      decay: 1.1,
      position: new THREE.Vector3(-7.5, 3.1, 23)
    },

    // Corridor Fluorescents (Spanning the 60m main hallway)
    {
      id: 'light_corridor_1',
      type: 'point',
      color: 0xe2f0fd,
      intensity: 3.6,
      distance: 22,
      decay: 1.1,
      position: new THREE.Vector3(0, 3.2, 12),
      flickers: true,
      castShadow: true
    },
    {
      id: 'light_corridor_2',
      type: 'point',
      color: 0xe2f0fd,
      intensity: 3.6,
      distance: 22,
      decay: 1.1,
      position: new THREE.Vector3(0, 3.2, 24)
    },
    {
      id: 'light_corridor_3',
      type: 'point',
      color: 0xdef0fc,
      intensity: 3.4,
      distance: 22,
      decay: 1.1,
      position: new THREE.Vector3(0, 3.2, 36),
      flickers: true
    },
    {
      id: 'light_corridor_4',
      type: 'point',
      color: 0xd8eaf7,
      intensity: 3.2,
      distance: 22,
      decay: 1.1,
      position: new THREE.Vector3(0, 3.2, 48)
    },

    // Nurse Station
    {
      id: 'light_nurse_station',
      type: 'point',
      color: 0xfffaed,
      intensity: 3.8,
      distance: 18,
      decay: 1.1,
      position: new THREE.Vector3(7.5, 3.1, 21)
    },

    // Emergency Ward (Surgical overhead + Red Emergency Beacon)
    {
      id: 'light_emergency_surgical',
      type: 'point',
      color: 0xf0f8ff,
      intensity: 4.5,
      distance: 22,
      decay: 1.0,
      position: new THREE.Vector3(9.0, 3.2, 38),
      castShadow: true
    },
    {
      id: 'light_emergency_red',
      type: 'point',
      color: 0xff2222,
      intensity: 2.4,
      distance: 14,
      position: new THREE.Vector3(14.2, 2.6, 34),
      pulse: true
    },

    // Pharmacy
    {
      id: 'light_pharmacy',
      type: 'point',
      color: 0xdaf0ff,
      intensity: 3.6,
      distance: 18,
      decay: 1.1,
      position: new THREE.Vector3(-8.5, 3.1, 39)
    },

    // Security Command
    {
      id: 'light_security_terminal',
      type: 'point',
      color: 0x58c4f8,
      intensity: 3.2,
      distance: 16,
      decay: 1.1,
      position: new THREE.Vector3(8.5, 2.5, 53)
    },

    // Staircase Junction
    {
      id: 'light_staircase',
      type: 'point',
      color: 0xddeafe,
      intensity: 3.2,
      distance: 16,
      decay: 1.1,
      position: new THREE.Vector3(-8.0, 3.1, 53)
    },

    // Emergency Exit (Green Exit Sign + Red Alarm Beacon)
    {
      id: 'light_exit_foyer',
      type: 'point',
      color: 0xe0f2fe,
      intensity: 3.4,
      distance: 18,
      decay: 1.1,
      position: new THREE.Vector3(0, 3.2, 58)
    },
    {
      id: 'light_exit_sign',
      type: 'point',
      color: 0x22c55e,
      intensity: 2.8,
      distance: 10,
      position: new THREE.Vector3(0, 3.0, 61.5)
    },
    {
      id: 'light_exit_beacon',
      type: 'point',
      color: 0xef4444,
      intensity: 2.6,
      distance: 12,
      position: new THREE.Vector3(2.2, 2.8, 61.2),
      pulse: true
    }
  ] as LightDef[],

  // Pickups, loot containers, notes, and door scanners
  interactables: [
    {
      id: 'med_cabinet_104',
      position: new THREE.Vector3(3.4, 1.2, -1.0),
      radius: 2.2,
      prompt: 'Scavenge Medical Cabinet',
      type: 'loot',
      itemId: 'bandage',
      itemCount: 2,
      missionHook: { missionId: 'hosp_m2', objectiveId: 'obj_meds' }
    },
    {
      id: 'nurse_clipboard',
      position: new THREE.Vector3(6.5, 1.1, 20),
      radius: 2.0,
      prompt: 'Read Doctor Emergency Log',
      type: 'note',
      noteText: 'PATIENT ZERO LOG: The orderly in Emergency Ward succumbed to the contagion. Dr. Vance took the St. Jude Security Keycard to the Security Office.'
    },
    {
      id: 'pharmacy_medkit',
      position: new THREE.Vector3(-12.0, 1.0, 39),
      radius: 2.2,
      prompt: 'Take Sterile Medical Kit',
      type: 'loot',
      itemId: 'medkit',
      itemCount: 2
    },
    {
      id: 'pharmacy_bandages',
      position: new THREE.Vector3(-12.0, 1.0, 43),
      radius: 2.2,
      prompt: 'Take Antiseptic Bandages',
      type: 'loot',
      itemId: 'bandage',
      itemCount: 3
    },
    {
      id: 'security_keycard',
      position: new THREE.Vector3(8.5, 1.15, 55),
      radius: 2.2,
      prompt: 'Take St. Jude Security Keycard',
      type: 'keycard',
      itemId: 'hospital_keycard',
      itemCount: 1,
      missionHook: { missionId: 'hosp_m2', objectiveId: 'obj_keycard' }
    },
    {
      id: 'emergency_exit_scanner',
      position: new THREE.Vector3(1.6, 1.3, 61.2),
      radius: 2.5,
      prompt: 'Swipe Keycard to Unlock Exit',
      type: 'door_scanner',
      missionHook: { missionId: 'hosp_m4', objectiveId: 'obj_unlock' }
    }
  ] as InteractableDef[],

  // Scripted zombie encounter trigger points
  zombieTriggers: [
    {
      id: 'trigger_orderly_ward',
      variant: 'walker',
      spawnPos: new THREE.Vector3(9.0, 0, 38),
      triggerDistance: 12.0,
      triggerCenter: new THREE.Vector3(3.0, 0, 34),
      missionHook: { missionId: 'hosp_m3', objectiveId: 'obj_encounter' }
    },
    {
      id: 'trigger_runner_corridor',
      variant: 'runner',
      spawnPos: new THREE.Vector3(0, 0, 45),
      triggerDistance: 10.0,
      triggerCenter: new THREE.Vector3(0, 0, 30)
    },
    {
      id: 'trigger_shambler_exit',
      variant: 'walker',
      spawnPos: new THREE.Vector3(0, 0, 56),
      triggerDistance: 10.0,
      triggerCenter: new THREE.Vector3(0, 0, 48)
    }
  ] as ZombieTriggerDef[]
};
