import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryManager } from '@/features/inventory/InventoryManager';

describe('InventoryManager', () => {
  let inventory: InventoryManager;

  beforeEach(() => {
    inventory = new InventoryManager();
  });

  it('adds items and handles stacking', () => {
    expect(inventory.addItem('bandage', 2)).toBe(true);
    expect(inventory.getItemCount('bandage')).toBe(2);

    expect(inventory.addItem('bandage', 2)).toBe(true);
    expect(inventory.getItemCount('bandage')).toBe(4);
  });

  it('correctly reports hasItem and removes items', () => {
    inventory.addItem('scrap_metal', 5);
    expect(inventory.hasItem('scrap_metal', 3)).toBe(true);
    expect(inventory.hasItem('scrap_metal', 6)).toBe(false);

    inventory.removeItem('scrap_metal', 2);
    expect(inventory.getItemCount('scrap_metal')).toBe(3);
  });

  it('respects inventory capacity limit', () => {
    // Add 16 different unstackable or full items
    for (let i = 0; i < 16; i++) {
      inventory.addItem('item_knife', 1);
    }
    // 17th item should fail
    const added = inventory.addItem('clean_water', 1);
    expect(added).toBe(false);
  });
});
