import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { events } from '../core/event-bus';

export class FirstPersonControls {
  readonly controls: PointerLockControls;
  private keys = new Set<string>();
  private walkSpeed = 15;
  private sprintSpeed = 25;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private getHeight: ((x: number, z: number) => number) | null = null;
  private eyeHeight = 1.8;
  private _isSprinting = false;
  private _enabled = true;
  private stepTimer = 0;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.controls = new PointerLockControls(camera, domElement);

    domElement.addEventListener('click', () => {
      if (!this.controls.isLocked) {
        this.controls.lock();
      }
    });

    document.addEventListener('keydown', (e) => this.keys.add(e.code));
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  setHeightProvider(fn: (x: number, z: number) => number) {
    this.getHeight = fn;
  }

  set enabled(value: boolean) {
    this._enabled = value;
  }

  get isLocked(): boolean {
    return this.controls.isLocked;
  }

  get isSprinting(): boolean {
    return this._isSprinting;
  }

  setCanSprint(canSprint: boolean) {
    if (!canSprint) this._isSprinting = false;
  }

  update(dt: number) {
    if (!this.controls.isLocked || !this._enabled) return;

    const camera = this.controls.object;

    // Sprint check
    this._isSprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = this._isSprinting ? this.sprintSpeed : this.walkSpeed;

    // Calculate movement direction
    this.direction.set(0, 0, 0);

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.direction.z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.direction.z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.direction.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.direction.x += 1;

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
    }

    // Move relative to camera facing (XZ plane only)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    this.velocity.set(0, 0, 0);
    this.velocity.addScaledVector(forward, -this.direction.z * speed * dt);
    this.velocity.addScaledVector(right, this.direction.x * speed * dt);

    camera.position.add(this.velocity);

    // Follow terrain height
    if (this.getHeight) {
      const terrainY = this.getHeight(camera.position.x, camera.position.z);
      camera.position.y = terrainY + this.eyeHeight;

      // Footstep sounds
      if (this.direction.lengthSq() > 0) {
        const stepInterval = this._isSprinting ? 0.25 : 0.4;
        this.stepTimer += dt;
        if (this.stepTimer >= stepInterval) {
          this.stepTimer = 0;
          const type = terrainY < 2 ? 'sand' : terrainY > 15 ? 'rock' : 'grass';
          events.emit('player:footstep', type);
        }
      } else {
        this.stepTimer = 0;
      }
    }
  }
}
