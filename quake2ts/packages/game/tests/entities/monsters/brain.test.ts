import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_brain } from '../../../src/entities/monsters/brain.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext } from '../../../src/entities/spawn.js';

describe('monster_brain', () => {
  let system: EntitySystem;
  let context: SpawnContext;

  beforeEach(() => {
    // Mock game engine and imports
    const engine = {
      sound: vi.fn(),
      modelIndex: vi.fn().mockReturnValue(1),
    };
    const imports = {
      trace: vi.fn().mockReturnValue({
        allsolid: false,
        startsolid: false,
        fraction: 1,
        endpos: { x: 0, y: 0, z: 0 },
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
        ent: null,
      }),
      pointcontents: vi.fn().mockReturnValue(0),
      linkentity: vi.fn(),
      multicast: vi.fn(),
      unicast: vi.fn(),
    };

    const gameExports = createGame(imports, engine as any, { gravity: { x: 0, y: 0, z: -800 } });
    system = (gameExports as any).entities;

    context = {
      keyValues: {},
      entities: system,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    };
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    SP_monster_brain(ent, context);

    expect(ent.classname).toBe('monster_brain');
    expect(ent.model).toBe('models/monsters/brain/tris.md2');
    expect(ent.health).toBe(300);
    expect(ent.max_health).toBe(300);
    expect(ent.mass).toBe(400);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('enters stand state after spawn', () => {
    const ent = system.spawn();
    SP_monster_brain(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(162);
  });

  it('handles pain correctly', () => {
    const ent = system.spawn();
    SP_monster_brain(ent, context);

    // Force pain debounce to pass
    ent.pain_debounce_time = 0;

    ent.pain!(ent, system.world, 0, 10);
    // Pain can be one of three animations (frames 88, 109, 117)
    // We check that current_move is set to one of the pain moves
    const frame = ent.monsterinfo.current_move?.firstframe;
    const painFrames = [88, 109, 117];
    expect(painFrames).toContain(frame);
  });

  it('handles death correctly', () => {
    const ent = system.spawn();
    SP_monster_brain(ent, context);

    ent.die!(ent, system.world, system.world, 500, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    // expect(ent.solid).toBe(Solid.Not); // brain_dead sets solid, but we check if it is tossed/not solid?
    // brain_dead sets movetype to TOSS and bbox, but solid is not explicitly set to Not in brain_dead, wait...
    // brain_dead sets mins/maxs.
    // The C code for brain_die does not set solid=NOT_SOLID immediately.
    // It calls brain_dead eventually via animation frame endfunc.
    // Wait, brain_die sets frames which end in brain_dead.
    // If I mock frame execution or if I just check initial state...
    // In my test I call die!.
    // brain_die sets takedamage=true, deadflag=Dead.
    // It DOES NOT set solid=Not immediately.
    // The test was expecting Solid.Not because other monsters do that.
    // Let's check if brain_die in C does that.
    // C: brain_die -> brain_dead (later).
    // brain_dead in C: self->solid = SOLID_BBOX; (Wait, really?)
    // C code:
    // void brain_dead (edict_t *self) { ... self->solid = SOLID_BBOX ... } is NOT in the C snippet I saw earlier.
    // Wait, the C snippet I saw earlier:
    /*
    void brain_dead (edict_t *self)
    {
	VectorSet (self->mins, -16, -16, -24);
	VectorSet (self->maxs, 16, 16, -8);
	self->movetype = MOVETYPE_TOSS;
	self->svflags |= SVF_DEADMONSTER;
	self->nextthink = 0;
	gi.linkentity (self);
    }
    */
    // It doesn't change solid type! It just changes bbox and movetype.
    // So it stays solid? That seems odd for a corpse unless SVF_DEADMONSTER handles it.
    // Actually, DeadFlag.Dead usually implies no collision or partial collision.
    // But strict check for Solid.Not might be wrong for Brain if it falls to floor.

    // Let's remove the expectation for Solid.Not if the code doesn't set it.
    // Or if I want to match C behavior exactly.

    // Death can be one of two animations (frames 123, 141)
    const frame = ent.monsterinfo.current_move?.firstframe;
    const deathFrames = [123, 141];
    expect(deathFrames).toContain(frame);
  });
});
