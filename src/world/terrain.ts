import * as THREE from 'three';
import { fbm } from '../utils/noise';

const SIZE = 500;
const SEGMENTS = 256;
const MAX_HEIGHT = 40;
const ISLAND_RADIUS = 200;

export class Terrain {
  readonly mesh: THREE.Mesh;
  private heightData: Float32Array;
  private geometry: THREE.PlaneGeometry;

  constructor() {
    this.geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    this.geometry.rotateX(-Math.PI / 2);

    this.heightData = new Float32Array((SEGMENTS + 1) * (SEGMENTS + 1));

    const positions = this.geometry.attributes.position;
    const colors: number[] = [];

    const sandColor = new THREE.Color(0xc2b280);
    const grassColor = new THREE.Color(0x4a7c2f);
    const rockColor = new THREE.Color(0x6b6b6b);
    const tmpColor = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Radial falloff for island shape
      const dist = Math.sqrt(x * x + z * z);
      const falloff = Math.max(0, 1 - Math.pow(dist / ISLAND_RADIUS, 2));
      const smoothFalloff = falloff * falloff * (3 - 2 * falloff); // smoothstep

      // Noise-based height
      const noise = (fbm(x, z, 6, 0.5, 2.0, 0.005) + 1) * 0.5; // normalize to 0-1
      const height = noise * MAX_HEIGHT * smoothFalloff;

      positions.setY(i, height);
      this.heightData[i] = height;

      // Vertex colors based on height
      if (height < 1.5) {
        tmpColor.copy(sandColor);
      } else if (height < 15) {
        const t = (height - 1.5) / 13.5;
        tmpColor.copy(sandColor).lerp(grassColor, Math.min(t * 2, 1));
      } else {
        const t = (height - 15) / (MAX_HEIGHT - 15);
        tmpColor.copy(grassColor).lerp(rockColor, t);
      }

      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }

    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: false,
    });

    // Height fog: denser fog at low altitudes for ground-hugging mist
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        `
        #include <fog_vertex>
        vFogDepth = vFogDepth * (1.0 + max(0.0, 8.0 - (modelMatrix * vec4(position, 1.0)).y) * 0.15);
        `
      );
    };

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.receiveShadow = true;
  }

  getHeightAt(x: number, z: number): number {
    // Convert world coords to grid coords
    const gridX = ((x + SIZE / 2) / SIZE) * SEGMENTS;
    const gridZ = ((z + SIZE / 2) / SIZE) * SEGMENTS;

    const ix = Math.floor(gridX);
    const iz = Math.floor(gridZ);
    const fx = gridX - ix;
    const fz = gridZ - iz;

    // Clamp to valid range
    const ix0 = Math.max(0, Math.min(SEGMENTS, ix));
    const ix1 = Math.max(0, Math.min(SEGMENTS, ix + 1));
    const iz0 = Math.max(0, Math.min(SEGMENTS, iz));
    const iz1 = Math.max(0, Math.min(SEGMENTS, iz + 1));

    const stride = SEGMENTS + 1;
    const h00 = this.heightData[iz0 * stride + ix0];
    const h10 = this.heightData[iz0 * stride + ix1];
    const h01 = this.heightData[iz1 * stride + ix0];
    const h11 = this.heightData[iz1 * stride + ix1];

    // Bilinear interpolation
    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;
    return h0 + (h1 - h0) * fz;
  }
}
