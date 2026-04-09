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

// Shared materials
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 });
const stoneDarkMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.75 });
const stickMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
const stickDarkMat = new THREE.MeshStandardMaterial({ color: 0x6b5010, roughness: 0.95 });
const fiberMat = new THREE.MeshStandardMaterial({ color: 0x3a7d2a, roughness: 0.75, side: THREE.DoubleSide });
const fiberDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a5d1a, roughness: 0.8, side: THREE.DoubleSide });
const bottleBodyMat = new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1 });
const bottleCapMat = new THREE.MeshStandardMaterial({ color: 0x2266ff, roughness: 0.5 });

/** Create a faceted rock by displacing icosahedron vertices */
function createFacetedRock(radius: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, 0); // 0 detail = 20 faces, sharp angular
  // Randomly displace vertices for irregular shape
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z);
    const displacement = 0.75 + Math.random() * 0.5; // 75-125% of original radius
    pos.setXYZ(i, x / len * radius * displacement, y / len * radius * displacement * 0.7, z / len * radius * displacement);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  return mesh;
}

function makeStone(): THREE.Object3D {
  const group = new THREE.Group();
  // Main faceted rock
  const main = createFacetedRock(0.25, stoneMat);
  main.scale.y = 0.6;
  main.castShadow = true;
  group.add(main);
  // Small chip beside it
  const chip = createFacetedRock(0.1, stoneDarkMat);
  chip.position.set(0.18, -0.02, 0.08);
  chip.scale.y = 0.5;
  group.add(chip);
  return group;
}

function makeStick(): THREE.Object3D {
  const group = new THREE.Group();
  // Main stick
  const main = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.2, 5), stickMat);
  main.rotation.z = Math.PI / 2;
  main.rotation.y = Math.random() * Math.PI;
  main.castShadow = true;
  group.add(main);
  // Small branch stub
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.2, 4), stickDarkMat);
  branch.position.set(0.15, 0.06, 0);
  branch.rotation.z = 0.8;
  group.add(branch);
  return group;
}

function makeFiberPlant(): THREE.Object3D {
  const group = new THREE.Group();
  // Root base — small brown mound
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 3), stickDarkMat);
  base.scale.set(1.5, 0.4, 1.5);
  base.position.y = 0.02;
  group.add(base);
  // Leaf blades — varying heights and angles
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2 + Math.random() * 0.3;
    const h = 0.5 + Math.random() * 0.4;
    const mat = i % 2 === 0 ? fiberMat : fiberDarkMat;
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.15, h), mat);
    blade.position.set(
      Math.cos(angle) * 0.08,
      h * 0.45,
      Math.sin(angle) * 0.08
    );
    blade.rotation.y = angle;
    blade.rotation.x = -0.15 + Math.random() * 0.3;
    group.add(blade);
  }
  return group;
}

function makeRockDeposit(): THREE.Object3D {
  const group = new THREE.Group();
  // Central large rock
  const main = createFacetedRock(0.5, stoneMat);
  main.scale.y = 0.65;
  main.position.y = 0.15;
  main.castShadow = true;
  group.add(main);
  // Surrounding smaller rocks
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 0.4 + Math.random() * 0.3;
    const size = 0.15 + Math.random() * 0.2;
    const mat = i % 2 === 0 ? stoneDarkMat : stoneMat;
    const rock = createFacetedRock(size, mat);
    rock.scale.y = 0.5 + Math.random() * 0.3;
    rock.position.set(Math.cos(angle) * dist, size * 0.25, Math.sin(angle) * dist);
    if (i < 2) rock.castShadow = true;
    group.add(rock);
  }
  // Rubble/debris — tiny chips
  for (let i = 0; i < 4; i++) {
    const chip = createFacetedRock(0.06, stoneDarkMat);
    chip.position.set(
      (Math.random() - 0.5) * 0.9,
      0.02,
      (Math.random() - 0.5) * 0.9
    );
    group.add(chip);
  }
  return group;
}

function makeWaterBottle(): THREE.Object3D {
  const group = new THREE.Group();
  // Body — transparent cylinder
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), bottleBodyMat);
  body.position.y = 0.11;
  body.rotation.z = Math.PI / 2 - 0.2;
  group.add(body);
  // Neck — narrower
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.06, 8), bottleBodyMat);
  neck.position.set(0.12, 0.14, 0);
  neck.rotation.z = Math.PI / 2 - 0.2;
  group.add(neck);
  // Cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), bottleCapMat);
  cap.position.set(0.15, 0.16, 0);
  cap.rotation.z = Math.PI / 2 - 0.2;
  group.add(cap);
  // Label band
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.06, 8), labelMat);
  label.position.set(0, 0.11, 0);
  label.rotation.z = Math.PI / 2 - 0.2;
  group.add(label);
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
