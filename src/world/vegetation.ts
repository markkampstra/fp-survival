import * as THREE from 'three';
import type { Terrain } from './terrain';

function createPalmTree(): THREE.Group {
  const tree = new THREE.Group();

  // Trunk
  const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.3, 8, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b6914,
    roughness: 0.9,
  });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 4;
  trunk.castShadow = true;
  tree.add(trunk);

  // Fronds
  const frondMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d5a1e,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  const frondCount = 7;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2;
    const frondGeometry = new THREE.PlaneGeometry(1.2, 4);

    // Taper the frond by adjusting vertices
    const positions = frondGeometry.attributes.position;
    for (let j = 0; j < positions.count; j++) {
      const y = positions.getY(j);
      const taper = 1 - (y + 2) / 4; // narrower at tip
      positions.setX(j, positions.getX(j) * Math.max(0.1, taper));
    }

    const frond = new THREE.Mesh(frondGeometry, frondMaterial);
    frond.position.set(
      Math.cos(angle) * 0.5,
      8,
      Math.sin(angle) * 0.5
    );
    frond.rotation.set(
      -Math.PI / 4, // droop
      angle,
      0
    );
    frond.castShadow = true;
    tree.add(frond);
  }

  return tree;
}

export class Vegetation {
  readonly group: THREE.Group;

  constructor(terrain: Terrain) {
    this.group = new THREE.Group();

    const treeCount = 40;
    const mapHalf = 250;

    for (let i = 0; i < treeCount; i++) {
      // Random position within island bounds
      const x = (Math.random() - 0.5) * mapHalf * 1.6;
      const z = (Math.random() - 0.5) * mapHalf * 1.6;
      const height = terrain.getHeightAt(x, z);

      // Only place trees in the habitable zone
      if (height < 2 || height > 20) continue;

      const tree = createPalmTree();
      tree.position.set(x, height, z);
      tree.userData.isPalmTree = true;

      // Random scale and rotation
      const scale = 0.8 + Math.random() * 0.4;
      tree.scale.setScalar(scale);
      tree.rotation.y = Math.random() * Math.PI * 2;

      this.group.add(tree);
    }
  }
}
