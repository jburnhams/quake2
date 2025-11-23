import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerJorgSpawns(registry: SpawnRegistry): void {
  registry.register('monster_jorg', createMonsterSpawn({
    model: 'models/monsters/boss3/jorg.md2',
    health: 3000,
    mass: 1000,
    mins: { x: -80, y: -80, z: -24 },
    maxs: { x: 80, y: 80, z: 140 } // Huge
  }));
}
