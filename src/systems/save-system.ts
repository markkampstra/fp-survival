const SAVE_KEY = 'fp-survival-save';
const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  timestamp: number;
  player: {
    position: [number, number, number];
    health: number;
    hunger: number;
    thirst: number;
    stamina: number;
  };
  inventory: {
    slots: { itemId: string | null; quantity: number; durability?: number }[];
  };
  time: {
    dayTime: number;
    day: number;
  };
  placeables: {
    id: string;
    position: [number, number, number];
    userData?: Record<string, any>;
  }[];
  resources: {
    depleted: { index: number; respawnTimer: number }[];
  };
  animals: {
    id: string;
    position: [number, number, number];
    health: number;
    dead: boolean;
  }[];
  weather: {
    type: string;
    intensity: number;
    duration: number;
  };
}

export class SaveSystem {
  save(data: SaveData): void {
    data.version = SAVE_VERSION;
    data.timestamp = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  load(): SaveData | null {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return null;
      const data = JSON.parse(json) as SaveData;
      if (!data.version) return null;
      return data;
    } catch {
      return null;
    }
  }

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
