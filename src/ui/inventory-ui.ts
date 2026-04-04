import { events } from '../core/event-bus';
import { ITEMS } from '../data/items';
import { createItemIcon } from './item-icon';
import type { Inventory } from '../systems/inventory';
import type { PlayerState } from '../player/player-state';

const COLS = 6;

export class InventoryUI {
  private container: HTMLDivElement;
  private hotbar: HTMLDivElement;
  private grid: HTMLDivElement;
  private visible = false;
  private selectedSlot: number | null = null;
  private equippedHotbarSlot = -1;

  constructor(
    private inventory: Inventory,
    private playerState: PlayerState,
  ) {
    // Full inventory overlay (toggled with Tab)
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.85);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 16px;
      z-index: 30;
      display: none;
      user-select: none;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'color: #fff; font-family: sans-serif; font-size: 16px; margin-bottom: 10px; text-align: center;';
    title.textContent = 'Inventory';
    this.container.appendChild(title);

    this.grid = document.createElement('div');
    this.grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${COLS}, 52px);
      gap: 4px;
    `;
    this.container.appendChild(this.grid);
    document.body.appendChild(this.container);

    // Hotbar (always visible at bottom)
    this.hotbar = document.createElement('div');
    this.hotbar.style.cssText = `
      position: fixed; bottom: 20px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 4px;
      z-index: 10;
      pointer-events: none;
    `;
    document.body.appendChild(this.hotbar);

    this.render();

    events.on('inventory:changed', () => this.render());

    // Key handlers
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.toggle();
      }
      if (e.code === 'Escape' && this.visible) {
        this.toggle();
      }
      // Hotbar keys 1-6
      const hotkey = parseInt(e.key);
      if (hotkey >= 1 && hotkey <= 6 && !this.visible) {
        const slotIdx = hotkey - 1;
        if (this.equippedHotbarSlot === slotIdx) {
          this.equippedHotbarSlot = -1;
          events.emit('hotbar:unequip');
        } else {
          this.equippedHotbarSlot = slotIdx;
          events.emit('hotbar:equip', slotIdx);
        }
        this.renderHotbar();
      }
    });

    // Right-click context on inventory slots
    this.grid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement | null;
      if (!target) return;
      const idx = parseInt(target.dataset.slot!);
      this.handleContextAction(idx);
    });

    // Click to select/swap in full inventory
    this.grid.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement | null;
      if (!target) return;
      const idx = parseInt(target.dataset.slot!);
      this.handleClick(idx);
    });
  }

  private toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
    this.selectedSlot = null;
    events.emit(this.visible ? 'inventory:opened' : 'inventory:closed');
    this.render();
  }

  isOpen(): boolean {
    return this.visible;
  }

  getEquippedHotbarSlot(): number {
    return this.equippedHotbarSlot;
  }

  private handleClick(idx: number) {
    if (this.selectedSlot === null) {
      if (this.inventory.getSlot(idx).itemId) {
        this.selectedSlot = idx;
        this.render();
      }
    } else {
      this.inventory.swapSlots(this.selectedSlot, idx);
      this.selectedSlot = null;
      this.render();
    }
  }

  /** Consume a food/drink item from the given slot index */
  consumeSlot(idx: number): boolean {
    const slot = this.inventory.getSlot(idx);
    if (!slot.itemId) return false;
    const def = ITEMS[slot.itemId];
    if (def.category !== 'food') return false;

    if (def.foodValue) this.playerState.modifyStat('hunger', -def.foodValue);
    if (def.waterValue) this.playerState.modifyStat('thirst', -def.waterValue);
    events.emit('notification', `Consumed ${def.name}`);

    // Eating a coconut yields a coconut shell
    const itemId = slot.itemId;
    slot.quantity--;
    if (slot.quantity <= 0) {
      slot.itemId = null;
      slot.quantity = 0;
    }
    if (itemId === 'coconut' || itemId === 'cooked_coconut') {
      this.inventory.addItem('coconut_shell', 1);
    }

    events.emit('inventory:changed');
    return true;
  }

  private handleContextAction(idx: number) {
    this.consumeSlot(idx);
  }

  private render() {
    this.renderGrid();
    this.renderHotbar();
  }

  private renderGrid() {
    this.grid.innerHTML = '';
    for (let i = 0; i < this.inventory.size; i++) {
      const slot = this.inventory.getSlot(i);
      const el = document.createElement('div');
      const isSelected = this.selectedSlot === i;
      el.style.cssText = `
        width: 52px; height: 52px;
        background: rgba(255,255,255,${isSelected ? 0.2 : 0.08});
        border: 1px solid rgba(255,255,255,${isSelected ? 0.6 : 0.15});
        border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        position: relative; cursor: pointer;
        font-size: 24px;
      `;
      el.dataset.slot = String(i);

      if (slot.itemId) {
        const def = ITEMS[slot.itemId];
        if (def) {
          el.appendChild(createItemIcon(def, 32));
        }
        if (slot.quantity > 1) {
          const badge = document.createElement('div');
          badge.style.cssText = `
            position: absolute; bottom: 2px; right: 2px;
            font-size: 10px; color: #fff; font-family: monospace;
            text-shadow: 1px 1px 1px rgba(0,0,0,0.8);
          `;
          badge.textContent = String(slot.quantity);
          el.appendChild(badge);
        }
        if (slot.durability !== undefined && def) {
          const maxDur = def.maxDurability ?? 50;
          const pct = (slot.durability / maxDur) * 100;
          const durBar = document.createElement('div');
          durBar.style.cssText = `
            position: absolute; bottom: 0; left: 2px; right: 2px;
            height: 3px; background: rgba(0,0,0,0.5); border-radius: 1px;
          `;
          const durFill = document.createElement('div');
          durFill.style.cssText = `
            height: 100%; width: ${pct}%;
            background: ${pct > 30 ? '#2ecc71' : '#e74c3c'};
            border-radius: 1px;
          `;
          durBar.appendChild(durFill);
          el.appendChild(durBar);
        }
      }

      this.grid.appendChild(el);
    }
  }

  private renderHotbar() {
    this.hotbar.innerHTML = '';
    for (let i = 0; i < COLS; i++) {
      const slot = this.inventory.getSlot(i);
      const isEquipped = this.equippedHotbarSlot === i;
      const el = document.createElement('div');
      el.style.cssText = `
        width: 48px; height: 48px;
        background: rgba(0,0,0,${isEquipped ? 0.8 : 0.5});
        border: 2px solid ${isEquipped ? '#f1c40f' : 'rgba(255,255,255,0.2)'};
        border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        position: relative;
        font-size: 22px;
      `;

      if (slot.itemId) {
        const def = ITEMS[slot.itemId];
        if (def) {
          el.appendChild(createItemIcon(def, 28));
        }
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

      // Key number indicator
      const keyLabel = document.createElement('div');
      keyLabel.style.cssText = `
        position: absolute; top: 1px; left: 3px;
        font-size: 9px; color: rgba(255,255,255,0.4); font-family: monospace;
      `;
      keyLabel.textContent = String(i + 1);
      el.appendChild(keyLabel);

      this.hotbar.appendChild(el);
    }
  }
}
