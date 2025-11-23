import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerFlyerSpawns(registry: SpawnRegistry): void {
  registry.register('monster_flyer', createMonsterSpawn({
    model: 'models/monsters/flyer/tris.md2',
    health: 50,
    mass: 50,
    mins: { x: -16, y: -16, z: -24 },
    maxs: { x: 16, y: 16, z: 24 }, // Slightly smaller?
    fly: true
  }));
}
