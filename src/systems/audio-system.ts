import { events } from '../core/event-bus';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private initialized = false;
  private masterGain: GainNode | null = null;
  private muted = true; // default off
  private muteIcon: HTMLDivElement;

  // Ambient sources
  private windGain: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;

  constructor() {
    // Mute icon (shown when sound is off)
    this.muteIcon = document.createElement('div');
    this.muteIcon.style.cssText = `
      position: fixed; top: 10px; left: 80px;
      font-size: 18px; color: rgba(255,255,255,0.5);
      pointer-events: none; z-index: 10;
      font-family: sans-serif;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    this.muteIcon.textContent = '\u{1F507}'; // 🔇
    document.body.appendChild(this.muteIcon);

    // Toggle sound with M key
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        this.muted = !this.muted;
        if (this.masterGain) {
          this.masterGain.gain.value = this.muted ? 0 : 0.3;
        }
        this.muteIcon.style.display = this.muted ? 'block' : 'none';
      }
    });

    // Initialize on first user interaction (browser autoplay policy)
    const init = () => {
      if (this.initialized) return;
      this.initialized = true;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.3;
      this.masterGain.connect(this.ctx.destination);
      this.startAmbient();
      document.removeEventListener('pointerdown', init);
      document.removeEventListener('keydown', init);
    };
    document.addEventListener('pointerdown', init);
    document.addEventListener('keydown', init);

    events.on('player:footstep', (terrainType: string) => this.playFootstep(terrainType));
    events.on('tool:swing', () => this.playSwing());
    events.on('resource:collected', () => this.playPickup());
    events.on('player:consumed', () => this.playEat());
    events.on('animal:killed', () => this.playHit());
  }

  private startAmbient() {
    if (!this.ctx || !this.masterGain) return;

    // Wind ambient — filtered noise
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.05;

    this.windSource.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windSource.start();
  }

  private playNoiseBurst(freq: number, duration: number, volume: number) {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    source.stop(this.ctx.currentTime + duration);
  }

  private playTone(startFreq: number, endFreq: number, duration: number, volume: number) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playFootstep(terrainType: string) {
    const freq = terrainType === 'sand' ? 200 : terrainType === 'rock' ? 1200 : 600;
    this.playNoiseBurst(freq, 0.05, 0.15);
  }

  playSwing() {
    this.playTone(300, 100, 0.15, 0.1);
  }

  playPickup() {
    this.playTone(400, 800, 0.1, 0.08);
  }

  playEat() {
    this.playNoiseBurst(300, 0.25, 0.08);
  }

  playHit() {
    this.playNoiseBurst(150, 0.1, 0.2);
    this.playTone(200, 80, 0.2, 0.1);
  }

  updateAmbient(rainIntensity: number, isNight: boolean) {
    if (!this.windGain) return;
    // Wind louder during rain, quieter at night
    const base = isNight ? 0.02 : 0.05;
    this.windGain.gain.value = base + rainIntensity * 0.1;
  }
}
