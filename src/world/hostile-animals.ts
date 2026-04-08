import * as THREE from 'three';

/**
 * Tier 2 Hostile Animals: Named sub-groups for attack, walk, and idle animation.
 */

const wolfBodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });
const wolfDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 });
const wolfBellyMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.8 });
const wolfEyeMat = new THREE.MeshStandardMaterial({
  color: 0xff0000, emissive: 0xff2200, emissiveIntensity: 6,
});
const snakeGreenMat = new THREE.MeshStandardMaterial({ color: 0x3a5a2a, roughness: 0.7 });
const snakePatternMat = new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.7 });
const snakeBellyMat = new THREE.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 0.7 });
const snakeEyeMat = new THREE.MeshStandardMaterial({
  color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 2,
});

export function createWolfMesh(): THREE.Group {
  const group = new THREE.Group();
  const model = new THREE.Group();
  model.rotation.y = -Math.PI / 2;
  group.add(model);

  // Body (sways during walk)
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.5), wolfBodyMat);
  body.castShadow = true;
  bodyGroup.add(body);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.5), wolfBellyMat);
  chest.position.set(0.35, -0.05, 0);
  bodyGroup.add(chest);
  bodyGroup.position.y = 0.55;
  model.add(bodyGroup);

  // Head (tracks player, lunges on attack)
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0.78, 0.65, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.28), wolfBodyMat);
  head.castShadow = true;
  headGroup.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.16), wolfDarkMat);
  snout.position.set(0.22, -0.05, 0);
  headGroup.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), wolfDarkMat);
  nose.position.set(0.34, -0.03, 0);
  headGroup.add(nose);
  // Jaw (opens on attack)
  const jawGroup = new THREE.Group();
  jawGroup.name = 'jaw';
  jawGroup.position.set(0.15, -0.1, 0);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.14), wolfDarkMat);
  jawGroup.add(jaw);
  headGroup.add(jawGroup);
  // Eyes
  for (const s of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), wolfEyeMat);
    eye.position.set(0.14, 0.07, s);
    headGroup.add(eye);
  }
  // Ears
  for (const s of [-0.09, 0.09]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), wolfBodyMat);
    ear.position.set(-0.06, 0.23, s);
    headGroup.add(ear);
  }
  model.add(headGroup);

  // Legs — each with upper + lower for walk cycle
  const legDefs: [string, number, number][] = [
    ['leg_fl', 0.4, 0.18], ['leg_fr', 0.4, -0.18],
    ['leg_bl', -0.4, 0.18], ['leg_br', -0.4, -0.18],
  ];
  for (const [name, x, z] of legDefs) {
    const legGroup = new THREE.Group();
    legGroup.name = name;
    legGroup.position.set(x, 0.45, z);
    // Upper
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.25, 6), wolfBodyMat);
    upper.position.y = -0.12;
    legGroup.add(upper);
    // Lower
    const lowerGroup = new THREE.Group();
    lowerGroup.name = name + '_lower';
    lowerGroup.position.y = -0.25;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.2, 6), wolfDarkMat);
    lower.position.y = -0.1;
    lowerGroup.add(lower);
    const paw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.06), wolfDarkMat);
    paw.position.y = -0.2;
    lowerGroup.add(paw);
    legGroup.add(lowerGroup);
    model.add(legGroup);
  }

  // Tail (wags, lowers when aggressive)
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(-0.65, 0.55, 0);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.4, 5), wolfBodyMat);
  tail.position.set(-0.1, -0.1, 0);
  tail.rotation.z = -0.6;
  tailGroup.add(tail);
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), wolfDarkMat);
  tailTip.position.set(-0.22, -0.25, 0);
  tailGroup.add(tailTip);
  model.add(tailGroup);

  return group;
}

export function createSnakeMesh(): THREE.Group {
  const group = new THREE.Group();
  const model = new THREE.Group();
  model.rotation.y = -Math.PI / 2;
  group.add(model);

  // Snake body as chain of segment groups — each can be offset for slither
  const segmentCount = 10;
  for (let i = 0; i < segmentCount; i++) {
    const t = i / segmentCount;
    const segGroup = new THREE.Group();
    segGroup.name = `seg_${i}`;
    segGroup.position.set(t * 1.4 - 0.7, 0.065, 0); // slither offset applied in animation

    const radius = 0.065 - t * 0.025;
    const mats = [snakeGreenMat, snakePatternMat, snakeBellyMat];
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.025, radius), 6, 4),
      mats[i % 3]
    );
    seg.scale.set(1.4, 0.7, 1);
    if (i === 0) seg.castShadow = true;
    segGroup.add(seg);
    model.add(segGroup);
  }

  // Head group (lunges on attack)
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(-0.72, 0.07, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.1), snakeGreenMat);
  head.castShadow = true;
  headGroup.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.08), snakePatternMat);
  jaw.position.y = -0.03;
  jaw.name = 'jaw';
  headGroup.add(jaw);
  for (const s of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), snakeEyeMat);
    eye.position.set(0, 0.03, s);
    headGroup.add(eye);
  }
  const tongueMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5 });
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.008), tongueMat);
  tongue.position.set(-0.1, -0.01, 0);
  tongue.name = 'tongue';
  headGroup.add(tongue);
  model.add(headGroup);

  // Tail tip
  const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), snakeGreenMat);
  tailTip.position.set(0.74, 0.04, 0);
  tailTip.rotation.z = Math.PI / 2;
  model.add(tailTip);

  return group;
}
