import { CraftingRecipe } from '@/shared/types';

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'craft_bandage',
    name: 'Craft Sterile Bandage',
    resultItemId: 'bandage',
    resultCount: 1,
    ingredients: [
      { itemId: 'cloth', count: 2 }
    ],
    description: 'Bind sterile cloth to halt bleeding.'
  },
  {
    id: 'craft_medkit',
    name: 'Craft Military Medkit',
    resultItemId: 'medkit',
    resultCount: 1,
    ingredients: [
      { itemId: 'cloth', count: 2 },
      { itemId: 'alcohol', count: 1 }
    ],
    description: 'Combine sterile bandages and antiseptic alcohol.'
  },
  {
    id: 'craft_ammo_9mm',
    name: 'Improvise 9mm Rounds',
    resultItemId: 'ammo_9mm',
    resultCount: 12,
    ingredients: [
      { itemId: 'scrap_metal', count: 3 }
    ],
    description: 'Cast metal scraps into makeshift pistol bullets.'
  }
];
