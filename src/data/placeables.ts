import * as THREE from 'three';

export interface PlaceableInteraction {
  promptText: string;
  action: string;
  requiresItem?: string;
}

export interface PlaceableDef {
  id: string;
  name: string;
  createMesh: () => THREE.Object3D;
  createGhostMesh: () => THREE.Object3D;
  footprint: number;
  interactions: PlaceableInteraction[];
}

// Maps inventory item IDs to placeable definition IDs
export const ITEM_TO_PLACEABLE: Record<string, string> = {
  campfire_item: 'campfire',
  shelter_item: 'shelter',
  storage_box_item: 'storage_box',
  water_collector_item: 'water_collector',
};

function makeGhost(size: number): THREE.Object3D {
  const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.6, size), mat);
  mesh.position.y = size * 0.3;
  return mesh;
}

// --- Campfire ---
function createCampfireMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.2), stoneMat);
    stone.position.set(Math.cos(angle) * 0.5, 0.075, Math.sin(angle) * 0.5);
    stone.rotation.y = angle;
    stone.castShadow = true;
    group.add(stone);
  }
  const fireMat = new THREE.MeshStandardMaterial({
    color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 6,
    transparent: true, opacity: 0.8, side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), fireMat);
    flame.position.y = 0.3;
    flame.rotation.y = (i / 3) * Math.PI;
    flame.userData.isFlame = true;
    group.add(flame);
  }
  return group;
}

// --- Shelter ---
function createShelterMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6E4B3A, roughness: 0.9 });

  // Two vertical poles
  for (const xOff of [-1.2, 1.2]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), woodMat);
    pole.position.set(xOff, 1.25, 0);
    pole.castShadow = true;
    group.add(pole);
  }
  // Rear short pole
  const rearPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), woodMat);
  rearPole.position.set(0, 0.6, -1.5);
  rearPole.castShadow = true;
  group.add(rearPole);

  // Angled roof
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4A7C2F, roughness: 0.8, side: THREE.DoubleSide });
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2), roofMat);
  roof.position.set(0, 1.6, -0.75);
  roof.rotation.x = -0.5;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Cross beam
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), woodMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, 2.4, 0);
  group.add(beam);

  return group;
}

// --- Storage Box ---
function createStorageBoxMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.8), woodMat);
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  // Lid (slightly different shade)
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x9B7924, roughness: 0.85 });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.85), lidMat);
  lid.position.y = 0.74;
  lid.castShadow = true;
  group.add(lid);

  // Dark edge strips
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x5C3D1E, roughness: 0.9 });
  for (const z of [-0.35, 0.35]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.04), stripMat);
    strip.position.set(0, 0.35, z);
    group.add(strip);
  }

  return group;
}

// --- Water Collector ---
function createWaterCollectorMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xA0724A, roughness: 0.9 });

  // Tripod legs
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), stickMat);
    leg.position.set(Math.cos(angle) * 0.35, 0.5, Math.sin(angle) * 0.35);
    leg.rotation.x = Math.sin(angle) * 0.2;
    leg.rotation.z = -Math.cos(angle) * 0.2;
    group.add(leg);
  }

  // Bowl (flattened hemisphere)
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x5C3D1E, roughness: 0.8, side: THREE.DoubleSide });
  const bowlGeo = new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const bowl = new THREE.Mesh(bowlGeo, bowlMat);
  bowl.rotation.x = Math.PI;
  bowl.position.y = 0.9;
  group.add(bowl);

  // Water level indicator (blue disc, initially hidden)
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3399aa, transparent: true, opacity: 0.6, roughness: 0.1,
  });
  const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), waterMat);
  waterDisc.rotation.x = -Math.PI / 2;
  waterDisc.position.y = 0.88;
  waterDisc.scale.set(0, 0, 0); // starts empty
  waterDisc.userData.isWaterLevel = true;
  group.add(waterDisc);

  return group;
}

export const PLACEABLES: Record<string, PlaceableDef> = {
  campfire: {
    id: 'campfire',
    name: 'Campfire',
    createMesh: createCampfireMesh,
    createGhostMesh: () => makeGhost(1.2),
    footprint: 1.5,
    interactions: [
      { promptText: 'Cook Coconut', action: 'cook', requiresItem: 'coconut' },
      { promptText: 'Cook Raw Meat', action: 'cook_meat', requiresItem: 'raw_meat' },
      { promptText: 'Cook Raw Fish', action: 'cook_fish', requiresItem: 'raw_fish' },
      { promptText: 'Cook Crab Meat', action: 'cook_crab', requiresItem: 'raw_crab_meat' },
      { promptText: 'Boil Water', action: 'boil_water', requiresItem: 'dirty_water' },
    ],
  },
  shelter: {
    id: 'shelter',
    name: 'Shelter',
    createMesh: createShelterMesh,
    createGhostMesh: () => makeGhost(2.5),
    footprint: 3.0,
    interactions: [
      { promptText: 'Sleep (skip to dawn)', action: 'sleep' },
    ],
  },
  storage_box: {
    id: 'storage_box',
    name: 'Storage Box',
    createMesh: createStorageBoxMesh,
    createGhostMesh: () => makeGhost(1.0),
    footprint: 1.5,
    interactions: [
      { promptText: 'Open Storage', action: 'open_storage' },
    ],
  },
  water_collector: {
    id: 'water_collector',
    name: 'Water Collector',
    createMesh: createWaterCollectorMesh,
    createGhostMesh: () => makeGhost(0.8),
    footprint: 1.0,
    interactions: [
      { promptText: 'Collect Water', action: 'collect_water' },
    ],
  },
};
