import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerMiscSpawns } from '../../src/entities/misc.js';
import { Entity, MoveType, Solid, ServerFlags } from '../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { T_Damage } from '../../src/combat/damage.js';
import { createEntityFactory } from '@quake2ts/test-utils';

vi.mock('../../src/combat/damage.js', () => ({
    T_Damage: vi.fn(),
}));

describe('func_object', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerMiscSpawns(registry);

    entity = createEntityFactory({
      number: 1,
      classname: 'func_object',
      mins: { x: 0, y: 0, z: 0 },
      maxs: { x: 10, y: 10, z: 10 }
    });
    vi.clearAllMocks();
  });

  it('should initialize with correct defaults', () => {
    const spawnFn = registry.get('func_object');
    expect(spawnFn).toBeDefined();
    spawnFn?.(entity, context);

    expect(entity.dmg).toBe(100);
    // Bounds should be inset by 1
    expect(entity.mins).toEqual({ x: 1, y: 1, z: 1 });
    expect(entity.maxs).toEqual({ x: 9, y: 9, z: 9 });
  });

  it('should start as SOLID_BSP if not triggered spawn', () => {
    const spawnFn = registry.get('func_object');
    spawnFn?.(entity, context);

    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.think).toBeDefined();
    expect(context.entities.scheduleThink).toHaveBeenCalled();
  });

  it('should start as SOLID_NOT if TRIGGER_SPAWN flag is set', () => {
    // TRIGGER_SPAWN = 1
    entity.spawnflags = 1;
    const spawnFn = registry.get('func_object');
    spawnFn?.(entity, context);

    expect(entity.solid).toBe(Solid.Not);
    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.use).toBeDefined();
    expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
  });

  it('should release when think is called', () => {
    const spawnFn = registry.get('func_object');
    spawnFn?.(entity, context);

    // Call the think function
    const think = entity.think;
    if (think) {
        think(entity, context.entities);
        expect(entity.movetype).toBe(MoveType.Toss);
        expect(entity.touch).toBeDefined();
    } else {
        expect(true).toBe(false); // Fail if no think
    }
  });

  it('should activate when used (TRIGGER_SPAWN case)', () => {
    entity.spawnflags = 1;
    const spawnFn = registry.get('func_object');
    spawnFn?.(entity, context);

    // Call use
    const use = entity.use;
    if (use) {
        use(entity, null, null);
        expect(entity.solid).toBe(Solid.Bsp);
        expect(entity.svflags & ServerFlags.NoClient).toBeFalsy();
        expect(context.entities.killBox).toHaveBeenCalledWith(entity);
        expect(entity.movetype).toBe(MoveType.Toss);
    }
  });

  it('should inflict damage on touch if falling on top', () => {
    const spawnFn = registry.get('func_object');
    spawnFn?.(entity, context);
    // Release it to set touch
    entity.think?.(entity, context.entities);

    const other = new Entity(2);
    other.takedamage = true;
    const plane = { normal: { x: 0, y: 0, z: 1 } }; // Hitting floor (normal up)

    entity.touch?.(entity, other, plane, undefined);

    expect(T_Damage).toHaveBeenCalled();
  });

  it('should NOT inflict damage if not hitting from above (normal.z < 1)', () => {
    const spawnFn = registry.get('func_object');
    spawnFn?.(entity, context);
    entity.think?.(entity, context.entities);

    const other = new Entity(2);
    other.takedamage = true;
    const plane = { normal: { x: 1, y: 0, z: 0 } }; // Side hit

    entity.touch?.(entity, other, plane, undefined);

    expect(T_Damage).not.toHaveBeenCalled();
  });
});
