import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryManager } from '@/features/inventory/InventoryManager';
import { CraftingManager } from '@/features/crafting/CraftingManager';

describe('CraftingManager', () => {
  let inventory: InventoryManager;
  let crafting: CraftingManager;

  beforeEach(() => {
    inventory = new InventoryManager();
    crafting = new CraftingManager(inventory);
  });

  it('detects missing ingredients', () => {
    // craft_bandage requires 2 cloth
    inventory.addItem('cloth', 1);
    expect(crafting.canCraft('craft_bandage')).toBe(false);
  });

  it('crafts item and consumes exact ingredient count', () => {
    inventory.addItem('cloth', 3);
    expect(crafting.canCraft('craft_bandage')).toBe(true);

    const success = crafting.craft('craft_bandage');
    expect(success).toBe(true);
    expect(inventory.getItemCount('cloth')).toBe(1); // 3 - 2 = 1
    expect(inventory.getItemCount('bandage')).toBe(1);
  });
});
