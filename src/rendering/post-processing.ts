import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Color grading + vignette + film grain shader.
 * Demoscene Tier 1: maximum visual impact for ~0.07ms cost.
 */
const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // --- Color grading: warm tropical feel ---
      // Slight warm shift
      color = pow(color, vec3(0.97, 1.0, 1.03));

      // Boost saturation 8%
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(lum), color, 1.08);

      // --- Vignette: subtle edge darkening ---
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float vignette = 1.0 - smoothstep(0.5, 0.95, dist) * 0.35;
      color *= vignette;

      // --- Film grain: very subtle noise to break banding ---
      float grain = fract(sin(dot(vUv * time * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
      color += (grain - 0.5) * 0.015;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class PostProcessing {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private colorGradePass: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Bloom (disabled — Sky HDR blows out)
    const resolution = new THREE.Vector2(
      Math.floor(window.innerWidth / 2),
      Math.floor(window.innerHeight / 2)
    );
    this.bloomPass = new UnrealBloomPass(resolution, 0.3, 0.3, 4.0);
    this.bloomPass.enabled = false;
    this.composer.addPass(this.bloomPass);

    // Color grading + vignette + grain (always on)
    this.colorGradePass = new ShaderPass(ColorGradeShader);
    this.composer.addPass(this.colorGradePass);

    window.addEventListener('resize', () => {
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setBloomStrength(strength: number) {
    this.bloomPass.strength = strength;
  }

  setBloomThreshold(threshold: number) {
    this.bloomPass.threshold = threshold;
  }

  render(dt?: number) {
    if (dt !== undefined) {
      this.colorGradePass.uniforms.time.value += dt;
    }
    this.composer.render();
  }
}
