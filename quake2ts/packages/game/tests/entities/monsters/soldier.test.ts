import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as soldierModule from '../../../src/entities/monsters/soldier.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameEngine } from '../../../src/index.js';
import { monster_fire_bullet, monster_fire_blaster, monster_fire_shotgun } from '../../../src/entities/monsters/attack.js';

// Mock dependencies
vi.mock('../../../src/entities/monsters/attack.js', () => ({
  monster_fire_bullet: vi.fn(),
  monster_fire_blaster: vi.fn(),
  monster_fire_shotgun: vi.fn(),
}));

describe('monster_soldier', () => {
  let sys: EntitySystem;
  let context: SpawnContext;
  let soldier: Entity;

  console.log('Soldier Module Exports:', Object.keys(soldierModule));

  const { SP_monster_soldier, SP_monster_soldier_light, SP_monster_soldier_ssg } = soldierModule;

  beforeEach(() => {
    // Basic mock of EntitySystem and SpawnContext
    const soundMock = vi.fn();
    const engineMock = {
        modelIndex: vi.fn().mockReturnValue(1),
        sound: soundMock,
    } as unknown as GameEngine;

    sys = {
        spawn: () => new Entity(1),
        modelIndex: (s: string) => 1,
        timeSeconds: 10,
        multicast: vi.fn(),
        engine: engineMock,
        sound: soundMock,
    } as unknown as EntitySystem;

    context = {
        entities: sys,
    } as unknown as SpawnContext;

    soldier = new Entity(1);
    vi.clearAllMocks();
  });

  it('SP_monster_soldier sets default properties (Blaster)', () => {
    SP_monster_soldier(soldier, context);
    expect(soldier.classname).toBe('');
    expect(soldier.model).toBe('models/monsters/soldier/tris.md2');
    expect(soldier.health).toBe(20);
    expect(soldier.skin).toBe(0);
    expect(soldier.solid).toBe(Solid.BoundingBox);
    expect(soldier.movetype).toBe(MoveType.Step);
    expect(soldier.monsterinfo.stand).toBeDefined();
    expect(soldier.monsterinfo.run).toBeDefined();
    expect(soldier.monsterinfo.attack).toBeDefined();
  });

  it('SP_monster_soldier_light sets spawnflag and lower health', () => {
    SP_monster_soldier_light(soldier, context);
    expect(soldier.spawnflags & 1).toBeTruthy(); // SOLDIER_LIGHT
    expect(soldier.health).toBe(10);
    expect(soldier.skin).toBe(0);
  });

  it('SP_monster_soldier_ssg sets spawnflag and skin', () => {
    SP_monster_soldier_ssg(soldier, context);
    expect(soldier.spawnflags & 2).toBeTruthy(); // SOLDIER_SSG
    expect(soldier.health).toBe(30);
    expect(soldier.skin).toBe(2);
  });

  it('spawnflag 4 sets Machinegun skin', () => {
    soldier.spawnflags = 4;
    SP_monster_soldier(soldier, context);
    expect(soldier.skin).toBe(4);
    expect(soldier.health).toBe(30);
  });

  it('attack initiates correctly', () => {
    SP_monster_soldier(soldier, context);
    soldier.monsterinfo.attack!(soldier, context as any);
    expect(soldier.monsterinfo.current_move).toBeDefined();
    expect(soldier.monsterinfo.current_move?.firstframe).toBe(90);
  });

  it('machinegun attack uses burst fire', () => {
    soldier.spawnflags = 4; // Machinegun
    SP_monster_soldier(soldier, context);
    soldier.monsterinfo.attack!(soldier, context as any);

    const move = soldier.monsterinfo.current_move;
    expect(move).toBeDefined();
    // Verify frames have think functions
    // Frames 4-8 relative to start (94-98)
    const frame4 = move!.frames[4];
    expect(frame4.think).toBeDefined();
  });

  it('soldier fires blaster (default)', () => {
    SP_monster_soldier(soldier, context);
    soldier.enemy = new Entity(2);
    soldier.enemy.origin = { x: 100, y: 0, z: 0 };
    soldier.origin = { x: 0, y: 0, z: 0 };

    // Simulate attack frame
    const move = soldier.monsterinfo.current_move; // undefined initially
    soldier.monsterinfo.attack!(soldier, context as any);
    const attackMove = soldier.monsterinfo.current_move;

    // Frame 5 triggers fire
    const fireFrame = attackMove!.frames[5];
    if (fireFrame.think) {
        fireFrame.think(soldier, sys);
    }

    expect(monster_fire_blaster).toHaveBeenCalled();
    expect(monster_fire_shotgun).not.toHaveBeenCalled();
    expect(monster_fire_bullet).not.toHaveBeenCalled();
  });

  it('soldier fires ssg', () => {
    SP_monster_soldier_ssg(soldier, context);
    soldier.enemy = new Entity(2);
    soldier.enemy.origin = { x: 100, y: 0, z: 0 };

    soldier.monsterinfo.attack!(soldier, context as any);
    const attackMove = soldier.monsterinfo.current_move;

    // Frame 5
    const fireFrame = attackMove!.frames[5];
    if (fireFrame.think) {
        fireFrame.think(soldier, sys);
    }

    expect(monster_fire_shotgun).toHaveBeenCalled();
  });

  it('soldier fires machinegun burst', () => {
    soldier.spawnflags = 4;
    SP_monster_soldier(soldier, context);
    soldier.enemy = new Entity(2);
    soldier.enemy.origin = { x: 100, y: 0, z: 0 };

    soldier.monsterinfo.attack!(soldier, context as any);
    const attackMove = soldier.monsterinfo.current_move;

    // Frame 4
    const fireFrame = attackMove!.frames[4];
    if (fireFrame.think) {
        fireFrame.think(soldier, sys);
    }
    expect(monster_fire_bullet).toHaveBeenCalled();
  });
});
