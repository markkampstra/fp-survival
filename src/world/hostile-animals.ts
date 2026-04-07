import * as THREE from 'three';

// Shared materials
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

  // Body — elongated, muscular
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.5), wolfBodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  // Chest — slightly wider at front
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.5), wolfBellyMat);
  chest.position.set(0.35, 0.5, 0);
  group.add(chest);

  // Head — angular, predatory
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.28), wolfBodyMat);
  head.position.set(0.78, 0.65, 0);
  head.castShadow = true;
  group.add(head);

  // Snout — longer, pointier
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.16), wolfDarkMat);
  snout.position.set(1.0, 0.6, 0);
  group.add(snout);

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), wolfDarkMat);
  nose.position.set(1.12, 0.62, 0);
  group.add(nose);

  // Glowing red eyes
  for (const side of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), wolfEyeMat);
    eye.position.set(0.92, 0.72, side);
    group.add(eye);
  }

  // Ears — tall, pointed
  for (const side of [-0.09, 0.09]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), wolfBodyMat);
    ear.position.set(0.72, 0.88, side);
    group.add(ear);
  }

  // Legs — muscular, thicker at top
  const legPositions: [number, number][] = [[0.4, 0.18], [0.4, -0.18], [-0.4, 0.18], [-0.4, -0.18]];
  for (const [x, z] of legPositions) {
    // Upper leg
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.3, 6), wolfBodyMat);
    upper.position.set(x, 0.3, z);
    group.add(upper);
    // Lower leg
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.2, 6), wolfDarkMat);
    lower.position.set(x, 0.1, z);
    group.add(lower);
    // Paw
    const paw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.06), wolfDarkMat);
    paw.position.set(x, 0.015, z);
    group.add(paw);
  }

  // Tail — bushy, angled down
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.4, 5), wolfBodyMat);
  tail.position.set(-0.8, 0.5, 0);
  tail.rotation.z = -0.8;
  group.add(tail);
  // Tail tip — darker
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), wolfDarkMat);
  tailTip.position.set(-0.93, 0.35, 0);
  group.add(tailTip);

  return group;
}

export function createSnakeMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body — chain of connected segments forming a sine wave
  const segments = 10;
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const x = t * 1.4 - 0.7;
    const z = Math.sin(t * Math.PI * 2.5) * 0.12;
    const radius = 0.065 - t * 0.025;
    const mat = i % 3 === 0 ? snakePatternMat : (i % 3 === 1 ? snakeGreenMat : snakeBellyMat);
    const seg = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.025, radius), 6, 4), mat);
    seg.position.set(x, 0.065, z);
    seg.scale.set(1.4, 0.7, 1);
    if (i === 0) seg.castShadow = true; // only largest segment
    group.add(seg);
  }

  // Head — diamond-shaped (wider than body)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.1), snakeGreenMat);
  head.position.set(-0.72, 0.07, 0);
  head.rotation.y = 0.1;
  head.castShadow = true;
  group.add(head);

  // Jaw — slightly darker, offset down
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.08), snakePatternMat);
  jaw.position.set(-0.73, 0.04, 0);
  group.add(jaw);

  // Eyes — glowing yellow, on sides of head
  for (const side of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), snakeEyeMat);
    eye.position.set(-0.72, 0.1, side);
    group.add(eye);
  }

  // Tongue (red, thin)
  const tongueMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5 });
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.008), tongueMat);
  tongue.position.set(-0.82, 0.06, 0);
  group.add(tongue);

  // Tail tip — tapered
  const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), snakeGreenMat);
  tailTip.position.set(0.74, 0.04, 0);
  tailTip.rotation.z = Math.PI / 2;
  group.add(tailTip);

  return group;
}
