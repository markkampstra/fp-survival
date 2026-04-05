export interface AnimalDef {
  id: string;
  name: string;
  health: number;
  speed: number;
  behavior: 'wander' | 'flee' | 'patrol' | 'hostile';
  fleeDistance: number;
  drops: { itemId: string; min: number; max: number }[];
  spawnHeightRange: [number, number];
  spawnCount: number;
  boundingRadius: number;
  requiresTool?: string;
  // Hostile-specific
  aggroRange?: number;
  attackDamage?: number;
  attackCooldown?: number;
  nightOnly?: boolean;
  fearsFire?: boolean;
  fearsFireRadius?: number;
}

export const ANIMALS: Record<string, AnimalDef> = {
  crab: {
    id: 'crab', name: 'Crab',
    health: 10, speed: 2,
    behavior: 'wander', fleeDistance: 0,
    drops: [{ itemId: 'raw_crab_meat', min: 1, max: 1 }],
    spawnHeightRange: [0.3, 2.5],
    spawnCount: 15,
    boundingRadius: 0.5,
  },
  fish: {
    id: 'fish', name: 'Fish',
    health: 5, speed: 3,
    behavior: 'patrol', fleeDistance: 0,
    drops: [{ itemId: 'raw_fish', min: 1, max: 1 }],
    spawnHeightRange: [-0.5, 0.5],
    spawnCount: 10,
    boundingRadius: 0.6,
    requiresTool: 'spear',
  },
  boar: {
    id: 'boar', name: 'Boar',
    health: 30, speed: 6,
    behavior: 'flee', fleeDistance: 8,
    drops: [
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'hide', min: 1, max: 1 },
    ],
    spawnHeightRange: [5, 18],
    spawnCount: 5,
    boundingRadius: 0.8,
  },
  wolf: {
    id: 'wolf', name: 'Wolf',
    health: 40, speed: 7,
    behavior: 'hostile', fleeDistance: 0,
    drops: [
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'hide', min: 1, max: 2 },
    ],
    spawnHeightRange: [5, 30],
    spawnCount: 4,
    boundingRadius: 0.8,
    aggroRange: 20,
    attackDamage: 15,
    attackCooldown: 1.5,
    nightOnly: true,
    fearsFire: true,
    fearsFireRadius: 8,
  },
  snake: {
    id: 'snake', name: 'Snake',
    health: 15, speed: 3,
    behavior: 'hostile', fleeDistance: 0,
    drops: [{ itemId: 'raw_meat', min: 1, max: 1 }],
    spawnHeightRange: [2, 12],
    spawnCount: 6,
    boundingRadius: 0.4,
    aggroRange: 4,
    attackDamage: 10,
    attackCooldown: 2.0,
    nightOnly: true,
    fearsFire: false,
  },
};
