import * as THREE from 'three';
import { events } from '../core/event-bus';

/**
 * Tier 3 Lightning: Branching bolt geometry via recursive midpoint displacement.
 * Appears for 0.1s on each flash, with 1-2 branch forks.
 */

export class LightningBolt {
  readonly group: THREE.Group;
  private bolt: THREE.Line | null = null;
  private branches: THREE.Line[] = [];
  private lifetime = 0;
  private active = false;

  constructor(private scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.scene.add(this.group);

    events.on('weather:lightning', () => this.strike());
  }

  private strike() {
    this.clear();
    this.active = true;
    this.lifetime = 0.12 + Math.random() * 0.08; // 0.12-0.2s visible

    // Random position in sky near player (offset from camera)
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetZ = (Math.random() - 0.5) * 200;

    // Generate main bolt path
    const startY = 90 + Math.random() * 20;
    const endY = 5 + Math.random() * 15;
    const mainPath = this.generateBoltPath(
      new THREE.Vector3(offsetX, startY, offsetZ),
      new THREE.Vector3(offsetX + (Math.random() - 0.5) * 30, endY, offsetZ + (Math.random() - 0.5) * 30),
      6 // subdivision iterations
    );

    this.bolt = this.createBoltLine(mainPath, 3);
    this.group.add(this.bolt);

    // 1-3 branch forks
    const forkCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < forkCount; i++) {
      const forkIdx = Math.floor(mainPath.length * (0.2 + Math.random() * 0.5));
      const forkStart = mainPath[forkIdx].clone();
      const forkEnd = forkStart.clone().add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 40,
          -(10 + Math.random() * 20),
          (Math.random() - 0.5) * 40
        )
      );
      const branchPath = this.generateBoltPath(forkStart, forkEnd, 4);
      const branch = this.createBoltLine(branchPath, 1.5);
      this.group.add(branch);
      this.branches.push(branch);
    }
  }

  private generateBoltPath(start: THREE.Vector3, end: THREE.Vector3, iterations: number): THREE.Vector3[] {
    let points = [start.clone(), end.clone()];

    for (let iter = 0; iter < iterations; iter++) {
      const newPoints: THREE.Vector3[] = [points[0]];
      for (let i = 0; i < points.length - 1; i++) {
        const mid = points[i].clone().lerp(points[i + 1], 0.5);
        // Displace perpendicular to segment
        const segLen = points[i].distanceTo(points[i + 1]);
        const displacement = segLen * 0.25 * Math.pow(0.6, iter);
        mid.x += (Math.random() - 0.5) * displacement;
        mid.y += (Math.random() - 0.5) * displacement * 0.3; // less vertical displacement
        mid.z += (Math.random() - 0.5) * displacement;
        newPoints.push(mid);
        newPoints.push(points[i + 1]);
      }
      points = newPoints;
    }

    return points;
  }

  private createBoltLine(points: THREE.Vector3[], width: number): THREE.Line {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xeeeeff,
      linewidth: width,
      transparent: true,
      opacity: 1,
    });
    return new THREE.Line(geo, mat);
  }

  private clear() {
    if (this.bolt) {
      this.group.remove(this.bolt);
      this.bolt.geometry.dispose();
      (this.bolt.material as THREE.Material).dispose();
      this.bolt = null;
    }
    for (const branch of this.branches) {
      this.group.remove(branch);
      branch.geometry.dispose();
      (branch.material as THREE.Material).dispose();
    }
    this.branches = [];
  }

  update(dt: number, playerPos: THREE.Vector3) {
    if (!this.active) return;

    this.lifetime -= dt;

    // Position bolt relative to player
    this.group.position.set(playerPos.x, 0, playerPos.z);

    // Fade out
    if (this.lifetime < 0.05) {
      const fade = this.lifetime / 0.05;
      if (this.bolt) (this.bolt.material as THREE.LineBasicMaterial).opacity = fade;
      for (const b of this.branches) (b.material as THREE.LineBasicMaterial).opacity = fade * 0.7;
    }

    if (this.lifetime <= 0) {
      this.clear();
      this.active = false;
    }
  }
}
