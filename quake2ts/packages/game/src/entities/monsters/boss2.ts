import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerBoss2Spawns(registry: SpawnRegistry): void {
  registry.register('monster_boss2', createMonsterSpawn({
    model: 'models/monsters/boss2/tris.md2',
    health: 3000,
    mass: 1000,
    mins: { x: -64, y: -64, z: -16 },
    maxs: { x: 64, y: 64, z: 80 },
    fly: true
  }));
}
