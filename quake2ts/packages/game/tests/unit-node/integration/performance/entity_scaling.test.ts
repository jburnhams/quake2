import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame } from '@quake2ts/game';
import type { GameExports } from '@quake2ts/game';
import { MoveType, Solid, Entity } from '../../../../src/entities/entity.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

// Increase timeout for performance tests
const TIMEOUT = 10000;

describe('Entity System Performance', () => {
  let game: GameExports;
  let engineMock: ReturnType<typeof createGameImportsAndEngine>['engine'];
  let importsMock: ReturnType<typeof createGameImportsAndEngine>['imports'];

  const gameOptions = {
    gravity: 800,
    maxEntities: 4096, // Increase limit for scaling tests
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const result = createGameImportsAndEngine();
    engineMock = result.engine;
    importsMock = result.imports;

    // Additional engine mocks needed for this test file that are not in default createGameImportsAndEngine
    Object.assign(engineMock, {
        boxEdicts: vi.fn(() => []),
        areaportalOpen: vi.fn(),
        cvar: vi.fn((name, val, flags) => ({ name, value: parseFloat(val), flags, string: val, modified: false })),
        cvar_set: vi.fn(),
        cvar_force_set: vi.fn(),
        cvar_string: vi.fn(),
        addCommand: vi.fn(),
        removeCommand: vi.fn(),
        args: vi.fn(() => ''),
        argv: vi.fn(() => ''),
        argc: vi.fn(() => 0),
        milliseconds: vi.fn(() => 0),
    });

    // Also need to ensure imports has cvar support if used via imports (usually not, but GameImports might have it)
    // createGame usually passes imports which match GameImports.
    // Let's check if createGame uses engine for cvars or imports. It uses engine.

    game = createGame(importsMock, engineMock, gameOptions);
    game.init(0);
  });

  it('scales with entity count (1000 entities)', async () => {
    const entityCount = 1000;
    const entities: Entity[] = [];

    // Spawn 1000 entities
    const startSpawn = performance.now();
    for (let i = 0; i < entityCount; i++) {
      const ent = game.entities.spawn();
      ent.classname = `perf_test_${i}`;
      ent.movetype = MoveType.None;
      ent.solid = Solid.Not;
      entities.push(ent);
    }
    const spawnTime = performance.now() - startSpawn;

    console.log(`Spawned ${entityCount} entities in ${spawnTime.toFixed(2)}ms`);
    expect(spawnTime).toBeLessThan(100); // Should be very fast

    // Measure frame time with 1000 idle entities
    const startFrame = performance.now();
    game.frame({ frame: 1, deltaSeconds: 0.1, time: 100, pause: false });
    const frameTime = performance.now() - startFrame;

    console.log(`runFrame with ${entityCount} idle entities: ${frameTime.toFixed(2)}ms`);
    expect(frameTime).toBeLessThan(30); // Should be negligible for idle entities
  }, TIMEOUT);

  it('handles think queue performance (1000 entities)', async () => {
    const entityCount = 1000;
    const thinkTime = 1.0;

    // Spawn entities and schedule them to think at the same time
    for (let i = 0; i < entityCount; i++) {
      const ent = game.entities.spawn();
      ent.classname = `think_test_${i}`;
      // Simple think function
      ent.think = (self) => {
        self.nextthink = self.nextthink + 0.1;
        return true;
      };
      ent.nextthink = thinkTime;
      game.entities.scheduleThink(ent, thinkTime);
    }

    // Advance time to just before think
    let time = 0;
    let frameCount = 0;
    while (time < thinkTime - 0.15) {
       game.frame({ frame: frameCount++, deltaSeconds: 0.1, time: time * 1000, pause: false });
       time += 0.1;
    }

    const startThinkFrame = performance.now();
    game.frame({ frame: frameCount++, deltaSeconds: 0.1, time: time * 1000, pause: false }); // This should trigger all 1000 thinks
    const thinkFrameTime = performance.now() - startThinkFrame;

    console.log(`runFrame with ${entityCount} thinking entities: ${thinkFrameTime.toFixed(2)}ms`);

    // 1000 simple JS calls should be fast, but overhead of queue management exists
    expect(thinkFrameTime).toBeLessThan(50);
  }, TIMEOUT);

  it('handles touch detection performance (O(N^2) check)', async () => {
    // Note: This test highlights the O(N^2) nature mentioned in docs
    const entityCount = 200; // reduced count because O(N^2) explodes fast

    for (let i = 0; i < entityCount; i++) {
      const ent = game.entities.spawn();
      ent.classname = `touch_test_${i}`;
      ent.solid = Solid.Trigger;
      ent.movetype = MoveType.None; // Triggers don't move but are checked against
      ent.absmin = { x: 0, y: 0, z: 0 };
      ent.absmax = { x: 10, y: 10, z: 10 };
      ent.touch = (self, other) => {};
    }

    // Add a moving entity that will check against all these
    const mover = game.entities.spawn();
    mover.classname = 'mover';
    mover.solid = Solid.Bbox;
    mover.movetype = MoveType.Walk;
    mover.absmin = { x: 0, y: 0, z: 0 };
    mover.absmax = { x: 10, y: 10, z: 10 };

    // Let's verify the cost of one entity checking against 200 triggers
    const startCheck = performance.now();

    // Mock trace to allow movement
    (engineMock.trace as any).mockReturnValue({
        fraction: 1,
        allsolid: false,
        startsolid: false,
        endpos: { x: 10, y: 0, z: 0 }, // Moved 10 units
        plane: { normal: { x: 0, y: 0, z: 0 }, dist: 0 },
        ent: null
    });

    game.frame({ frame: 1, deltaSeconds: 0.1, time: 100, pause: false });
    const checkTime = performance.now() - startCheck;

    console.log(`runFrame with ${entityCount} triggers and 1 mover: ${checkTime.toFixed(2)}ms`);
    expect(checkTime).toBeLessThan(20);
  }, TIMEOUT);
});
