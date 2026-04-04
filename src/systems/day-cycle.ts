import * as THREE from 'three';
import { events } from '../core/event-bus';
import type { Sun } from '../lighting/sun';
import type { SkyDome } from '../world/sky';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export class DayCycle {
  private time = 0.3; // 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
  private dayDuration = 600; // 10 minutes per day
  private phase: TimeOfDay = 'day';
  private day = 1;
  private moonLight: THREE.DirectionalLight;
  private renderer: THREE.WebGLRenderer;
  private moonOffset = new THREE.Vector3();

  constructor(
    private sun: Sun,
    private sky: SkyDome,
    private ambient: THREE.HemisphereLight,
    private scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
  ) {
    this.renderer = renderer;

    // Moonlight — cool blue directional
    this.moonLight = new THREE.DirectionalLight(0x8899cc, 0);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.left = -60;
    this.moonLight.shadow.camera.right = 60;
    this.moonLight.shadow.camera.top = 60;
    this.moonLight.shadow.camera.bottom = -60;
    this.moonLight.shadow.camera.near = 0.5;
    this.moonLight.shadow.camera.far = 300;
    this.moonLight.shadow.bias = -0.001;
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target);

    this.updateAll();
  }

  update(dt: number) {
    this.time += dt / this.dayDuration;
    if (this.time >= 1) {
      this.time -= 1;
      this.day++;
    }

    const oldPhase = this.phase;
    this.phase = this.getPhase();
    if (this.phase !== oldPhase) {
      events.emit('daycycle:phase-changed', this.phase);
    }

    this.updateAll();
  }

  getSunElevation(): number {
    const sunAngle = (this.time - 0.25) * Math.PI * 2;
    return Math.sin(sunAngle) * 75;
  }

  private updateAll() {
    const sunElev = this.getSunElevation();
    this.updateSun(sunElev);
    this.updateMoon(sunElev);
    this.updateAmbient(sunElev);
    this.updateFog(sunElev);
    this.updateExposure(sunElev);
  }

  private updateSun(elevation: number) {
    const sunAngle = (this.time - 0.25) * Math.PI * 2;
    const azimuth = 90 + (this.time - 0.25) * 360;

    const phi = THREE.MathUtils.degToRad(90 - Math.max(elevation, -5));
    const theta = THREE.MathUtils.degToRad(azimuth);
    const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);

    this.sky.updateSunPosition(sunPos);
    this.sun.setDirection(sunPos);

    if (elevation > 5) {
      this.sun.light.intensity = 2.0;
      this.sun.light.color.setHex(0xfff5e0);
    } else if (elevation > -5) {
      const t = (elevation + 5) / 10;
      this.sun.light.intensity = t * 2.0;
      this.sun.light.color.lerpColors(
        new THREE.Color(0xff6b35),
        new THREE.Color(0xfff5e0),
        t
      );
    } else {
      this.sun.light.intensity = 0;
    }

    this.sun.light.castShadow = elevation > 0;
  }

  private updateMoon(sunElev: number) {
    // Moon arcs opposite the sun
    const moonTime = (this.time + 0.5) % 1;
    const moonAngle = (moonTime - 0.25) * Math.PI * 2;
    const elevation = Math.sin(moonAngle) * 65;
    const azimuth = 90 + (moonTime - 0.25) * 360;

    const phi = THREE.MathUtils.degToRad(90 - Math.max(elevation, 0));
    const theta = THREE.MathUtils.degToRad(azimuth);
    const moonDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);

    this.moonOffset.copy(moonDir).normalize().multiplyScalar(100);
    this.moonLight.position.copy(this.moonOffset);
    this.moonLight.target.position.set(0, 0, 0);
    this.moonLight.target.updateMatrixWorld();

    // Moon intensity: strong when moon is up and sun is down
    if (elevation > 0 && sunElev < 5) {
      const moonStrength = Math.min(elevation / 15, 1); // ramps up as moon rises
      const sunGone = Math.min(Math.max((5 - sunElev) / 10, 0), 1); // 1 when sun fully set
      this.moonLight.intensity = 1.0 * moonStrength * sunGone;
      this.moonLight.castShadow = this.moonLight.intensity > 0.2;
    } else {
      this.moonLight.intensity = 0;
      this.moonLight.castShadow = false;
    }
  }

  /** Adjust tone mapping exposure — brighter during day, compensate at night */
  private updateExposure(sunElev: number) {
    if (sunElev > 10) {
      this.renderer.toneMappingExposure = 0.7; // bright sunny day
    } else if (sunElev > -10) {
      const t = (10 - sunElev) / 20;
      this.renderer.toneMappingExposure = 0.7 + t * 0.6; // 0.7 → 1.3
    } else {
      this.renderer.toneMappingExposure = 1.3;
    }
  }

  /** Call each frame to keep moonlight shadow centered on player */
  followPlayer(playerPosition: THREE.Vector3) {
    if (this.moonLight.intensity > 0) {
      this.moonLight.position.copy(playerPosition).add(this.moonOffset);
      this.moonLight.target.position.copy(playerPosition);
      this.moonLight.target.updateMatrixWorld();
    }
  }

  private updateAmbient(sunElev: number) {
    if (sunElev < -5) {
      // Night: blue-ish moonlit ambient
      this.ambient.intensity = 0.45;
      this.ambient.color.setHex(0x5577bb);
      this.ambient.groundColor.setHex(0x223355);
    } else if (sunElev < 5) {
      // Dawn/dusk transition
      const t = (sunElev + 5) / 10; // 0 = full night, 1 = full day transition
      this.ambient.intensity = 0.45 + t * (0.5 - 0.45);
      this.ambient.color.setHex(0xffa060);
      this.ambient.groundColor.setHex(0x4a3520);
    } else {
      this.ambient.intensity = 0.5;
      this.ambient.color.setHex(0x87ceeb);
      this.ambient.groundColor.setHex(0x8b7355);
    }
  }

  private updateFog(sunElev: number) {
    const fog = this.scene.fog as THREE.FogExp2;
    if (!fog) return;

    if (sunElev < -5) {
      fog.color.setHex(0x112244);
      fog.density = 0.0015; // same as day — don't eat the moonlight
    } else if (sunElev < 5) {
      fog.color.setHex(0xcc8855);
      fog.density = 0.0017;
    } else {
      fog.color.setHex(0x87ceeb);
      fog.density = 0.0015;
    }
  }

  getPhase(): TimeOfDay {
    const t = this.time;
    if (t >= 0.22 && t < 0.3) return 'dawn';
    if (t >= 0.3 && t < 0.7) return 'day';
    if (t >= 0.7 && t < 0.78) return 'dusk';
    return 'night';
  }

  getTimeString(): string {
    const hours = Math.floor(this.time * 24);
    const minutes = Math.floor((this.time * 24 - hours) * 60);
    return `Day ${this.day} - ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  getDay(): number {
    return this.day;
  }

  getTime(): number {
    return this.time;
  }

  getDayDuration(): number {
    return this.dayDuration;
  }

  setTime(t: number) {
    this.time = t % 1;
    this.updateAll();
  }
}
