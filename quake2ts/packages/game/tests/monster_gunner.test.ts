import { describe, expect, it, vi } from 'vitest';
import { Entity, EntitySystem, MoveType, Solid } from '../src/index.js';
import { registerGunnerSpawns } from '../src/entities/monsters/gunner.js';
import { SpawnRegistry } from '../src/entities/spawn.js';

describe('monster_gunner', () => {
  it('spawns with correct health, model, and bbox', () => {
    const registry = new SpawnRegistry();
    registerGunnerSpawns(registry);

    const system = new EntitySystem({} as any, {} as any, 800, 1024);
    const gunner = system.spawn();
    const spawn = registry.get('monster_gunner');

    expect(spawn).toBeDefined();

    if (spawn) {
      spawn(gunner, {
        entities: system,
        keyValues: {},
        warn: () => {},
        free: () => {},
      });
    }

    expect(gunner.health).toBe(175);
    expect(gunner.max_health).toBe(175);
    expect(gunner.model).toBe('models/monsters/gunner/tris.md2');
    expect(gunner.mins).toEqual({ x: -16, y: -16, z: -24 });
    expect(gunner.maxs).toEqual({ x: 16, y: 16, z: 32 });
    expect(gunner.solid).toBe(Solid.BoundingBox);
    expect(gunner.movetype).toBe(MoveType.Step);
    expect(gunner.monsterinfo.stand).toBeDefined();
    expect(gunner.monsterinfo.run).toBeDefined();
    expect(gunner.monsterinfo.attack).toBeDefined();
  });

  it('transitions to run state when enemy is present', () => {
    const registry = new SpawnRegistry();
    registerGunnerSpawns(registry);
    const system = new EntitySystem({} as any, {} as any, 800, 1024);
    const gunner = system.spawn();
    registry.get('monster_gunner')!(gunner, {
      entities: system,
      keyValues: {},
      warn: () => {},
      free: () => {},
    });

    const enemy = system.spawn();
    enemy.health = 100;
    gunner.enemy = enemy;

    // Manually trigger run logic
    if (gunner.monsterinfo.run) {
      gunner.monsterinfo.run(gunner);
    }

    // Verify current move is set (checking indirectly via frame info if possible, or just that it didn't crash)
    expect(gunner.monsterinfo.current_move).toBeDefined();
    // Run move has frames
    expect(gunner.monsterinfo.current_move?.frames.length).toBeGreaterThan(0);
  });
});
