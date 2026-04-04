import type { ItemDef } from '../data/items';

/** Create a colored badge element for an item icon */
export function createItemIcon(def: ItemDef, size = 28): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width: ${size}px; height: ${size}px;
    background: ${def.iconColor};
    border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    font-family: monospace; font-weight: bold;
    font-size: ${size * 0.4}px;
    color: #fff;
    text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
    line-height: 1;
    flex-shrink: 0;
  `;
  el.textContent = def.icon;
  return el;
}
