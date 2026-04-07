import * as THREE from 'three';
import type { Terrain } from './terrain';

// Shared materials
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
const trunkDarkMat = new THREE.MeshStandardMaterial({ color: 0x6b5010, roughness: 0.95 });
const frondMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.7, side: THREE.DoubleSide });
const frondLightMat = new THREE.MeshStandardMaterial({ color: 0x3a7520, roughness: 0.7, side: THREE.DoubleSide });

function createPalmTree(): THREE.Group {
  const tree = new THREE.Group();

  // Trunk — tapered cylinder with bark rings
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 8, 8), trunkMat);
  trunk.position.y = 4;
  trunk.castShadow = true;
  tree.add(trunk);

  // Bark rings — darker bands for texture
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.16 + i * 0.015, 0.18 + i * 0.015, 0.08, 8), trunkDarkMat);
    ring.position.y = 1.5 + i * 1.6;
    tree.add(ring);
  }

  // Coconut cluster at top
  const coconutMat = new THREE.MeshStandardMaterial({ color: 0x5C3D1E, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), coconutMat);
    coconut.position.set(Math.cos(angle) * 0.15, 7.7, Math.sin(angle) * 0.15);
    tree.add(coconut);
  }

  // Fronds — alternating light/dark for depth
  const frondCount = 7;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2;
    const frondGeometry = new THREE.PlaneGeometry(1.3, 4.2);
    const mat = i % 2 === 0 ? frondMat : frondLightMat;

    // Taper the frond
    const positions = frondGeometry.attributes.position;
    for (let j = 0; j < positions.count; j++) {
      const y = positions.getY(j);
      const taper = 1 - (y + 2.1) / 4.2;
      positions.setX(j, positions.getX(j) * Math.max(0.08, taper));
    }

    const frond = new THREE.Mesh(frondGeometry, mat);
    frond.position.set(Math.cos(angle) * 0.5, 8, Math.sin(angle) * 0.5);
    frond.rotation.set(-Math.PI / 4 - Math.random() * 0.15, angle, 0);
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
      const x = (Math.random() - 0.5) * mapHalf * 1.6;
      const z = (Math.random() - 0.5) * mapHalf * 1.6;
      const height = terrain.getHeightAt(x, z);

      if (height < 2 || height > 20) continue;

      const tree = createPalmTree();
      tree.position.set(x, height, z);
      tree.userData.isPalmTree = true;

      const scale = 0.8 + Math.random() * 0.4;
      tree.scale.setScalar(scale);
      tree.rotation.y = Math.random() * Math.PI * 2;

      this.group.add(tree);
    }
  }
}
