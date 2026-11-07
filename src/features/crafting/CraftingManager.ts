import { CraftingRecipe } from '@/shared/types';
import { CRAFTING_RECIPES } from '@/data/crafting';
import { InventoryManager } from '@/features/inventory/InventoryManager';
import { EventBus } from '@/core/events/EventBus';
import { useGameUIStore } from '@/ui/store/gameUIStore';

export class CraftingManager {
  private recipes: CraftingRecipe[] = CRAFTING_RECIPES;
  private inventory: InventoryManager;
  private eventBus: EventBus;

  constructor(inventory: InventoryManager) {
    this.inventory = inventory;
    this.eventBus = EventBus.getInstance();
    useGameUIStore.getState().setCraftingRecipes(this.recipes);
  }

  public getRecipes(): CraftingRecipe[] {
    return this.recipes;
  }

  public canCraft(recipeId: string): boolean {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe) return false;

    for (const ing of recipe.ingredients) {
      if (!this.inventory.hasItem(ing.itemId, ing.count)) {
        return false;
      }
    }
    return true;
  }

  public craft(recipeId: string): boolean {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe || !this.canCraft(recipeId)) return false;

    // Deduct ingredients
    for (const ing of recipe.ingredients) {
      this.inventory.removeItem(ing.itemId, ing.count);
    }

    // Add result
    this.inventory.addItem(recipe.resultItemId, recipe.resultCount);
    this.eventBus.emit('audio:play_sfx', { sound: 'pickup', volume: 0.8 });
    return true;
  }
}
