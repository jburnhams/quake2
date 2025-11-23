import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeadFlag, Entity, EntitySystem, MoveType, Solid } from '../src/index.js';
import { registerGunnerSpawns } from '../src/entities/monsters/gunner.js';
import { SpawnRegistry } from '../src/entities/spawn.js';
import { throwGibs } from '../src/entities/gibs.js';

// Mock throwGibs
vi.mock('../src/entities/gibs.js', () => ({
    throwGibs: vi.fn(),
}));

describe('monster_gunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      gunner.monsterinfo.run(gunner, system);
    }

    // Verify current move is set
    expect(gunner.monsterinfo.current_move).toBeDefined();
    expect(gunner.monsterinfo.current_move?.frames.length).toBeGreaterThan(0);
  });

  it('should transition to pain state when pain callback is called with low health', () => {
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

      gunner.health = 50; // Less than max_health / 2 (175 / 2 = 87.5)

      const initialMove = gunner.monsterinfo.current_move;
      gunner.pain!(gunner, null, 0, 5);

      // Should have transitioned to pain frames
      expect(gunner.monsterinfo.current_move).not.toBe(initialMove);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(110);
  });

  it('should throw gibs and remove entity when health is below -40', () => {
      const registry = new SpawnRegistry();
      registerGunnerSpawns(registry);
      const freeMock = vi.fn();
      // Mock EntitySystem to spy on free
      const system = {
          spawn: vi.fn(() => new Entity(0)),
          free: freeMock,
          modelIndex: vi.fn(),
          scheduleThink: vi.fn(),
          finalizeSpawn: vi.fn(),
          timeSeconds: 0,
          entities: {
              free: freeMock,
              timeSeconds: 0
          }
      } as unknown as EntitySystem;

      const gunner = new Entity(0);

      registry.get('monster_gunner')!(gunner, {
          entities: system,
          keyValues: {},
          warn: () => {},
          free: () => {},
      });

      gunner.health = -50;

      gunner.die!(gunner, null, null, 100, { x: 0, y: 0, z: 0 }, 0);

      expect(throwGibs).toHaveBeenCalledWith(system, gunner.origin, 100);
      expect(freeMock).toHaveBeenCalledWith(gunner);
      expect(gunner.deadflag).toBe(DeadFlag.Dead);
      expect(gunner.solid).toBe(Solid.Not);
  });

  it('should transition to death animation when dying but not gibbed', () => {
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

      gunner.health = -10;

      const initialMove = gunner.monsterinfo.current_move;
      gunner.die!(gunner, null, null, 20, { x: 0, y: 0, z: 0 }, 0);

      expect(gunner.deadflag).toBe(DeadFlag.Dead);
      expect(gunner.solid).toBe(Solid.Not);
      // Should transition to death frames
      expect(gunner.monsterinfo.current_move).not.toBe(initialMove);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(118);

      // Should NOT throw gibs
      expect(throwGibs).not.toHaveBeenCalled();
  });
});
