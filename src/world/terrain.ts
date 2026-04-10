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
      let height = noise * MAX_HEIGHT * smoothFalloff;

      // Sink terrain below water beyond the island so mesh edges are invisible
      if (dist > ISLAND_RADIUS * 0.95) {
        const sinkT = (dist - ISLAND_RADIUS * 0.95) / (ISLAND_RADIUS * 0.3);
        height = height - Math.max(0, sinkT) * 3; // dip up to 3 units below water
      }

      positions.setY(i, height);
      this.heightData[i] = height;

      // Biome-based vertex colors with baked ambient occlusion
      const biomeColor = getBiomeColor(height, noise);

      // AO: subtle darkening in low areas only
      const ao = Math.min(1, 0.8 + height * 0.015); // 0.8 at sea level → 1.0 at height ~13
      // Shore AO: very mild darkening near water line
      const shoreAO = height < 1.5 ? 0.9 + (height / 1.5) * 0.1 : 1.0;
      const totalAO = ao * shoreAO;

      colors.push(biomeColor.r * totalAO, biomeColor.g * totalAO, biomeColor.b * totalAO);
    }

    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: false,
    });

    // Shader patches: height fog + procedural texture detail + slope-based roughness
    material.onBeforeCompile = (shader) => {
      // Pass world position to fragment shader for procedural detail
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        `
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        `
        #include <fog_vertex>
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vFogDepth = vFogDepth * (1.0 + max(0.0, 8.0 - vWorldPosition.y) * 0.15);
        `
      );

      // Fragment: procedural detail noise + slope-based roughness
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        float hash2D(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float detailNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash2D(i);
          float b = hash2D(i + vec2(1.0, 0.0));
          float c = hash2D(i + vec2(0.0, 1.0));
          float d = hash2D(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>

        // Procedural detail: subtle noise to break up flat vertex colors
        float detail = detailNoise(vWorldPosition.xz * 2.0) * 0.06 - 0.03;
        diffuseColor.rgb += detail;

        // Fine grain at close range
        float grain = detailNoise(vWorldPosition.xz * 12.0) * 0.03 - 0.015;
        diffuseColor.rgb += grain;

        // Mild slope variation (not darkening — just slight color shift)
        float slope = 1.0 - vWorldNormal.y;
        diffuseColor.rgb *= 1.0 - slope * 0.08;
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `
        #include <roughnessmap_fragment>
        // Slope-based roughness: flat = smooth (grass), steep = rough (rock)
        float slopeR = 1.0 - vWorldNormal.y;
        roughnessFactor = mix(roughnessFactor, 0.95, slopeR);
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
