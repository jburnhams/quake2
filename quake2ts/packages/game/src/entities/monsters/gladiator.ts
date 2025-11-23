import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerGladiatorSpawns(registry: SpawnRegistry): void {
  registry.register('monster_gladiator', createMonsterSpawn({
    model: 'models/monsters/gladiatr/tris.md2',
    health: 400,
    mass: 400
  }));
}
