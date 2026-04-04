import * as THREE from 'three';

export function createCrabMesh(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xD4603A, roughness: 0.7 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.3), bodyMat);
  body.position.y = 0.12;
  body.castShadow = true;
  group.add(body);

  // Legs (6)
  const legMat = new THREE.MeshStandardMaterial({ color: 0xC0503A, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.2), legMat);
      leg.position.set(side * 0.22, 0.06, (i - 1) * 0.1);
      leg.rotation.x = 0.3 * side;
      group.add(leg);
    }
  }

  // Claws
  for (const side of [-1, 1]) {
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), bodyMat);
    claw.position.set(side * 0.28, 0.15, 0.15);
    group.add(claw);
  }

  return group;
}

export function createFishMesh(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8BADC4, roughness: 0.3, metalness: 0.2 });

  // Body (elongated ellipsoid)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bodyMat);
  body.scale.set(2.5, 0.8, 1);
  body.position.y = 0.1;
  group.add(body);

  // Tail
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7A9DB4, roughness: 0.4, side: THREE.DoubleSide });
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), tailMat);
  tail.position.set(-0.45, 0.1, 0);
  tail.rotation.y = Math.PI / 2;
  group.add(tail);

  return group;
}

export function createBoarMesh(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.85 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.5), bodyMat);
  body.position.y = 0.45;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), bodyMat);
  head.position.set(0.55, 0.45, 0);
  head.castShadow = true;
  group.add(head);

  // Snout
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0x8B5A3A, roughness: 0.7 });
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.15, 6), snoutMat);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(0.78, 0.4, 0);
  group.add(snout);

  // Legs (4)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x5A3520, roughness: 0.9 });
  const legPositions = [
    [0.3, 0, 0.2], [0.3, 0, -0.2],
    [-0.3, 0, 0.2], [-0.3, 0, -0.2],
  ];
  for (const [x, _y, z] of legPositions) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), legMat);
    leg.position.set(x, 0.175, z);
    group.add(leg);
  }

  return group;
}
