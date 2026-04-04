import * as THREE from 'three';
import { events } from '../core/event-bus';
import { PLACEABLES, ITEM_TO_PLACEABLE } from '../data/placeables';
import { ITEMS } from '../data/items';
import type { Terrain } from '../world/terrain';
import type { Inventory } from './inventory';
import type { PlaceableManager } from '../world/placeables';

export class PlacementSystem {
  private active = false;
  private placeableId: string | null = null;
  private ghostMesh: THREE.Object3D | null = null;
  private raycaster = new THREE.Raycaster();
  private inventorySlot = -1;

  constructor(
    private camera: THREE.Camera,
    private terrain: Terrain,
    private scene: THREE.Scene,
    private inventory: Inventory,
    private placeableManager: PlaceableManager,
  ) {
    document.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (e.button === 0) {
        // Left click: place
        this.confirmPlacement();
      } else if (e.button === 2) {
        // Right click: cancel
        this.cancelPlacement();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.active) {
        this.cancelPlacement();
      }
    });

    // Listen for placement requests from hotbar
    events.on('hotbar:equip', (slotIdx: number) => {
      const slot = this.inventory.getSlot(slotIdx);
      if (slot.itemId) {
        const def = ITEMS[slot.itemId];
        const placeableId = ITEM_TO_PLACEABLE[slot.itemId];
        if (def?.category === 'placeable' && placeableId) {
          this.startPlacement(placeableId, slotIdx);
        }
      }
    });
  }

  startPlacement(placeableId: string, inventorySlot: number) {
    const def = PLACEABLES[placeableId];
    if (!def) return;

    this.cancelPlacement(); // clean up any existing

    this.active = true;
    this.placeableId = placeableId;
    this.inventorySlot = inventorySlot;
    this.ghostMesh = def.createGhostMesh();
    this.scene.add(this.ghostMesh);
    events.emit('placement:started', placeableId);
  }

  cancelPlacement() {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }
    this.active = false;
    this.placeableId = null;
    events.emit('placement:cancelled');
  }

  private confirmPlacement() {
    if (!this.ghostMesh || !this.placeableId) return;

    const position = this.ghostMesh.position.clone();

    // Remove ghost
    this.scene.remove(this.ghostMesh);
    this.ghostMesh = null;

    // Consume item
    const slot = this.inventory.getSlot(this.inventorySlot);
    if (slot.itemId) {
      slot.quantity--;
      if (slot.quantity <= 0) {
        slot.itemId = null;
        slot.quantity = 0;
      }
      events.emit('inventory:changed');
    }

    // Place object
    this.placeableManager.place(this.placeableId, position);

    this.active = false;
    this.placeableId = null;
    events.emit('placement:completed');
  }

  isActive(): boolean {
    return this.active;
  }

  update(_dt: number) {
    if (!this.active || !this.ghostMesh) return;

    // Raycast down from camera to find placement point
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 10;

    // Get terrain intersection via simple projection
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const pos = this.camera.position.clone().add(dir.multiplyScalar(5));
    const terrainY = this.terrain.getHeightAt(pos.x, pos.z);

    this.ghostMesh.position.set(pos.x, terrainY, pos.z);

    // Color based on validity (above water)
    const isValid = terrainY > 0.5;
    this.ghostMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        (child.material as THREE.MeshStandardMaterial).color.setHex(
          isValid ? 0x00ff00 : 0xff0000
        );
      }
    });
  }
}
