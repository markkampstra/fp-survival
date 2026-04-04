import * as THREE from 'three';

/**
 * Tier 2 Rain: Instanced stretched quads with wind tilt.
 * Wind pushes rain sideways and stretches streaks.
 */

const PARTICLE_COUNT = 3000;
const SPREAD = 50;
const TOP_Y = 50;

const rainVertexShader = /* glsl */ `
  attribute vec3 instanceOffset;
  attribute float instanceSpeed;

  uniform float time;
  uniform vec3 playerPos;
  uniform float intensity;
  uniform float windStrength;

  varying float vAlpha;

  void main() {
    float idx = float(gl_InstanceID);
    vAlpha = step(idx, intensity * ${PARTICLE_COUNT.toFixed(1)}) * 0.5;

    if (vAlpha < 0.01) {
      gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      return;
    }

    // Fall animation with wrap
    vec3 pos = instanceOffset;
    float fallDist = mod(time * instanceSpeed, ${TOP_Y.toFixed(1)} + 10.0);
    pos.y -= fallDist;
    pos.y = mod(pos.y + ${TOP_Y.toFixed(1)}, ${TOP_Y.toFixed(1)} + 10.0) - 5.0;

    // Wind pushes rain sideways (stronger wind = more tilt)
    float windDrift = windStrength * fallDist * 0.4;
    pos.x += windDrift;
    pos.z += windDrift * 0.3;

    // Center on player
    pos.x += playerPos.x;
    pos.z += playerPos.z;

    // Stretch quad into streak — longer with more speed and wind
    vec3 stretched = position;
    float streakLen = 0.5 + instanceSpeed * 0.015 + windStrength * 0.3;
    stretched.y *= streakLen;

    // Tilt streak to match wind angle
    float tiltAngle = windStrength * 0.5; // radians
    float cosA = cos(tiltAngle);
    float sinA = sin(tiltAngle);
    vec3 tilted = vec3(
      stretched.x * cosA - stretched.y * sinA,
      stretched.x * sinA + stretched.y * cosA,
      stretched.z
    );

    vec3 worldPos = pos + tilted;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);

    // Fade at edges
    float heightFade = smoothstep(-2.0, 2.0, worldPos.y) * smoothstep(${TOP_Y.toFixed(1)}, ${TOP_Y.toFixed(1)} - 5.0, worldPos.y);
    vAlpha *= heightFade;

    // Slightly brighter rain at higher intensity (storm)
    vAlpha *= 0.8 + intensity * 0.4;
  }
`;

const rainFragmentShader = /* glsl */ `
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.01) discard;
    gl_FragColor = vec4(0.7, 0.75, 0.85, vAlpha);
  }
`;

export class Rain {
  readonly mesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.PlaneGeometry(0.03, 0.8, 1, 1);

    const offsets = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      offsets[i * 3] = (Math.random() - 0.5) * SPREAD;
      offsets[i * 3 + 1] = Math.random() * TOP_Y;
      offsets[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      speeds[i] = 25 + Math.random() * 15;
    }

    geo.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('instanceSpeed', new THREE.InstancedBufferAttribute(speeds, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: rainVertexShader,
      fragmentShader: rainFragmentShader,
      uniforms: {
        time: { value: 0 },
        playerPos: { value: new THREE.Vector3() },
        intensity: { value: 0 },
        windStrength: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, PARTICLE_COUNT);
    const dummy = new THREE.Matrix4();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.mesh.setMatrixAt(i, dummy);
    }
    this.mesh.frustumCulled = false;
  }

  update(dt: number, playerPos: THREE.Vector3, intensity: number, windStrength: number) {
    this.material.uniforms.time.value += dt;
    this.material.uniforms.playerPos.value.copy(playerPos);
    this.material.uniforms.intensity.value = intensity;
    this.material.uniforms.windStrength.value = windStrength;
  }
}
