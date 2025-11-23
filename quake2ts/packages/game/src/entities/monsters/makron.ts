import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerMakronSpawns(registry: SpawnRegistry): void {
  registry.register('monster_makron', createMonsterSpawn({
    model: 'models/monsters/boss3/rider.md2',
    health: 3000,
    mass: 1000,
    mins: { x: -30, y: -30, z: -24 },
    maxs: { x: 30, y: 30, z: 90 }
  }));
}
