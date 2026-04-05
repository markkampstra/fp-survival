import * as THREE from 'three';

/**
 * Moon rendered as an HTML overlay element positioned via 3D→screen projection.
 * Bypasses all WebGL pipeline issues (fog, tone mapping, depth, render order).
 * Phase is rendered with CSS gradients.
 */

export class Moon {
  private element: HTMLDivElement;
  private shadow: HTMLDivElement;
  private glowElement: HTMLDivElement;
  private lunarDay = 0;
  private _visible = false;

  // Dummy mesh kept for API compat (visibility checks in game.ts)
  readonly mesh: { visible: boolean } = { visible: false };

  constructor() {
    // Glow behind the moon
    this.glowElement = document.createElement('div');
    this.glowElement.style.cssText = `
      position: fixed; pointer-events: none; z-index: 5;
      width: 80px; height: 80px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(200,210,255,0.15) 0%, transparent 70%);
      transform: translate(-50%, -50%);
      display: none;
    `;
    document.body.appendChild(this.glowElement);

    // Moon disc — base bright circle
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed; pointer-events: none; z-index: 6;
      width: 28px; height: 28px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      display: none;
      overflow: hidden;
    `;

    // Shadow overlay — a LARGER circle that shifts to create curved terminator
    // Larger radius + offset = curved intersection inside the clipped moon disc
    this.shadow = document.createElement('div');
    this.shadow.style.cssText = `
      position: absolute;
      width: 40px; height: 40px;
      border-radius: 50%;
      top: -6px;
    `;
    this.element.appendChild(this.shadow);

    document.body.appendChild(this.element);
  }

  update(
    gameDay: number,
    gameTime: number,
    sunElevation: number,
    playerPos: THREE.Vector3,
    camera: THREE.Camera,
  ) {
    this.lunarDay = gameDay % 30;
    const lunarPhase = this.lunarDay / 30;

    // Moon sky position
    const moonLag = lunarPhase;
    const moonTime = (gameTime + moonLag * 0.5) % 1;
    const moonAngle = (moonTime - 0.25) * Math.PI * 2;
    const elevation = Math.sin(moonAngle) * 60;
    const azimuth = 90 + (moonTime - 0.25) * 360;

    const aboveHorizon = elevation > 2;
    const darkEnough = sunElevation < 10;
    this._visible = aboveHorizon && darkEnough;
    this.mesh.visible = this._visible;

    if (!this._visible) {
      this.element.style.display = 'none';
      this.glowElement.style.display = 'none';
      return;
    }

    // 3D position on sky sphere
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    const r = 500;
    const worldPos = new THREE.Vector3().setFromSphericalCoords(r, phi, theta);
    worldPos.x += playerPos.x;
    worldPos.z += playerPos.z;

    // Project to screen
    const projected = worldPos.clone().project(camera);
    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;

    // Check if in front of camera
    if (projected.z > 1 || screenX < -50 || screenX > window.innerWidth + 50 ||
        screenY < -50 || screenY > window.innerHeight + 50) {
      this.element.style.display = 'none';
      this.glowElement.style.display = 'none';
      return;
    }

    // Phase rendering via CSS gradient
    // phase 0 = new (dark), 0.5 = full (bright)
    const illumination = (1 - Math.cos(lunarPhase * Math.PI * 2)) / 2;
    this.updatePhaseStyle(lunarPhase, illumination);

    this.element.style.display = 'block';
    this.element.style.left = `${screenX}px`;
    this.element.style.top = `${screenY}px`;

    this.glowElement.style.display = 'block';
    this.glowElement.style.left = `${screenX}px`;
    this.glowElement.style.top = `${screenY}px`;
    this.glowElement.style.opacity = `${illumination * 0.8}`;
  }

  private updatePhaseStyle(phase: number, illumination: number) {
    const bright = `rgb(230, 225, 210)`;
    const dark = `rgb(20, 20, 30)`;

    // Base disc is always bright
    this.element.style.background = bright;
    this.element.style.boxShadow = `0 0 ${illumination * 15}px ${illumination * 3}px rgba(200,210,255,${illumination * 0.4})`;

    if (illumination > 0.97) {
      // Full moon — hide shadow
      this.shadow.style.display = 'none';
    } else if (illumination < 0.03) {
      // New moon — shadow centered, covers everything
      this.shadow.style.display = 'block';
      this.shadow.style.background = dark;
      this.shadow.style.left = '-6px';
    } else {
      // Partial phase — offset the larger dark circle to create curved terminator
      // Shadow is 40px wide, moon is 28px. Shadow centered = left: -6px
      // Shift range: from -6 (centered/new) to -46 (fully off left/full waxing)
      //              or from -6 (centered/new) to +34 (fully off right/full waning)
      this.shadow.style.display = 'block';
      this.shadow.style.background = dark;

      if (phase < 0.5) {
        // Waxing: bright on right, shadow slides left to reveal
        // At new (illum=0): shadow at -6 (centered). At full (illum=1): at -46 (off-screen left)
        const offset = -6 - illumination * 40;
        this.shadow.style.left = `${offset}px`;
      } else {
        // Waning: bright on left, shadow slides right to cover
        // At full (illum=1): at +34 (off-screen right). At new (illum=0): at -6 (centered)
        const offset = -6 + illumination * 40;
        this.shadow.style.left = `${offset}px`;
      }
    }
  }

  getLunarPhase(): number {
    return this.lunarDay / 30;
  }

  getIllumination(): number {
    const phase = this.lunarDay / 30;
    return (1 - Math.cos(phase * Math.PI * 2)) / 2;
  }
}
