import { events } from '../core/event-bus';
import type { DayCycle } from '../systems/day-cycle';
import type { PlayerState } from '../player/player-state';
import type { Inventory } from '../systems/inventory';
import type { WeatherSystem } from '../systems/weather-system';
import { ITEMS } from '../data/items';

export class GameConsole {
  private element: HTMLDivElement;
  private input: HTMLInputElement;
  private output: HTMLDivElement;
  private visible = false;
  private history: string[] = [];
  private historyIdx = -1;

  constructor(
    private dayCycle: DayCycle,
    private playerState: PlayerState,
    private inventory: Inventory,
    private weatherSystem: WeatherSystem,
  ) {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed; bottom: 0; left: 0; width: 100%;
      background: rgba(0,0,0,0.85);
      font-family: monospace; font-size: 13px;
      z-index: 40; display: none;
      max-height: 40vh; overflow: hidden;
    `;

    this.output = document.createElement('div');
    this.output.style.cssText = `
      padding: 8px 12px; color: #aaa;
      max-height: 30vh; overflow-y: auto;
      white-space: pre-wrap;
    `;
    this.element.appendChild(this.output);

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; padding: 4px 8px; border-top: 1px solid rgba(255,255,255,0.1);';

    const prompt = document.createElement('span');
    prompt.style.cssText = 'color: #2ecc71; padding: 4px;';
    prompt.textContent = '> ';
    row.appendChild(prompt);

    this.input = document.createElement('input');
    this.input.style.cssText = `
      flex: 1; background: none; border: none; outline: none;
      color: #fff; font-family: monospace; font-size: 13px;
      padding: 4px;
    `;
    this.input.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        this.exec(this.input.value.trim());
        this.history.push(this.input.value.trim());
        this.historyIdx = this.history.length;
        this.input.value = '';
      } else if (e.code === 'ArrowUp') {
        if (this.historyIdx > 0) {
          this.historyIdx--;
          this.input.value = this.history[this.historyIdx];
        }
      } else if (e.code === 'ArrowDown') {
        if (this.historyIdx < this.history.length - 1) {
          this.historyIdx++;
          this.input.value = this.history[this.historyIdx];
        } else {
          this.historyIdx = this.history.length;
          this.input.value = '';
        }
      }
      e.stopPropagation(); // prevent game keys while typing
    });
    row.appendChild(this.input);
    this.element.appendChild(row);
    document.body.appendChild(this.element);

    // Toggle with backtick/tilde
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') {
        e.preventDefault();
        this.toggle();
      }
    });

    this.log('Type "help" for commands. Press ` to toggle console.');
  }

  private toggle() {
    this.visible = !this.visible;
    this.element.style.display = this.visible ? 'block' : 'none';
    if (this.visible) {
      this.input.focus();
      events.emit('console:opened');
    } else {
      events.emit('console:closed');
    }
  }

  private log(msg: string, color = '#aaa') {
    const line = document.createElement('div');
    line.style.color = color;
    line.textContent = msg;
    this.output.appendChild(line);
    this.output.scrollTop = this.output.scrollHeight;
  }

  private exec(cmd: string) {
    if (!cmd) return;
    this.log(`> ${cmd}`, '#fff');

    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        this.log([
          'Commands:',
          '  time <0-24>        Set time of day (e.g. time 0 = midnight, time 12 = noon)',
          '  setday <n>         Set game day (moon phase: 0/30=new, 15=full)',
          '  night              Set time to midnight',
          '  day                Set time to noon',
          '  dawn               Set time to dawn',
          '  dusk               Set time to dusk',
          '  rain [0-1]         Set rain intensity (0=off, 1=max)',
          '  weather <type>     clear|partly_cloudy|cloudy|overcast|rain|heavy_rain|storm',
          '  heal               Restore all stats',
          '  feed               Reset hunger and thirst',
          '  give <item> [qty]  Add item to inventory',
          '  items              List all item IDs',
          '  god                Toggle god mode (no stat drain)',
          '  pos                Show player position',
          '  tp <x> <z>        Teleport to coordinates',
          '  speed <n>          Set move speed',
          '  clear              Clear console',
        ].join('\n'), '#888');
        break;

      case 'time': {
        const hours = parseFloat(args[0]);
        if (isNaN(hours) || hours < 0 || hours > 24) {
          this.log('Usage: time <0-24>', '#e74c3c');
          break;
        }
        this.dayCycle.setTime(hours / 24);
        this.log(`Time set to ${hours}:00`, '#2ecc71');
        break;
      }

      case 'night':
        this.dayCycle.setTime(0);
        this.log('Time set to midnight', '#2ecc71');
        break;

      case 'day':
        this.dayCycle.setTime(0.5);
        this.log('Time set to noon', '#2ecc71');
        break;

      case 'dawn':
        this.dayCycle.setTime(0.25);
        this.log('Time set to dawn', '#2ecc71');
        break;

      case 'dusk':
        this.dayCycle.setTime(0.75);
        this.log('Time set to dusk', '#2ecc71');
        break;

      case 'setday': {
        const d = parseInt(args[0]);
        if (isNaN(d) || d < 1) {
          this.log('Usage: setday <number> (moon: 0/30=new, 8=first quarter, 15=full, 22=last quarter)', '#e74c3c');
          break;
        }
        (this.dayCycle as any).day = d;
        this.log(`Day set to ${d} (moon phase: ${((d % 30) / 30 * 100).toFixed(0)}%)`, '#2ecc71');
        break;
      }

      case 'rain': {
        const intensity = args[0] !== undefined ? parseFloat(args[0]) : 0.8;
        if (intensity <= 0) {
          this.weatherSystem.forceWeather('clear');
        } else if (intensity < 0.4) {
          this.weatherSystem.forceWeather('rain', intensity);
        } else if (intensity < 0.75) {
          this.weatherSystem.forceWeather('heavy_rain', intensity);
        } else {
          this.weatherSystem.forceWeather('storm', intensity);
        }
        this.log(`Rain ${intensity > 0 ? `on (${intensity})` : 'off'}`, '#2ecc71');
        break;
      }

      case 'weather': {
        const validTypes = ['clear', 'partly_cloudy', 'cloudy', 'overcast', 'rain', 'heavy_rain', 'storm'];
        const type = args[0];
        if (!type || !validTypes.includes(type)) {
          this.log(`Usage: weather <${validTypes.join('|')}>`, '#e74c3c');
          break;
        }
        this.weatherSystem.forceWeather(type as any);
        this.log(`Weather set to ${type}`, '#2ecc71');
        break;
      }

      case 'heal':
        this.playerState.modifyStat('health', 100);
        this.playerState.modifyStat('stamina', 100);
        this.playerState.modifyStat('hunger', -100);
        this.playerState.modifyStat('thirst', -100);
        this.log('All stats restored', '#2ecc71');
        break;

      case 'feed':
        this.playerState.modifyStat('hunger', -100);
        this.playerState.modifyStat('thirst', -100);
        this.log('Hunger and thirst reset', '#2ecc71');
        break;

      case 'give': {
        const itemId = args[0];
        const qty = parseInt(args[1]) || 1;
        if (!itemId || !ITEMS[itemId]) {
          this.log(`Unknown item "${itemId}". Use "items" to list.`, '#e74c3c');
          break;
        }
        const left = this.inventory.addItem(itemId, qty);
        this.log(`Added ${qty - left}x ${ITEMS[itemId].name}${left > 0 ? ` (${left} didn't fit)` : ''}`, '#2ecc71');
        break;
      }

      case 'items':
        this.log(Object.keys(ITEMS).join(', '), '#888');
        break;

      case 'god':
        // Toggle by setting rates to 0 — use a simple flag on playerState
        (this.playerState as any)._godMode = !(this.playerState as any)._godMode;
        const god = (this.playerState as any)._godMode;
        if (god) {
          this.playerState.modifyStat('health', 100);
          this.playerState.modifyStat('stamina', 100);
          this.playerState.modifyStat('hunger', -100);
          this.playerState.modifyStat('thirst', -100);
        }
        this.log(`God mode ${god ? 'ON' : 'OFF'}`, '#f1c40f');
        break;

      case 'pos': {
        const p = (this as any).camera?.position;
        // We don't have camera here, use events
        this.log('Check HUD for coordinates', '#888');
        break;
      }

      case 'tp': {
        const x = parseFloat(args[0]);
        const z = parseFloat(args[1]);
        if (isNaN(x) || isNaN(z)) {
          this.log('Usage: tp <x> <z>', '#e74c3c');
          break;
        }
        events.emit('console:teleport', x, z);
        this.log(`Teleporting to ${x}, ${z}`, '#2ecc71');
        break;
      }

      case 'speed': {
        const spd = parseFloat(args[0]);
        if (isNaN(spd)) {
          this.log('Usage: speed <number>', '#e74c3c');
          break;
        }
        events.emit('console:speed', spd);
        this.log(`Speed set to ${spd}`, '#2ecc71');
        break;
      }

      case 'clear':
        this.output.innerHTML = '';
        break;

      default:
        this.log(`Unknown command: ${command}`, '#e74c3c');
    }
  }
}
