import * as THREE from 'three';

export type BiomeType = 'beach' | 'jungle' | 'highlands' | 'underwater';

const beachSand = new THREE.Color(0xc2b280);
const beachWet = new THREE.Color(0xa09060);
const jungleDark = new THREE.Color(0x2d6b1e);
const jungleBright = new THREE.Color(0x4a8c2f);
const highlandRock = new THREE.Color(0x6b6b6b);
const highlandPeak = new THREE.Color(0x888888);

export function getBiome(height: number): BiomeType {
  if (height < 0.3) return 'underwater';
  if (height < 2.5) return 'beach';
  if (height < 15) return 'jungle';
  return 'highlands';
}

export function getBiomeColor(height: number, noise: number): THREE.Color {
  const color = new THREE.Color();

  if (height < 0.3) {
    // Underwater — dark sand
    color.copy(beachWet).multiplyScalar(0.6);
  } else if (height < 1.5) {
    // Wet sand near water
    color.copy(beachWet).lerp(beachSand, (height - 0.3) / 1.2);
  } else if (height < 2.5) {
    // Dry sand → jungle transition
    const t = (height - 1.5) / 1.0;
    color.copy(beachSand).lerp(jungleBright, t * 0.5);
  } else if (height < 5) {
    // Jungle edge — lighter green
    const t = (height - 2.5) / 2.5;
    color.copy(jungleBright).lerp(jungleDark, t);
  } else if (height < 15) {
    // Dense jungle — dark green with variation
    const variation = noise * 0.15;
    color.copy(jungleDark);
    color.r += variation * 0.3;
    color.g += variation;
    color.b += variation * 0.2;
  } else if (height < 25) {
    // Jungle → highlands transition
    const t = (height - 15) / 10;
    color.copy(jungleDark).lerp(highlandRock, t);
  } else {
    // Rocky highlands
    const t = Math.min((height - 25) / 15, 1);
    color.copy(highlandRock).lerp(highlandPeak, t);
    // Add slight noise variation for rocky texture
    const rockNoise = noise * 0.08;
    color.r += rockNoise;
    color.g += rockNoise;
    color.b += rockNoise;
  }

  return color;
}
