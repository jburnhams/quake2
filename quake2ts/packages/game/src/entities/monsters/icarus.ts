import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerIcarusSpawns(registry: SpawnRegistry): void {
  registry.register('monster_icarus', createMonsterSpawn({
    model: 'models/monsters/icarus/tris.md2',
    health: 240,
    mass: 200,
    fly: true
  }));
}
