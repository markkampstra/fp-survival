import * as THREE from 'three';

/**
 * Tier 2 Animals: Composed meshes with named sub-groups for animation.
 * Each animal returns a Group with named children that the AnimalSystem
 * can access and animate per-frame (legs, head, tail, body).
 */

// Shared materials
const crabBodyMat = new THREE.MeshStandardMaterial({ color: 0xD4603A, roughness: 0.75 });
const crabLegMat = new THREE.MeshStandardMaterial({ color: 0xB8503A, roughness: 0.8 });
const fishBodyMat = new THREE.MeshStandardMaterial({ color: 0x8BADC4, roughness: 0.3, metalness: 0.15 });
const fishFinMat = new THREE.MeshStandardMaterial({ color: 0x7A9DB4, roughness: 0.4, side: THREE.DoubleSide });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
const boarBodyMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.85 });
const boarDarkMat = new THREE.MeshStandardMaterial({ color: 0x5A3520, roughness: 0.9 });
const boarSnoutMat = new THREE.MeshStandardMaterial({ color: 0x9B6A4A, roughness: 0.7 });

export function createCrabMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body (static)
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.35), crabBodyMat);
  body.position.y = 0.14;
  body.castShadow = true;
  bodyGroup.add(body);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), crabBodyMat);
  shell.scale.set(1.2, 0.5, 0.9);
  shell.position.y = 0.22;
  bodyGroup.add(shell);
  // Eyes
  for (const side of [-0.1, 0.1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 4), crabLegMat);
    stalk.position.set(0.12, 0.28, side);
    bodyGroup.add(stalk);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), eyeMat);
    eye.position.set(0.12, 0.33, side);
    bodyGroup.add(eye);
  }
  group.add(bodyGroup);

  // Legs — each pair in a group for scuttling animation
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const legGroup = new THREE.Group();
      legGroup.name = `leg_${i}_${side > 0 ? 'r' : 'l'}`;
      legGroup.position.set(-0.05 + i * 0.12, 0.08, side * 0.18);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.22, 4), crabLegMat);
      leg.rotation.z = side * 0.6;
      legGroup.add(leg);
      group.add(legGroup);
    }
  }

  // Claws — in groups for pinch animation
  for (const side of [-1, 1]) {
    const clawGroup = new THREE.Group();
    clawGroup.name = `claw_${side > 0 ? 'r' : 'l'}`;
    clawGroup.position.set(0.22, 0.16, side * 0.15);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.15, 4), crabBodyMat);
    arm.rotation.z = 0.5;
    clawGroup.add(arm);
    const pincer = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), crabBodyMat);
    pincer.position.set(0.1, 0.06, 0);
    clawGroup.add(pincer);
    group.add(clawGroup);
  }

  return group;
}

export function createFishMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), fishBodyMat);
  body.scale.set(2.5, 0.8, 1);
  body.castShadow = true;
  bodyGroup.add(body);
  // Dorsal fin
  const dorsal = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), fishFinMat);
  dorsal.position.set(-0.05, 0.14, 0);
  dorsal.rotation.y = Math.PI / 2;
  bodyGroup.add(dorsal);
  // Side fins (animated separately)
  for (const side of [-1, 1]) {
    const finGroup = new THREE.Group();
    finGroup.name = `fin_${side > 0 ? 'r' : 'l'}`;
    finGroup.position.set(0.1, -0.05, side * 0.15);
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), fishFinMat);
    fin.rotation.x = side * 0.3;
    finGroup.add(fin);
    bodyGroup.add(finGroup);
  }
  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), eyeMat);
    eye.position.set(0.35, 0.04, side * 0.12);
    bodyGroup.add(eye);
  }
  group.add(bodyGroup);

  // Tail — separate group for swimming wag
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(-0.45, 0, 0);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), fishFinMat);
  tail.rotation.y = Math.PI / 2;
  tailGroup.add(tail);
  group.add(tailGroup);

  return group;
}

export function createBoarMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body group (sways when moving)
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.55), boarBodyMat);
  body.position.y = 0.48;
  body.castShadow = true;
  bodyGroup.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), boarBodyMat);
  belly.scale.set(1.8, 0.8, 1);
  belly.position.set(0, 0.35, 0);
  bodyGroup.add(belly);
  group.add(bodyGroup);

  // Head group (bobs when walking, turns when fleeing)
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0.6, 0.5, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), boarBodyMat);
  head.castShadow = true;
  headGroup.add(head);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 6), boarSnoutMat);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(0.22, -0.05, 0);
  headGroup.add(snout);
  for (const s of [-0.03, 0.03]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), boarDarkMat);
    nostril.position.set(0.28, -0.05, s);
    headGroup.add(nostril);
  }
  for (const s of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), eyeMat);
    eye.position.set(0.12, 0.08, s);
    headGroup.add(eye);
  }
  for (const s of [-0.14, 0.14]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 4), boarBodyMat);
    ear.position.set(-0.05, 0.25, s);
    ear.rotation.z = s > 0 ? 0.3 : -0.3;
    headGroup.add(ear);
  }
  group.add(headGroup);

  // Legs — each in own group for walk cycle
  const legDefs: [string, number, number][] = [
    ['leg_fl', 0.3, 0.2], ['leg_fr', 0.3, -0.2],
    ['leg_bl', -0.3, 0.2], ['leg_br', -0.3, -0.2],
  ];
  for (const [name, x, z] of legDefs) {
    const legGroup = new THREE.Group();
    legGroup.name = name;
    legGroup.position.set(x, 0.3, z);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.25, 6), boarDarkMat);
    upper.position.y = -0.08;
    legGroup.add(upper);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 6), boarDarkMat);
    hoof.position.y = -0.23;
    legGroup.add(hoof);
    group.add(legGroup);
  }

  // Tail — separate for wagging
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(-0.52, 0.55, 0);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 4, 6, Math.PI), boarDarkMat);
  tail.rotation.y = Math.PI / 2;
  tailGroup.add(tail);
  group.add(tailGroup);

  return group;
}
