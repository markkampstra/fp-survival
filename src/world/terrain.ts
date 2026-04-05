import * as THREE from 'three';
import { fbm } from '../utils/noise';
import { getBiomeColor } from './biome';

export const TERRAIN_SIZE = 500;
export const TERRAIN_SEGMENTS = 256;
const MAX_HEIGHT = 40;
const ISLAND_RADIUS = 200;

export class Terrain {
  readonly mesh: THREE.Mesh;
  readonly heightData: Float32Array;
  private geometry: THREE.PlaneGeometry;

  constructor() {
    this.geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    this.geometry.rotateX(-Math.PI / 2);

    this.heightData = new Float32Array((TERRAIN_SEGMENTS + 1) * (TERRAIN_SEGMENTS + 1));

    const positions = this.geometry.attributes.position;
    const colors: number[] = [];

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

      // Biome-based vertex colors
      const biomeColor = getBiomeColor(height, noise);
      colors.push(biomeColor.r, biomeColor.g, biomeColor.b);
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
    const gridX = ((x + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * TERRAIN_SEGMENTS;
    const gridZ = ((z + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * TERRAIN_SEGMENTS;

    const ix = Math.floor(gridX);
    const iz = Math.floor(gridZ);
    const fx = gridX - ix;
    const fz = gridZ - iz;

    // Clamp to valid range
    const ix0 = Math.max(0, Math.min(TERRAIN_SEGMENTS, ix));
    const ix1 = Math.max(0, Math.min(TERRAIN_SEGMENTS, ix + 1));
    const iz0 = Math.max(0, Math.min(TERRAIN_SEGMENTS, iz));
    const iz1 = Math.max(0, Math.min(TERRAIN_SEGMENTS, iz + 1));

    const stride = TERRAIN_SEGMENTS + 1;
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
