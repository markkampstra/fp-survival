import * as THREE from 'three';
import { events } from '../core/event-bus';
import type { Terrain } from './terrain';
import type { InteractionSystem } from '../systems/interaction';
import type { Inventory } from '../systems/inventory';

const LOOT_TABLE = [
  [{ itemId: 'water_bottle', qty: 2 }, { itemId: 'rope', qty: 3 }],
  [{ itemId: 'arrow', qty: 6 }, { itemId: 'stick', qty: 5 }],
  [{ itemId: 'fiber', qty: 8 }, { itemId: 'coconut', qty: 3 }, { itemId: 'stone', qty: 5 }],
];

export class Shipwreck {
  private looted: boolean[] = [false, false, false];
  private position = new THREE.Vector3();

  constructor(
    terrain: Terrain,
    scene: THREE.Scene,
    interaction: InteractionSystem,
    private inventory: Inventory,
  ) {
    // Find a beach spot
    let x = 0, z = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 140 + Math.random() * 40;
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      const h = terrain.getHeightAt(x, z);
      if (h > 0.5 && h < 2.5) break;
    }

    const y = terrain.getHeightAt(x, z);
    this.position.set(x, y, z);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.95 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 0.95 });

    // Hull — tilted broken box
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 2.5), woodMat);
    hull.position.set(x, y + 0.5, z);
    hull.rotation.z = 0.15;
    hull.rotation.y = Math.random() * Math.PI;
    hull.castShadow = true;
    hull.receiveShadow = true;
    scene.add(hull);

    const hullAngle = hull.rotation.y;

    // Broken mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4, 6), darkWoodMat);
    mast.position.set(x + Math.cos(hullAngle) * 1, y + 1.5, z + Math.sin(hullAngle) * 1);
    mast.rotation.z = 0.6;
    mast.castShadow = true;
    scene.add(mast);

    // Broken planks scattered around
    for (let i = 0; i < 5; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(1.5 + Math.random(), 0.08, 0.3),
        i % 2 === 0 ? woodMat : darkWoodMat
      );
      const offset = (Math.random() - 0.5) * 4;
      plank.position.set(
        x + Math.cos(hullAngle + offset) * (3 + Math.random() * 2),
        y + 0.04,
        z + Math.sin(hullAngle + offset) * (3 + Math.random() * 2)
      );
      plank.rotation.y = Math.random() * Math.PI;
      plank.rotation.z = (Math.random() - 0.5) * 0.3;
      scene.add(plank);
    }

    // Cargo boxes (lootable)
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
    for (let i = 0; i < 3; i++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), boxMat);
      const bx = x + Math.cos(hullAngle + i * 0.8) * (1.5 + i * 0.8);
      const bz = z + Math.sin(hullAngle + i * 0.8) * (1.5 + i * 0.8);
      box.position.set(bx, y + 0.25, bz);
      box.rotation.y = Math.random() * Math.PI;
      box.castShadow = true;
      scene.add(box);

      const idx = i;
      interaction.register({
        type: 'shipwreck_loot',
        promptText: this.looted[idx] ? 'Empty wreckage' : 'Search wreckage',
        mesh: box,
        onInteract: () => this.lootBox(idx),
      });
    }
  }

  private lootBox(index: number) {
    if (this.looted[index]) {
      events.emit('notification', 'Already searched');
      return;
    }
    this.looted[index] = true;
    const loot = LOOT_TABLE[index];
    for (const item of loot) {
      this.inventory.addItem(item.itemId, item.qty);
    }
    const names = loot.map(l => `${l.qty}x ${l.itemId}`).join(', ');
    events.emit('notification', `Found: ${names}`);
  }

  serialize(): { looted: boolean[] } {
    return { looted: [...this.looted] };
  }

  deserialize(data: { looted: boolean[] }) {
    for (let i = 0; i < Math.min(data.looted.length, this.looted.length); i++) {
      this.looted[i] = data.looted[i];
    }
  }
}
