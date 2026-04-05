import type { Terrain } from '../world/terrain';
import { TERRAIN_SIZE, TERRAIN_SEGMENTS } from '../world/terrain';
import type { PlaceableManager } from '../world/placeables';

const MAP_SIZE = 128;
const MAP_RADIUS = 200; // world units shown on minimap

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrainImage: ImageData;
  private timer = 0;
  private readonly UPDATE_INTERVAL = 0.1; // 10 FPS

  constructor(
    terrain: Terrain,
    private placeableManager: PlaceableManager,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = MAP_SIZE;
    this.canvas.height = MAP_SIZE;
    this.canvas.style.cssText = `
      position: fixed; top: 50px; right: 10px;
      width: 128px; height: 128px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.2);
      z-index: 10; pointer-events: none;
      image-rendering: pixelated;
    `;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // Render static terrain image once
    this.terrainImage = this.ctx.createImageData(MAP_SIZE, MAP_SIZE);
    this.renderTerrainImage(terrain);
  }

  private renderTerrainImage(terrain: Terrain) {
    const data = this.terrainImage.data;
    const stride = TERRAIN_SEGMENTS + 1;
    const halfSize = TERRAIN_SIZE / 2;

    for (let py = 0; py < MAP_SIZE; py++) {
      for (let px = 0; px < MAP_SIZE; px++) {
        // Map pixel to world coords
        const wx = ((px / MAP_SIZE) - 0.5) * MAP_RADIUS * 2;
        const wz = ((py / MAP_SIZE) - 0.5) * MAP_RADIUS * 2;

        // Sample terrain height
        const gx = ((wx + halfSize) / TERRAIN_SIZE) * TERRAIN_SEGMENTS;
        const gz = ((wz + halfSize) / TERRAIN_SIZE) * TERRAIN_SEGMENTS;
        const ix = Math.max(0, Math.min(TERRAIN_SEGMENTS, Math.floor(gx)));
        const iz = Math.max(0, Math.min(TERRAIN_SEGMENTS, Math.floor(gz)));
        const h = terrain.heightData[iz * stride + ix];

        const idx = (py * MAP_SIZE + px) * 4;

        if (h < 0.3) {
          // Water
          data[idx] = 20; data[idx + 1] = 60; data[idx + 2] = 100; data[idx + 3] = 255;
        } else if (h < 2.5) {
          // Beach
          data[idx] = 180; data[idx + 1] = 165; data[idx + 2] = 120; data[idx + 3] = 255;
        } else if (h < 15) {
          // Jungle
          const g = 80 + (h / 15) * 40;
          data[idx] = 40; data[idx + 1] = g; data[idx + 2] = 30; data[idx + 3] = 255;
        } else {
          // Highlands
          const grey = 90 + (h / 40) * 50;
          data[idx] = grey; data[idx + 1] = grey; data[idx + 2] = grey; data[idx + 3] = 255;
        }
      }
    }
  }

  update(dt: number, playerX: number, playerZ: number, playerRotY: number) {
    this.timer += dt;
    if (this.timer < this.UPDATE_INTERVAL) return;
    this.timer = 0;

    // Draw terrain
    this.ctx.putImageData(this.terrainImage, 0, 0);

    // Player position on map
    const px = ((playerX / (MAP_RADIUS * 2)) + 0.5) * MAP_SIZE;
    const py = ((playerZ / (MAP_RADIUS * 2)) + 0.5) * MAP_SIZE;

    // Campfire markers (orange dots)
    for (const obj of this.placeableManager.getObjects()) {
      if (obj.def.id === 'campfire') {
        const cx = ((obj.position.x / (MAP_RADIUS * 2)) + 0.5) * MAP_SIZE;
        const cy = ((obj.position.z / (MAP_RADIUS * 2)) + 0.5) * MAP_SIZE;
        this.ctx.fillStyle = '#ff8833';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Player arrow (white triangle)
    this.ctx.save();
    this.ctx.translate(px, py);
    this.ctx.rotate(-playerRotY + Math.PI);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -5);
    this.ctx.lineTo(-3, 4);
    this.ctx.lineTo(3, 4);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();

    // Circular clip mask via compositing
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.beginPath();
    this.ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalCompositeOperation = 'source-over';
  }
}
