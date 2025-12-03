
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnGib, throwGibs, GIB_METALLIC, GIB_DEBRIS, GIB_ORGANIC } from '../../src/entities/gibs.js';
import { createTestContext } from '../test-helpers.js';
import { MoveType, Solid, Entity, DeadFlag } from '../../src/entities/entity.js';
import { DamageMod } from '../../src/combat/damageMods.js';

describe('Gibs System', () => {
  let context: any;

  beforeEach(() => {
    context = createTestContext();
  });

  it('spawnGib creates a gib with basic properties (Organic)', () => {
    const origin = { x: 100, y: 100, z: 100 };
    const gib = spawnGib(context.entities, origin, 100, undefined, GIB_ORGANIC);

    expect(gib).toBeDefined();
    expect(gib.classname).toBe('gib');
    // Organic gibs use Toss
    expect(gib.movetype).toBe(MoveType.Toss);
    expect(gib.solid).toBe(Solid.Not);
    expect(gib.takedamage).toBe(true);
    expect(gib.die).toBeDefined();
    expect(gib.velocity).toBeDefined();
    expect(gib.avelocity).toBeDefined();
    expect(gib.nextthink).toBeGreaterThan(context.entities.timeSeconds);
  });

  it('spawnGib creates a gib with basic properties (Metallic)', () => {
    const origin = { x: 100, y: 100, z: 100 };
    const gib = spawnGib(context.entities, origin, 100, undefined, GIB_METALLIC);

    expect(gib.movetype).toBe(MoveType.Bounce);
  });

  it('throwGibs spawns multiple gibs', () => {
    const origin = { x: 0, y: 0, z: 0 };
    const spy = vi.spyOn(context.entities, 'spawn');

    // throwGibs calls spawnGib which calls spawn
    throwGibs(context.entities, origin, 100);

    expect(spy).toHaveBeenCalled();
    // Default implementation spawns multiple gibs (4 small meat + 2 others = 6)
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('gib dies when damaged', () => {
     const origin = { x: 0, y: 0, z: 0 };
     const gib = spawnGib(context.entities, origin, 100);

     expect(gib.die).toBeDefined();

     const spyFree = vi.spyOn(context.entities, 'free');
     if (gib.die) {
        gib.die(gib, null, null, 10, {x:0,y:0,z:0}, DamageMod.UNKNOWN);
     }

     expect(spyFree).toHaveBeenCalledWith(gib);
  });
});
