import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerChickSpawns(registry: SpawnRegistry): void {
  registry.register('monster_chick', createMonsterSpawn({
    model: 'models/monsters/bitch/tris.md2',
    health: 175,
    mass: 200
  }));
}
