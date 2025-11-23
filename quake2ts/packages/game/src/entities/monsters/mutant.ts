import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerMutantSpawns(registry: SpawnRegistry): void {
  registry.register('monster_mutant', createMonsterSpawn({
    model: 'models/monsters/mutant/tris.md2',
    health: 300,
    mass: 300
  }));
}
