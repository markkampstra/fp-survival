import { events } from '../core/event-bus';
import { ITEMS } from '../data/items';
import type { Inventory } from './inventory';

export class ArmorSystem {
  private equippedSlot = -1;

  constructor(private inventory: Inventory) {
    // Intercept damage — reduce by armor value
    events.on('player:take-damage', (_amount: number) => {
      // This runs after PlayerState's listener, but we need to intercept BEFORE.
      // Use a pre-damage event pattern instead.
    });

    // Equip armor from hotbar
    events.on('hotbar:equip', (slotIdx: number) => {
      const slot = this.inventory.getSlot(slotIdx);
      if (slot.itemId && ITEMS[slot.itemId]?.category === 'armor') {
        this.equippedSlot = slotIdx;
      }
    });

    events.on('hotbar:unequip', () => {
      this.equippedSlot = -1;
    });

    events.on('inventory:changed', () => {
      if (this.equippedSlot >= 0) {
        const slot = this.inventory.getSlot(this.equippedSlot);
        if (!slot.itemId || ITEMS[slot.itemId]?.category !== 'armor') {
          this.equippedSlot = -1;
        }
      }
    });
  }

  /** Call before applying damage to get reduced amount */
  reduceDamage(amount: number): number {
    if (this.equippedSlot < 0) return amount;
    const slot = this.inventory.getSlot(this.equippedSlot);
    if (!slot.itemId) return amount;
    const def = ITEMS[slot.itemId];
    if (!def?.armorValue) return amount;

    const reduction = Math.min(amount, def.armorValue);
    const reduced = amount - reduction;

    // Damage armor durability
    this.inventory.damageTool(this.equippedSlot, 2);

    return Math.max(1, reduced); // always take at least 1 damage
  }

  getArmorValue(): number {
    if (this.equippedSlot < 0) return 0;
    const slot = this.inventory.getSlot(this.equippedSlot);
    if (!slot.itemId) return 0;
    return ITEMS[slot.itemId]?.armorValue ?? 0;
  }

  getDurability(): number | null {
    if (this.equippedSlot < 0) return null;
    const slot = this.inventory.getSlot(this.equippedSlot);
    return slot.durability ?? null;
  }
}
