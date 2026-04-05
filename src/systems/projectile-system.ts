import * as THREE from 'three';
import { events } from '../core/event-bus';

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
}

const GRAVITY = -15;
const ARROW_SPEED = 40;

export class ProjectileSystem {
  private projectiles: Projectile[] = [];
  private arrowGeo: THREE.CylinderGeometry;
  private arrowMat: THREE.MeshStandardMaterial;

  constructor(private scene: THREE.Scene) {
    this.arrowGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
    this.arrowMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });

    events.on('projectile:fire', (pos: THREE.Vector3, dir: THREE.Vector3) => {
      this.fireArrow(pos, dir);
    });
  }

  private fireArrow(pos: THREE.Vector3, dir: THREE.Vector3) {
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    mesh.position.copy(pos);

    // Point arrow along direction
    const axis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir.clone().normalize());
    mesh.quaternion.copy(quat);

    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: dir.clone().normalize().multiplyScalar(ARROW_SPEED),
      lifetime: 3,
    });
  }

  update(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.lifetime -= dt;

      // Apply gravity
      p.velocity.y += GRAVITY * dt;

      // Move
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Rotate to match velocity direction
      const dir = p.velocity.clone().normalize();
      const axis = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir);
      p.mesh.quaternion.copy(quat);

      // Check hit — emit event with position for AnimalSystem to check
      events.emit('projectile:check-hit', p.mesh.position, 1.5);

      // Remove if expired or hit ground
      if (p.lifetime <= 0 || p.mesh.position.y < -1) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }
}
