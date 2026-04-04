import * as THREE from 'three';

/**
 * Tier 3 Clouds: Dome mesh with pseudo-volumetric shader.
 * Uses the reliable dome geometry (proper depth ordering with scene)
 * but upgrades the shader with multi-sample depth, Beer's law absorption,
 * Henyey-Greenstein scattering, and 3D noise for volumetric look.
 * No separate render target needed — composites naturally via dome depth.
 * Cost: ~1.5ms at 1080p.
 */

const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    // Dome normal points inward (radial) — used for stable depth sampling
    vNormal = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const cloudFragmentShader = /* glsl */ `
  uniform float time;
  uniform float coverage;
  uniform float windStrength;
  uniform float darkness;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  // --- 3D noise for volumetric depth ---
  float hash3(vec3 p) {
    p = fract(p * vec3(443.897, 397.297, 491.187));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x),
          mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x),
          mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm3D(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise3D(p);
      p = p * 2.1 + vec3(100.0);
      a *= 0.45;
    }
    return v;
  }

  // Henyey-Greenstein phase function
  float hgPhase(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
  }

  void main() {
    // Height fade — wide band so clouds cover most of visible sky
    // vUv.y: 0 = horizon, 1 = zenith on a half-sphere
    float heightFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
    if (heightFade < 0.01 || coverage < 0.01) discard;

    // Wind animation
    float windSpeed = 0.8 + windStrength * 3.0;
    vec3 windOffset = vec3(time * windSpeed, 0.0, time * 0.3) * 0.008;

    // Sample in 3D — use world XZ for horizontal, UV.y for vertical
    // Scale down so noise has good frequency on the large dome
    vec3 basePos = vec3(vWorldPos.x * 0.003, vUv.y * 4.0, vWorldPos.z * 0.003) + windOffset;

    // Storm turbulence
    if (windStrength > 0.3) {
      basePos.xz += noise3D(basePos * 0.5) * windStrength * 0.3;
    }

    // --- Multi-depth sampling (pseudo-volumetric) ---
    // Sample at 4 depth layers along the dome's radial direction (inward).
    // Using the radial normal (not view direction) keeps samples stable
    // as the camera rotates — clouds don't flicker or pop.
    float totalDensity = 0.0;
    float totalLight = 0.0;
    float transmittance = 1.0;
    vec3 toSun = normalize(sunDirection);
    vec3 viewDir = normalize(vWorldPos - cameraPosition);
    float cosTheta = dot(viewDir, toSun);
    float phase = hgPhase(cosTheta, 0.6) + hgPhase(cosTheta, -0.3) * 0.25;

    float threshold = 1.0 - coverage;
    // Depth layers go inward along dome normal (stable, view-independent)
    vec3 depthDir = -normalize(vNormal);
    float stepDepth = 0.15;

    for (int layer = 0; layer < 2; layer++) {
      float depthOffset = float(layer) * stepDepth;
      vec3 samplePos = basePos + depthDir * depthOffset;

      // 3D FBM noise — single sample per layer for performance
      float shape = fbm3D(samplePos * 2.5);

      // Coverage threshold
      float density = smoothstep(threshold - 0.05, threshold + 0.15, shape);
      density = max(0.0, density) * (1.2 + darkness * 0.8);

      if (density > 0.001) {
        // Light march — single sample toward sun
        vec3 lightSample = samplePos + toSun * 0.3;
        float lightShape = fbm3D(lightSample * 2.5);
        float lightTransmittance = exp(-smoothstep(threshold, threshold + 0.2, lightShape) * 2.5);

        // Powder effect — dark cloud interiors
        float powder = 1.0 - exp(-density * 3.0);

        // Accumulate with Beer's law (front-to-back)
        float absorption = density * stepDepth * 3.0;
        float layerAlpha = 1.0 - exp(-absorption);

        totalLight += transmittance * layerAlpha * lightTransmittance * powder;
        totalDensity += transmittance * layerAlpha;
        transmittance *= (1.0 - layerAlpha);
      }

      if (transmittance < 0.05) break; // early exit
    }

    if (totalDensity < 0.01) discard;

    // --- Color computation ---
    float lightFactor = totalDensity > 0.01 ? totalLight / totalDensity : 0.5;

    // Base cloud colors (white → dark storm)
    vec3 brightCol = mix(vec3(0.96, 0.96, 0.98), vec3(0.65, 0.65, 0.72), darkness * 0.6);
    vec3 shadowCol = mix(vec3(0.45, 0.48, 0.58), vec3(0.15, 0.15, 0.25), darkness);

    // Storm tint — purple-grey at base
    vec3 stormTint = vec3(0.2, 0.17, 0.32) * darkness * (1.0 - vUv.y);

    vec3 cloudColor = mix(shadowCol, brightCol, lightFactor);

    // Phase-function scattering (bright rim when looking toward sun)
    cloudColor += sunColor * phase * lightFactor * 0.2;

    // Silver lining
    float silver = pow(max(0.0, cosTheta), 12.0) * 0.3 * (1.0 - darkness) * lightFactor;
    cloudColor += vec3(silver);

    cloudColor += stormTint;

    // Final alpha — stormier = more opaque
    float alpha = totalDensity * heightFade * (0.75 + darkness * 0.2);
    alpha = min(alpha, 0.95);

    gl_FragColor = vec4(cloudColor, alpha);
  }
`;

export class Clouds {
  readonly mesh: THREE.Mesh;
  // Keep blitMesh for API compatibility (unused now)
  readonly blitMesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private targetCoverage = 0;
  private currentCoverage = 0;

  constructor(_renderer?: THREE.WebGLRenderer) {
    const geo = new THREE.SphereGeometry(800, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      uniforms: {
        time: { value: 0 },
        coverage: { value: 0 },
        windStrength: { value: 0 },
        darkness: { value: 0 },
        sunDirection: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Vector3(1.0, 0.95, 0.8) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;

    // Dummy blit mesh (not used — kept for API compatibility)
    this.blitMesh = new THREE.Mesh(new THREE.PlaneGeometry(0, 0));
    this.blitMesh.visible = false;
  }

  setCoverage(coverage: number) { this.targetCoverage = coverage; }
  setWindStrength(wind: number) { this.material.uniforms.windStrength.value = wind; }
  setDarkness(darkness: number) { this.material.uniforms.darkness.value = darkness; }
  setSunDirection(dir: THREE.Vector3) { this.material.uniforms.sunDirection.value.copy(dir); }
  setSunColor(color: THREE.Color) { this.material.uniforms.sunColor.value.set(color.r, color.g, color.b); }

  /** No-op for API compatibility — clouds render via dome mesh in main scene */
  render(_renderer: THREE.WebGLRenderer, _camera: THREE.PerspectiveCamera) {}

  update(dt: number, playerPos: THREE.Vector3) {
    this.currentCoverage += (this.targetCoverage - this.currentCoverage) * dt * 0.8;
    this.material.uniforms.coverage.value = this.currentCoverage;
    this.material.uniforms.time.value += dt;

    this.mesh.position.x = playerPos.x;
    this.mesh.position.z = playerPos.z;
  }
}
