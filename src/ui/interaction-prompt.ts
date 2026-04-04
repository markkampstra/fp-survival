import { events } from '../core/event-bus';
import type { Interactable } from '../systems/interaction';

export class InteractionPrompt {
  private element: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private progressFill: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed;
      top: calc(50% + 30px); left: 50%;
      transform: translateX(-50%);
      padding: 6px 14px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-family: sans-serif; font-size: 14px;
      border-radius: 4px;
      pointer-events: none;
      z-index: 10;
      display: none;
      text-align: center;
    `;

    this.progressBar = document.createElement('div');
    this.progressBar.style.cssText = `
      width: 100%; height: 4px;
      background: rgba(255,255,255,0.2);
      border-radius: 2px;
      margin-top: 6px;
      display: none;
      overflow: hidden;
    `;

    this.progressFill = document.createElement('div');
    this.progressFill.style.cssText = `
      height: 100%; width: 0%;
      background: #2ecc71;
      border-radius: 2px;
      transition: width 0.1s linear;
    `;

    this.progressBar.appendChild(this.progressFill);
    this.element.appendChild(this.progressBar);
    document.body.appendChild(this.element);

    events.on('interaction:target-changed', (target: Interactable | null) => {
      if (target) {
        this.element.childNodes[0].textContent = `[E] ${target.promptText}`;
        this.element.style.display = 'block';
      } else {
        this.element.style.display = 'none';
      }
    });

    events.on('interaction:harvest-start', () => {
      this.progressBar.style.display = 'block';
      this.progressFill.style.width = '0%';
    });

    events.on('interaction:harvest-progress', (pct: number) => {
      this.progressFill.style.width = `${Math.min(pct * 100, 100)}%`;
    });

    events.on('interaction:harvest-complete', () => {
      this.progressBar.style.display = 'none';
    });

    events.on('interaction:harvest-cancel', () => {
      this.progressBar.style.display = 'none';
    });
  }
}
