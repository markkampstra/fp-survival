import * as THREE from 'three';

export class Sun {
  readonly light: THREE.DirectionalLight;
  private offset: THREE.Vector3;

  constructor(sunDirection: THREE.Vector3) {
    this.light = new THREE.DirectionalLight(0xfff5e0, 2.0);
    this.offset = sunDirection.clone().normalize().multiplyScalar(100);
    this.light.position.copy(this.offset);
    this.light.target.position.set(0, 0, 0);

    // Shadow config
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.camera.left = -60;
    this.light.shadow.camera.right = 60;
    this.light.shadow.camera.top = 60;
    this.light.shadow.camera.bottom = -60;
    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 300;
    this.light.shadow.bias = -0.0005;
  }

  setDirection(direction: THREE.Vector3) {
    this.offset.copy(direction).normalize().multiplyScalar(100);
  }

  followPlayer(playerPosition: THREE.Vector3) {
    this.light.position.copy(playerPosition).add(this.offset);
    this.light.target.position.copy(playerPosition);
    this.light.target.updateMatrixWorld();
  }
}
