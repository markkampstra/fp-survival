import { events } from '../core/event-bus';
import { ITEMS } from '../data/items';
import { createItemIcon } from './item-icon';
import type { Inventory } from '../systems/inventory';

export class StorageUI {
  private container: HTMLDivElement;
  private playerGrid: HTMLDivElement;
  private storageGrid: HTMLDivElement;
  private visible = false;
  private storageInv: Inventory | null = null;
  private selectedSlot: { source: 'player' | 'storage'; index: number } | null = null;

  constructor(private playerInventory: Inventory) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.85);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px; padding: 16px;
      z-index: 30; display: none; user-select: none;
    `;

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 20px;';

    // Player inventory side
    const playerSide = document.createElement('div');
    const pTitle = document.createElement('div');
    pTitle.style.cssText = 'color: #fff; font-family: sans-serif; font-size: 13px; margin-bottom: 8px; text-align: center;';
    pTitle.textContent = 'Inventory';
    playerSide.appendChild(pTitle);
    this.playerGrid = document.createElement('div');
    this.playerGrid.style.cssText = 'display: grid; grid-template-columns: repeat(6, 48px); gap: 3px;';
    playerSide.appendChild(this.playerGrid);

    // Storage side
    const storageSide = document.createElement('div');
    const sTitle = document.createElement('div');
    sTitle.style.cssText = 'color: #fff; font-family: sans-serif; font-size: 13px; margin-bottom: 8px; text-align: center;';
    sTitle.textContent = 'Storage';
    storageSide.appendChild(sTitle);
    this.storageGrid = document.createElement('div');
    this.storageGrid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 48px); gap: 3px;';
    storageSide.appendChild(this.storageGrid);

    row.appendChild(playerSide);
    row.appendChild(storageSide);
    this.container.appendChild(row);
    document.body.appendChild(this.container);

    events.on('storage:open', (inv: Inventory) => {
      this.storageInv = inv;
      this.open();
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) this.close();
    });
  }

  private open() {
    this.visible = true;
    this.selectedSlot = null;
    this.container.style.display = 'block';
    events.emit('storage:opened');
    this.render();
  }

  private close() {
    this.visible = false;
    this.container.style.display = 'none';
    this.storageInv = null;
    events.emit('storage:closed');
  }

  private render() {
    this.renderGrid(this.playerGrid, this.playerInventory, 'player');
    if (this.storageInv) {
      this.renderGrid(this.storageGrid, this.storageInv, 'storage');
    }
  }

  private renderGrid(grid: HTMLDivElement, inv: Inventory, source: 'player' | 'storage') {
    grid.innerHTML = '';
    for (let i = 0; i < inv.size; i++) {
      const slot = inv.getSlot(i);
      const isSelected = this.selectedSlot?.source === source && this.selectedSlot.index === i;
      const el = document.createElement('div');
      el.style.cssText = `
        width: 48px; height: 48px;
        background: rgba(255,255,255,${isSelected ? 0.2 : 0.08});
        border: 1px solid rgba(255,255,255,${isSelected ? 0.6 : 0.15});
        border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        position: relative; cursor: pointer;
      `;

      if (slot.itemId) {
        const def = ITEMS[slot.itemId];
        if (def) el.appendChild(createItemIcon(def, 28));
        if (slot.quantity > 1) {
          const badge = document.createElement('div');
          badge.style.cssText = `
            position: absolute; bottom: 1px; right: 3px;
            font-size: 10px; color: #fff; font-family: monospace;
            text-shadow: 1px 1px 1px rgba(0,0,0,0.8);
          `;
          badge.textContent = String(slot.quantity);
          el.appendChild(badge);
        }
      }

      el.addEventListener('click', () => this.handleClick(source, i));
      grid.appendChild(el);
    }
  }

  private handleClick(source: 'player' | 'storage', index: number) {
    if (!this.storageInv) return;

    if (!this.selectedSlot) {
      const inv = source === 'player' ? this.playerInventory : this.storageInv;
      if (inv.getSlot(index).itemId) {
        this.selectedSlot = { source, index };
        this.render();
      }
    } else {
      const fromInv = this.selectedSlot.source === 'player' ? this.playerInventory : this.storageInv;
      const toInv = source === 'player' ? this.playerInventory : this.storageInv;

      if (this.selectedSlot.source === source) {
        // Same inventory — swap
        fromInv.swapSlots(this.selectedSlot.index, index);
      } else {
        // Different inventories — transfer
        const fromSlot = fromInv.getSlot(this.selectedSlot.index);
        if (fromSlot.itemId) {
          const leftover = toInv.addItem(fromSlot.itemId, fromSlot.quantity);
          const moved = fromSlot.quantity - leftover;
          if (moved > 0) {
            fromInv.removeItem(fromSlot.itemId, moved);
          }
        }
      }

      this.selectedSlot = null;
      this.render();
    }
  }
}
