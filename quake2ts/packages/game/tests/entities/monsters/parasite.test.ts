import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_parasite } from '../../../src/entities/monsters/parasite.js';
import {
  Entity,
  MonsterMove,
  MoveType,
  Solid,
  DeadFlag
} from '../../../src/entities/entity.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameImports } from '../../../src/game.js';
import { GameEngine } from '../../../src/index.js';
import {
    ZERO_VEC3,
    copyVec3
} from '@quake2ts/shared';

describe('monster_parasite', () => {
  let self: Entity;
  let context: SpawnContext;
  let entities: EntitySystem;
  let gameEngine: GameEngine;
  let gameImports: GameImports;

  beforeEach(() => {
    gameEngine = {
      time: 100,
      soundIndex: vi.fn().mockReturnValue(1),
      sound: vi.fn(),
      multicast: vi.fn(),
      pointContents: vi.fn(),
      trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
    } as unknown as GameEngine;

    gameImports = {
      trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
      pointcontents: vi.fn().mockReturnValue(0),
      linkentity: vi.fn(),
      multicast: vi.fn(),
      unicast: vi.fn(),
    } as unknown as GameImports;

    // Mock spawn() to return a valid entity
    const spawnMock = vi.fn().mockImplementation(() => {
        return {
            origin: {x:0, y:0, z:0},
            mins: {x:0, y:0, z:0},
            maxs: {x:0, y:0, z:0},
            velocity: {x:0, y:0, z:0},
            avelocity: {x:0, y:0, z:0},
            angles: {x:0, y:0, z:0},
            size: {x:0, y:0, z:0},
            inUse: true,
            classname: 'gib',
            // add other required props if needed by throwGibs
        } as unknown as Entity;
    });

    entities = {
        trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
        engine: gameEngine,
        free: vi.fn(),
        spawn: spawnMock,
        multicast: vi.fn(),
        modelIndex: vi.fn().mockReturnValue(1),
        scheduleThink: vi.fn(),
        finalizeSpawn: vi.fn(),
        timeSeconds: 100, // Needed for scheduleThink calculation in throwGibs
    } as unknown as EntitySystem;

    context = {
      entities,
      game: gameEngine,
    } as unknown as SpawnContext;

    self = {
      index: 1,
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: 0, y: 0, z: 0 },
      maxs: { x: 0, y: 0, z: 0 },
      monsterinfo: {},
      health: 0,
      max_health: 0,
      mass: 0,
      takedamage: false,
      deadflag: DeadFlag.Alive,
      solid: Solid.Not,
      movetype: MoveType.None,
      timestamp: 1000,
      nextthink: 0,
      think: null,
      pain: null,
      die: null,
      frame: 0,
      skin: 0,
    } as unknown as Entity;
  });

  it('should spawn with correct properties', () => {
    SP_monster_parasite(self, context);

    expect(self.model).toBe('models/monsters/parasite/tris.md2');
    expect(self.health).toBe(175);
    expect(self.max_health).toBe(175);
    expect(self.mass).toBe(250);
    expect(self.movetype).toBe(MoveType.Step);
    expect(self.solid).toBe(Solid.BoundingBox);
    expect(self.monsterinfo.stand).toBeDefined();
    expect(self.monsterinfo.run).toBeDefined();
    expect(self.monsterinfo.attack).toBeDefined();
    expect(self.monsterinfo.sight).toBeDefined();
    expect(self.monsterinfo.idle).toBeDefined();

    // Initial state should be stand
    expect(self.monsterinfo.current_move).toBeDefined();
    expect(self.monsterinfo.current_move?.firstframe).toBe(83); // FRAME_stand01
  });

  it('should transition to run when run is called', () => {
    SP_monster_parasite(self, context);
    if (self.monsterinfo.run) {
        self.monsterinfo.run(self, entities);
        // Should use start_run_move (frame 68)
        expect(self.monsterinfo.current_move?.firstframe).toBe(68);
    }
  });

  it('should transition to attack (drain) when attack is called', () => {
    SP_monster_parasite(self, context);
    if (self.monsterinfo.attack) {
        self.monsterinfo.attack(self, entities);
        // Should use drain_move (frame 39)
        expect(self.monsterinfo.current_move?.firstframe).toBe(39);
    }
  });

  it('should play pain sound and anim when damaged', () => {
    SP_monster_parasite(self, context);

    // Simulate pain debounce time passed
    self.timestamp = 2000;
    self.pain_finished_time = 0;

    if (self.pain) {
        self.pain(self, self, 0, 10);
        expect(gameEngine.sound).toHaveBeenCalled();
        // Should use pain_move (frame 57)
        expect(self.monsterinfo.current_move?.firstframe).toBe(57);
    }
  });

  it('should die correctly', () => {
    SP_monster_parasite(self, context);

    if (self.die) {
        self.die(self, self, self, 100, ZERO_VEC3, 0);

        expect(self.deadflag).toBe(DeadFlag.Dead);
        expect(self.solid).toBe(Solid.Not);
        expect(gameEngine.sound).toHaveBeenCalled(); // Death sound
        // Should use death_move (frame 32)
        expect(self.monsterinfo.current_move?.firstframe).toBe(32);
    }
  });

  it('should gib if overkill damage', () => {
    SP_monster_parasite(self, context);

    // Mock throwGibs via global if possible or just check free called
    self.health = -100; // Below -50
    if (self.die) {
        self.die(self, self, self, 100, ZERO_VEC3, 0);
        expect(entities.free).toHaveBeenCalledWith(self);
    }
  });

  it('parasite_drain_attack should trace and apply damage', () => {
    SP_monster_parasite(self, context);

    // Setup enemy
    const enemy = {
        index: 2,
        origin: { x: 100, y: 0, z: 0 },
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 },
        takedamage: true,
        health: 100,
        pain: vi.fn(),
    } as unknown as Entity;
    self.enemy = enemy;
    self.angles = { x: 0, y: 0, z: 0 }; // Facing +X

    // Mock trace hitting enemy
    (entities.trace as any).mockReturnValue({
        fraction: 0.5,
        ent: enemy
    });

    // Manually trigger drain attack logic
    // We need to access the think function of the attack frame

    const drainMove = self.monsterinfo.current_move; // Wait, we need to switch to attack first
    if (self.monsterinfo.attack) self.monsterinfo.attack(self, entities);

    const attackMove = self.monsterinfo.current_move;
    expect(attackMove).toBeDefined();

    const damageFrame = attackMove!.frames[2]; // frame 41
    expect(damageFrame.think).toBeDefined();

    // Set frame to match what check expects (41)
    self.frame = 41;

    // Call think
    self.health = 100;
    damageFrame.think!(self, entities);

    expect(entities.trace).toHaveBeenCalled();
    expect(entities.multicast).toHaveBeenCalled();

    // Check healing (damage was 5 for frame 41)
    expect(self.health).toBe(105);
  });

  it('should correctly use copyVec3 from shared package', () => {
    const src = { x: 1, y: 2, z: 3 };
    const dest = copyVec3(src);
    expect(dest).toEqual(src);
    expect(dest).not.toBe(src);
  });
});
