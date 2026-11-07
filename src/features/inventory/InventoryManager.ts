import { InventoryItem } from '@/shared/types';
import { ITEM_CATALOG } from '@/data/items';
import { EventBus } from '@/core/events/EventBus';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { Logger } from '@/core/utils/Logger';

export class InventoryManager {
  private items: InventoryItem[] = [];
  private maxSlots: number = 16;
  private eventBus: EventBus;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public getItems(): InventoryItem[] {
    return [...this.items];
  }

  public setItems(items: InventoryItem[]): void {
    this.items = [...items];
    this.syncToStore();
  }

  public addItem(catalogId: string, count: number = 1): boolean {
    const template = ITEM_CATALOG[catalogId];
    if (!template) {
      Logger.warn(`Item catalog ID "${catalogId}" not found.`);
      return false;
    }

    // Check if item is stackable and already exists in inventory
    const existing = this.items.find((i) => i.id === catalogId && i.count < i.maxStack);
    if (existing) {
      const space = existing.maxStack - existing.count;
      const addAmount = Math.min(space, count);
      existing.count += addAmount;
      const remainder = count - addAmount;

      this.eventBus.emit('item:collected', { item: { ...existing } });
      this.syncToStore();

      if (remainder > 0) {
        return this.addItem(catalogId, remainder);
      }
      return true;
    }

    // Check available slot capacity
    if (this.items.length >= this.maxSlots) {
      Logger.warn('Inventory is full!');
      return false;
    }

    const newItem: InventoryItem = {
      ...template,
      count: Math.min(count, template.maxStack)
    };
    this.items.push(newItem);
    this.eventBus.emit('item:collected', { item: newItem });
    this.syncToStore();

    const remainder = count - newItem.count;
    if (remainder > 0) {
      return this.addItem(catalogId, remainder);
    }
    return true;
  }

  public removeItem(itemId: string, count: number = 1): boolean {
    const idx = this.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;

    const item = this.items[idx];
    if (item.count > count) {
      item.count -= count;
    } else {
      this.items.splice(idx, 1);
    }

    this.syncToStore();
    return true;
  }

  public hasItem(itemId: string, minCount: number = 1): boolean {
    const total = this.items
      .filter((i) => i.id === itemId)
      .reduce((sum, cur) => sum + cur.count, 0);
    return total >= minCount;
  }

  public getItemCount(itemId: string): number {
    return this.items
      .filter((i) => i.id === itemId)
      .reduce((sum, cur) => sum + cur.count, 0);
  }

  public syncToStore(): void {
    useGameUIStore.getState().setInventoryItems([...this.items]);
    this.eventBus.emit('inventory:updated', { items: [...this.items] });
  }
}
