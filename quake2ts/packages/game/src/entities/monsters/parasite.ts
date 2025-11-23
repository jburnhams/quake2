import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerParasiteSpawns(registry: SpawnRegistry): void {
  registry.register('monster_parasite', createMonsterSpawn({
    model: 'models/monsters/parasite/tris.md2',
    health: 175,
    mass: 200
  }));
}
