import { events } from '../core/event-bus';
import { ITEMS } from '../data/items';
import { createItemIcon } from './item-icon';
import type { CraftingSystem } from '../systems/crafting';
import type { Inventory } from '../systems/inventory';

export class CraftingUI {
  private container: HTMLDivElement;
  private list: HTMLDivElement;
  private visible = false;

  constructor(
    private crafting: CraftingSystem,
    private inventory: Inventory,
  ) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed; top: 50%; left: 20px;
      transform: translateY(-50%);
      width: 260px;
      max-height: 70vh;
      background: rgba(0,0,0,0.85);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 12px;
      z-index: 30;
      display: none;
      overflow-y: auto;
      user-select: none;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'color: #fff; font-family: sans-serif; font-size: 16px; margin-bottom: 10px;';
    title.textContent = 'Crafting';
    this.container.appendChild(title);

    this.list = document.createElement('div');
    this.list.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    this.container.appendChild(this.list);

    document.body.appendChild(this.container);

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC' && !this.isInputFocused()) {
        e.preventDefault();
        this.toggle();
      }
      if (e.code === 'Escape' && this.visible) {
        this.toggle();
      }
    });

    events.on('inventory:changed', () => {
      if (this.visible) this.render();
    });

    events.on('crafting:crafted', () => {
      if (this.visible) this.render();
    });
  }

  private isInputFocused(): boolean {
    const el = document.activeElement;
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  }

  private toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
    events.emit(this.visible ? 'crafting:opened' : 'crafting:closed');
    if (this.visible) this.render();
  }

  isOpen(): boolean {
    return this.visible;
  }

  private render() {
    this.list.innerHTML = '';
    const recipes = this.crafting.getRecipes();

    for (const recipe of recipes) {
      const canCraft = this.crafting.canCraft(recipe);
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex; align-items: center; gap: 8px;
        padding: 8px;
        background: rgba(255,255,255,0.05);
        border-radius: 4px;
        opacity: ${canCraft ? 1 : 0.5};
      `;

      // Result icon
      const resultDef = ITEMS[recipe.result.itemId];
      if (resultDef) {
        row.appendChild(createItemIcon(resultDef, 32));
      }

      // Info
      const info = document.createElement('div');
      info.style.cssText = 'flex: 1; font-family: sans-serif; font-size: 12px; color: #fff;';

      const name = document.createElement('div');
      name.style.cssText = 'font-weight: bold; margin-bottom: 2px;';
      name.textContent = recipe.name;
      info.appendChild(name);

      const ings = document.createElement('div');
      ings.style.cssText = 'font-size: 10px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap;';
      for (const ing of recipe.ingredients) {
        const def = ITEMS[ing.itemId];
        const have = this.inventory.countItem(ing.itemId);
        const ok = have >= ing.quantity;
        const span = document.createElement('span');
        span.style.cssText = `
          display: inline-flex; align-items: center; gap: 2px;
          color: ${ok ? '#2ecc71' : '#e74c3c'};
        `;
        if (def) {
          const mini = createItemIcon(def, 14);
          span.appendChild(mini);
        }
        const txt = document.createElement('span');
        txt.textContent = `${have}/${ing.quantity}`;
        span.appendChild(txt);
        ings.appendChild(span);
      }
      info.appendChild(ings);
      row.appendChild(info);

      // Craft button
      const btn = document.createElement('button');
      btn.style.cssText = `
        padding: 4px 10px;
        background: ${canCraft ? '#2ecc71' : '#555'};
        border: none; border-radius: 3px;
        color: #fff; font-size: 11px;
        cursor: ${canCraft ? 'pointer' : 'default'};
        font-family: sans-serif;
      `;
      btn.textContent = 'Craft';
      btn.disabled = !canCraft;
      if (canCraft) {
        btn.addEventListener('click', () => {
          this.crafting.craft(recipe);
        });
      }
      row.appendChild(btn);

      this.list.appendChild(row);
    }
  }
}
