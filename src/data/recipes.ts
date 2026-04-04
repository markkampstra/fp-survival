export interface Recipe {
  id: string;
  name: string;
  icon: string;
  ingredients: { itemId: string; quantity: number }[];
  result: { itemId: string; quantity: number };
  craftTime: number;
  category: 'tools' | 'building' | 'materials';
}

export const RECIPES: Recipe[] = [
  {
    id: 'craft_rope', name: 'Rope', icon: '\u{1FAA2}',
    ingredients: [{ itemId: 'fiber', quantity: 4 }],
    result: { itemId: 'rope', quantity: 1 },
    craftTime: 0, category: 'materials',
  },
  {
    id: 'craft_stone_axe', name: 'Stone Axe', icon: '\u{1FA93}',
    ingredients: [
      { itemId: 'stone', quantity: 3 },
      { itemId: 'stick', quantity: 2 },
      { itemId: 'rope', quantity: 1 },
    ],
    result: { itemId: 'stone_axe', quantity: 1 },
    craftTime: 0, category: 'tools',
  },
  {
    id: 'craft_stone_pickaxe', name: 'Stone Pickaxe', icon: '\u{26CF}',
    ingredients: [
      { itemId: 'stone', quantity: 3 },
      { itemId: 'stick', quantity: 2 },
      { itemId: 'rope', quantity: 1 },
    ],
    result: { itemId: 'stone_pickaxe', quantity: 1 },
    craftTime: 0, category: 'tools',
  },
  {
    id: 'craft_campfire', name: 'Campfire', icon: '\u{1F525}',
    ingredients: [
      { itemId: 'stone', quantity: 5 },
      { itemId: 'stick', quantity: 5 },
    ],
    result: { itemId: 'campfire_item', quantity: 1 },
    craftTime: 0, category: 'building',
  },
  {
    id: 'craft_fishing_spear', name: 'Fishing Spear', icon: 'Sp',
    ingredients: [
      { itemId: 'stick', quantity: 2 },
      { itemId: 'stone', quantity: 1 },
      { itemId: 'rope', quantity: 1 },
    ],
    result: { itemId: 'fishing_spear', quantity: 1 },
    craftTime: 0, category: 'tools',
  },
  {
    id: 'craft_shelter', name: 'Shelter', icon: 'Sl',
    ingredients: [
      { itemId: 'wood', quantity: 8 },
      { itemId: 'rope', quantity: 4 },
      { itemId: 'fiber', quantity: 6 },
    ],
    result: { itemId: 'shelter_item', quantity: 1 },
    craftTime: 0, category: 'building',
  },
  {
    id: 'craft_storage_box', name: 'Storage Box', icon: 'Bx',
    ingredients: [
      { itemId: 'wood', quantity: 10 },
      { itemId: 'rope', quantity: 2 },
    ],
    result: { itemId: 'storage_box_item', quantity: 1 },
    craftTime: 0, category: 'building',
  },
  {
    id: 'craft_water_collector', name: 'Water Collector', icon: 'Wc',
    ingredients: [
      { itemId: 'stick', quantity: 4 },
      { itemId: 'fiber', quantity: 4 },
      { itemId: 'coconut_shell', quantity: 1 },
    ],
    result: { itemId: 'water_collector_item', quantity: 1 },
    craftTime: 0, category: 'building',
  },
];
