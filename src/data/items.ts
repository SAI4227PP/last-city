import { InventoryItem } from '@/shared/types';

export const ITEM_CATALOG: Record<string, InventoryItem> = {
  // Medical
  bandage: {
    id: 'bandage',
    name: 'Sterile Bandage',
    category: 'medicine',
    count: 1,
    maxStack: 5,
    description: 'Stops bleeding and restores 25 HP.',
    icon: '🩹',
    usable: true,
    healAmount: 25
  },
  medkit: {
    id: 'medkit',
    name: 'Military Medkit',
    category: 'medicine',
    count: 1,
    maxStack: 3,
    description: 'Comprehensive medical kit. Restores 75 HP.',
    icon: '🧰',
    usable: true,
    healAmount: 75
  },

  // Food & Water
  canned_beans: {
    id: 'canned_beans',
    name: 'Canned Rations',
    category: 'food',
    count: 1,
    maxStack: 5,
    description: 'Preserved military food. Restores 35 Hunger.',
    icon: '🥫',
    usable: true,
    hungerAmount: 35
  },
  energy_bar: {
    id: 'energy_bar',
    name: 'Energy Bar',
    category: 'food',
    count: 1,
    maxStack: 10,
    description: 'Quick carbohydrate boost. Restores 20 Hunger.',
    icon: '🍫',
    usable: true,
    hungerAmount: 20
  },
  clean_water: {
    id: 'clean_water',
    name: 'Purified Water',
    category: 'water',
    count: 1,
    maxStack: 4,
    description: 'Fresh clean drinking water. Restores 45 Thirst.',
    icon: '💧',
    usable: true,
    thirstAmount: 45
  },

  // Ammunition
  ammo_9mm: {
    id: 'ammo_9mm',
    name: '9mm Rounds (x12)',
    category: 'ammo',
    count: 12,
    maxStack: 60,
    description: 'Standard ammunition for service pistol.',
    icon: '🔫',
    usable: false
  },
  ammo_shotgun: {
    id: 'ammo_shotgun',
    name: '12G Buckshot (x6)',
    category: 'ammo',
    count: 6,
    maxStack: 30,
    description: 'Heavy 12-gauge shotgun shells.',
    icon: '💥',
    usable: false
  },
  ammo_rifle: {
    id: 'ammo_rifle',
    name: '5.56mm NATO (x30)',
    category: 'ammo',
    count: 30,
    maxStack: 90,
    description: 'High-velocity rifle cartridges.',
    icon: '🎯',
    usable: false
  },

  // Crafting Materials
  cloth: {
    id: 'cloth',
    name: 'Cloth Scraps',
    category: 'crafting',
    count: 1,
    maxStack: 20,
    description: 'Torn fabric useful for bandages and molotovs.',
    icon: '🧵',
    usable: false
  },
  alcohol: {
    id: 'alcohol',
    name: 'Antiseptic Alcohol',
    category: 'crafting',
    count: 1,
    maxStack: 5,
    description: 'Medical alcohol used for sterilization and explosives.',
    icon: '🧪',
    usable: false
  },
  scrap_metal: {
    id: 'scrap_metal',
    name: 'Scrap Metal',
    category: 'crafting',
    count: 1,
    maxStack: 20,
    description: 'Rusty nails, bolts, and sheet metal for upgrades.',
    icon: '🔩',
    usable: false
  },

  // Weapons as Inventory Items
  item_knife: {
    id: 'item_knife',
    name: 'Tactical Knife',
    category: 'weapon',
    count: 1,
    maxStack: 1,
    description: 'Razor-sharp combat blade.',
    icon: '🔪',
    usable: false,
    weaponType: 'knife'
  },
  item_bat: {
    id: 'item_bat',
    name: 'Baseball Bat',
    category: 'weapon',
    count: 1,
    maxStack: 1,
    description: 'Heavy wooden bat.',
    icon: '🏏',
    usable: false,
    weaponType: 'bat'
  },
  item_pistol: {
    id: 'item_pistol',
    name: '9mm Service Pistol',
    category: 'weapon',
    count: 1,
    maxStack: 1,
    description: 'Reliable sidearm.',
    icon: '🔫',
    usable: false,
    weaponType: 'pistol'
  },
  item_shotgun: {
    id: 'item_shotgun',
    name: 'Pump-Action Shotgun',
    category: 'weapon',
    count: 1,
    maxStack: 1,
    description: 'Close-quarters devastating firepower.',
    icon: '💥',
    usable: false,
    weaponType: 'shotgun'
  },
  item_rifle: {
    id: 'item_rifle',
    name: 'Assault Rifle M4',
    category: 'weapon',
    count: 1,
    maxStack: 1,
    description: 'Military assault rifle.',
    icon: '🎖️',
    usable: false,
    weaponType: 'rifle'
  },

  // Quest Keys
  hospital_keycard: {
    id: 'hospital_keycard',
    name: 'St. Jude Security Keycard',
    category: 'quest',
    count: 1,
    maxStack: 1,
    description: 'Magnetic keycard for hospital emergency exit doors.',
    icon: '💳',
    usable: false
  },
  police_car_keys: {
    id: 'police_car_keys',
    name: 'Patrol Car Trunk Key',
    category: 'quest',
    count: 1,
    maxStack: 1,
    description: 'Opens police vehicle trunk for armory cache.',
    icon: '🔑',
    usable: false
  },
  safehouse_key: {
    id: 'safehouse_key',
    name: 'Safehouse Deadbolt Key',
    category: 'quest',
    count: 1,
    maxStack: 1,
    description: 'Unlocks the reinforced district safehouse.',
    icon: '🗝️',
    usable: false
  }
};
