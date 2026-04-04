import { events } from '../core/event-bus';
import { RECIPES, type Recipe } from '../data/recipes';
import type { Inventory } from './inventory';

export class CraftingSystem {
  constructor(private inventory: Inventory) {}

  getRecipes(): Recipe[] {
    return RECIPES;
  }

  canCraft(recipe: Recipe): boolean {
    return recipe.ingredients.every(
      ing => this.inventory.hasItem(ing.itemId, ing.quantity)
    );
  }

  craft(recipe: Recipe): boolean {
    if (!this.canCraft(recipe)) return false;

    for (const ing of recipe.ingredients) {
      this.inventory.removeItem(ing.itemId, ing.quantity);
    }

    const leftover = this.inventory.addItem(recipe.result.itemId, recipe.result.quantity);
    if (leftover > 0) {
      // Inventory full — items lost. Could drop on ground instead.
      events.emit('crafting:inventory-full');
    }

    events.emit('crafting:crafted', recipe.id);
    return true;
  }
}
