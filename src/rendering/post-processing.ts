import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class PostProcessing {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Bloom at half resolution for performance (~1ms)
    const resolution = new THREE.Vector2(
      Math.floor(window.innerWidth / 2),
      Math.floor(window.innerHeight / 2)
    );
    this.bloomPass = new UnrealBloomPass(resolution, 0.4, 0.3, 0.85);
    this.composer.addPass(this.bloomPass);

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

  render() {
    this.composer.render();
  }
}
