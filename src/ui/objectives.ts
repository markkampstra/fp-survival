import { events } from '../core/event-bus';
import type { Inventory } from '../systems/inventory';
import type { DayCycle } from '../systems/day-cycle';

interface Objective {
  text: string;
  check: () => boolean;
}

export class ObjectiveTracker {
  private completedIndex = 0;
  private objectives: Objective[];
  private element: HTMLDivElement;
  private textEl: HTMLDivElement;
  private flashTimer = 0;

  constructor(
    private inventory: Inventory,
    private dayCycle: DayCycle,
  ) {
    this.objectives = [
      { text: 'Collect 5 sticks', check: () => inventory.countItem('stick') >= 5 },
      { text: 'Collect 5 stones', check: () => inventory.countItem('stone') >= 5 },
      { text: 'Craft a Stone Axe', check: () => inventory.hasItem('stone_axe') },
      { text: 'Craft a Campfire', check: () => inventory.hasItem('campfire_item') },
      { text: 'Build a Shelter', check: () => inventory.hasItem('shelter_item') || this.checkPlaced('shelter') },
      { text: 'Survive the first night', check: () => dayCycle.getDay() >= 2 },
      { text: 'Craft Hide Armor', check: () => inventory.hasItem('hide_armor') },
      { text: 'Craft a Bow', check: () => inventory.hasItem('bow') },
      { text: 'Survive to Day 5', check: () => dayCycle.getDay() >= 5 },
    ];

    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed; top: 35px; left: 10px;
      font-family: sans-serif; font-size: 12px;
      color: rgba(255,255,255,0.7);
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      pointer-events: none; z-index: 10;
      transition: color 0.3s ease;
    `;

    this.textEl = document.createElement('div');
    this.element.appendChild(this.textEl);
    document.body.appendChild(this.element);

    this.render();

    // Check progress on relevant events
    events.on('inventory:changed', () => this.checkProgress());
    events.on('crafting:crafted', () => this.checkProgress());
    events.on('placeable:placed', () => this.checkProgress());
    events.on('daycycle:phase-changed', () => this.checkProgress());
  }

  private placedTypes = new Set<string>();

  private checkPlaced(type: string): boolean {
    return this.placedTypes.has(type);
  }

  private checkProgress() {
    if (this.completedIndex >= this.objectives.length) return;

    const obj = this.objectives[this.completedIndex];
    if (obj.check()) {
      this.completedIndex++;
      this.flashTimer = 1;
      events.emit('notification', `Objective complete: ${obj.text}`);
      this.render();
    }
  }

  private render() {
    if (this.completedIndex >= this.objectives.length) {
      this.textEl.innerHTML = '<span style="color: #2ecc71;">All objectives complete!</span>';
      return;
    }

    const obj = this.objectives[this.completedIndex];
    this.textEl.innerHTML = `<span style="opacity: 0.5;">Objective:</span> ${obj.text}`;
  }

  // Track placed objects
  listenPlaceables() {
    events.on('placeable:placed', (id: string) => {
      this.placedTypes.add(id);
    });
  }

  getCompletedIndex(): number {
    return this.completedIndex;
  }

  setCompletedIndex(idx: number) {
    this.completedIndex = idx;
    this.render();
  }
}
