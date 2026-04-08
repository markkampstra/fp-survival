import * as THREE from 'three';
import { events } from '../core/event-bus';
import { ANIMALS, type AnimalDef } from '../data/animals';
import { createCrabMesh, createFishMesh, createBoarMesh } from '../world/animals';
import { createWolfMesh, createSnakeMesh } from '../world/hostile-animals';
import type { Terrain } from '../world/terrain';
import type { Inventory } from './inventory';
import type { PlaceableManager } from '../world/placeables';

interface ActiveAnimal {
  def: AnimalDef;
  mesh: THREE.Group;
  health: number;
  dead: boolean;
  deathTimer: number;
  // AI state
  state: 'idle' | 'wander' | 'flee' | 'chase' | 'attack' | 'cooldown';
  stateTimer: number;
  target: THREE.Vector3;
  homePos: THREE.Vector3;
  patrolAngle: number;
  attackTimer: number;
  isNightSpawn: boolean;
  animTime: number;
  isMoving: boolean;
}

const MESH_FACTORIES: Record<string, () => THREE.Group> = {
  crab: createCrabMesh,
  fish: createFishMesh,
  boar: createBoarMesh,
  wolf: createWolfMesh,
  snake: createSnakeMesh,
};

export class AnimalSystem {
  private animals: ActiveAnimal[] = [];
  private group: THREE.Group;
  private tmpVec = new THREE.Vector3();
  private nightSpawned = false;

  constructor(
    private terrain: Terrain,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private inventory: Inventory,
    private placeableManager?: PlaceableManager,
  ) {
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.spawnAll();

    events.on('tool:swing', (pos: THREE.Vector3, dir: THREE.Vector3, toolType: string | null) => {
      this.handleAttack(pos, dir, toolType);
    });

    // Projectile hit detection (arrows)
    events.on('projectile:check-hit', (pos: THREE.Vector3, radius: number) => {
      for (const animal of this.animals) {
        if (animal.dead) continue;
        const dx = pos.x - animal.mesh.position.x;
        const dz = pos.z - animal.mesh.position.z;
        const dy = pos.y - animal.mesh.position.y;
        if (dx * dx + dz * dz + dy * dy < radius * radius) {
          animal.health -= 15; // arrow damage
          events.emit('notification', `Arrow hit ${animal.def.name}! (${Math.max(0, animal.health)} HP)`);
          if (animal.health <= 0) this.killAnimal(animal);
          break;
        }
      }
    });

    // Night spawn/despawn for hostile creatures
    events.on('daycycle:phase-changed', (phase: string) => {
      if ((phase === 'night' || phase === 'dusk') && !this.nightSpawned) {
        this.spawnNightCreatures();
        this.nightSpawned = true;
      } else if (phase === 'dawn' && this.nightSpawned) {
        this.despawnNightCreatures();
        this.nightSpawned = false;
      }
    });
  }

  private spawnAll() {
    for (const def of Object.values(ANIMALS)) {
      if (def.nightOnly) continue; // hostile night creatures spawn separately
      const factory = MESH_FACTORIES[def.id];
      if (!factory) continue;
      for (let i = 0; i < def.spawnCount; i++) {
        this.spawnAnimal(def, factory, false);
      }
    }
  }

  private spawnNightCreatures() {
    for (const def of Object.values(ANIMALS)) {
      if (!def.nightOnly) continue;
      const factory = MESH_FACTORIES[def.id];
      if (!factory) continue;
      for (let i = 0; i < def.spawnCount; i++) {
        this.spawnAnimal(def, factory, true);
      }
    }
    events.emit('notification', 'You hear creatures stirring in the dark...');
  }

  private despawnNightCreatures() {
    const toRemove = this.animals.filter(a => a.isNightSpawn);
    for (const animal of toRemove) {
      this.group.remove(animal.mesh);
    }
    this.animals = this.animals.filter(a => !a.isNightSpawn);
  }

  private spawnAnimal(def: AnimalDef, factory: () => THREE.Group, isNightSpawn: boolean) {
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
      attackTimer: 0,
      isNightSpawn,
      animTime: Math.random() * 10, // offset so animals don't animate in sync
      isMoving: false,
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
      animal.isMoving = false; // reset each frame — moveToward sets true if actually moving

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
        case 'hostile':
          this.updateHostile(animal, dt, playerPos);
          break;
      }

      // Animate the mesh based on movement and state
      animal.animTime += dt;
      this.animateAnimal(animal, dt);
    }
  }

  private animateAnimal(animal: ActiveAnimal, _dt: number) {
    const mesh = animal.mesh;
    const t = animal.animTime;
    const moving = animal.isMoving;
    const id = animal.def.id;
    const state = animal.state;

    if (id === 'crab') {
      // Legs: fast scuttle when moving, slow rhythmic sway when idle
      const legSpeed = moving ? 18 : 4;
      const legAmp = moving ? 0.5 : 0.2;
      for (let i = 0; i < 3; i++) {
        for (const side of ['l', 'r']) {
          const leg = mesh.getObjectByName(`leg_${i}_${side}`);
          if (leg) {
            const phase = i * 1.5 + (side === 'r' ? Math.PI : 0);
            leg.rotation.x = Math.sin(t * legSpeed + phase) * legAmp;
            leg.rotation.z = (side === 'r' ? 0.6 : -0.6) + Math.sin(t * legSpeed * 0.5 + phase) * 0.1;
          }
        }
      }
      // Claws: constant slow pinch
      const clawL = mesh.getObjectByName('claw_l');
      const clawR = mesh.getObjectByName('claw_r');
      if (clawL) clawL.rotation.z = Math.sin(t * 2.5) * 0.25;
      if (clawR) clawR.rotation.z = -Math.sin(t * 2.5 + 0.5) * 0.25;
      // Body: side-to-side rock
      const body = mesh.getObjectByName('body');
      if (body) {
        body.position.y = Math.sin(t * (moving ? 12 : 3)) * 0.015;
        body.rotation.z = Math.sin(t * (moving ? 8 : 2)) * 0.05;
      }

    } else if (id === 'fish') {
      // Tail: constant wag (fish always swim)
      const tail = mesh.getObjectByName('tail');
      if (tail) tail.rotation.y = Math.sin(t * 7) * 0.5;
      // Fins: flutter
      for (const side of ['l', 'r']) {
        const fin = mesh.getObjectByName(`fin_${side}`);
        if (fin) fin.rotation.z = Math.sin(t * 5 + (side === 'r' ? Math.PI : 0)) * 0.3;
      }
      // Body: gentle sway
      const body = mesh.getObjectByName('body');
      if (body) body.rotation.z = Math.sin(t * 2) * 0.08;

    } else if (id === 'boar') {
      // Walk cycle — visible even at idle (slow weight shift)
      const walkSpeed = moving ? 9 : 2;
      const walkAmp = moving ? 0.55 : 0.1;
      const legPhases: [string, number][] = [['leg_fl', 0], ['leg_fr', Math.PI], ['leg_bl', Math.PI], ['leg_br', 0]];
      for (const [name, phase] of legPhases) {
        const leg = mesh.getObjectByName(name);
        if (leg) leg.rotation.x = Math.sin(t * walkSpeed + phase) * walkAmp;
      }
      // Head: bobs when moving, slow look around when idle
      const head = mesh.getObjectByName('head');
      if (head) {
        head.rotation.x = Math.sin(t * (moving ? 4.5 : 1)) * (moving ? 0.12 : 0.04);
        head.rotation.y = moving ? 0 : Math.sin(t * 0.7) * 0.15;
      }
      // Tail: constant gentle wag
      const tail = mesh.getObjectByName('tail');
      if (tail) tail.rotation.y = Math.sin(t * 4) * 0.35;
      // Body: sway and breathing
      const body = mesh.getObjectByName('body');
      if (body) {
        body.rotation.z = Math.sin(t * (moving ? 4.5 : 1.5)) * (moving ? 0.05 : 0.02);
        body.scale.y = 1 + Math.sin(t * 2) * 0.015; // breathing
      }

    } else if (id === 'wolf') {
      const isAttacking = state === 'attack' || state === 'cooldown';
      const isChasing = state === 'chase';

      // Walk/run/idle cycle — always some leg movement
      const walkSpeed = isChasing ? 14 : (moving ? 9 : 2.5);
      const walkAmp = isChasing ? 0.7 : (moving ? 0.5 : 0.12);
      const legPhases: [string, number][] = [['leg_fl', 0], ['leg_fr', Math.PI], ['leg_bl', Math.PI * 0.5], ['leg_br', Math.PI * 1.5]];
      for (const [name, phase] of legPhases) {
        const leg = mesh.getObjectByName(name);
        if (leg) leg.rotation.x = Math.sin(t * walkSpeed + phase) * walkAmp;
      }

      // Head animation
      const head = mesh.getObjectByName('head');
      if (head) {
        if (isAttacking) {
          head.rotation.x = Math.sin(t * 16) * 0.35;
          head.position.x = 0.88;
        } else if (isChasing) {
          head.rotation.x = -0.12;
          head.position.x = 0.83;
        } else {
          // Idle: look around
          head.rotation.x = Math.sin(t * 1.2) * 0.06;
          head.rotation.y = Math.sin(t * 0.8) * 0.15;
          head.position.x = 0.78;
        }
      }

      // Jaw
      const jaw = mesh.getObjectByName('jaw');
      if (jaw) {
        jaw.rotation.x = isAttacking ? 0.5 + Math.sin(t * 14) * 0.25 : Math.sin(t * 1.5) * 0.02;
      }

      // Tail
      const tail = mesh.getObjectByName('tail');
      if (tail) {
        if (isChasing || isAttacking) {
          tail.rotation.x = 0.4;
          tail.rotation.y = Math.sin(t * 6) * 0.1;
        } else {
          tail.rotation.x = -0.1;
          tail.rotation.y = Math.sin(t * 3) * 0.35;
        }
      }

      // Body sway
      const body = mesh.getObjectByName('body');
      if (body) {
        body.rotation.z = Math.sin(t * walkSpeed * 0.5) * (isChasing ? 0.06 : 0.02);
        body.scale.y = 1 + Math.sin(t * 2.5) * 0.01; // breathing
      }

    } else if (id === 'snake') {
      // Slither wave — always active, faster when moving
      const slitherSpeed = moving ? 5 : 2;
      const slitherAmp = moving ? 0.15 : 0.08;
      for (let i = 0; i < 10; i++) {
        const seg = mesh.getObjectByName(`seg_${i}`);
        if (seg) {
          seg.position.z = Math.sin(t * slitherSpeed + i * 0.7) * slitherAmp;
          seg.position.y = 0.065 + Math.sin(t * slitherSpeed * 0.5 + i * 0.5) * 0.01;
        }
      }

      // Head
      const head = mesh.getObjectByName('head');
      if (head) {
        if (state === 'attack') {
          head.position.x = -0.88;
          head.position.y = 0.14;
          head.rotation.x = -0.3; // rear up
        } else {
          head.position.x = -0.72;
          head.position.y = 0.07;
          head.rotation.x = 0;
          head.rotation.y = Math.sin(t * 1.8) * 0.15;
        }
      }

      // Tongue: periodic flick
      const tongue = mesh.getObjectByName('tongue');
      if (tongue) {
        const flickCycle = (t * 1.5) % 3; // flick every ~2 seconds
        tongue.scale.x = flickCycle < 0.3 ? Math.sin(flickCycle / 0.3 * Math.PI) : 0;
        tongue.visible = flickCycle < 0.3;
      }
    }
  }

  private updateHostile(animal: ActiveAnimal, dt: number, playerPos: THREE.Vector3) {
    const def = animal.def;
    const dx = playerPos.x - animal.mesh.position.x;
    const dz = playerPos.z - animal.mesh.position.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);

    // Check if near a campfire — wolves flee from fire
    if (def.fearsFire && this.placeableManager) {
      const fireRadius = def.fearsFireRadius ?? 8;
      for (const obj of this.placeableManager.getObjects()) {
        if (obj.def.id !== 'campfire') continue;
        const fdx = animal.mesh.position.x - obj.position.x;
        const fdz = animal.mesh.position.z - obj.position.z;
        if (fdx * fdx + fdz * fdz < fireRadius * fireRadius) {
          // Flee from fire
          animal.target.set(
            animal.mesh.position.x + fdx * 2,
            0,
            animal.mesh.position.z + fdz * 2
          );
          this.moveToward(animal, animal.target, def.speed * 1.5, dt);
          return;
        }
      }
    }

    animal.attackTimer = Math.max(0, animal.attackTimer - dt);

    if (animal.state === 'attack' || animal.state === 'cooldown') {
      if (animal.attackTimer <= 0 && dist < 2) {
        // Attack the player
        events.emit('player:raw-damage', def.attackDamage ?? 10);
        animal.attackTimer = def.attackCooldown ?? 1.5;
        animal.state = 'cooldown';
        animal.stateTimer = def.attackCooldown ?? 1.5;
      } else if (dist > 2.5) {
        animal.state = 'chase';
      } else if (animal.stateTimer <= 0) {
        animal.state = 'chase';
      }
    } else if (dist < (def.aggroRange ?? 15)) {
      // Chase the player
      animal.state = 'chase';
      animal.target.set(playerPos.x, 0, playerPos.z);
      this.moveToward(animal, animal.target, def.speed, dt);

      if (dist < 1.5 && animal.attackTimer <= 0) {
        animal.state = 'attack';
        animal.stateTimer = 0;
      }
    } else {
      // Idle/wander when player is far
      this.updateWander(animal, dt);
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
    if (dist < 0.1) {
      animal.isMoving = false;
      return;
    }

    animal.isMoving = true;
    const moveX = (dx / dist) * speed * dt;
    const moveZ = (dz / dist) * speed * dt;
    animal.mesh.position.x += moveX;
    animal.mesh.position.z += moveZ;

    // Terrain following (land animals only)
    if (animal.def.id !== 'fish') {
      const h = this.terrain.getHeightAt(animal.mesh.position.x, animal.mesh.position.z);
      animal.mesh.position.y = h;
    }

    // Face movement direction — models have head along +X, so offset by -PI/2
    if (animal.def.id === 'crab') {
      // Crabs walk sideways — face perpendicular to movement
      animal.mesh.rotation.y = Math.atan2(dx, dz);
    } else {
      animal.mesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
    }
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

  serialize(): { id: string; position: [number, number, number]; health: number; dead: boolean }[] {
    return this.animals.map(a => ({
      id: a.def.id,
      position: [a.mesh.position.x, a.mesh.position.y, a.mesh.position.z] as [number, number, number],
      health: a.health,
      dead: a.dead,
    }));
  }

  deserialize(data: { id: string; position: [number, number, number]; health: number; dead: boolean }[]) {
    for (let i = 0; i < Math.min(data.length, this.animals.length); i++) {
      const animal = this.animals[i];
      const entry = data[i];
      if (animal.def.id !== entry.id) continue; // skip mismatches
      animal.health = entry.health;
      animal.mesh.position.set(entry.position[0], entry.position[1], entry.position[2]);
      if (entry.dead && !animal.dead) {
        animal.dead = true;
        animal.mesh.visible = false;
        this.group.remove(animal.mesh);
        setTimeout(() => this.respawnAnimal(animal), 60000);
      }
    }
  }
}
