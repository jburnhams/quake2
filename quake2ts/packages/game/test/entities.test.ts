import { describe, expect, it } from 'vitest';
import {
  DeadFlag,
  ENTITY_FIELD_METADATA,
  EntitySystem,
  MoveType,
  Solid,
} from '../src/entities/index.js';
import { createGame, type GameEngine } from '../src/index.js';

const ZERO_VEC3 = { x: 0, y: 0, z: 0 } as const;

const mockEngine: GameEngine = {
  trace: () => ({}),
};

describe('Entity defaults', () => {
  it('initializes core fields to rerelease defaults', () => {
    const system = new EntitySystem(mockEngine);
    const entity = system.spawn();

    expect(entity.inUse).toBe(true);
    expect(entity.movetype).toBe(MoveType.None);
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.deadflag).toBe(DeadFlag.Alive);
    expect(entity.gravity).toBe(1);
    expect(entity.origin).toEqual(ZERO_VEC3);
    expect(entity.velocity).toEqual(ZERO_VEC3);
    expect(entity.nextthink).toBe(0);
    expect(entity.think).toBeUndefined();
    expect(entity.touch).toBeUndefined();
    expect(entity.use).toBeUndefined();
  });
});

describe('Entity pool lifecycle', () => {
  it('defers frees until the end of the frame', () => {
    const system = new EntitySystem(mockEngine);
    const first = system.spawn();
    const second = system.spawn();

    system.free(first);
    const third = system.spawn();

    expect(third.index).not.toBe(first.index);

    system.beginFrame(0);
    system.runFrame();
    const fourth = system.spawn();
    expect(fourth.index).toBe(first.index);
    expect(system.activeCount).toBe(4); // world + second + third + fourth
  });

  it('keeps the world entity alive', () => {
    const system = new EntitySystem(mockEngine);
    expect(system.world.classname).toBe('worldspawn');
    expect(() => system.free(system.world)).toThrow();
  });
});

describe('Think scheduling', () => {
  it('fires thinks when time reaches nextthink', () => {
    const system = new EntitySystem(mockEngine);
    const thinker = system.spawn();
    let fired = false;
    thinker.think = () => {
      fired = true;
    };
    system.scheduleThink(thinker, 0.5);

    system.beginFrame(0.25);
    system.runFrame();
    expect(fired).toBe(false);

    system.beginFrame(0.5);
    system.runFrame();
    expect(fired).toBe(true);
  });

  it('orders thinks deterministically by scheduled time then entity index', () => {
    const system = new EntitySystem(mockEngine);
    const first = system.spawn();
    const second = system.spawn();
    const order: number[] = [];

    first.think = () => order.push(first.index);
    second.think = () => order.push(second.index);

    system.scheduleThink(first, 1);
    system.scheduleThink(second, 1);

    system.beginFrame(1);
    system.runFrame();

    expect(order).toEqual([second.index, first.index]);
  });
});

describe('Touch detection', () => {
  it('invokes touch callbacks when bounds overlap', () => {
    const system = new EntitySystem(mockEngine);
    const trigger = system.spawn();
    const target = system.spawn();

    trigger.solid = Solid.Trigger;
    trigger.mins = { x: -8, y: -8, z: -8 };
    trigger.maxs = { x: 8, y: 8, z: 8 };
    target.solid = Solid.BoundingBox;
    target.mins = { x: -4, y: -4, z: -4 };
    target.maxs = { x: 4, y: 4, z: 4 };

    let triggerTouches = 0;
    let targetTouches = 0;
    trigger.touch = () => {
      triggerTouches += 1;
    };
    target.touch = () => {
      targetTouches += 1;
    };

    system.beginFrame(0);
    system.runFrame();

    expect(triggerTouches).toBe(1);
    expect(targetTouches).toBe(1);

    system.runFrame();
    expect(triggerTouches).toBe(2);
  });

  it('skips touch callbacks when bounds do not intersect', () => {
    const system = new EntitySystem(mockEngine);
    const trigger = system.spawn();
    const target = system.spawn();

    trigger.solid = Solid.Trigger;
    trigger.mins = { x: -8, y: -8, z: -8 };
    trigger.maxs = { x: 8, y: 8, z: 8 };
    trigger.origin = { x: 0, y: 0, z: 0 };
    target.solid = Solid.BoundingBox;
    target.mins = { x: -4, y: -4, z: -4 };
    target.maxs = { x: 4, y: 4, z: 4 };
    target.origin = { x: 100, y: 100, z: 100 };

    let touched = false;
    trigger.touch = () => {
      touched = true;
    };

    system.beginFrame(0);
    system.runFrame();

    expect(touched).toBe(false);
  });

  it('does not call touch handlers for freed entities', () => {
    const system = new EntitySystem(mockEngine);
    const trigger = system.spawn();
    const target = system.spawn();

    trigger.solid = Solid.Trigger;
    trigger.mins = { x: -8, y: -8, z: -8 };
    trigger.maxs = { x: 8, y: 8, z: 8 };
    trigger.touch = () => {
      throw new Error('should not touch freed entity');
    };

    system.free(target);

    system.beginFrame(0);
    system.runFrame();
  });

  it('fires touch callbacks even if only one participant defines touch', () => {
    const system = new EntitySystem(mockEngine);
    const mover = system.spawn();
    const trigger = system.spawn();

    mover.origin = { x: 0, y: 0, z: 0 };
    mover.mins = { x: -16, y: -16, z: -16 };
    mover.maxs = { x: 16, y: 16, z: 16 };
    mover.solid = Solid.BoundingBox;

    trigger.origin = { x: 0, y: 0, z: 0 };
    trigger.mins = { x: -8, y: -8, z: -8 };
    trigger.maxs = { x: 8, y: 8, z: 8 };
    trigger.solid = Solid.Trigger;

    let touched = 0;
    trigger.touch = () => {
      touched += 1;
    };

    system.beginFrame(0);
    system.runFrame();

    expect(touched).toBe(1);
  });
});

describe('Entity field metadata', () => {
  it('marks callbacks as non-serializable and core fields as serializable', () => {
    const callbackFields = ENTITY_FIELD_METADATA.filter((field) => field.type === 'callback');
    expect(callbackFields.every((field) => field.save === false)).toBe(true);

    const criticalFields = ['classname', 'origin', 'movetype', 'solid', 'health'];
    for (const critical of criticalFields) {
      const entry = ENTITY_FIELD_METADATA.find((field) => field.name === critical);
      expect(entry?.save).toBe(true);
    }
  });
});

describe('Game loop integration', () => {
  it('spawns a player at the start location', () => {
    const game = createGame(
      () => ({ fraction: 1, endpos: { x: 0, y: 0, z: 0 } }) as any,
      () => 0,
      mockEngine as any,
      { gravity: { x: 0, y: 0, z: -1 } }
    );
    game.init(0);
    const playerStart = game.entities.spawn();
    playerStart.classname = 'info_player_start';
    playerStart.origin = { x: 1, y: 2, z: 3 };
    playerStart.angles = { x: 0, y: 90, z: 0 };
    game.entities.finalizeSpawn(playerStart);
    game.spawnWorld();
    const player = game.entities.find((e) => e.classname === 'player');
    expect(player).toBeDefined();
    expect(player.origin).toEqual(playerStart.origin);
    expect(player.angles).toEqual(playerStart.angles);
    expect(player.health).toBe(100);
  });

  it('exposes entity state inside snapshots and processes thinks during simulation', () => {
    const game = createGame(
      { trace: mockEngine.trace as any, pointcontents: () => 0 },
      mockEngine as any,
      { gravity: { x: 0, y: 0, z: -1 } }
    );
    game.init(0);

    const thinker = game.entities.spawn();
    let thinkCount = 0;
    thinker.think = () => {
      thinkCount += 1;
    };
    game.entities.scheduleThink(thinker, 0.1);

    const frame1 = game.frame({ frame: 1, deltaMs: 25 });
    expect(frame1.state.entities.activeCount).toBeGreaterThanOrEqual(2);
    expect(frame1.state.entities.worldClassname).toBe('worldspawn');
    expect(thinkCount).toBe(0);

    game.frame({ frame: 2, deltaMs: 25 });
    game.frame({ frame: 3, deltaMs: 25 });
    game.frame({ frame: 4, deltaMs: 25 });
    expect(thinkCount).toBe(1);
  });
});
