import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export class SkyDome {
  readonly sky: Sky;
  readonly sunPosition: THREE.Vector3;

  constructor() {
    this.sky = new Sky();
    this.sky.scale.setScalar(10000);

    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 8;
    uniforms['rayleigh'].value = 3;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.85;

    // Sun position: tropical midday
    const elevation = 45;
    const azimuth = 180;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);

    this.sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(this.sunPosition);
  }

  updateSunPosition(position: THREE.Vector3) {
    this.sunPosition.copy(position);
    this.sky.material.uniforms['sunPosition'].value.copy(position);
  }

  /** Set sky haziness: 0 = clear vibrant sky, 1 = overcast hazy */
  setOvercast(amount: number) {
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 8 + amount * 12; // 8 (clear) → 20 (overcast)
    uniforms['rayleigh'].value = 3 - amount * 2;   // 3 (vibrant blue) → 1 (washed out)
  }
}
