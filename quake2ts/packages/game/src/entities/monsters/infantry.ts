import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerInfantrySpawns(registry: SpawnRegistry): void {
  registry.register('monster_infantry', createMonsterSpawn({
    model: 'models/monsters/infantry/tris.md2',
    health: 100,
    mass: 200
  }));
}
