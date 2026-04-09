import * as THREE from 'three';
import type { Terrain } from './terrain';

/**
 * Tier 3 Vegetation: More organic palm trees with curved trunks,
 * fuller canopies, and natural variation.
 */

// Shared materials
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
const trunkDarkMat = new THREE.MeshStandardMaterial({ color: 0x6b5010, roughness: 0.95 });
const frondMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.7, side: THREE.DoubleSide });
const frondLightMat = new THREE.MeshStandardMaterial({ color: 0x3a7520, roughness: 0.7, side: THREE.DoubleSide });
const frondYoungMat = new THREE.MeshStandardMaterial({ color: 0x4a9530, roughness: 0.65, side: THREE.DoubleSide });
const coconutMat = new THREE.MeshStandardMaterial({ color: 0x5C3D1E, roughness: 0.8 });

function createCurvedTrunk(height: number, curve: number): THREE.Group {
  const group = new THREE.Group();

  // Single tapered cylinder for the main trunk — no gaps
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.28, height, 8),
    trunkMat
  );
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  // Slight lean
  trunk.rotation.z = curve * 0.08;
  group.add(trunk);

  // Bark ring details — thin darker cylinders wrapped around trunk
  for (let i = 0; i < 5; i++) {
    const t = 0.15 + (i / 5) * 0.7;
    const y = t * height;
    const r = 0.28 * (1 - t * 0.55) + 0.015;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r + 0.005, 0.06, 8),
      trunkDarkMat
    );
    ring.position.set(Math.sin(t * Math.PI) * curve * 0.05, y, 0);
    group.add(ring);
  }

  return group;
}

function createFrond(length: number, width: number, droop: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, length, 2, 8);
  const positions = geo.attributes.position;

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const x = positions.getX(i);
    const t = (y + length / 2) / length; // 0 at base, 1 at tip

    // Taper width toward tip — gradual
    positions.setX(i, x * Math.max(0.08, 1 - t * 0.75));

    // Gentle droop — quadratic curve, mild
    positions.setZ(i, -t * t * droop * 0.3);
  }

  geo.computeVertexNormals();
  return new THREE.Mesh(geo, frondMat);
}

function createPalmTree(): THREE.Group {
  const tree = new THREE.Group();

  // Trunk with slight lean
  const trunkHeight = 7 + Math.random() * 2;
  const trunkCurve = 0.3 + Math.random() * 0.4;
  const trunk = createCurvedTrunk(trunkHeight, trunkCurve);
  tree.add(trunk);

  // Crown position
  const crownX = trunkCurve * 0.06; // slight offset matching lean
  const crownY = trunkHeight;

  // Coconut cluster
  for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
    const coconut = new THREE.Mesh(
      new THREE.SphereGeometry(0.09 + Math.random() * 0.03, 5, 4),
      coconutMat
    );
    coconut.position.set(
      crownX + Math.cos(angle) * 0.18,
      crownY - 0.15 - Math.random() * 0.1,
      Math.sin(angle) * 0.18
    );
    coconut.scale.y = 1.15; // slightly elongated
    tree.add(coconut);
  }

  // Fronds — layered: large droopy outer + shorter upright inner
  const frondCount = 7 + Math.floor(Math.random() * 3);
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2 + Math.random() * 0.2;
    const isInner = i % 3 === 0;
    const length = isInner ? 2.5 + Math.random() * 0.5 : 3.5 + Math.random() * 0.5;
    const width = isInner ? 0.9 : 1.2 + Math.random() * 0.2;
    const droop = isInner ? 0.5 : 1.5 + Math.random() * 0.5;

    const frond = createFrond(length, width, droop);
    frond.material = isInner ? frondYoungMat : (i % 2 === 0 ? frondMat : frondLightMat);

    frond.position.set(
      crownX + Math.cos(angle) * 0.3,
      crownY + (isInner ? 0.2 : -0.05),
      Math.sin(angle) * 0.3
    );
    frond.rotation.set(
      -Math.PI / (isInner ? 3 : 4.5) - Math.random() * 0.15,
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
