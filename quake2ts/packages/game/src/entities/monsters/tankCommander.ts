import { SpawnRegistry } from '../spawn.js';
import { createMonsterSpawn } from './common.js';

export function registerTankCommanderSpawns(registry: SpawnRegistry): void {
  registry.register('monster_tank_commander', createMonsterSpawn({
    model: 'models/monsters/tank/tris.md2', // Same model as tank usually
    health: 750, // Often similar or tougher
    mass: 500,
    mins: { x: -32, y: -32, z: -16 },
    maxs: { x: 32, y: 32, z: 64 }
  }));
}
