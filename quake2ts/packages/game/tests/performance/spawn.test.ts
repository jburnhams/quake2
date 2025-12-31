import { describe, it, expect, vi } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { registerTargetSpawns } from '../../src/entities/targets.js';
import { TempEntity } from '@quake2ts/shared';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';

describe('Performance: Spawn Time', () => {
  it('should spawn 1000 entities in under 100ms', () => {
    // Setup minimal entity system
    const { imports, engine } = createGameImportsAndEngine();

    // Use a larger limit than 800 to allow 1000 entities
    const system = new EntitySystem(engine, imports, undefined, 2048);

    // Register spawn functions
    const registry = new SpawnRegistry();
    registerTargetSpawns(registry);
    system.setSpawnRegistry(registry);

    const startTime = performance.now();

    const ENTITY_COUNT = 1000;

    for (let i = 0; i < ENTITY_COUNT; i++) {
      // Spawn target_temp_entity
      const ent1 = system.spawn();
      ent1.classname = 'target_temp_entity';
      const kv1 = { style: String(TempEntity.EXPLOSION1), origin: '100 200 -50' };
      const spawnFn1 = registry.get('target_temp_entity');
      if (spawnFn1) spawnFn1(ent1, { keyValues: kv1, entities: system, imports: imports, warn: () => {}, free: () => system.free(ent1) } as any);

      // Spawn target_splash
      const ent2 = system.spawn();
      ent2.classname = 'target_splash';
      const kv2 = { count: '10', origin: '0 0 0', angles: '90 0 0' };
      const spawnFn2 = registry.get('target_splash');
      if (spawnFn2) spawnFn2(ent2, { keyValues: kv2, entities: system, imports: imports, warn: () => {}, free: () => system.free(ent2) } as any);

      // Increment only by 1 for loop, but we spawned 2.
      // Let's just adjust count.
      i++;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Spawned ${ENTITY_COUNT} entities in ${duration.toFixed(2)}ms`);

    expect(duration).toBeLessThan(100);
  });
});
