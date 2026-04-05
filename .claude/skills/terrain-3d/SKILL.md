---
name: terrain-3d
description: "3D terrain generation expert for browser-based games using Three.js/WebGL. TRIGGER when: creating or modifying terrain, heightmaps, islands, biomes, terrain texturing, vertex colors, splatmaps, erosion simulation, LOD systems, terrain noise functions, caves, cliffs, overhangs, underwater terrain, procedural landscape generation, terrain performance optimization, or chunk-based terrain. Also trigger when discussing terrain mesh resolution, island shaping, radial falloff, terrain colliders, height sampling, or any terrain-related visual quality improvements. Even if the user just says 'make the terrain look better', 'add a cave', 'bigger island', or 'more interesting landscape' — use this skill."
---

# 3D Terrain Generation Expert

You are an expert in real-time procedural terrain generation for browser-based 3D games using Three.js + WebGL. Read the detailed reference file when you need specific technique details:

```
references/terrain-techniques.md
```

## Current Project Terrain

**File:** `src/world/terrain.ts`
- 500x500 unit PlaneGeometry with 256x256 segments (65K vertices)
- FBM noise (6 octaves, persistence 0.5, lacunarity 2.0, scale 0.005)
- Radial falloff (radius 200) creates island silhouette
- Max height 40 units
- Biome colors from `src/world/biome.ts`: beach (0-2.5), jungle (2.5-15), highlands (15+)
- `getHeightAt(x, z)` — bilinear interpolation for camera/object ground-following
- Height fog shader patched into material (denser at low altitude)

## Core Principles

1. **Heightmap first, details second.** Get the silhouette right (island shape, mountain placement) before adding detail noise or erosion. A good silhouette at 64x64 resolution beats a bad one at 1024x1024.

2. **Layer noise, don't just add octaves.** Use domain warping (feed noise output back as UV offset) for organic shapes. Combine noise types: FBM for rolling hills, ridged noise for mountain peaks, Worley for rocky crags.

3. **Biomes drive everything.** Height alone isn't enough — use moisture/temperature maps (or just distance from water + height) to determine biome. Biome then drives vertex color, vegetation density, resource spawns, and creature habitats.

4. **Performance = vertex count × shader complexity.** A 256x256 heightmap (65K vertices) is fine for a single island. Beyond that, use LOD (geomorphing between resolution levels) or chunked terrain. Never go above 512x512 without LOD.

## Noise Function Toolkit

### Available in this project
- **FBM** (`src/utils/noise.ts`): Standard fractal Brownian motion using simplex-noise. Good for smooth rolling terrain.
- **Simplex 2D** (via `simplex-noise` package): Base noise, already installed.

### Techniques to add when needed

**Ridged FBM** — for mountain ridges and peaks:
```typescript
function ridgedFbm(x: number, z: number, octaves: number, scale: number): number {
  let value = 0, amplitude = 0.5, frequency = scale;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2D(x * frequency, z * frequency));
    value += n * n * amplitude; // square for sharper ridges
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}
```

**Domain Warping** — for organic, river-like shapes:
```typescript
function warpedNoise(x: number, z: number, scale: number): number {
  const wx = fbm(x + 5.2, z + 1.3, 4, 0.5, 2.0, scale) * 20;
  const wz = fbm(x + 9.7, z + 6.8, 4, 0.5, 2.0, scale) * 20;
  return fbm(x + wx, z + wz, 6, 0.5, 2.0, scale);
}
```

**Worley/Voronoi Noise** — for rocky, cellular terrain:
```typescript
function worley(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  let minDist = 1;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const cx = ix + dx + hash(ix + dx, iz + dz);
      const cz = iz + dz + hash(ix + dx + 31, iz + dz + 17);
      const d = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
      minDist = Math.min(minDist, d);
    }
  }
  return minDist;
}
```

## Island Shaping

### Radial Falloff (current approach)
Good for single islands. Height drops to 0 beyond radius:
```
falloff = max(0, 1 - (dist/radius)²)
smoothFalloff = falloff² × (3 - 2 × falloff)  // smoothstep
finalHeight = noise × maxHeight × smoothFalloff
```

### Multiple Islands
Use multiple radial centers with different radii and heights, sum their falloffs:
```typescript
const islands = [
  { x: 0, z: 0, radius: 200, height: 40 },  // main
  { x: 300, z: 200, radius: 80, height: 20 }, // small island
];
let falloff = 0;
for (const island of islands) {
  const d = dist(x - island.x, z - island.z);
  const f = smoothstep(1 - (d / island.radius) ** 2);
  falloff = Math.max(falloff, f * island.height / maxHeight);
}
```

### Continent Mask
For larger worlds, use a low-frequency noise as a continent mask instead of radial falloff. Threshold it to get irregular coastlines.

## Texturing Strategies

### Tier 1 — Vertex Colors (current)
Height-based colors via `getBiomeColor()`. Fast, no texture memory. Limited to smooth gradients between biomes. Good for low-poly aesthetics.

### Tier 2 — Slope + Height Shader
Modify the terrain material via `onBeforeCompile` to blend textures based on slope (normal.y) and height. Steep slopes get rock, flat areas get grass/sand:
```glsl
float slope = 1.0 - normal.y; // 0 = flat, 1 = vertical
vec3 color = mix(grassColor, rockColor, smoothstep(0.3, 0.6, slope));
```

### Tier 3 — Splatmap
Generate a splatmap texture (RGBA where each channel = weight of a texture layer). Requires 4-5 texture samples per fragment but gives full control. Use vertex colors as the splatmap input (free — already computed).

## Erosion (Post-Processing Heightmap)

### Hydraulic Erosion (most impactful)
Simulate water droplets rolling downhill, picking up sediment, depositing when slowing:
1. Spawn droplet at random position
2. Compute gradient (downhill direction)
3. Move droplet, adjust speed by slope
4. Erode terrain at steep descent, deposit at slow areas
5. Repeat 50K-200K droplets

**Result:** Natural-looking valleys, river beds, smooth slopes. Run once at terrain generation, not per-frame.

### Thermal Erosion
Material falls from steep slopes to accumulate at the base. Creates talus slopes and softens sharp peaks:
```
if (slope > talusAngle) transfer material downhill
```
Simpler than hydraulic, good for rocky highlands.

## Performance Guide

| Terrain Size | Segments | Vertices | FPS Impact | Use Case |
|-------------|----------|----------|------------|----------|
| 500×500 | 128×128 | 16K | ~0ms | Small island, low detail |
| 500×500 | 256×256 | 65K | ~0.1ms | Current project — good balance |
| 500×500 | 512×512 | 262K | ~0.5ms | High detail single island |
| 2000×2000 | 512×512 | 262K | ~0.5ms | Large world, lower density |
| Chunked | 64×64 per chunk | 4K each | Varies | Infinite terrain |

### LOD (Level of Detail)
For larger terrains, use geomorphing: render nearby chunks at high resolution, distant chunks at lower. Three.js doesn't have built-in terrain LOD — implement via multiple PlaneGeometry meshes at different resolutions, swapped by camera distance.

### Chunk Loading
For very large worlds: divide terrain into tiles (e.g., 128×128 each), load/unload based on player position. Keep 3×3 grid of chunks around the player.

## Caves and Overhangs

Heightmaps cannot represent caves or overhangs (single height per XZ). Options:

1. **Fake caves:** Place box/cylinder geometry into hillsides at specific locations. Cheapest — just add mesh objects at designated positions.

2. **Marching cubes:** Generate a 3D density field, extract mesh via marching cubes algorithm. Expensive but supports full caves, tunnels, arches. Use only for small cave sections, not the entire terrain.

3. **Cliff meshes:** Place vertical wall geometry at steep terrain transitions. Creates the illusion of cliffs without true overhangs.

## Key References

- Three.js terrain libraries: [THREE.Terrain](https://github.com/IceCreamYou/THREE.Terrain)
- Procedural generation tutorial: [LearnProceduralGeneration](https://aparis69.github.io/LearnProceduralGeneration/)
- Terrain erosion on GPU: [aparis69 blog](https://aparis69.github.io/public_html/posts/terrain_erosion.html)
- Terrain rendering tricks: [kosmonaut's blog](https://kosmonautblog.wordpress.com/2017/06/04/terrain-rendering-overview-and-tricks/)
- Hydraulic erosion 3 ways: [GitHub](https://github.com/dandrino/terrain-erosion-3-ways)
- Splatmap terrain shader: [Godot Shaders](https://godotshaders.com/shader/simple-splat-map-shader-for-3d-terrain-uses-vertex-colors-as-splatmap/)
- Gamasutra terrain generation: [GameDeveloper](https://www.gamedeveloper.com/design/how-to-procedurally-generate-terrain-in-20-minutes-or-less)
- MIT terrain paper: [Realtime Procedural Terrain](https://web.mit.edu/cesium/Public/terrain.pdf)
