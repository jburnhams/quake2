import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerMedicSpawns(registry: SpawnRegistry): void {
  registry.register('monster_medic', createMonsterSpawn({
    model: 'models/monsters/medic/tris.md2',
    health: 300,
    mass: 400
  }));
}
