import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerFlipperSpawns(registry: SpawnRegistry): void {
  registry.register('monster_flipper', createMonsterSpawn({
    model: 'models/monsters/flipper/tris.md2',
    health: 50,
    mass: 100,
    fly: true // Swims
  }));
}
