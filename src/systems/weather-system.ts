import { events } from '../core/event-bus';
import type { DayCycle } from './day-cycle';

export type WeatherType = 'clear' | 'partly_cloudy' | 'cloudy' | 'overcast' | 'rain' | 'heavy_rain' | 'storm';

interface WeatherProfile {
  cloudCoverage: number;    // 0-1
  rainIntensity: number;    // 0-1
  sunDimming: number;       // 1 = full sun, 0 = no sun
  fogMultiplier: number;    // multiplier on base fog density
  windStrength: number;     // 0-1
  lightningRate: number;    // avg seconds between strikes, 0 = none
  cameraShake: number;      // 0-1
  tempPenalty: number;      // subtracted from base temperature
}

const PROFILES: Record<WeatherType, WeatherProfile> = {
  clear:         { cloudCoverage: 0,    rainIntensity: 0,   sunDimming: 1.0, fogMultiplier: 1.0, windStrength: 0.05, lightningRate: 0,  cameraShake: 0,    tempPenalty: 0 },
  partly_cloudy: { cloudCoverage: 0.3,  rainIntensity: 0,   sunDimming: 0.85, fogMultiplier: 1.1, windStrength: 0.1,  lightningRate: 0,  cameraShake: 0,    tempPenalty: 0 },
  cloudy:        { cloudCoverage: 0.55, rainIntensity: 0,   sunDimming: 0.6, fogMultiplier: 1.3, windStrength: 0.15, lightningRate: 0,  cameraShake: 0,    tempPenalty: 0.05 },
  overcast:      { cloudCoverage: 0.8,  rainIntensity: 0,   sunDimming: 0.35, fogMultiplier: 1.6, windStrength: 0.2,  lightningRate: 0,  cameraShake: 0,    tempPenalty: 0.1 },
  rain:          { cloudCoverage: 0.85, rainIntensity: 0.4, sunDimming: 0.25, fogMultiplier: 1.8, windStrength: 0.3,  lightningRate: 0,  cameraShake: 0,    tempPenalty: 0.15 },
  heavy_rain:    { cloudCoverage: 0.92, rainIntensity: 0.75, sunDimming: 0.15, fogMultiplier: 2.2, windStrength: 0.5,  lightningRate: 20, cameraShake: 0.05, tempPenalty: 0.2 },
  storm:         { cloudCoverage: 1.0,  rainIntensity: 1.0, sunDimming: 0.08, fogMultiplier: 2.8, windStrength: 0.9,  lightningRate: 8,  cameraShake: 0.15, tempPenalty: 0.3 },
};

// Transition table: from → possible next states with weights
const TRANSITIONS: Record<WeatherType, { to: WeatherType; weight: number }[]> = {
  clear:         [{ to: 'clear', weight: 3 }, { to: 'partly_cloudy', weight: 2 }],
  partly_cloudy: [{ to: 'clear', weight: 2 }, { to: 'cloudy', weight: 3 }],
  cloudy:        [{ to: 'partly_cloudy', weight: 2 }, { to: 'overcast', weight: 3 }, { to: 'rain', weight: 1 }],
  overcast:      [{ to: 'cloudy', weight: 2 }, { to: 'rain', weight: 3 }, { to: 'heavy_rain', weight: 1 }],
  rain:          [{ to: 'overcast', weight: 2 }, { to: 'heavy_rain', weight: 2 }, { to: 'cloudy', weight: 1 }],
  heavy_rain:    [{ to: 'rain', weight: 2 }, { to: 'storm', weight: 2 }, { to: 'overcast', weight: 1 }],
  storm:         [{ to: 'heavy_rain', weight: 3 }, { to: 'rain', weight: 1 }],
};

// Duration ranges per state (seconds)
const DURATIONS: Record<WeatherType, [number, number]> = {
  clear:         [180, 480],
  partly_cloudy: [90, 180],
  cloudy:        [60, 180],
  overcast:      [60, 150],
  rain:          [90, 240],
  heavy_rain:    [60, 180],
  storm:         [40, 120],
};

export class WeatherSystem {
  private type: WeatherType = 'clear';
  private duration: number;
  private temperature = 0.6;
  private lightningTimer = 15;
  private lightningFlash = 0;

  // Current interpolated values (smooth transitions)
  private current: WeatherProfile;
  private target: WeatherProfile;
  private transitionProgress = 1; // 1 = fully at target
  private transitionSpeed = 0.15; // how fast to blend (per second)

  constructor(private dayCycle: DayCycle) {
    this.current = { ...PROFILES.clear };
    this.target = { ...PROFILES.clear };
    this.duration = this.randomDuration('clear');
  }

  private randomDuration(type: WeatherType): number {
    const [min, max] = DURATIONS[type];
    return min + Math.random() * (max - min);
  }

  private pickNext(): WeatherType {
    const options = TRANSITIONS[this.type];
    const totalWeight = options.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * totalWeight;
    for (const opt of options) {
      r -= opt.weight;
      if (r <= 0) return opt.to;
    }
    return options[options.length - 1].to;
  }

  update(dt: number) {
    this.duration -= dt;
    if (this.duration <= 0) {
      this.transition();
    }

    // Smoothly interpolate current toward target
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt * this.transitionSpeed);
      const t = this.transitionProgress;
      for (const key of Object.keys(this.target) as (keyof WeatherProfile)[]) {
        (this.current as any)[key] = this.lerp((this.current as any)[key], (this.target as any)[key], t);
      }
    }

    // Temperature
    const sunElev = this.dayCycle.getSunElevation();
    const sunNorm = Math.max(0, sunElev) / 75;
    this.temperature = Math.max(0, Math.min(1,
      0.3 + sunNorm * 0.5 - this.current.tempPenalty
    ));

    let tempMult = 1.0;
    if (this.temperature < 0.3) tempMult = 0.5;
    else if (this.temperature > 0.8) tempMult = 0.7;
    events.emit('weather:temperature', tempMult);

    // Lightning
    const lRate = this.current.lightningRate;
    if (lRate > 0 && this.current.rainIntensity > 0.3) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        // 1-3 rapid flashes
        const flashes = 1 + Math.floor(Math.random() * 3);
        this.lightningFlash = flashes > 1 ? 1.2 : 1.0;
        this.lightningTimer = lRate * (0.5 + Math.random());
        events.emit('weather:lightning');
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4);
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(t * 0.3, 1); // damped blend each frame
  }

  private transition() {
    const next = this.pickNext();
    const old = this.type;
    this.type = next;
    this.target = { ...PROFILES[next] };
    this.transitionProgress = 0;
    this.duration = this.randomDuration(next);

    // Storms transition slower for dramatic buildup
    this.transitionSpeed = (next === 'storm' || old === 'storm') ? 0.08 : 0.15;

    if (old !== next) {
      events.emit('weather:changed', next);
    }
    events.emit('weather:rain-changed', this.target.rainIntensity);
  }

  // --- Public getters (all return smoothly interpolated values) ---

  getType(): WeatherType { return this.type; }
  getIntensity(): number { return this.current.rainIntensity; }
  getTemperature(): number { return this.temperature; }
  isRaining(): boolean { return this.current.rainIntensity > 0.05; }
  getLightningFlash(): number { return this.lightningFlash; }
  getCloudCoverage(): number { return this.current.cloudCoverage; }
  getSunDimming(): number { return this.current.sunDimming; }
  getWindStrength(): number { return this.current.windStrength; }
  getCameraShake(): number { return this.current.cameraShake; }
  getFogMultiplier(): number { return this.current.fogMultiplier; }

  /** Force weather state (debug console) */
  forceWeather(type: WeatherType, intensity?: number) {
    this.type = type;
    this.target = { ...PROFILES[type] };
    if (intensity !== undefined && type !== 'clear' && type !== 'partly_cloudy' && type !== 'cloudy' && type !== 'overcast') {
      this.target.rainIntensity = intensity;
    }
    // Snap to target immediately
    this.current = { ...this.target };
    this.transitionProgress = 1;
    this.duration = this.randomDuration(type);
    events.emit('weather:changed', type);
    events.emit('weather:rain-changed', this.current.rainIntensity);
  }
}
