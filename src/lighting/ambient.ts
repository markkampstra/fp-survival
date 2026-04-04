import * as THREE from 'three';

export function createAmbientLight(): THREE.HemisphereLight {
  return new THREE.HemisphereLight(
    0x87ceeb, // sky color
    0x8b7355, // ground color
    0.5       // intensity
  );
}
