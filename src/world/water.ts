import * as THREE from 'three';

export class Water {
  readonly mesh: THREE.Mesh;
  private time = 0;

  constructor() {
    const geometry = new THREE.CircleGeometry(5000, 64);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x4a90b0,
      transparent: true,
      opacity: 0.9,
      roughness: 0.1,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = 0.2; // Slightly above 0 to reduce z-fighting
  }

  update(dt: number) {
    this.time += dt;
    this.mesh.position.y = 0.2 + Math.sin(this.time * 0.5) * 0.1;
  }
}
