export class Crosshair {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 20px; height: 20px;
      pointer-events: none;
      z-index: 10;
      display: none;
    `;

    // Horizontal line
    const h = document.createElement('div');
    h.style.cssText = `
      position: absolute; top: 50%; left: 0;
      width: 100%; height: 2px;
      background: rgba(255,255,255,0.8);
      transform: translateY(-50%);
    `;

    // Vertical line
    const v = document.createElement('div');
    v.style.cssText = `
      position: absolute; left: 50%; top: 0;
      width: 2px; height: 100%;
      background: rgba(255,255,255,0.8);
      transform: translateX(-50%);
    `;

    this.element.appendChild(h);
    this.element.appendChild(v);
    document.body.appendChild(this.element);
  }

  show() { this.element.style.display = 'block'; }
  hide() { this.element.style.display = 'none'; }
}
