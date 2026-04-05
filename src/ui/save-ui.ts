export class SaveUI {
  private indicator: HTMLDivElement;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.indicator = document.createElement('div');
    this.indicator.style.cssText = `
      position: fixed; top: 10px; right: 120px;
      font-family: monospace; font-size: 12px;
      color: rgba(255,255,255,0.5);
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      pointer-events: none; z-index: 10;
      opacity: 0; transition: opacity 0.3s ease;
    `;
    this.indicator.textContent = 'Saving...';
    document.body.appendChild(this.indicator);
  }

  flash() {
    this.indicator.style.opacity = '1';
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.indicator.style.opacity = '0';
    }, 1200);
  }
}
