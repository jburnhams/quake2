import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerFloaterSpawns(registry: SpawnRegistry): void {
  registry.register('monster_floater', createMonsterSpawn({
    model: 'models/monsters/floater/tris.md2',
    health: 200,
    mass: 300,
    fly: true
  }));
}
