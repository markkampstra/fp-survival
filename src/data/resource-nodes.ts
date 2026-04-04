import * as THREE from 'three';

export interface ResourceNodeDef {
  id: string;
  name: string;
  createMesh: () => THREE.Object3D;
  drops: { itemId: string; min: number; max: number }[];
  interactTime: number;
  requiresTool?: string;
  toolBonusMultiplier?: number;
  spawnHeightRange: [number, number];
  respawnTime: number;
  spawnCount: number;
}

function makeStone(): THREE.Object3D {
  const geo = new THREE.SphereGeometry(0.3, 6, 4);
  geo.scale(1, 0.6, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function makeStick(): THREE.Object3D {
  const geo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = Math.PI / 2;
  mesh.rotation.y = Math.random() * Math.PI;
  mesh.castShadow = true;
  return mesh;
}

function makeFiberPlant(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a7d2a, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.PlaneGeometry(0.3, 0.8);
    const blade = new THREE.Mesh(geo, mat);
    blade.position.set(
      (Math.random() - 0.5) * 0.3,
      0.4,
      (Math.random() - 0.5) * 0.3
    );
    blade.rotation.y = Math.random() * Math.PI;
    blade.rotation.x = -0.2 + Math.random() * 0.4;
    group.add(blade);
  }
  return group;
}

function makeRockDeposit(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.SphereGeometry(0.4 + Math.random() * 0.3, 6, 4);
    geo.scale(1, 0.7, 1);
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(
      (Math.random() - 0.5) * 0.6,
      0,
      (Math.random() - 0.5) * 0.6
    );
    rock.castShadow = true;
    group.add(rock);
  }
  return group;
}

function makeWaterBottle(): THREE.Object3D {
  const group = new THREE.Group();
  // Body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8),
    new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.6, roughness: 0.1 })
  );
  body.position.y = 0.12;
  body.rotation.z = Math.PI / 2 - 0.3;
  group.add(body);
  // Cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8),
    new THREE.MeshStandardMaterial({ color: 0x2266ff, roughness: 0.5 })
  );
  cap.position.set(0.13, 0.17, 0);
  cap.rotation.z = Math.PI / 2 - 0.3;
  group.add(cap);
  return group;
}

export const RESOURCE_NODES: Record<string, ResourceNodeDef> = {
  loose_stone: {
    id: 'loose_stone', name: 'Loose Stone',
    createMesh: makeStone,
    drops: [{ itemId: 'stone', min: 1, max: 2 }],
    interactTime: 0,
    spawnHeightRange: [1, 25],
    respawnTime: 120,
    spawnCount: 100,
  },
  stick_ground: {
    id: 'stick_ground', name: 'Stick',
    createMesh: makeStick,
    drops: [{ itemId: 'stick', min: 1, max: 1 }],
    interactTime: 0,
    spawnHeightRange: [2, 18],
    respawnTime: 90,
    spawnCount: 80,
  },
  fiber_plant: {
    id: 'fiber_plant', name: 'Fiber Plant',
    createMesh: makeFiberPlant,
    drops: [{ itemId: 'fiber', min: 2, max: 4 }],
    interactTime: 1,
    spawnHeightRange: [2, 15],
    respawnTime: 180,
    spawnCount: 60,
  },
  rock_deposit: {
    id: 'rock_deposit', name: 'Rock Deposit',
    createMesh: makeRockDeposit,
    drops: [{ itemId: 'stone', min: 2, max: 5 }],
    interactTime: 3,
    requiresTool: 'pickaxe',
    toolBonusMultiplier: 2,
    spawnHeightRange: [12, 30],
    respawnTime: 300,
    spawnCount: 25,
  },
  water_bottle: {
    id: 'water_bottle', name: 'Plastic Bottle',
    createMesh: makeWaterBottle,
    drops: [{ itemId: 'water_bottle', min: 1, max: 1 }],
    interactTime: 0,
    spawnHeightRange: [0.3, 1.8],
    respawnTime: 600,
    spawnCount: 8,
  },
};
