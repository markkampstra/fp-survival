import { events } from '../core/event-bus';
import type { PlayerState } from '../player/player-state';

// For hunger/thirst: bar fills up as the stat increases (bad).
// For health/stamina: bar empties as the stat decreases (bad).
const BAR_CONFIGS: Record<string, { color: string; inverted: boolean; label: string }> = {
  health:  { color: '#e74c3c', inverted: false, label: 'HEALTH' },
  hunger:  { color: '#e67e22', inverted: true,  label: 'HUNGER' },
  thirst:  { color: '#3498db', inverted: true,  label: 'THIRST' },
  stamina: { color: '#f1c40f', inverted: false, label: 'STAMINA' },
};

export class StatusBars {
  private bars: Record<string, HTMLDivElement> = {};
  private container: HTMLDivElement;

  constructor(private playerState: PlayerState) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed; bottom: 20px; left: 20px;
      display: flex; flex-direction: column; gap: 4px;
      z-index: 10; pointer-events: none;
    `;

    for (const stat of ['health', 'hunger', 'thirst', 'stamina']) {
      const cfg = BAR_CONFIGS[stat];
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 6px;';

      const label = document.createElement('div');
      label.style.cssText = `
        font-family: monospace; font-size: 11px; color: #fff;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        width: 55px;
      `;
      label.textContent = cfg.label;

      const track = document.createElement('div');
      track.style.cssText = `
        width: 120px; height: 10px;
        background: rgba(0,0,0,0.5); border-radius: 3px;
        overflow: hidden;
      `;

      const value = this.playerState[stat as keyof PlayerState] as number;
      const pct = cfg.inverted ? value : (100 - value);

      const fill = document.createElement('div');
      fill.style.cssText = `
        height: 100%; border-radius: 3px;
        background: ${cfg.color};
        transition: width 0.3s ease;
        width: ${cfg.inverted ? value : value}%;
      `;

      track.appendChild(fill);
      row.appendChild(label);
      row.appendChild(track);
      this.container.appendChild(row);
      this.bars[stat] = fill;
    }

    document.body.appendChild(this.container);

    events.on('player:stat-changed', (stat: string, _old: number, value: number) => {
      const bar = this.bars[stat];
      const cfg = BAR_CONFIGS[stat];
      if (!bar || !cfg) return;

      // For health/stamina: width = value (full = good)
      // For hunger/thirst: width = value (filling up = bad)
      const pct = value;
      bar.style.width = `${pct}%`;

      // Pulse when in danger
      const isDangerous = cfg.inverted ? pct > 80 : pct < 20;
      bar.style.animation = isDangerous ? 'pulse 0.5s infinite alternate' : '';
    });

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        from { opacity: 1; }
        to { opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }
}
