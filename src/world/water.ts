import * as THREE from 'three';

export class Water {
  readonly mesh: THREE.Mesh;
  private time = 0;

  constructor() {
    const geometry = new THREE.PlaneGeometry(2000, 2000, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x006994,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.3,
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
