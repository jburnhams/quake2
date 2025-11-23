import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerTankSpawns(registry: SpawnRegistry): void {
  registry.register('monster_tank', createMonsterSpawn({
    model: 'models/monsters/tank/tris.md2',
    health: 750,
    mass: 500,
    mins: { x: -32, y: -32, z: -16 }, // Tank is bigger
    maxs: { x: 32, y: 32, z: 64 }
  }));
}
