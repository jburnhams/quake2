import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerSupertankSpawns(registry: SpawnRegistry): void {
  registry.register('monster_supertank', createMonsterSpawn({
    model: 'models/monsters/boss1/tris.md2',
    health: 1500,
    mass: 800,
    mins: { x: -64, y: -64, z: -16 }, // Very big
    maxs: { x: 64, y: 64, z: 72 }
  }));
}
