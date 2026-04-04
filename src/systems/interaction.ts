import * as THREE from 'three';
import { events } from '../core/event-bus';

export interface Interactable {
  type: string;
  promptText: string;
  onInteract: () => void;
  mesh: THREE.Object3D;
}

export class InteractionSystem {
  private raycaster = new THREE.Raycaster();
  private interactables = new Set<Interactable>();
  private current: Interactable | null = null;
  private timer = 0;
  private readonly INTERVAL = 0.1; // raycast every 100ms
  private readonly RANGE = 4;
  private enabled = true;

  // Harvest progress
  private harvesting = false;
  private harvestTarget: Interactable | null = null;
  private harvestTime = 0;
  private harvestDuration = 0;
  private harvestCallback: (() => void) | null = null;

  constructor(private camera: THREE.Camera) {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.enabled) {
        if (this.harvesting) return; // already harvesting
        if (this.current) {
          this.current.onInteract();
        }
      }
    });
  }

  register(interactable: Interactable) {
    this.interactables.add(interactable);
  }

  unregister(interactable: Interactable) {
    this.interactables.delete(interactable);
    if (this.current === interactable) {
      this.current = null;
      events.emit('interaction:target-changed', null);
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled && this.current) {
      this.current = null;
      this.cancelHarvest();
      events.emit('interaction:target-changed', null);
    }
  }

  startHarvest(duration: number, callback: () => void) {
    this.harvesting = true;
    this.harvestTarget = this.current;
    this.harvestTime = 0;
    this.harvestDuration = duration;
    this.harvestCallback = callback;
    events.emit('interaction:harvest-start', duration);
  }

  cancelHarvest() {
    if (this.harvesting) {
      this.harvesting = false;
      this.harvestTarget = null;
      this.harvestCallback = null;
      events.emit('interaction:harvest-cancel');
    }
  }

  update(dt: number) {
    if (!this.enabled) return;

    // Handle harvest progress
    if (this.harvesting) {
      this.harvestTime += dt;
      events.emit('interaction:harvest-progress', this.harvestTime / this.harvestDuration);
      if (this.harvestTime >= this.harvestDuration) {
        const cb = this.harvestCallback;
        this.harvesting = false;
        this.harvestTarget = null;
        this.harvestCallback = null;
        events.emit('interaction:harvest-complete');
        cb?.();
      }
      return;
    }

    // Throttled raycast
    this.timer += dt;
    if (this.timer < this.INTERVAL) return;
    this.timer = 0;

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = this.RANGE;

    const meshes = Array.from(this.interactables).map(i => i.mesh);
    const intersects = this.raycaster.intersectObjects(meshes, true);

    let hit: Interactable | null = null;
    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      for (const interactable of this.interactables) {
        if (interactable.mesh === hitObj || interactable.mesh.getObjectById(hitObj.id)) {
          hit = interactable;
          break;
        }
        // Check if hitObj is a descendant
        let parent = hitObj.parent;
        while (parent) {
          if (parent === interactable.mesh) {
            hit = interactable;
            break;
          }
          parent = parent.parent;
        }
        if (hit) break;
      }
    }

    if (hit !== this.current) {
      this.current = hit;
      events.emit('interaction:target-changed', hit);
    }
  }

  getCurrent(): Interactable | null {
    return this.current;
  }

  isHarvesting(): boolean {
    return this.harvesting;
  }
}
