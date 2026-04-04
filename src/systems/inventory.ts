import { events } from '../core/event-bus';
import { ITEMS } from '../data/items';

export interface InventorySlot {
  itemId: string | null;
  quantity: number;
  durability?: number;
}

export class Inventory {
  readonly slots: InventorySlot[];
  readonly size: number;

  constructor(size = 24) {
    this.size = size;
    this.slots = Array.from({ length: size }, () => ({ itemId: null, quantity: 0 }));
  }

  addItem(itemId: string, quantity = 1): number {
    const def = ITEMS[itemId];
    if (!def) return quantity;
    let remaining = quantity;

    // First, try to stack into existing slots
    for (const slot of this.slots) {
      if (remaining <= 0) break;
      if (slot.itemId === itemId && slot.quantity < def.stackSize) {
        const canAdd = Math.min(remaining, def.stackSize - slot.quantity);
        slot.quantity += canAdd;
        remaining -= canAdd;
        events.emit('inventory:changed');
      }
    }

    // Then fill empty slots
    for (const slot of this.slots) {
      if (remaining <= 0) break;
      if (slot.itemId === null) {
        const canAdd = Math.min(remaining, def.stackSize);
        slot.itemId = itemId;
        slot.quantity = canAdd;
        if (def.maxDurability) {
          slot.durability = def.maxDurability;
        }
        remaining -= canAdd;
        events.emit('inventory:changed');
      }
    }

    return remaining; // leftover that didn't fit
  }

  removeItem(itemId: string, quantity = 1): boolean {
    if (this.countItem(itemId) < quantity) return false;
    let remaining = quantity;

    // Remove from last to first so hotbar empties last
    for (let i = this.slots.length - 1; i >= 0; i--) {
      if (remaining <= 0) break;
      const slot = this.slots[i];
      if (slot.itemId === itemId) {
        const remove = Math.min(remaining, slot.quantity);
        slot.quantity -= remove;
        remaining -= remove;
        if (slot.quantity <= 0) {
          slot.itemId = null;
          slot.quantity = 0;
          slot.durability = undefined;
        }
      }
    }

    events.emit('inventory:changed');
    return true;
  }

  hasItem(itemId: string, quantity = 1): boolean {
    return this.countItem(itemId) >= quantity;
  }

  countItem(itemId: string): number {
    return this.slots.reduce((sum, s) => sum + (s.itemId === itemId ? s.quantity : 0), 0);
  }

  swapSlots(a: number, b: number) {
    const tmp = { ...this.slots[a] };
    this.slots[a] = { ...this.slots[b] };
    this.slots[b] = tmp;
    events.emit('inventory:changed');
  }

  getSlot(index: number): InventorySlot {
    return this.slots[index];
  }

  damageTool(slotIndex: number, amount = 1): boolean {
    const slot = this.slots[slotIndex];
    if (slot.durability !== undefined) {
      slot.durability -= amount;
      events.emit('inventory:changed');
      if (slot.durability <= 0) {
        slot.itemId = null;
        slot.quantity = 0;
        slot.durability = undefined;
        events.emit('inventory:changed');
        events.emit('tool:broke');
        return true; // tool broke
      }
    }
    return false;
  }
}
