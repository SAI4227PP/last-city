export type StageId = 'main-menu' | 'cinematic' | 'hospital' | 'city-escape' | 'open-survival';

export interface VitalStats {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  thirst: number;
}

export type WeaponType = 'knife' | 'bat' | 'pistol' | 'shotgun' | 'rifle' | 'sniper' | 'machinegun';

export type WeaponRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface WeaponStats {
  id: WeaponType;
  name: string;
  isRanged: boolean;
  damage: number;
  fireRate: number; // shots or swings per second
  range: number;
  maxAmmo: number;        // Magazine capacity
  maxReserveAmmo: number; // Maximum reserve ammunition capacity
  currentAmmo: number;
  reserveAmmo: number;
  reloadTime: number; // seconds
  recoil: number;
  rarity?: WeaponRarity;
}

export type ItemCategory = 'weapon' | 'ammo' | 'medicine' | 'food' | 'water' | 'crafting' | 'quest';

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  count: number;
  maxStack: number;
  description: string;
  icon: string;
  usable: boolean;
  weaponType?: WeaponType;
  healAmount?: number;
  hungerAmount?: number;
  thirstAmount?: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  resultItemId: string;
  resultCount: number;
  ingredients: { itemId: string; count: number }[];
  description: string;
}

export type ZombieVariantType = 'walker' | 'runner' | 'brute' | 'spitter' | 'boss';
export type ZombieModelType = 'patient' | 'zombie1' | 'zombie2';

export type ZombieState = 'idle' | 'patrol' | 'investigate' | 'detect' | 'chase' | 'attack' | 'damage' | 'dead';

export interface MissionObjective {
  id: string;
  description: string;
  completed: boolean;
  targetCount?: number;
  currentCount?: number;
}

export interface MissionData {
  id: string;
  stageId: StageId;
  title: string;
  description: string;
  objectives: MissionObjective[];
  completed: boolean;
  rewardText?: string;
}

export interface PlayerSaveData {
  version: number;
  timestamp: number;
  stage: StageId;
  cinematicCompleted: boolean;
  playerPosition: [number, number, number];
  playerRotation: number;
  vitals: VitalStats;
  inventory: InventoryItem[];
  equippedWeapon: WeaponType;
  weapons: Record<WeaponType, { unlocked: boolean; currentAmmo: number; reserveAmmo: number; maxReserveAmmo?: number }>;
  completedMissions: string[];
  safehouseUnlocked: boolean;
  gameTimeMinutes: number;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export interface GraphicsSettings {
  quality: 'auto' | 'low' | 'medium' | 'high';
  shadows: 'off' | 'low' | 'high';
  renderScale: number;
  particleQuality: 'low' | 'medium' | 'high';
  environmentalDetail: 'low' | 'high';
  showFps: boolean;
  showDiagnostics: boolean;
}
