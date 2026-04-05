import * as THREE from 'three';

export function createWolfMesh(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.45), bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.3), bodyMat);
  head.position.set(0.7, 0.6, 0);
  head.castShadow = true;
  group.add(head);

  // Snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.15), darkMat);
  snout.position.set(0.92, 0.55, 0);
  group.add(snout);

  // Glowing red eyes (triggers bloom)
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff0000, emissive: 0xff2200, emissiveIntensity: 3,
  });
  for (const side of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), eyeMat);
    eye.position.set(0.88, 0.65, side);
    group.add(eye);
  }

  // Ears
  for (const side of [-0.1, 0.1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), bodyMat);
    ear.position.set(0.65, 0.8, side);
    group.add(ear);
  }

  // Legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
  for (const [x, z] of [[0.35, 0.15], [0.35, -0.15], [-0.35, 0.15], [-0.35, -0.15]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), legMat);
    leg.position.set(x, 0.2, z);
    group.add(leg);
  }

  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.35, 4), darkMat);
  tail.position.set(-0.7, 0.55, 0);
  tail.rotation.z = -0.5;
  group.add(tail);

  return group;
}

export function createSnakeMesh(): THREE.Group {
  const group = new THREE.Group();
  const snakeMat = new THREE.MeshStandardMaterial({ color: 0x3a5a2a, roughness: 0.7 });
  const patternMat = new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.7 });

  // Body — series of segments forming a sine wave
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const x = t * 1.2 - 0.6;
    const z = Math.sin(t * Math.PI * 2) * 0.15;
    const radius = 0.06 - t * 0.02; // taper toward tail
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.02, radius), 6, 4),
      i % 2 === 0 ? snakeMat : patternMat
    );
    seg.position.set(x, 0.06, z);
    seg.scale.x = 1.5;
    group.add(seg);
  }

  // Head — slightly larger
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), snakeMat);
  head.position.set(-0.6, 0.08, 0);
  head.scale.set(1.5, 0.8, 1);
  group.add(head);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 1,
  });
  for (const side of [-0.04, 0.04]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), eyeMat);
    eye.position.set(-0.66, 0.1, side);
    group.add(eye);
  }

  return group;
}
