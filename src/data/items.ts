export interface ItemDef {
  id: string;
  name: string;
  icon: string;       // Short label (1-3 chars) displayed on the colored badge
  iconColor: string;  // Background color for the badge
  category: 'resource' | 'tool' | 'food' | 'placeable' | 'container' | 'armor';
  stackSize: number;
  description: string;
  foodValue?: number;
  waterValue?: number;
  toolType?: string;
  toolTier?: number;
  maxDurability?: number;
  armorValue?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  wood: {
    id: 'wood', name: 'Wood', icon: 'W', iconColor: '#8B5E3C',
    category: 'resource', stackSize: 20, description: 'Basic building material',
  },
  stone: {
    id: 'stone', name: 'Stone', icon: 'S', iconColor: '#778899',
    category: 'resource', stackSize: 20, description: 'Hard and heavy',
  },
  fiber: {
    id: 'fiber', name: 'Fi', iconColor: '#6B8E23',
    icon: 'Fi', category: 'resource', stackSize: 30, description: 'Flexible plant material',
  },
  stick: {
    id: 'stick', name: 'Stick', icon: '/', iconColor: '#A0724A',
    category: 'resource', stackSize: 20, description: 'A thin branch',
  },
  coconut: {
    id: 'coconut', name: 'Coconut', icon: 'Co', iconColor: '#7B4F2A',
    category: 'food', stackSize: 5, description: 'Raw coconut — food and hydration',
    foodValue: 15, waterValue: 20,
  },
  cooked_coconut: {
    id: 'cooked_coconut', name: 'Cooked Coconut', icon: 'Ck', iconColor: '#D4881C',
    category: 'food', stackSize: 5, description: 'Cooked — tasty and nutritious',
    foodValue: 30, waterValue: 10,
  },
  coconut_shell: {
    id: 'coconut_shell', name: 'Coconut Shell', icon: 'Sh', iconColor: '#5C3D1E',
    category: 'container', stackSize: 5, description: 'Empty shell — can hold water',
  },
  water_bottle: {
    id: 'water_bottle', name: 'Plastic Bottle', icon: 'Bt', iconColor: '#4A9BD9',
    category: 'container', stackSize: 3, description: 'Washed ashore. Reusable water container',
  },
  dirty_water: {
    id: 'dirty_water', name: 'Dirty Water', icon: 'dW', iconColor: '#7A8B5C',
    category: 'food', stackSize: 5, description: 'Unclean spring water — boil it first!',
    waterValue: 8, foodValue: 0,
  },
  clean_water: {
    id: 'clean_water', name: 'Clean Water', icon: 'cW', iconColor: '#2E86C1',
    category: 'food', stackSize: 5, description: 'Boiled and safe to drink',
    waterValue: 30, foodValue: 0,
  },
  rope: {
    id: 'rope', name: 'Rope', icon: 'Rp', iconColor: '#B8860B',
    category: 'resource', stackSize: 10, description: 'Crafted from fiber',
  },
  stone_axe: {
    id: 'stone_axe', name: 'Stone Axe', icon: 'Ax', iconColor: '#607D8B',
    category: 'tool', stackSize: 1, description: 'Chop trees faster',
    toolType: 'axe', toolTier: 1, maxDurability: 50,
  },
  stone_pickaxe: {
    id: 'stone_pickaxe', name: 'Stone Pickaxe', icon: 'Pk', iconColor: '#546E7A',
    category: 'tool', stackSize: 1, description: 'Mine rocks faster',
    toolType: 'pickaxe', toolTier: 1, maxDurability: 50,
  },
  campfire_item: {
    id: 'campfire_item', name: 'Campfire', icon: 'Cf', iconColor: '#D35400',
    category: 'placeable', stackSize: 1, description: 'Place to cook and stay warm',
  },
  // Phase 3 items
  raw_crab_meat: {
    id: 'raw_crab_meat', name: 'Raw Crab', icon: 'Cr', iconColor: '#C0392B',
    category: 'food', stackSize: 5, description: 'Raw crab meat — cook it',
    foodValue: 10, waterValue: 0,
  },
  raw_fish: {
    id: 'raw_fish', name: 'Raw Fish', icon: 'Fs', iconColor: '#7FB3D8',
    category: 'food', stackSize: 5, description: 'Raw fish — cook it',
    foodValue: 8, waterValue: 5,
  },
  raw_meat: {
    id: 'raw_meat', name: 'Raw Meat', icon: 'Rm', iconColor: '#922B21',
    category: 'food', stackSize: 5, description: 'Raw boar meat — cook it',
    foodValue: 12, waterValue: 0,
  },
  cooked_meat: {
    id: 'cooked_meat', name: 'Cooked Meat', icon: 'Cm', iconColor: '#A04000',
    category: 'food', stackSize: 5, description: 'Hearty cooked meat',
    foodValue: 35, waterValue: 0,
  },
  cooked_fish: {
    id: 'cooked_fish', name: 'Cooked Fish', icon: 'Cf', iconColor: '#2980B9',
    category: 'food', stackSize: 5, description: 'Cooked fish — nutritious',
    foodValue: 25, waterValue: 8,
  },
  hide: {
    id: 'hide', name: 'Hide', icon: 'Hd', iconColor: '#7D6608',
    category: 'resource', stackSize: 10, description: 'Animal hide',
  },
  fishing_spear: {
    id: 'fishing_spear', name: 'Fishing Spear', icon: 'Sp', iconColor: '#5D6D7E',
    category: 'tool', stackSize: 1, description: 'Catch fish near shore',
    toolType: 'spear', toolTier: 1, maxDurability: 30,
  },
  shelter_item: {
    id: 'shelter_item', name: 'Shelter', icon: 'Sl', iconColor: '#6E4B3A',
    category: 'placeable', stackSize: 1, description: 'A lean-to for resting',
  },
  storage_box_item: {
    id: 'storage_box_item', name: 'Storage Box', icon: 'Bx', iconColor: '#8B6914',
    category: 'placeable', stackSize: 1, description: 'Store your items',
  },
  water_collector_item: {
    id: 'water_collector_item', name: 'Water Collector', icon: 'Wc', iconColor: '#1A5276',
    category: 'placeable', stackSize: 1, description: 'Collects clean water over time',
  },
  // Phase 4 — Combat items
  hide_armor: {
    id: 'hide_armor', name: 'Hide Armor', icon: 'Ha', iconColor: '#7D5A38',
    category: 'armor', stackSize: 1, description: 'Reduces incoming damage',
    armorValue: 5, maxDurability: 100,
  },
  bone_club: {
    id: 'bone_club', name: 'Bone Club', icon: 'Cb', iconColor: '#8B7355',
    category: 'tool', stackSize: 1, description: 'Heavy melee weapon',
    toolType: 'club', toolTier: 1, maxDurability: 40,
  },
  bow: {
    id: 'bow', name: 'Bow', icon: 'Bw', iconColor: '#6B4226',
    category: 'tool', stackSize: 1, description: 'Ranged weapon — uses arrows',
    toolType: 'bow', toolTier: 1, maxDurability: 60,
  },
  arrow: {
    id: 'arrow', name: 'Arrow', icon: 'Ar', iconColor: '#5D4E37',
    category: 'resource', stackSize: 20, description: 'Ammunition for bow',
  },
};
