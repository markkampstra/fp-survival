import * as THREE from 'three';
import { events } from '../core/event-bus';
import { RESOURCE_NODES, type ResourceNodeDef } from '../data/resource-nodes';
import type { Terrain } from './terrain';
import type { InteractionSystem, Interactable } from '../systems/interaction';
import type { Inventory } from '../systems/inventory';

interface ActiveNode {
  def: ResourceNodeDef;
  mesh: THREE.Object3D;
  interactable: Interactable;
  depleted: boolean;
  respawnTimer: number;
}

export class ResourceManager {
  private nodes: ActiveNode[] = [];
  private group: THREE.Group;

  constructor(
    private terrain: Terrain,
    private scene: THREE.Scene,
    private interaction: InteractionSystem,
    private inventory: Inventory,
  ) {
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.spawnAll();
  }

  private spawnAll() {
    for (const def of Object.values(RESOURCE_NODES)) {
      for (let i = 0; i < def.spawnCount; i++) {
        this.spawnNode(def);
      }
    }

    // Make existing palm trees interactable for coconuts
    this.registerPalmTrees();
  }

  private spawnNode(def: ResourceNodeDef) {
    const mapHalf = 220;
    let x: number, z: number, height: number;
    let attempts = 0;

    do {
      x = (Math.random() - 0.5) * mapHalf * 2;
      z = (Math.random() - 0.5) * mapHalf * 2;
      height = this.terrain.getHeightAt(x, z);
      attempts++;
    } while (
      (height < def.spawnHeightRange[0] || height > def.spawnHeightRange[1]) &&
      attempts < 20
    );

    if (attempts >= 20) return;

    const mesh = def.createMesh();
    mesh.position.set(x, height + 0.05, z);
    this.group.add(mesh);

    const node: ActiveNode = {
      def,
      mesh,
      interactable: null!,
      depleted: false,
      respawnTimer: 0,
    };

    node.interactable = this.createInteractable(node);
    this.interaction.register(node.interactable);
    this.nodes.push(node);
  }

  private createInteractable(node: ActiveNode): Interactable {
    const def = node.def;
    let prompt = `Pick up ${def.name}`;
    if (def.interactTime > 0) {
      prompt = `Harvest ${def.name}`;
    }
    if (def.requiresTool) {
      prompt = `${prompt} (requires ${def.requiresTool})`;
    }

    return {
      type: 'resource_node',
      promptText: prompt,
      mesh: node.mesh,
      onInteract: () => this.harvestNode(node),
    };
  }

  private harvestNode(node: ActiveNode) {
    if (node.depleted) return;

    const def = node.def;

    // Check tool requirement
    if (def.requiresTool) {
      const toolType = this.getEquippedToolType();
      if (toolType !== def.requiresTool) {
        events.emit('notification', `Requires ${def.requiresTool}`);
        return;
      }
    }

    if (def.interactTime > 0) {
      // Start timed harvest
      this.interaction.startHarvest(def.interactTime, () => {
        this.completeHarvest(node);
      });
    } else {
      this.completeHarvest(node);
    }
  }

  private completeHarvest(node: ActiveNode) {
    const def = node.def;
    const toolType = this.getEquippedToolType();
    const hasBonus = def.requiresTool && toolType === def.requiresTool && def.toolBonusMultiplier;

    for (const drop of def.drops) {
      let amount = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
      if (hasBonus) amount = Math.ceil(amount * def.toolBonusMultiplier!);
      if (amount > 0) {
        this.inventory.addItem(drop.itemId, amount);
      }
    }

    // Use tool durability
    if (def.requiresTool) {
      events.emit('tool:use');
    }

    // Deplete node
    node.depleted = true;
    node.mesh.visible = false;
    node.respawnTimer = def.respawnTime;
    this.interaction.unregister(node.interactable);
    events.emit('resource:collected', def.id);
  }

  private registerPalmTrees() {
    // Find palm trees in the scene and make them coconut sources
    this.scene.traverse((obj) => {
      if (obj.userData.isPalmTree) {
        const node: ActiveNode = {
          def: {
            id: 'coconut_palm',
            name: 'Coconut Palm',
            createMesh: () => obj,
            drops: [
              { itemId: 'coconut', min: 1, max: 3 },
              { itemId: 'wood', min: 0, max: 1 },
            ],
            interactTime: 2,
            requiresTool: 'axe',
            toolBonusMultiplier: 2,
            spawnHeightRange: [2, 20],
            respawnTime: 300,
            spawnCount: 0,
          },
          mesh: obj,
          interactable: null!,
          depleted: false,
          respawnTimer: 0,
        };
        node.interactable = this.createInteractable(node);
        this.interaction.register(node.interactable);
        this.nodes.push(node);
      }
    });
  }

  private getEquippedToolType(): string | null {
    // This will be checked via event or direct reference
    // For now, emit a sync query event
    let toolType: string | null = null;
    events.emit('tool:query-type', (t: string | null) => { toolType = t; });
    return toolType;
  }

  update(dt: number) {
    for (const node of this.nodes) {
      if (node.depleted) {
        node.respawnTimer -= dt;
        if (node.respawnTimer <= 0) {
          node.depleted = false;
          node.mesh.visible = true;
          node.interactable = this.createInteractable(node);
          this.interaction.register(node.interactable);
        }
      }
    }
  }

  serialize(): { depleted: { index: number; respawnTimer: number }[] } {
    const depleted: { index: number; respawnTimer: number }[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].depleted) {
        depleted.push({ index: i, respawnTimer: this.nodes[i].respawnTimer });
      }
    }
    return { depleted };
  }

  deserialize(data: { depleted: { index: number; respawnTimer: number }[] }) {
    for (const entry of data.depleted) {
      const node = this.nodes[entry.index];
      if (node) {
        node.depleted = true;
        node.mesh.visible = false;
        node.respawnTimer = entry.respawnTimer;
        this.interaction.unregister(node.interactable);
      }
    }
  }
}
