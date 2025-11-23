import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerBrainSpawns(registry: SpawnRegistry): void {
  registry.register('monster_brain', createMonsterSpawn({
    model: 'models/monsters/brain/tris.md2',
    health: 300,
    mass: 400
  }));
}
