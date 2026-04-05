import * as THREE from 'three';

/**
 * Starfield: Points on a large sphere, visible at night.
 * Stars twinkle with slight random brightness variation.
 */

const STAR_COUNT = 1500;

export class Stars {
  readonly mesh: THREE.Points;
  private baseSizes: Float32Array;
  private time = 0;

  constructor() {
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    this.baseSizes = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Distribute on upper hemisphere — only above 20° elevation (no stars near horizon)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.15 + Math.random() * 0.65); // ~20° to ~80° elevation
      const r = 900;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi); // Y = up
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Star color: mostly white, some warm, some blue
      const colorRoll = Math.random();
      if (colorRoll < 0.1) {
        // Warm/orange star
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.85;
        colors[i * 3 + 2] = 0.6;
      } else if (colorRoll < 0.2) {
        // Blue star
        colors[i * 3] = 0.7;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 1.0;
      } else {
        // White
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
      }

      // Varying brightness via size (needs to be large enough to survive tone mapping)
      this.baseSizes[i] = 1.5 + Math.random() * 3.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(this.baseSizes), 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * glow, glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      toneMapped: false,
      fog: false,
    });

    this.mesh = new THREE.Points(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 99; // render after sky dome and clouds
  }

  /** Update twinkling and visibility based on sun elevation */
  update(dt: number, sunElevation: number, cloudCoverage: number) {
    this.time += dt;

    // Stars visible only at night (sun below horizon) and when sky is clear
    const nightFactor = Math.max(0, Math.min(1, (-sunElevation - 5) / 15)); // fade in below -5°
    const clearFactor = Math.max(0, 1 - cloudCoverage * 1.5); // fade out with clouds
    const visibility = nightFactor * clearFactor;

    this.mesh.visible = visibility > 0.01;
    if (!this.mesh.visible) return;

    // Gentle twinkle: slow, subtle brightness variation (not rapid flicker)
    const sizes = this.mesh.geometry.attributes.size as THREE.BufferAttribute;
    for (let i = 0; i < STAR_COUNT; i++) {
      // Very slow oscillation (0.3-0.7 Hz) with small amplitude (±10%)
      const twinkle = Math.sin(this.time * (0.3 + (i % 5) * 0.1) + i * 2.71) * 0.1;
      sizes.setX(i, this.baseSizes[i] * (1 + twinkle) * visibility);
    }
    sizes.needsUpdate = true;
  }

  /** Keep centered on player */
  follow(playerPos: THREE.Vector3) {
    this.mesh.position.x = playerPos.x;
    this.mesh.position.z = playerPos.z;
  }
}
