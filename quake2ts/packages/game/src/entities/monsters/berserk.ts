import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerBerserkSpawns(registry: SpawnRegistry): void {
  registry.register('monster_berserk', createMonsterSpawn({
    model: 'models/monsters/berserk/tris.md2',
    health: 240,
    mass: 250
  }));
}
