import { StageId, WeaponType, VitalStats, InventoryItem } from '@/shared/types';

export interface GameEventPayloads {
  // Stage & Lifecycle
  'stage:change': { from: StageId; to: StageId };
  'stage:completed': { stageId: StageId };
  'game:pause': boolean;
  'game:over': { reason: string };
  'game:save': void;
  'game:loaded': void;

  // Player & Vitals
  'player:damage': { amount: number; source: string };
  'player:heal': { amount: number };
  'player:vitals_updated': VitalStats;
  'player:death': void;
  'player:interact': { targetId: string; prompt: string };
  'player:interact_clear': void;

  // Combat & Weapons
  'weapon:switch': { weapon: WeaponType };
  'weapon:fire': { weapon: WeaponType; currentAmmo: number; reserveAmmo: number };
  'weapon:reload': { weapon: WeaponType };
  'weapon:hit': { targetType: 'zombie' | 'prop'; damage: number; isHeadshot: boolean; position: [number, number, number] };
  'combat:damage_number': { amount: number; position: [number, number, number]; isHeadshot: boolean; hitLocation: string; armorReduced?: number };
  'combat:headshot': { position: [number, number, number] };

  // Zombie
  'zombie:spawn': { id: string; variant: string };
  'zombie:alerted': { id: string; position: [number, number, number] };
  'zombie:attack': { id: string; damage: number };
  'zombie:killed': { id: string; variant: string; position: [number, number, number] };

  // Inventory & Crafting
  'inventory:updated': { items: InventoryItem[] };
  'item:collected': { item: InventoryItem };
  'item:used': { itemId: string };
  'item:crafted': { recipeId: string; resultItem: InventoryItem };

  // Missions
  'mission:updated': { missionId: string; objectiveId?: string };
  'mission:completed': { missionId: string; title: string };

  // Audio & Subtitles
  'audio:play_sfx': { sound: string; volume?: number };
  'subtitle:show': { speaker: string; text: string; durationMs: number };
  'subtitle:hide': void;
}
