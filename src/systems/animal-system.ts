import * as THREE from 'three';
import { events } from '../core/event-bus';
import { ANIMALS, type AnimalDef } from '../data/animals';
import { createCrabMesh, createFishMesh, createBoarMesh } from '../world/animals';
import type { Terrain } from '../world/terrain';
import type { Inventory } from './inventory';

interface ActiveAnimal {
  def: AnimalDef;
  mesh: THREE.Group;
  health: number;
  dead: boolean;
  deathTimer: number;
  // AI state
  state: 'idle' | 'wander' | 'flee';
  stateTimer: number;
  target: THREE.Vector3;
  homePos: THREE.Vector3;
  patrolAngle: number; // for fish
}

const MESH_FACTORIES: Record<string, () => THREE.Group> = {
  crab: createCrabMesh,
  fish: createFishMesh,
  boar: createBoarMesh,
};

export class AnimalSystem {
  private animals: ActiveAnimal[] = [];
  private group: THREE.Group;
  private tmpVec = new THREE.Vector3();

  constructor(
    private terrain: Terrain,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private inventory: Inventory,
  ) {
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.spawnAll();

    // Listen for tool swings (left-click attack)
    events.on('tool:swing', (pos: THREE.Vector3, dir: THREE.Vector3, toolType: string | null) => {
      this.handleAttack(pos, dir, toolType);
    });
  }

  private spawnAll() {
    for (const def of Object.values(ANIMALS)) {
      const factory = MESH_FACTORIES[def.id];
      if (!factory) continue;

      for (let i = 0; i < def.spawnCount; i++) {
        this.spawnAnimal(def, factory);
      }
    }
  }

  private spawnAnimal(def: AnimalDef, factory: () => THREE.Group) {
    let x: number, z: number, h: number;
    let attempts = 0;
    const mapHalf = 200;

    do {
      x = (Math.random() - 0.5) * mapHalf * 2;
      z = (Math.random() - 0.5) * mapHalf * 2;
      h = this.terrain.getHeightAt(x, z);
      attempts++;
    } while (
      (h < def.spawnHeightRange[0] || h > def.spawnHeightRange[1]) &&
      attempts < 30
    );
    if (attempts >= 30) return;

    const mesh = factory();
    const y = def.id === 'fish' ? 0.2 : h;
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    this.animals.push({
      def,
      mesh,
      health: def.health,
      dead: false,
      deathTimer: 0,
      state: 'idle',
      stateTimer: 1 + Math.random() * 3,
      target: new THREE.Vector3(x, y, z),
      homePos: new THREE.Vector3(x, y, z),
      patrolAngle: Math.random() * Math.PI * 2,
    });
  }

  private handleAttack(pos: THREE.Vector3, dir: THREE.Vector3, toolType: string | null) {
    for (const animal of this.animals) {
      if (animal.dead) continue;

      const range = animal.def.requiresTool === 'spear' ? 4 : 3;

      // Check if tool is required
      if (animal.def.requiresTool && toolType !== animal.def.requiresTool) continue;

      // Distance check
      this.tmpVec.copy(animal.mesh.position).sub(pos);
      const dist = this.tmpVec.length();
      if (dist > range) continue;

      // Angle check (within ~45 degrees of look direction)
      this.tmpVec.normalize();
      const dot = this.tmpVec.dot(dir);
      if (dot < 0.7) continue;

      // Hit!
      const damage = 10;
      animal.health -= damage;
      events.emit('notification', `Hit ${animal.def.name}! (${Math.max(0, animal.health)} HP)`);

      if (animal.health <= 0) {
        this.killAnimal(animal);
      } else if (animal.def.behavior === 'flee') {
        animal.state = 'flee';
        animal.stateTimer = 5;
      }
      break; // Only hit one animal per swing
    }
  }

  private killAnimal(animal: ActiveAnimal) {
    animal.dead = true;
    animal.deathTimer = 1.5;
    events.emit('animal:killed', animal.def.id);

    // Drop items
    for (const drop of animal.def.drops) {
      const amount = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
      if (amount > 0) {
        this.inventory.addItem(drop.itemId, amount);
      }
    }

    // Fall-over animation
    events.emit('notification', `Killed ${animal.def.name}!`);
  }

  update(dt: number) {
    const playerPos = this.camera.position;

    for (const animal of this.animals) {
      if (animal.dead) {
        // Death animation: rotate and fade
        animal.deathTimer -= dt;
        animal.mesh.rotation.z = Math.min(animal.mesh.rotation.z + dt * 3, Math.PI / 2);
        if (animal.deathTimer <= 0) {
          this.group.remove(animal.mesh);
          // Respawn after delay
          setTimeout(() => this.respawnAnimal(animal), 60000); // 60s respawn
        }
        continue;
      }

      animal.stateTimer -= dt;

      // AI behavior
      switch (animal.def.behavior) {
        case 'wander':
          this.updateWander(animal, dt);
          break;
        case 'flee':
          this.updateFlee(animal, dt, playerPos);
          break;
        case 'patrol':
          this.updatePatrol(animal, dt);
          break;
      }
    }
  }

  private updateWander(animal: ActiveAnimal, dt: number) {
    if (animal.state === 'idle') {
      if (animal.stateTimer <= 0) {
        // Pick new destination
        const angle = Math.random() * Math.PI * 2;
        const dist = 3 + Math.random() * 7;
        animal.target.set(
          animal.homePos.x + Math.cos(angle) * dist,
          0,
          animal.homePos.z + Math.sin(angle) * dist
        );
        animal.state = 'wander';
      }
    } else if (animal.state === 'wander') {
      this.moveToward(animal, animal.target, animal.def.speed, dt);
      const dx = animal.target.x - animal.mesh.position.x;
      const dz = animal.target.z - animal.mesh.position.z;
      if (dx * dx + dz * dz < 1) {
        animal.state = 'idle';
        animal.stateTimer = 2 + Math.random() * 3;
      }
    }
  }

  private updateFlee(animal: ActiveAnimal, dt: number, playerPos: THREE.Vector3) {
    const dx = animal.mesh.position.x - playerPos.x;
    const dz = animal.mesh.position.z - playerPos.z;
    const distSq = dx * dx + dz * dz;
    const fleeDist = animal.def.fleeDistance;

    if (animal.state === 'flee') {
      // Run away
      this.moveToward(animal, animal.target, animal.def.speed * 2, dt);
      if (animal.stateTimer <= 0 || distSq > fleeDist * fleeDist * 4) {
        animal.state = 'idle';
        animal.stateTimer = 2 + Math.random() * 3;
      }
    } else if (distSq < fleeDist * fleeDist) {
      // Player too close — flee!
      const len = Math.sqrt(distSq) || 1;
      animal.target.set(
        animal.mesh.position.x + (dx / len) * fleeDist * 2,
        0,
        animal.mesh.position.z + (dz / len) * fleeDist * 2
      );
      animal.state = 'flee';
      animal.stateTimer = 5;
    } else {
      // Normal wander
      this.updateWander(animal, dt);
    }
  }

  private updatePatrol(animal: ActiveAnimal, dt: number) {
    // Circle around home position
    animal.patrolAngle += dt * 0.5;
    const r = 5;
    animal.target.set(
      animal.homePos.x + Math.cos(animal.patrolAngle) * r,
      0.2,
      animal.homePos.z + Math.sin(animal.patrolAngle) * r
    );
    this.moveToward(animal, animal.target, animal.def.speed, dt);
    // Fish stay at water level
    animal.mesh.position.y = 0.15;
  }

  private moveToward(animal: ActiveAnimal, target: THREE.Vector3, speed: number, dt: number) {
    const dx = target.x - animal.mesh.position.x;
    const dz = target.z - animal.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.1) return;

    const moveX = (dx / dist) * speed * dt;
    const moveZ = (dz / dist) * speed * dt;
    animal.mesh.position.x += moveX;
    animal.mesh.position.z += moveZ;

    // Terrain following (land animals only)
    if (animal.def.id !== 'fish') {
      const h = this.terrain.getHeightAt(animal.mesh.position.x, animal.mesh.position.z);
      animal.mesh.position.y = h;
    }

    // Face movement direction
    animal.mesh.rotation.y = Math.atan2(dx, dz);
  }

  private respawnAnimal(animal: ActiveAnimal) {
    animal.dead = false;
    animal.health = animal.def.health;
    animal.deathTimer = 0;
    animal.state = 'idle';
    animal.stateTimer = 2;
    animal.mesh.rotation.z = 0;
    animal.mesh.position.copy(animal.homePos);
    if (animal.def.id !== 'fish') {
      animal.mesh.position.y = this.terrain.getHeightAt(animal.homePos.x, animal.homePos.z);
    }
    this.group.add(animal.mesh);
  }
}
