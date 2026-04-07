import * as THREE from 'three';

// Shared materials — reused across all passive animals
const crabBodyMat = new THREE.MeshStandardMaterial({ color: 0xD4603A, roughness: 0.75 });
const crabLegMat = new THREE.MeshStandardMaterial({ color: 0xB8503A, roughness: 0.8 });
const fishBodyMat = new THREE.MeshStandardMaterial({ color: 0x8BADC4, roughness: 0.3, metalness: 0.15 });
const fishFinMat = new THREE.MeshStandardMaterial({ color: 0x7A9DB4, roughness: 0.4, side: THREE.DoubleSide });
const fishEyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
const boarBodyMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.85 });
const boarDarkMat = new THREE.MeshStandardMaterial({ color: 0x5A3520, roughness: 0.9 });
const boarSnoutMat = new THREE.MeshStandardMaterial({ color: 0x9B6A4A, roughness: 0.7 });

export function createCrabMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body — flattened box
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.35), crabBodyMat);
  body.position.y = 0.14;
  body.castShadow = true;
  group.add(body);

  // Shell detail — slightly raised bump on top
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), crabBodyMat);
  shell.scale.set(1.2, 0.5, 0.9);
  shell.position.y = 0.22;
  group.add(shell);

  // Eyes on stalks
  for (const side of [-0.1, 0.1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 4), crabLegMat);
    stalk.position.set(0.12, 0.28, side);
    group.add(stalk);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), fishEyeMat);
    eye.position.set(0.12, 0.33, side);
    group.add(eye);
  }

  // Legs (6) — thicker, angled properly
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.22, 4), crabLegMat);
      leg.position.set(-0.05 + i * 0.12, 0.08, side * 0.22);
      leg.rotation.z = side * 0.6;
      leg.rotation.x = 0.2;
      group.add(leg);
    }
  }

  // Claws — oversized for readability
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.15, 4), crabBodyMat);
    arm.position.set(0.22, 0.16, side * 0.15);
    arm.rotation.z = side * 0.4 + 0.5;
    group.add(arm);
    // Pincer
    const pincer = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), crabBodyMat);
    pincer.position.set(0.32, 0.22, side * 0.15);
    group.add(pincer);
  }

  return group;
}

export function createFishMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body — stretched ellipsoid
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), fishBodyMat);
  body.scale.set(2.5, 0.8, 1);
  body.position.y = 0.1;
  body.castShadow = true;
  group.add(body);

  // Tail fin
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), fishFinMat);
  tail.position.set(-0.48, 0.1, 0);
  tail.rotation.y = Math.PI / 2;
  group.add(tail);

  // Dorsal fin
  const dorsal = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), fishFinMat);
  dorsal.position.set(-0.05, 0.24, 0);
  dorsal.rotation.y = Math.PI / 2;
  group.add(dorsal);

  // Side fins
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), fishFinMat);
    fin.position.set(0.1, 0.05, side * 0.15);
    fin.rotation.x = side * 0.5;
    group.add(fin);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), fishEyeMat);
    eye.position.set(0.35, 0.14, side * 0.12);
    group.add(eye);
  }

  return group;
}

export function createBoarMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body — barrel-shaped
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.55), boarBodyMat);
  body.position.y = 0.48;
  body.castShadow = true;
  group.add(body);

  // Belly (slightly lighter, rounder)
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), boarBodyMat);
  belly.scale.set(1.8, 0.8, 1);
  belly.position.set(0, 0.35, 0);
  group.add(belly);

  // Head — oversized for readability
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), boarBodyMat);
  head.position.set(0.6, 0.5, 0);
  head.castShadow = true;
  group.add(head);

  // Snout — pink/lighter
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 6), boarSnoutMat);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(0.82, 0.45, 0);
  group.add(snout);

  // Nostrils
  for (const side of [-0.03, 0.03]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), boarDarkMat);
    nostril.position.set(0.88, 0.45, side);
    group.add(nostril);
  }

  // Eyes
  for (const side of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), fishEyeMat);
    eye.position.set(0.72, 0.58, side);
    group.add(eye);
  }

  // Ears — small triangular
  for (const side of [-0.14, 0.14]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 4), boarBodyMat);
    ear.position.set(0.55, 0.75, side);
    ear.rotation.z = side > 0 ? 0.3 : -0.3;
    group.add(ear);
  }

  // Legs — thick, positioned at corners
  const legPositions: [number, number][] = [[0.3, 0.2], [0.3, -0.2], [-0.3, 0.2], [-0.3, -0.2]];
  for (const [x, z] of legPositions) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.25, 6), boarDarkMat);
    upper.position.set(x, 0.22, z);
    group.add(upper);
    // Hoof
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 6), boarDarkMat);
    hoof.position.set(x, 0.03, z);
    group.add(hoof);
  }

  // Tail — small curly
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 4, 6, Math.PI), boarDarkMat);
  tail.position.set(-0.52, 0.55, 0);
  tail.rotation.y = Math.PI / 2;
  group.add(tail);

  return group;
}
