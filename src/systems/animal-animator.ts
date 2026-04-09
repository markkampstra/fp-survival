import * as THREE from 'three';

/**
 * Tier 3 Animal Animator: AnimationClip + AnimationMixer per animal.
 * Creates keyframe clips for idle/walk/run/attack and crossfades between them.
 * Works with named sub-groups (no SkinnedMesh needed — AnimationMixer
 * can target any Object3D property via dot-notation paths).
 */

export type AnimState = 'idle' | 'walk' | 'run' | 'attack' | 'death';

interface AnimalAnimData {
  mixer: THREE.AnimationMixer;
  actions: Map<AnimState, THREE.AnimationAction>;
  currentState: AnimState;
}

const CROSSFADE_DURATION = 0.25; // seconds to blend between clips

export class AnimalAnimator {
  private animData = new Map<THREE.Object3D, AnimalAnimData>();

  /** Set up animations for an animal mesh. Call once after mesh creation. */
  register(mesh: THREE.Group, animalId: string) {
    const mixer = new THREE.AnimationMixer(mesh);
    const clips = this.createClips(mesh, animalId);
    const actions = new Map<AnimState, THREE.AnimationAction>();

    for (const [state, clip] of clips) {
      const action = mixer.clipAction(clip);
      if (state === 'attack' || state === 'death') {
        action.loop = THREE.LoopOnce;
        action.clampWhenFinished = true;
      }
      actions.set(state, action);
    }

    // Start with idle
    const idleAction = actions.get('idle');
    if (idleAction) idleAction.play();

    this.animData.set(mesh, { mixer, actions, currentState: 'idle' });
  }

  /** Transition to a new animation state with crossfade */
  setState(mesh: THREE.Object3D, state: AnimState) {
    const data = this.animData.get(mesh);
    if (!data || data.currentState === state) return;

    const prevAction = data.actions.get(data.currentState);
    const nextAction = data.actions.get(state);
    if (!nextAction) return;

    // Reset one-shot clips (attack, death)
    if (state === 'attack' || state === 'death') {
      nextAction.reset();
    }

    nextAction.play();
    if (prevAction) {
      prevAction.crossFadeTo(nextAction, CROSSFADE_DURATION, true);
    }

    data.currentState = state;
  }

  /** Update all mixers. Call once per frame. */
  update(dt: number) {
    for (const data of this.animData.values()) {
      data.mixer.update(dt);
    }
  }

  /** Remove an animal's animation data */
  unregister(mesh: THREE.Object3D) {
    const data = this.animData.get(mesh);
    if (data) {
      data.mixer.stopAllAction();
      this.animData.delete(mesh);
    }
  }

  // ============================================================
  // Clip factories per animal type
  // ============================================================

  private createClips(mesh: THREE.Group, id: string): Map<AnimState, THREE.AnimationClip> {
    switch (id) {
      case 'wolf': return this.wolfClips(mesh);
      case 'boar': return this.boarClips(mesh);
      case 'crab': return this.crabClips(mesh);
      case 'fish': return this.fishClips(mesh);
      case 'snake': return this.snakeClips(mesh);
      default: return this.genericClips(mesh);
    }
  }

  // --- Helper to find property path from mesh root to a named child ---
  private findPath(mesh: THREE.Group, name: string): string | null {
    const obj = mesh.getObjectByName(name);
    if (!obj) return null;
    // Build path by walking up parents
    const parts: string[] = [];
    let current: THREE.Object3D | null = obj;
    while (current && current !== mesh) {
      const p: THREE.Object3D | null = current.parent;
      if (!p) break;
      const idx = p.children.indexOf(current);
      parts.unshift(`.children[${idx}]`);
      current = p;
    }
    return parts.join('');
  }

  // --- Wolf: idle, walk, run, attack ---
  private wolfClips(mesh: THREE.Group): Map<AnimState, THREE.AnimationClip> {
    const clips = new Map<AnimState, THREE.AnimationClip>();
    const legNames = ['leg_fl', 'leg_fr', 'leg_bl', 'leg_br'];
    const legPhases = [0, 0.5, 0.25, 0.75]; // normalized phase offsets

    // IDLE — gentle weight shift, head look, tail wag
    {
      const tracks: THREE.KeyframeTrack[] = [];
      for (let i = 0; i < legNames.length; i++) {
        const p = this.findPath(mesh, legNames[i]);
        if (p) tracks.push(new THREE.NumberKeyframeTrack(
          p + '.rotation[x]', [0, 1, 2], [0.05, -0.05, 0.05]
        ));
      }
      this.addTrack(mesh, tracks, 'head', '.rotation[y]', [0, 1.5, 3], [0.12, -0.12, 0.12]);
      this.addTrack(mesh, tracks, 'head', '.rotation[x]', [0, 1.5, 3], [0.03, -0.03, 0.03]);
      this.addTrack(mesh, tracks, 'tail', '.rotation[y]', [0, 0.5, 1], [0.3, -0.3, 0.3]);
      this.addTrack(mesh, tracks, 'body', '.scale[y]', [0, 1, 2], [1.0, 1.02, 1.0]); // breathing
      clips.set('idle', new THREE.AnimationClip('wolf_idle', 3, tracks));
    }

    // WALK — moderate leg swing, head bob
    {
      const tracks: THREE.KeyframeTrack[] = [];
      const dur = 0.8; // one full walk cycle
      for (let i = 0; i < legNames.length; i++) {
        const p = this.findPath(mesh, legNames[i]);
        if (p) {
          const ph = legPhases[i] * dur;
          tracks.push(new THREE.NumberKeyframeTrack(
            p + '.rotation[x]',
            [0, dur * 0.25, dur * 0.5, dur * 0.75, dur].map(t => (t + ph) % dur),
            [0.4, 0, -0.4, 0, 0.4]
          ));
        }
      }
      this.addTrack(mesh, tracks, 'head', '.rotation[x]', [0, 0.4, 0.8], [0.05, -0.08, 0.05]);
      this.addTrack(mesh, tracks, 'body', '.rotation[z]', [0, 0.4, 0.8], [0.03, -0.03, 0.03]);
      this.addTrack(mesh, tracks, 'tail', '.rotation[y]', [0, 0.4, 0.8], [0.15, -0.15, 0.15]);
      clips.set('walk', new THREE.AnimationClip('wolf_walk', dur, tracks));
    }

    // RUN — fast, exaggerated leg swing, body bounce
    {
      const tracks: THREE.KeyframeTrack[] = [];
      const dur = 0.45;
      for (let i = 0; i < legNames.length; i++) {
        const p = this.findPath(mesh, legNames[i]);
        if (p) {
          const ph = legPhases[i] * dur;
          tracks.push(new THREE.NumberKeyframeTrack(
            p + '.rotation[x]',
            [0, dur * 0.25, dur * 0.5, dur * 0.75, dur].map(t => (t + ph) % dur),
            [0.7, 0, -0.6, 0, 0.7]
          ));
        }
      }
      this.addTrack(mesh, tracks, 'head', '.rotation[x]', [0, 0.225, 0.45], [-0.1, -0.15, -0.1]); // lowered
      this.addTrack(mesh, tracks, 'body', '.rotation[z]', [0, 0.225, 0.45], [0.05, -0.05, 0.05]);
      this.addTrack(mesh, tracks, 'body', '.position[y]', [0, 0.15, 0.3, 0.45], [0.55, 0.6, 0.55, 0.55]); // bounce
      this.addTrack(mesh, tracks, 'tail', '.rotation[x]', [0, 0.45], [0.35, 0.35]); // tail down
      clips.set('run', new THREE.AnimationClip('wolf_run', dur, tracks));
    }

    // ATTACK — lunge, jaw snap
    {
      const tracks: THREE.KeyframeTrack[] = [];
      const dur = 0.6;
      this.addTrack(mesh, tracks, 'head', '.position[x]', [0, 0.15, 0.3, 0.6], [0.78, 0.92, 0.78, 0.78]);
      this.addTrack(mesh, tracks, 'head', '.rotation[x]', [0, 0.1, 0.2, 0.35, 0.6], [0, 0.15, -0.2, 0.1, 0]);
      this.addTrack(mesh, tracks, 'jaw', '.rotation[x]', [0, 0.12, 0.25, 0.4, 0.6], [0, 0.5, 0.1, 0.45, 0]);
      // Front legs lunge forward
      this.addTrack(mesh, tracks, 'leg_fl', '.rotation[x]', [0, 0.15, 0.4, 0.6], [0, -0.5, 0.3, 0]);
      this.addTrack(mesh, tracks, 'leg_fr', '.rotation[x]', [0, 0.15, 0.4, 0.6], [0, -0.5, 0.3, 0]);
      clips.set('attack', new THREE.AnimationClip('wolf_attack', dur, tracks));
    }

    return clips;
  }

  // --- Boar: idle, walk, run ---
  private boarClips(mesh: THREE.Group): Map<AnimState, THREE.AnimationClip> {
    const clips = new Map<AnimState, THREE.AnimationClip>();
    const legNames = ['leg_fl', 'leg_fr', 'leg_bl', 'leg_br'];
    const legPhases = [0, 0.5, 0.5, 0];

    // IDLE
    {
      const tracks: THREE.KeyframeTrack[] = [];
      for (const name of legNames) {
        this.addTrack(mesh, tracks, name, '.rotation[x]', [0, 1.5, 3], [0.05, -0.05, 0.05]);
      }
      this.addTrack(mesh, tracks, 'head', '.rotation[y]', [0, 2, 4], [0.1, -0.1, 0.1]); // look around
      this.addTrack(mesh, tracks, 'head', '.rotation[x]', [0, 2, 4], [0.02, -0.04, 0.02]);
      this.addTrack(mesh, tracks, 'tail', '.rotation[y]', [0, 0.6, 1.2], [0.3, -0.3, 0.3]);
      this.addTrack(mesh, tracks, 'body', '.scale[y]', [0, 1.5, 3], [1.0, 1.015, 1.0]);
      clips.set('idle', new THREE.AnimationClip('boar_idle', 4, tracks));
    }

    // WALK
    {
      const tracks: THREE.KeyframeTrack[] = [];
      const dur = 0.7;
      for (let i = 0; i < legNames.length; i++) {
        const p = this.findPath(mesh, legNames[i]);
        if (p) {
          const ph = legPhases[i] * dur;
          tracks.push(new THREE.NumberKeyframeTrack(
            p + '.rotation[x]',
            [0, dur * 0.25, dur * 0.5, dur * 0.75, dur].map(t => (t + ph) % dur),
            [0.45, 0, -0.45, 0, 0.45]
          ));
        }
      }
      this.addTrack(mesh, tracks, 'head', '.rotation[x]', [0, 0.35, 0.7], [0.06, -0.1, 0.06]);
      this.addTrack(mesh, tracks, 'body', '.rotation[z]', [0, 0.35, 0.7], [0.03, -0.03, 0.03]);
      this.addTrack(mesh, tracks, 'tail', '.rotation[y]', [0, 0.35, 0.7], [0.2, -0.2, 0.2]);
      clips.set('walk', new THREE.AnimationClip('boar_walk', dur, tracks));
    }

    // RUN (flee)
    {
      const tracks: THREE.KeyframeTrack[] = [];
      const dur = 0.4;
      for (let i = 0; i < legNames.length; i++) {
        const p = this.findPath(mesh, legNames[i]);
        if (p) {
          const ph = legPhases[i] * dur;
          tracks.push(new THREE.NumberKeyframeTrack(
            p + '.rotation[x]',
            [0, dur * 0.25, dur * 0.5, dur * 0.75, dur].map(t => (t + ph) % dur),
            [0.65, 0, -0.6, 0, 0.65]
          ));
        }
      }
      this.addTrack(mesh, tracks, 'head', '.rotation[x]', [0, 0.2, 0.4], [-0.05, -0.12, -0.05]);
      this.addTrack(mesh, tracks, 'body', '.rotation[z]', [0, 0.2, 0.4], [0.05, -0.05, 0.05]);
      this.addTrack(mesh, tracks, 'body', '.position[y]', [0, 0.13, 0.27, 0.4], [0, 0.04, 0, 0]); // bounce
      clips.set('run', new THREE.AnimationClip('boar_run', dur, tracks));
    }

    return clips;
  }

  // --- Crab: idle, walk ---
  private crabClips(mesh: THREE.Group): Map<AnimState, THREE.AnimationClip> {
    const clips = new Map<AnimState, THREE.AnimationClip>();

    // IDLE — slow leg sway, claw pinch
    {
      const tracks: THREE.KeyframeTrack[] = [];
      for (let i = 0; i < 3; i++) {
        for (const side of ['l', 'r']) {
          const phase = i * 0.3 + (side === 'r' ? 0.5 : 0);
          this.addTrack(mesh, tracks, `leg_${i}_${side}`, '.rotation[x]',
            [0, 0.8, 1.6].map(t => t + phase * 0.5),
            [0.15, -0.15, 0.15]);
        }
      }
      this.addTrack(mesh, tracks, 'claw_l', '.rotation[z]', [0, 0.8, 1.6], [0.2, -0.15, 0.2]);
      this.addTrack(mesh, tracks, 'claw_r', '.rotation[z]', [0, 0.8, 1.6], [-0.2, 0.15, -0.2]);
      this.addTrack(mesh, tracks, 'body', '.rotation[z]', [0, 1, 2], [0.03, -0.03, 0.03]);
      clips.set('idle', new THREE.AnimationClip('crab_idle', 2, tracks));
    }

    // WALK — fast scuttle
    {
      const tracks: THREE.KeyframeTrack[] = [];
      const dur = 0.4;
      for (let i = 0; i < 3; i++) {
        for (const side of ['l', 'r']) {
          const phase = (i * 0.15 + (side === 'r' ? dur / 2 : 0)) % dur;
          this.addTrack(mesh, tracks, `leg_${i}_${side}`, '.rotation[x]',
            [0, dur * 0.25, dur * 0.5, dur * 0.75, dur].map(t => (t + phase) % dur),
            [0.45, 0, -0.45, 0, 0.45]);
        }
      }
      this.addTrack(mesh, tracks, 'body', '.position[y]', [0, 0.1, 0.2, 0.3, 0.4], [0, 0.015, 0, 0.015, 0]);
      this.addTrack(mesh, tracks, 'body', '.rotation[z]', [0, 0.2, 0.4], [0.04, -0.04, 0.04]);
      clips.set('walk', new THREE.AnimationClip('crab_walk', dur, tracks));
    }

    return clips;
  }

  // --- Fish: idle (swim) ---
  private fishClips(mesh: THREE.Group): Map<AnimState, THREE.AnimationClip> {
    const clips = new Map<AnimState, THREE.AnimationClip>();

    {
      const tracks: THREE.KeyframeTrack[] = [];
      this.addTrack(mesh, tracks, 'tail', '.rotation[y]', [0, 0.25, 0.5, 0.75, 1.0], [0.4, 0, -0.4, 0, 0.4]);
      this.addTrack(mesh, tracks, 'body', '.rotation[z]', [0, 0.5, 1.0], [0.06, -0.06, 0.06]);
      this.addTrack(mesh, tracks, 'fin_l', '.rotation[z]', [0, 0.35, 0.7], [0.25, -0.2, 0.25]);
      this.addTrack(mesh, tracks, 'fin_r', '.rotation[z]', [0, 0.35, 0.7], [-0.25, 0.2, -0.25]);
      clips.set('idle', new THREE.AnimationClip('fish_swim', 1.0, tracks));
    }

    // Walk = same as idle for fish (always swimming)
    clips.set('walk', clips.get('idle')!);
    return clips;
  }

  // --- Snake: idle, walk (slither), attack ---
  private snakeClips(mesh: THREE.Group): Map<AnimState, THREE.AnimationClip> {
    const clips = new Map<AnimState, THREE.AnimationClip>();

    // IDLE — slow wave
    {
      const tracks: THREE.KeyframeTrack[] = [];
      for (let i = 0; i < 10; i++) {
        const phase = i * 0.15;
        this.addTrack(mesh, tracks, `seg_${i}`, '.position[z]',
          [0, 0.75, 1.5, 2.25, 3].map(t => (t + phase) % 3),
          [0.06, -0.06, 0.06, -0.06, 0.06]);
      }
      this.addTrack(mesh, tracks, 'head', '.rotation[y]', [0, 1.5, 3], [0.12, -0.12, 0.12]);
      clips.set('idle', new THREE.AnimationClip('snake_idle', 3, tracks));
    }

    // WALK (slither) — faster wave
    {
      const tracks: THREE.KeyframeTrack[] = [];
      const dur = 1.0;
      for (let i = 0; i < 10; i++) {
        const phase = i * 0.1;
        this.addTrack(mesh, tracks, `seg_${i}`, '.position[z]',
          [0, dur * 0.25, dur * 0.5, dur * 0.75, dur].map(t => (t + phase) % dur),
          [0.14, -0.14, 0.14, -0.14, 0.14]);
      }
      clips.set('walk', new THREE.AnimationClip('snake_slither', dur, tracks));
    }

    // ATTACK — rear up and strike
    {
      const tracks: THREE.KeyframeTrack[] = [];
      const dur = 0.5;
      this.addTrack(mesh, tracks, 'head', '.position[x]', [0, 0.15, 0.25, 0.5], [-0.72, -0.72, -0.9, -0.72]);
      this.addTrack(mesh, tracks, 'head', '.position[y]', [0, 0.15, 0.25, 0.5], [0.07, 0.15, 0.08, 0.07]);
      this.addTrack(mesh, tracks, 'head', '.rotation[x]', [0, 0.15, 0.25, 0.5], [0, -0.3, 0.1, 0]);
      clips.set('attack', new THREE.AnimationClip('snake_attack', dur, tracks));
    }

    return clips;
  }

  // --- Generic fallback ---
  private genericClips(_mesh: THREE.Group): Map<AnimState, THREE.AnimationClip> {
    return new Map([
      ['idle', new THREE.AnimationClip('generic_idle', 1, [])],
    ]);
  }

  // --- Utility: add a track if the named object exists ---
  private addTrack(
    mesh: THREE.Group,
    tracks: THREE.KeyframeTrack[],
    objectName: string,
    property: string,
    times: number[],
    values: number[],
  ) {
    const path = this.findPath(mesh, objectName);
    if (path) {
      tracks.push(new THREE.NumberKeyframeTrack(path + property, times, values));
    }
  }
}
