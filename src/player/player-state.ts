import { events } from '../core/event-bus';

// Game day = 600 seconds (10 real minutes)
const DAY = 600;

// Hunger/thirst go 0→100 (0 = satisfied, 100 = starving/dehydrated)
// Without water: die in ~3 days. Thirst reaches 100 in ~2 days, health damage over ~1 day.
// Without food: die in ~20 days. Hunger reaches 100 in ~15 days, health damage over ~5 days.

const THIRST_RATE = 100 / (2 * DAY);   // ~0.083/s → full in 2 days
const HUNGER_RATE = 100 / (15 * DAY);  // ~0.011/s → full in 15 days

// Health damage at critical levels (>90)
const THIRST_DAMAGE_RATE = 100 / (1 * DAY);   // kills in 1 day once critical
const HUNGER_DAMAGE_RATE = 100 / (5 * DAY);   // kills in 5 days once critical

// Stamina
const STAMINA_SPRINT_DRAIN = 15;   // per second while sprinting
const STAMINA_BASE_REGEN = 8;      // per second at rest, fully fed/hydrated

// Health natural regen (when well fed and hydrated)
const HEALTH_REGEN_RATE = 0.5;     // per second, only when hunger < 30 AND thirst < 30

export class PlayerState {
  health = 100;
  hunger = 0;   // 0 = full, 100 = starving
  thirst = 0;   // 0 = hydrated, 100 = dehydrated
  stamina = 100;
  dead = false;

  _godMode = false;

  update(dt: number, isSprinting: boolean) {
    if (this.dead) return;
    if (this._godMode) return;

    // Hunger and thirst increase over time
    this.modifyStat('hunger', HUNGER_RATE * dt);
    this.modifyStat('thirst', THIRST_RATE * dt);

    // --- Stamina ---
    // Effective stamina regen is reduced by hunger/thirst
    const hungerPenalty = this.hunger > 50 ? (this.hunger - 50) / 50 : 0;   // 0-1
    const thirstPenalty = this.thirst > 50 ? (this.thirst - 50) / 50 : 0;   // 0-1
    const regenMultiplier = Math.max(0.1, (1 - hungerPenalty * 0.5 - thirstPenalty * 0.5) * this.temperatureMultiplier);

    if (isSprinting && this.stamina > 0) {
      this.modifyStat('stamina', -STAMINA_SPRINT_DRAIN * dt);
    } else if (!isSprinting) {
      this.modifyStat('stamina', STAMINA_BASE_REGEN * regenMultiplier * dt);
    }

    // Max effective stamina reduced when very hungry/thirsty
    const maxStamina = Math.max(10, 100 - hungerPenalty * 30 - thirstPenalty * 30);
    if (this.stamina > maxStamina) {
      this.modifyStat('stamina', -dt * 5); // slowly drain to cap
    }

    // --- Health damage only at critical levels (>90) ---
    if (this.thirst > 90) {
      const severity = (this.thirst - 90) / 10; // 0-1
      this.modifyStat('health', -THIRST_DAMAGE_RATE * severity * dt);
    }
    if (this.hunger > 90) {
      const severity = (this.hunger - 90) / 10; // 0-1
      this.modifyStat('health', -HUNGER_DAMAGE_RATE * severity * dt);
    }

    // --- Health regen when well nourished ---
    if (this.hunger < 30 && this.thirst < 30 && this.health < 100) {
      this.modifyStat('health', HEALTH_REGEN_RATE * dt);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      events.emit('player:died');
    }
  }

  /** Advance hunger/thirst by a duration without health damage (for sleeping) */
  advanceTime(dt: number) {
    this.modifyStat('hunger', HUNGER_RATE * dt);
    this.modifyStat('thirst', THIRST_RATE * dt);
  }

  temperatureMultiplier = 1.0;

  modifyStat(stat: 'health' | 'hunger' | 'thirst' | 'stamina', amount: number) {
    const old = this[stat];
    this[stat] = Math.max(0, Math.min(100, this[stat] + amount));
    if (this[stat] !== old) {
      events.emit('player:stat-changed', stat, old, this[stat]);
    }
  }

  getMax(_stat: string): number {
    return 100;
  }

  serialize() {
    return { health: this.health, hunger: this.hunger, thirst: this.thirst, stamina: this.stamina };
  }

  deserialize(data: { health: number; hunger: number; thirst: number; stamina: number }) {
    this.health = data.health;
    this.hunger = data.hunger;
    this.thirst = data.thirst;
    this.stamina = data.stamina;
    for (const stat of ['health', 'hunger', 'thirst', 'stamina'] as const) {
      events.emit('player:stat-changed', stat, 0, this[stat]);
    }
  }
}
