import * as THREE from 'three';
import { events } from '../core/event-bus';
import { ITEMS } from '../data/items';
import type { Inventory } from './inventory';

export class ToolSystem {
  private equippedSlot = -1;
  private handGroup: THREE.Group;
  private toolMesh: THREE.Object3D | null = null;
  private bobTime = 0;
  private swingTime = -1;
  private placementActive = false;

  constructor(
    private inventory: Inventory,
    private camera: THREE.Camera,
  ) {
    // Hand model attached to camera
    this.handGroup = new THREE.Group();
    this.handGroup.position.set(0.4, -0.35, -0.5);
    this.camera.add(this.handGroup);

    // Default hand mesh
    this.showHand();

    events.on('hotbar:equip', (slotIdx: number) => {
      this.equip(slotIdx);
    });

    events.on('hotbar:unequip', () => {
      this.unequip();
    });

    events.on('tool:use', () => {
      this.useTool();
    });

    // Respond to tool type queries from resource system
    events.on('tool:query-type', (callback: (t: string | null) => void) => {
      callback(this.getToolType());
    });

    // Left-click attack (only when not in placement mode or UI)
    this.placementActive = false;
    events.on('placement:started', () => { this.placementActive = true; });
    events.on('placement:completed', () => { this.placementActive = false; });
    events.on('placement:cancelled', () => { this.placementActive = false; });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !this.placementActive) {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        events.emit('tool:swing', this.camera.position.clone(), dir, this.getToolType());
        this.triggerSwing();
      }
    });

    events.on('inventory:changed', () => {
      // Check if equipped tool was removed
      if (this.equippedSlot >= 0) {
        const slot = this.inventory.getSlot(this.equippedSlot);
        if (!slot.itemId || ITEMS[slot.itemId]?.category !== 'tool') {
          this.unequip();
        }
      }
    });
  }

  private showHand() {
    this.clearToolMesh();
    const handGeo = new THREE.BoxGeometry(0.12, 0.2, 0.35);
    const handMat = new THREE.MeshStandardMaterial({ color: 0xe0b090, roughness: 0.7 });
    this.toolMesh = new THREE.Mesh(handGeo, handMat);
    this.handGroup.add(this.toolMesh);
  }

  private showTool(itemId: string) {
    this.clearToolMesh();
    const def = ITEMS[itemId];
    if (!def) return;

    const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 });
    const group = new THREE.Group();

    if (def.toolType === 'axe') {
      // Assemble upright, then tilt the whole group
      const inner = new THREE.Group();

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 6), handleMat);
      inner.add(handle); // centered at origin

      // Axe head at top of handle
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), stoneMat);
      head.position.set(0.06, 0.27, 0);
      inner.add(head);

      // Lashing detail
      const lash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6),
        new THREE.MeshStandardMaterial({ color: 0xB8860B, roughness: 0.8 })
      );
      lash.position.y = 0.22;
      inner.add(lash);

      inner.rotation.z = 0.4; // tilt forward
      inner.position.set(0, 0.05, 0);
      group.add(inner);

    } else if (def.toolType === 'pickaxe') {
      const inner = new THREE.Group();

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 6), handleMat);
      inner.add(handle);

      // Pick head — horizontal bar with pointed ends
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.28), stoneMat);
      head.position.y = 0.27;
      inner.add(head);

      // Pointed tips
      for (const side of [-1, 1]) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), stoneMat);
        tip.position.set(0, 0.27, side * 0.17);
        tip.rotation.x = side * Math.PI / 2;
        inner.add(tip);
      }

      // Lashing
      const lash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6),
        new THREE.MeshStandardMaterial({ color: 0xB8860B, roughness: 0.8 })
      );
      lash.position.y = 0.22;
      inner.add(lash);

      inner.rotation.z = 0.4;
      inner.position.set(0, 0.05, 0);
      group.add(inner);

    } else if (def.toolType === 'spear') {
      const inner = new THREE.Group();

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.9, 6), handleMat);
      inner.add(shaft);

      // Stone tip at top
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), stoneMat);
      tip.position.y = 0.5;
      inner.add(tip);

      // Lashing
      const lash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.04, 6),
        new THREE.MeshStandardMaterial({ color: 0xB8860B, roughness: 0.8 })
      );
      lash.position.y = 0.43;
      inner.add(lash);

      inner.rotation.z = 0.25; // slight tilt
      inner.position.set(0, -0.05, 0);
      group.add(inner);
    }

    this.toolMesh = group;
    this.handGroup.add(this.toolMesh);
  }

  private clearToolMesh() {
    if (this.toolMesh) {
      this.handGroup.remove(this.toolMesh);
      this.toolMesh = null;
    }
  }

  equip(slotIndex: number) {
    const slot = this.inventory.getSlot(slotIndex);
    if (!slot.itemId) {
      this.unequip();
      return;
    }

    const def = ITEMS[slot.itemId];
    if (def?.category === 'tool') {
      this.equippedSlot = slotIndex;
      this.showTool(slot.itemId);
      events.emit('tool:equipped', slot.itemId);
    } else {
      this.equippedSlot = slotIndex;
      this.showHand();
    }
  }

  unequip() {
    this.equippedSlot = -1;
    this.showHand();
    events.emit('tool:equipped', null);
  }

  getToolType(): string | null {
    if (this.equippedSlot < 0) return null;
    const slot = this.inventory.getSlot(this.equippedSlot);
    if (!slot.itemId) return null;
    return ITEMS[slot.itemId]?.toolType ?? null;
  }

  getToolTier(): number {
    if (this.equippedSlot < 0) return 0;
    const slot = this.inventory.getSlot(this.equippedSlot);
    if (!slot.itemId) return 0;
    return ITEMS[slot.itemId]?.toolTier ?? 0;
  }

  useTool() {
    if (this.equippedSlot >= 0) {
      this.inventory.damageTool(this.equippedSlot);
      this.triggerSwing();
    }
  }

  private triggerSwing() {
    this.swingTime = 0;
  }

  update(dt: number) {
    this.bobTime += dt;

    if (this.toolMesh) {
      // Idle bob
      const bob = Math.sin(this.bobTime * 2) * 0.01;
      this.handGroup.position.y = -0.35 + bob;

      // Swing animation
      if (this.swingTime >= 0) {
        this.swingTime += dt;
        const progress = this.swingTime / 0.3; // 0.3s swing
        if (progress < 1) {
          const angle = Math.sin(progress * Math.PI) * 0.8;
          this.handGroup.rotation.x = -angle;
        } else {
          this.swingTime = -1;
          this.handGroup.rotation.x = 0;
        }
      }
    }
  }
}
