import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerHoverSpawns(registry: SpawnRegistry): void {
  registry.register('monster_hover', createMonsterSpawn({
    model: 'models/monsters/hover/tris.md2', // Note: monster_hover usually points to Icarus or similar, but let's assume specific if exists
    health: 240,
    mass: 200,
    fly: true
  }));
}
