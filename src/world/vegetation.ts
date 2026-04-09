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

function createCurvedTrunk(height: number, curve: number, segments: number): THREE.Group {
  const group = new THREE.Group();
  const segHeight = height / segments;

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const nextT = (i + 1) / segments;
    const bottomRadius = 0.28 * (1 - t * 0.55); // taper from 0.28 to ~0.13
    const topRadius = 0.28 * (1 - nextT * 0.55);
    const mat = i % 3 === 0 ? trunkDarkMat : trunkMat;

    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(topRadius, bottomRadius, segHeight, 7),
      mat
    );

    // Curve the trunk slightly — each segment offset from previous
    const curveOffset = Math.sin(t * Math.PI) * curve;
    seg.position.set(curveOffset, t * height + segHeight / 2, 0);

    // Slight tilt to follow curve
    if (i > 0) {
      seg.rotation.z = Math.cos(t * Math.PI) * curve * 0.15;
    }

    if (i < 3) seg.castShadow = true;
    group.add(seg);
  }

  return group;
}

function createFrond(length: number, width: number, droop: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, length, 1, 5);
  const positions = geo.attributes.position;

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const x = positions.getX(i);
    const t = (y + length / 2) / length; // 0 at base, 1 at tip

    // Taper width toward tip
    positions.setX(i, x * Math.max(0.05, 1 - t * 0.85));

    // Droop curve — tip hangs down
    positions.setZ(i, -t * t * droop);

    // Slight wavy edge
    positions.setX(i, positions.getX(i) + Math.sin(t * 6) * 0.03);
  }

  geo.computeVertexNormals();
  return new THREE.Mesh(geo, frondMat);
}

function createPalmTree(): THREE.Group {
  const tree = new THREE.Group();

  // Curved trunk (6-8 segments)
  const trunkHeight = 7 + Math.random() * 2;
  const trunkCurve = 0.3 + Math.random() * 0.5;
  const trunk = createCurvedTrunk(trunkHeight, trunkCurve, 7);
  tree.add(trunk);

  // Crown position (top of curved trunk)
  const crownX = Math.sin(Math.PI) * trunkCurve * 0.3; // slight offset from curve
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
    const length = isInner ? 2.5 + Math.random() * 0.5 : 3.8 + Math.random() * 0.8;
    const width = isInner ? 0.8 : 1.2 + Math.random() * 0.3;
    const droop = isInner ? 0.3 : 1.0 + Math.random() * 0.5;

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
