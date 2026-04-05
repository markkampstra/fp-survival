import * as THREE from 'three';
import { events } from '../core/event-bus';
import { PLACEABLES, type PlaceableDef } from '../data/placeables';
import type { InteractionSystem, Interactable } from '../systems/interaction';
import { Inventory } from '../systems/inventory';
import type { PlayerState } from '../player/player-state';

export interface PlacedObject {
  def: PlaceableDef;
  mesh: THREE.Object3D;
  light?: THREE.PointLight;
  position: THREE.Vector3;
  interactables: Interactable[];
  time: number;
  userData: Record<string, any>;
}

// Water collector: 100 units = 1 clean_water, fills in 5 real minutes
const WATER_COLLECTOR_RATE = 100 / 300;

export class PlaceableManager {
  private objects: PlacedObject[] = [];
  private isRaining = false;

  constructor(
    private scene: THREE.Scene,
    private interaction: InteractionSystem,
    private inventory: Inventory,
    private playerState: PlayerState,
  ) {
    events.on('weather:rain-changed', (intensity: number) => {
      this.isRaining = intensity > 0.2;
    });
  }

  getObjects(): PlacedObject[] {
    return this.objects;
  }

  place(placeableId: string, position: THREE.Vector3): PlacedObject | null {
    const def = PLACEABLES[placeableId];
    if (!def) return null;

    const mesh = def.createMesh();
    mesh.position.copy(position);
    this.scene.add(mesh);

    const obj: PlacedObject = {
      def,
      mesh,
      position: position.clone(),
      interactables: [],
      time: 0,
      userData: {},
    };

    // Type-specific setup
    if (placeableId === 'campfire') {
      const light = new THREE.PointLight(0xff8833, 2, 15, 2);
      light.position.copy(position);
      light.position.y += 0.5;
      this.scene.add(light);
      obj.light = light;
    } else if (placeableId === 'storage_box') {
      obj.userData.storage = new Inventory(12);
    } else if (placeableId === 'water_collector') {
      obj.userData.waterLevel = 0;
    }

    // Register interaction
    const interactable: Interactable = {
      type: 'placeable',
      promptText: `Use ${def.name}`,
      mesh: mesh,
      onInteract: () => this.showActionMenu(obj),
    };
    this.interaction.register(interactable);
    obj.interactables.push(interactable);

    this.objects.push(obj);
    events.emit('placeable:placed', placeableId, position);
    return obj;
  }

  private showActionMenu(obj: PlacedObject) {
    const existing = document.getElementById('action-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'action-menu';
    menu.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.85);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px; padding: 10px;
      z-index: 30; user-select: none; min-width: 220px;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'color: #fff; font-family: sans-serif; font-size: 14px; margin-bottom: 8px; text-align: center;';
    title.textContent = obj.def.name;
    menu.appendChild(title);

    events.emit('actionmenu:opened');

    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('keydown', onKey);
      events.emit('actionmenu:closed');
    };

    for (const ia of obj.def.interactions) {
      const btn = document.createElement('button');
      const hasItem = !ia.requiresItem || this.inventory.hasItem(ia.requiresItem);
      btn.style.cssText = `
        display: block; width: 100%;
        padding: 8px 12px; margin-bottom: 4px;
        background: ${hasItem ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.05)'};
        border: 1px solid ${hasItem ? 'rgba(46,204,113,0.5)' : 'rgba(255,255,255,0.1)'};
        border-radius: 4px;
        color: ${hasItem ? '#fff' : '#666'};
        font-family: sans-serif; font-size: 13px;
        cursor: ${hasItem ? 'pointer' : 'default'};
        text-align: left;
      `;
      btn.textContent = ia.promptText;
      if (hasItem) {
        btn.addEventListener('click', () => {
          this.handleInteraction(obj, ia.action, ia.requiresItem);
          closeMenu();
        });
      }
      menu.appendChild(btn);
    }

    const close = document.createElement('button');
    close.style.cssText = `
      display: block; width: 100%; margin-top: 6px;
      padding: 6px; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;
      color: #999; font-family: sans-serif; font-size: 12px;
      cursor: pointer; text-align: center;
    `;
    close.textContent = 'Close [ESC]';
    close.addEventListener('click', closeMenu);
    menu.appendChild(close);

    document.body.appendChild(menu);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKey);
  }

  private handleInteraction(obj: PlacedObject, action: string, requiresItem?: string) {
    if (requiresItem && !this.inventory.hasItem(requiresItem)) {
      events.emit('notification', `Need ${requiresItem}`);
      return;
    }

    switch (action) {
      case 'cook':
        this.inventory.removeItem(requiresItem!, 1);
        this.inventory.addItem('cooked_coconut', 1);
        events.emit('notification', 'Cooked coconut!');
        break;
      case 'cook_meat':
        this.inventory.removeItem('raw_meat', 1);
        this.inventory.addItem('cooked_meat', 1);
        events.emit('notification', 'Cooked meat!');
        break;
      case 'cook_fish':
        this.inventory.removeItem('raw_fish', 1);
        this.inventory.addItem('cooked_fish', 1);
        events.emit('notification', 'Cooked fish!');
        break;
      case 'cook_crab':
        this.inventory.removeItem('raw_crab_meat', 1);
        this.inventory.addItem('cooked_meat', 1);
        events.emit('notification', 'Cooked crab meat!');
        break;
      case 'boil_water':
        this.inventory.removeItem('dirty_water', 1);
        this.inventory.addItem('clean_water', 1);
        this.inventory.addItem('coconut_shell', 1);
        events.emit('notification', 'Boiled water — safe to drink!');
        break;
      case 'sleep':
        events.emit('sleep:start');
        break;
      case 'open_storage':
        events.emit('storage:open', obj.userData.storage);
        break;
      case 'collect_water': {
        const level = obj.userData.waterLevel ?? 0;
        if (level >= 100) {
          obj.userData.waterLevel -= 100;
          this.inventory.addItem('clean_water', 1);
          events.emit('notification', 'Collected clean water!');
        } else {
          events.emit('notification', `Water collector ${Math.floor(level)}% full`);
        }
        break;
      }
    }
  }

  update(dt: number) {
    for (const obj of this.objects) {
      obj.time += dt;

      // Campfire animations
      if (obj.def.id === 'campfire') {
        obj.mesh.traverse((child) => {
          if (child.userData.isFlame) {
            child.scale.y = 0.8 + Math.sin(obj.time * 5 + child.id) * 0.3;
            child.position.y = 0.3 + Math.sin(obj.time * 3 + child.id * 2) * 0.05;
          }
        });
        if (obj.light) {
          obj.light.intensity = 1.8 + Math.sin(obj.time * 8) * 0.4 + Math.sin(obj.time * 13) * 0.2;
        }
      }

      // Water collector fill
      if (obj.def.id === 'water_collector') {
        const rate = this.isRaining ? WATER_COLLECTOR_RATE * 3 : WATER_COLLECTOR_RATE;
        obj.userData.waterLevel = Math.min(200, (obj.userData.waterLevel ?? 0) + rate * dt);

        // Update visual water level
        const fillPct = Math.min((obj.userData.waterLevel ?? 0) / 100, 1);
        obj.mesh.traverse((child) => {
          if (child.userData.isWaterLevel) {
            const s = fillPct * 0.8 + 0.01; // slight minimum so it doesn't vanish
            child.scale.set(s, s, s);
          }
        });
      }
    }
  }

  serialize(): { id: string; position: [number, number, number]; userData?: Record<string, any> }[] {
    return this.objects.map(obj => {
      const ud: Record<string, any> = {};
      if (obj.def.id === 'water_collector') {
        ud.waterLevel = obj.userData.waterLevel ?? 0;
      }
      if (obj.def.id === 'storage_box' && obj.userData.storage) {
        ud.storageSlots = (obj.userData.storage as Inventory).serialize();
      }
      return {
        id: obj.def.id,
        position: [obj.position.x, obj.position.y, obj.position.z] as [number, number, number],
        userData: Object.keys(ud).length > 0 ? ud : undefined,
      };
    });
  }

  deserializePlaceables(data: { id: string; position: [number, number, number]; userData?: Record<string, any> }[]) {
    for (const entry of data) {
      const pos = new THREE.Vector3(entry.position[0], entry.position[1], entry.position[2]);
      const obj = this.place(entry.id, pos);
      if (obj && entry.userData) {
        if (entry.userData.waterLevel !== undefined) {
          obj.userData.waterLevel = entry.userData.waterLevel;
        }
        if (entry.userData.storageSlots && obj.userData.storage) {
          (obj.userData.storage as Inventory).deserialize(entry.userData.storageSlots);
        }
      }
    }
  }
}
