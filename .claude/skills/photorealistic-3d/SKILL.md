---
name: photorealistic-3d
description: "Photorealistic 3D rendering and demoscene optimization specialist for browser games. TRIGGER when: improving visual quality, adding realism, optimizing rendering performance, implementing PBR materials, environment maps, screen-space effects, procedural textures, impostor sprites, SDF raymarching, triplanar mapping, or any task related to making the game look dramatically better while keeping performance high. Also trigger when the user mentions 'make it look realistic', 'better graphics', 'more detail', 'performance optimization', or 'demoscene tricks'."
---

# Photorealistic Rendering & Demoscene Optimization

Expert in making browser 3D games look dramatically better using a combination of modern PBR techniques and classic demoscene tricks that maximize visual impact per GPU cycle.

## Philosophy: The Demoscene Mindset

The 90s demoscene proved that **perceived quality matters more than geometric complexity**. A 64KB intro can look more impressive than a 2GB game by:
1. **Faking expensive effects with cheap approximations**
2. **Using math where others use memory** (procedural everything)
3. **Exploiting human perception** (we notice contrast, motion, and lighting more than polygon count)
4. **Doing less work per pixel** (move computation from fragment to vertex shader)

---

## Tier 1: Quick Wins (< 1 hour each, massive visual impact)

### 1. Procedural Textures via Shader
Instead of texture files, generate surface detail in the fragment shader. Zero memory cost, infinite resolution:

```glsl
// Procedural wood grain
float grain = sin(pos.x * 20.0 + noise(pos.xz * 5.0) * 3.0) * 0.5 + 0.5;
vec3 woodColor = mix(vec3(0.4, 0.25, 0.1), vec3(0.6, 0.35, 0.15), grain);
```

```glsl
// Procedural stone/rock surface
float cracks = 1.0 - smoothstep(0.0, 0.05, abs(voronoi(pos.xz * 3.0).y));
vec3 stoneColor = mix(baseColor, baseColor * 0.6, cracks);
```

**Cost:** ~0.1ms. **Impact:** Surfaces go from flat-colored to detailed.

### 2. Triplanar Mapping
Project textures (or procedural patterns) from 3 axes and blend by surface normal. Works on any geometry without UV coordinates:

```glsl
vec3 blend = abs(normal);
blend = normalize(max(blend, 0.00001));
blend /= (blend.x + blend.y + blend.z);
vec3 xProj = texture(tex, pos.yz * scale).rgb;
vec3 yProj = texture(tex, pos.xz * scale).rgb;
vec3 zProj = texture(tex, pos.xy * scale).rgb;
vec3 color = xProj * blend.x + yProj * blend.y + zProj * blend.z;
```

**Use for:** Terrain, rocks, walls — anything without good UVs.

### 3. Fake Ambient Occlusion
Darken concavities without SSAO (expensive). Use vertex position as a proxy:

```glsl
// In terrain material onBeforeCompile:
// Vertices at lower height relative to neighbors = more occluded
float ao = smoothstep(0.0, 5.0, worldPos.y); // simple height-based AO
color *= 0.5 + 0.5 * ao;
```

Or bake AO into vertex colors during terrain generation — free at runtime.

### 4. Normal-Mapped Sky Dome
Replace the flat sky with a hemisphere that has a procedural normal map for cloud-like bumps. Gives volumetric feel without raymarching.

### 5. Color Grading Post-Process
A simple fullscreen shader that adjusts contrast, saturation, and color temperature:

```glsl
// Warm tropical color grade
color = pow(color, vec3(0.95, 1.0, 1.05)); // slight warm shift
color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, 1.15); // boost saturation
color = smoothstep(0.0, 1.0, color); // contrast S-curve
```

**Cost:** ~0.05ms. **Impact:** Entire scene feels cinematic.

---

## Tier 2: Medium Effort (2-4 hours, significant quality jump)

### 6. PBR Material Upgrade
Three.js MeshStandardMaterial already does PBR. The trick is using it properly:

- **Roughness variation:** Don't use a flat value. Use `onBeforeCompile` to modulate roughness by noise:
  ```glsl
  float roughnessVar = texture2D(noiseMap, vUv * 5.0).r;
  roughnessFactor = roughnessFactor * (0.7 + roughnessVar * 0.6);
  ```
- **Metalness:** Most natural surfaces = 0. Only metal tools/armor > 0.
- **Environment map:** Even a simple blurred sky environment map adds subtle reflections to everything.

### 7. Screen-Space Reflections (SSR) — Cheap Version
Full SSR is expensive. Cheap trick: for the water plane, use a flipped render-to-texture:

1. Render scene once normally
2. Set camera below water, flip Y, render to a half-res texture
3. Apply that texture to the water plane with distortion

**Cost:** ~2ms (double render). **Impact:** Reflective water transforms the scene.

### 8. Billboard Impostors for Distant Trees
Replace 3D tree meshes beyond 50m with pre-rendered 2D billboards:

1. Render a tree to a small texture (64x128) from 8 angles
2. At distance, swap the 3D mesh for a quad with the nearest angle's texture
3. Fade between 3D and billboard at transition distance

**Cost:** Saves 90% of draw calls for distant vegetation.
**Demoscene trick:** Pre-compute the impostor textures procedurally at startup from the same mesh factory.

### 9. Procedural Normal Maps
Generate normal maps from noise in a shader without any texture files:

```glsl
// Compute normal from height noise
float h = fbm(uv * 10.0);
float hx = fbm((uv + vec2(0.001, 0.0)) * 10.0);
float hz = fbm((uv + vec2(0.0, 0.001)) * 10.0);
vec3 normal = normalize(vec3((h - hx) / 0.001, 1.0, (h - hz) / 0.001));
```

Apply to terrain, rocks, wood — adds surface detail that catches light without geometry.

### 10. Signed Distance Field (SDF) Effects
The demoscene's secret weapon. SDFs can render perfect smooth shapes with infinite detail:

```glsl
// SDF for a rounded rock
float sdRock(vec3 p) {
  float d = length(p) - 1.0;
  d += fbm3D(p * 3.0) * 0.2; // noise displacement
  return d;
}
```

**Use for:** Decorative elements (coral, crystals, eroded rock formations) rendered via raymarching in a shader, not geometry.

---

## Tier 3: Major Effort (1+ day, photorealistic quality)

### 11. Global Illumination Approximation
Full GI is too expensive. Demoscene solution: **light probes**.

- Place 5-10 invisible probe points around the scene
- At each probe, capture ambient color (average of sky + nearby surfaces)
- In the terrain shader, interpolate between nearest probes
- Gives the illusion of color bleeding (green terrain reflects green light upward)

### 12. Subsurface Scattering (SSS) for Vegetation
Real leaves transmit light. Cheap approximation:

```glsl
// In leaf fragment shader:
float sss = pow(max(0.0, dot(viewDir, -lightDir)), 3.0) * 0.5;
color += leafColor * sss * lightColor; // back-lit glow
```

Makes vegetation glow when backlit by the sun. Massive realism boost for ~0 cost.

### 13. Atmospheric Perspective
Objects further away should be bluer and hazier. Three.js fog does this roughly, but a proper implementation:

```glsl
float dist = length(worldPos - cameraPos);
float scatter = 1.0 - exp(-dist * 0.002);
vec3 skyColor = vec3(0.5, 0.7, 1.0);
color = mix(color, skyColor, scatter * 0.6);
```

### 14. Water Caustics
Project animated caustic patterns onto underwater terrain:

```glsl
// On terrain below water level:
if (worldPos.y < waterLevel) {
  float caustic = abs(sin(worldPos.x * 3.0 + time) * sin(worldPos.z * 3.0 + time * 0.7));
  color += vec3(0.1, 0.15, 0.2) * caustic;
}
```

### 15. Deferred Rendering for Many Lights
If adding many campfires/torches, switch from forward to deferred rendering:
1. Render geometry to G-buffer (position, normal, albedo, roughness)
2. For each light, render a light volume (sphere) that only processes pixels it affects
3. Compose final image

Three.js doesn't have built-in deferred, but it's implementable via custom render targets.

---

## Demoscene-Specific Tricks for This Project

### Procedural Everything
- **Terrain texture:** Generate in shader from height + slope + noise. Zero texture memory.
- **Tree bark:** Perlin noise stretched along Y axis in shader.
- **Rock surface:** Voronoi cracks + noise displacement in shader.
- **Water:** Animated multi-octave noise for wave normals.
- **Clouds:** Already done (FBM noise shader on dome).

### The Lookup Table Trick
Pre-compute expensive calculations into a texture at startup:
- Render noise patterns to a canvas → upload as texture
- Use as procedural "texture atlas" — one texture, many uses
- Cheaper than computing noise per-pixel per-frame

### Screen-Space Tricks (Nearly Free)
- **Vignette:** Darken screen edges. 3 lines of shader code, huge cinematic impact.
- **Film grain:** Subtle noise overlay. Hides banding artifacts in gradients.
- **Chromatic aberration:** Offset R/G/B channels slightly at screen edges. Looks "filmic."
- **Dithering:** Break color banding with ordered dither pattern (demoscene classic).

### The "Less is More" Principle
The demoscene teaches that **suggestion beats simulation**:
- A single shadow ray is better than full shadow mapping for atmosphere
- A noise-displaced sphere looks more like a rock than 1000 triangles
- A colored fog gradient suggests a sunset better than 10 lights
- Screen-space effects (grain, vignette, color grade) add more perceived quality than doubling poly count

---

## Performance Budget Reality Check

| Technique | Cost | Visual Impact | Priority |
|-----------|------|--------------|----------|
| Color grading | 0.05ms | ★★★★★ | Do first |
| Vignette | 0.02ms | ★★★★ | Do first |
| Procedural textures (vertex shader) | 0ms | ★★★★ | Do first |
| Height-based AO | 0ms (baked) | ★★★★ | Do first |
| SSS on leaves | 0.05ms | ★★★★ | High |
| Triplanar mapping | 0.2ms | ★★★★ | Medium |
| Environment map | 0.1ms | ★★★ | Medium |
| Normal maps (procedural) | 0.3ms | ★★★★ | Medium |
| Billboard impostors | Saves 1ms+ | ★★★ | If needed |
| Water reflections | 2ms | ★★★★★ | When ready |
| SDF raymarching (select objects) | 0.5ms | ★★★★ | Advanced |

**Rule of thumb:** If it costs < 0.1ms and affects the entire screen, do it immediately. If it costs > 1ms, it better be the most impressive thing on screen.

---

## Key References

- [Inigo Quilez — Raymarching Distance Fields](https://iquilezles.org/articles/raymarchingdf/) (demoscene bible)
- [How a 64k Intro is Made](https://www.lofibucket.com/articles/64k_intro.html)
- [Procedural 3D Mesh in 64KB](https://www.ctrl-alt-test.fr/2023/procedural-3d-mesh-generation-in-a-64kb-intro/)
- [64k Scene Resources](https://64k-scene.github.io/resources.html)
- [Three.js Rendering Guide 2026](https://rendimension.com/blog/three-js-rendering/)
- [Creating Photorealistic 3D on the Web](https://css-tricks.com/creating-photorealistic-3d-graphics-web/)
- [Ultra-Realistic Scenes in Three.js](https://waelyasmina.net/articles/how-to-create-ultra-realistic-scenes-in-three.js/)
- [PBR Textures in Three.js](https://medium.com/@Makoto_29712/experimenting-with-pbr-textures-usingthree-js-a25aad28ed65)
- [Demoscene's Optimization Legacy](https://devops-geek.net/computer-history/the-demoscene-s-secret-war-how-underground-coders-accidentally-pioneered-real-time-graphics-optimiza/)
- [60 to 1500 FPS WebGL Optimization](https://medium.com/@dhiashakiry/60-to-1500-fps-optimising-a-webgl-visualisation-d79705b33af4)
- [Three.js PathTracing Renderer](https://github.com/erichlof/THREE.js-PathTracing-Renderer)
- [WebGL Best Practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [Realtime Visualization in the Demoscene](https://old.cescg.org/CESCG-2002/BBurger/index.html)
- [SDF Rendering Journey](https://kosmonautblog.wordpress.com/2017/05/01/signed-distance-field-rendering-journey-pt-1/)
