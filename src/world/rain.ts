import * as THREE from 'three';

/**
 * Tier 3 Rain: Three-layer system
 * 1. World-space instanced streaks (kept from Tier 2, with improvements)
 * 2. Screen-space rain overlay (parallax noise layers)
 * 3. Ground splash particles (short-lived instanced quads)
 */

// ============================================================
// Layer 1: World-space rain streaks (improved Tier 2)
// ============================================================
const STREAK_COUNT = 3000;
const SPREAD = 50;
const TOP_Y = 50;

const streakVS = /* glsl */ `
  attribute vec3 instanceOffset;
  attribute float instanceSpeed;
  uniform float time;
  uniform vec3 playerPos;
  uniform float intensity;
  uniform float windStrength;
  varying float vAlpha;

  void main() {
    float idx = float(gl_InstanceID);
    vAlpha = step(idx, intensity * ${STREAK_COUNT.toFixed(1)}) * 0.45;
    if (vAlpha < 0.01) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }

    vec3 pos = instanceOffset;
    float fallDist = mod(time * instanceSpeed, ${TOP_Y.toFixed(1)} + 10.0);
    pos.y -= fallDist;
    pos.y = mod(pos.y + ${TOP_Y.toFixed(1)}, ${TOP_Y.toFixed(1)} + 10.0) - 5.0;
    float windDrift = windStrength * fallDist * 0.4;
    pos.x += windDrift;
    pos.z += windDrift * 0.3;
    pos.x += playerPos.x;
    pos.z += playerPos.z;

    vec3 stretched = position;
    float streakLen = 0.5 + instanceSpeed * 0.015 + windStrength * 0.3;
    stretched.y *= streakLen;
    float tiltAngle = windStrength * 0.5;
    float cosA = cos(tiltAngle);
    float sinA = sin(tiltAngle);
    vec3 tilted = vec3(stretched.x * cosA - stretched.y * sinA, stretched.x * sinA + stretched.y * cosA, stretched.z);

    vec3 worldPos = pos + tilted;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
    float heightFade = smoothstep(-2.0, 2.0, worldPos.y) * smoothstep(${TOP_Y.toFixed(1)}, ${TOP_Y.toFixed(1)} - 5.0, worldPos.y);
    vAlpha *= heightFade * (0.8 + intensity * 0.4);
  }
`;
const streakFS = /* glsl */ `
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.01) discard;
    gl_FragColor = vec4(0.7, 0.75, 0.85, vAlpha);
  }
`;

// ============================================================
// Layer 2: Screen-space rain overlay (post-process quad)
// ============================================================
const screenRainVS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const screenRainFS = /* glsl */ `
  uniform float time;
  uniform float intensity;
  uniform float windStrength;
  uniform vec2 resolution;
  uniform vec3 cameraUp;

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  // Single rain streak layer — each layer has distinct depth character
  float rainLayer(vec2 uv, float speed, float density, float thickness, float seed) {
    // Wind tilt
    uv.x += uv.y * windStrength * 0.15;

    // Flip Y so increasing cell Y = downward on screen
    uv.y = 1.0 - uv.y;

    // Grid of potential streak positions
    vec2 cell = uv * vec2(density * 0.4, density);
    vec2 id = floor(cell);
    vec2 f = fract(cell);

    float rnd = hash21(id + seed);

    // Only some cells have a streak (sparse)
    if (rnd > 0.5) return 0.0;

    // Streak x position within cell
    float sx = 0.3 + rnd * 0.4;
    float dist = abs(f.x - sx);
    float streak = smoothstep(thickness, thickness * 0.2, dist);

    // Fall animation — phase increases over time, moves streak downward
    float phase = fract(rnd * 5.7 + time * speed);
    float len = 0.15 + rnd * 0.2;

    // Streak window in cell (head moves down as phase increases)
    float head = phase;
    float tail = head - len;
    streak *= smoothstep(tail - 0.05, tail + 0.05, f.y) * smoothstep(head + 0.05, head - 0.05, f.y);

    return streak;
  }

  // Subtle lens droplets
  float lensDrop(vec2 uv, float seed) {
    vec2 grid = floor(uv * 5.0 + seed);
    vec2 gf = fract(uv * 5.0 + seed);
    float rnd = hash21(grid);
    if (rnd > 0.2) return 0.0;

    vec2 center = vec2(0.3 + rnd * 0.4, 0.3 + fract(rnd * 7.3) * 0.4);
    float d = length(gf - center);
    float radius = 0.04 + rnd * 0.06;

    float life = fract(time * 0.12 + rnd * 5.0);
    float fade = smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.5, life);

    return smoothstep(radius, radius * 0.2, d) * fade;
  }

  void main() {
    if (intensity < 0.05) discard;

    vec2 uv = vUv;
    float aspect = resolution.x / resolution.y;
    uv.x *= aspect;

    // Distant rain haze — very faint, adds atmospheric depth
    // NOT visible individual streaks — the world-space rain handles that
    float far = rainLayer(uv, 0.6, 40.0, 0.004, 19.1) * 0.04;
    float haze = far * intensity;

    // Lens drops (heavy rain only, subtle refraction spots)
    float drops = 0.0;
    if (intensity > 0.5) {
      float upFactor = max(0.0, -cameraUp.z) * 0.4 + 0.3;
      drops += lensDrop(vUv, 0.0) * (intensity - 0.4) * upFactor * 0.2;
    }

    float total = min(haze + drops, 0.15);
    if (total < 0.003) discard;

    // Slight blue-grey tint — atmospheric rain fog
    gl_FragColor = vec4(0.7, 0.73, 0.8, total);
  }
`;

// ============================================================
// Layer 3: Ground splash particles
// ============================================================
const SPLASH_COUNT = 200;

const splashVS = /* glsl */ `
  attribute vec3 splashPos;
  attribute float splashLife;
  uniform float time;
  varying float vAlpha;

  void main() {
    float age = fract(time * 0.8 + splashLife);
    float alive = step(age, 0.15); // lives for 15% of cycle
    vAlpha = alive * (1.0 - age / 0.15) * 0.4;

    vec3 pos = splashPos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = max(1.0, (1.0 - age / 0.15) * 2.5);
  }
`;

const splashFS = /* glsl */ `
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.01) discard;
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float circle = smoothstep(0.5, 0.2, d);
    gl_FragColor = vec4(0.85, 0.88, 0.95, vAlpha * circle);
  }
`;

export class Rain {
  readonly mesh: THREE.InstancedMesh; // world streaks
  readonly screenQuad: THREE.Mesh;     // screen-space overlay
  readonly splashes: THREE.Points;     // ground splashes
  private streakMaterial: THREE.ShaderMaterial;
  private screenMaterial: THREE.ShaderMaterial;

  constructor() {
    // --- World streaks (Tier 2 base) ---
    const streakGeo = new THREE.PlaneGeometry(0.03, 0.8, 1, 1);
    const offsets = new Float32Array(STREAK_COUNT * 3);
    const speeds = new Float32Array(STREAK_COUNT);
    for (let i = 0; i < STREAK_COUNT; i++) {
      offsets[i * 3] = (Math.random() - 0.5) * SPREAD;
      offsets[i * 3 + 1] = Math.random() * TOP_Y;
      offsets[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      speeds[i] = 25 + Math.random() * 15;
    }
    streakGeo.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    streakGeo.setAttribute('instanceSpeed', new THREE.InstancedBufferAttribute(speeds, 1));

    this.streakMaterial = new THREE.ShaderMaterial({
      vertexShader: streakVS, fragmentShader: streakFS,
      uniforms: {
        time: { value: 0 }, playerPos: { value: new THREE.Vector3() },
        intensity: { value: 0 }, windStrength: { value: 0 },
      },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });

    this.mesh = new THREE.InstancedMesh(streakGeo, this.streakMaterial, STREAK_COUNT);
    const dummy = new THREE.Matrix4();
    for (let i = 0; i < STREAK_COUNT; i++) this.mesh.setMatrixAt(i, dummy);
    this.mesh.frustumCulled = false;

    // --- Screen-space rain overlay ---
    this.screenMaterial = new THREE.ShaderMaterial({
      vertexShader: screenRainVS, fragmentShader: screenRainFS,
      uniforms: {
        time: { value: 0 }, intensity: { value: 0 }, windStrength: { value: 0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        cameraUp: { value: new THREE.Vector3(0, 1, 0) },
      },
      transparent: true, depthWrite: false, depthTest: false,
    });
    this.screenQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.screenMaterial);
    this.screenQuad.frustumCulled = false;
    this.screenQuad.renderOrder = 1000;

    window.addEventListener('resize', () => {
      this.screenMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    });

    // --- Ground splash particles ---
    const splashPositions = new Float32Array(SPLASH_COUNT * 3);
    const splashLives = new Float32Array(SPLASH_COUNT);
    for (let i = 0; i < SPLASH_COUNT; i++) {
      splashPositions[i * 3] = (Math.random() - 0.5) * 40;
      splashPositions[i * 3 + 1] = 0;
      splashPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      splashLives[i] = Math.random();
    }
    const splashGeo = new THREE.BufferGeometry();
    splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
    splashGeo.setAttribute('splashPos', new THREE.BufferAttribute(splashPositions, 3));
    splashGeo.setAttribute('splashLife', new THREE.BufferAttribute(splashLives, 1));

    const splashMat = new THREE.ShaderMaterial({
      vertexShader: splashVS, fragmentShader: splashFS,
      uniforms: { time: { value: 0 } },
      transparent: true, depthWrite: false,
    });
    this.splashes = new THREE.Points(splashGeo, splashMat);
    this.splashes.frustumCulled = false;
  }

  update(dt: number, playerPos: THREE.Vector3, intensity: number, windStrength: number, camera?: THREE.Camera) {
    const t = this.streakMaterial.uniforms.time.value + dt;

    // World streaks
    this.streakMaterial.uniforms.time.value = t;
    this.streakMaterial.uniforms.playerPos.value.copy(playerPos);
    this.streakMaterial.uniforms.intensity.value = intensity;
    this.streakMaterial.uniforms.windStrength.value = windStrength;

    // Screen overlay
    this.screenMaterial.uniforms.time.value = t;
    this.screenMaterial.uniforms.intensity.value = intensity;
    this.screenMaterial.uniforms.windStrength.value = windStrength;
    if (camera) {
      const up = new THREE.Vector3(0, 0, -1);
      up.applyQuaternion(camera.quaternion);
      this.screenMaterial.uniforms.cameraUp.value.copy(up);
    }

    // Splashes — center on player
    this.splashes.position.set(playerPos.x, 0.2, playerPos.z);
    (this.splashes.material as THREE.ShaderMaterial).uniforms.time.value = t;

    // Hide splashes if no rain
    this.splashes.visible = intensity > 0.1;
    this.screenQuad.visible = intensity > 0.05;
  }
}
