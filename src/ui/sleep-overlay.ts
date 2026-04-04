export class SleepOverlay {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #000; opacity: 0; pointer-events: none; z-index: 25;
      transition: opacity 0.8s ease;
    `;
    document.body.appendChild(this.element);
  }

  async fadeToBlack(): Promise<void> {
    this.element.style.opacity = '1';
    return new Promise(r => setTimeout(r, 900));
  }

  async fadeIn(): Promise<void> {
    this.element.style.opacity = '0';
    return new Promise(r => setTimeout(r, 900));
  }
}
