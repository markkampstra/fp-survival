export class HUD {
  private container: HTMLDivElement;
  private fpsEl: HTMLDivElement;
  private coordsEl: HTMLDivElement;
  private timeEl: HTMLDivElement;
  private notifEl: HTMLDivElement;
  private frameTimestamps: number[] = [];
  private notifTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0;
      pointer-events: none; z-index: 10;
      font-family: monospace; font-size: 14px; color: #fff;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      padding: 10px;
    `;

    this.fpsEl = document.createElement('div');
    this.fpsEl.style.cssText = 'position: absolute; top: 10px; left: 10px;';

    this.timeEl = document.createElement('div');
    this.timeEl.style.cssText = 'position: absolute; top: 10px; left: 50%; transform: translateX(-50%);';

    this.coordsEl = document.createElement('div');
    this.coordsEl.style.cssText = 'position: absolute; top: 10px; right: 10px; text-align: right;';

    this.notifEl = document.createElement('div');
    this.notifEl.style.cssText = `
      position: fixed; top: 30%; left: 50%;
      transform: translateX(-50%);
      font-family: sans-serif; font-size: 16px; color: #fff;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
      background: rgba(0,0,0,0.4);
      padding: 6px 14px; border-radius: 4px;
      display: none;
      pointer-events: none; z-index: 15;
    `;

    this.container.appendChild(this.fpsEl);
    this.container.appendChild(this.timeEl);
    this.container.appendChild(this.coordsEl);
    document.body.appendChild(this.container);
    document.body.appendChild(this.notifEl);
  }

  update(x: number, y: number, z: number, timeStr?: string) {
    const now = performance.now();
    this.frameTimestamps.push(now);
    while (this.frameTimestamps.length > 0 && now - this.frameTimestamps[0] > 1000) {
      this.frameTimestamps.shift();
    }

    this.fpsEl.textContent = `FPS: ${this.frameTimestamps.length}`;
    this.coordsEl.textContent = `X: ${x.toFixed(1)}  Y: ${y.toFixed(1)}  Z: ${z.toFixed(1)}`;
    if (timeStr) {
      this.timeEl.textContent = timeStr;
    }
  }

  showNotification(text: string) {
    this.notifEl.textContent = text;
    this.notifEl.style.display = 'block';
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
    this.notifTimeout = setTimeout(() => {
      this.notifEl.style.display = 'none';
    }, 2000);
  }
}
