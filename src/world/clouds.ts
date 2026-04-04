import * as THREE from 'three';

/**
 * Tier 2 Clouds: FBM noise shader on a dome mesh.
 * Supports clear → storm progression with wind distortion and darkening.
 */

const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const cloudFragmentShader = /* glsl */ `
  uniform float time;
  uniform float coverage;
  uniform float windStrength;
  uniform float darkness;      // 0 = white fluffy, 1 = dark storm
  uniform vec3 sunDirection;
  uniform vec3 sunColor;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value += amplitude * noise(p * frequency);
      frequency *= 2.1;
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    // Height fade: clouds only in upper portion of dome
    float heightFade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    if (heightFade < 0.01) discard;

    // Wind-animated UV — stronger wind = faster + more turbulent
    float windSpeed = 0.005 + windStrength * 0.02;
    vec2 windDir = vec2(0.7, 0.3); // predominant wind direction
    vec2 cloudUV = vWorldPos.xz * 0.003 + windDir * time * windSpeed;

    // Turbulence distortion in storms
    if (windStrength > 0.3) {
      float turb = noise(cloudUV * 2.0 + time * 0.01) * windStrength * 0.4;
      cloudUV += vec2(turb, turb * 0.7);
    }

    // Multi-layer FBM — more octaves for stormier weather
    int octaves = coverage > 0.7 ? 6 : (coverage > 0.3 ? 5 : 4);
    float n = fbm(cloudUV * 3.0, octaves);
    float n2 = fbm(cloudUV * 8.0 + 5.7, 4); // detail
    float cloudShape = n * 0.65 + n2 * 0.35;

    // Coverage threshold
    float threshold = 1.0 - coverage;
    float cloud = smoothstep(threshold - 0.06, threshold + 0.14, cloudShape);
    cloud *= heightFade;

    if (cloud < 0.01) discard;

    // --- Lighting ---
    vec3 toSun = normalize(sunDirection);
    float topLight = 0.5 + 0.5 * max(0.0, dot(vec3(0.0, 1.0, 0.0), toSun));

    // Powder effect — dark cloud interiors
    float powder = 1.0 - exp(-cloud * 3.5);

    // Silver lining
    vec3 viewDir = normalize(vWorldPos - cameraPosition);
    float silver = pow(max(0.0, dot(viewDir, toSun)), 10.0) * 0.3 * (1.0 - darkness);

    // Base colors — shift from white to dark grey-blue for storms
    vec3 brightColor = mix(vec3(0.95, 0.95, 0.97), vec3(0.7, 0.7, 0.75), darkness * 0.5);
    vec3 shadowColor = mix(vec3(0.55, 0.55, 0.65), vec3(0.2, 0.2, 0.3), darkness);

    // Storm clouds have a slight blue-purple tint at the base
    vec3 stormTint = vec3(0.25, 0.22, 0.35) * darkness * (1.0 - vUv.y);

    vec3 cloudColor = mix(shadowColor, brightColor, topLight * powder) + sunColor * silver + stormTint;

    // Opacity — stormier = more opaque
    float baseOpacity = 0.7 + darkness * 0.25;
    float alpha = cloud * baseOpacity;

    gl_FragColor = vec4(cloudColor, alpha);
  }
`;

export class Clouds {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private targetCoverage = 0;
  private currentCoverage = 0;

  constructor() {
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
  }

  setCoverage(coverage: number) {
    this.targetCoverage = coverage;
  }

  setWindStrength(wind: number) {
    this.material.uniforms.windStrength.value = wind;
  }

  /** 0 = bright fluffy clouds, 1 = dark storm clouds */
  setDarkness(darkness: number) {
    this.material.uniforms.darkness.value = darkness;
  }

  setSunDirection(dir: THREE.Vector3) {
    this.material.uniforms.sunDirection.value.copy(dir);
  }

  setSunColor(color: THREE.Color) {
    this.material.uniforms.sunColor.value.set(color.r, color.g, color.b);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.currentCoverage += (this.targetCoverage - this.currentCoverage) * dt * 0.8;
    this.material.uniforms.coverage.value = this.currentCoverage;
    this.material.uniforms.time.value += dt;

    this.mesh.position.x = playerPos.x;
    this.mesh.position.z = playerPos.z;
  }
}
