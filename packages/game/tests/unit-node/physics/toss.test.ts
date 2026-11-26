/**
 * SV_Physics_Toss (rerelease g_phys.cpp) through the real entity frame loop, on the analytic
 * floor-and-walls world the AI tests use.
 */
import { describe, expect, it, vi } from 'vitest';
import { MoveType, Solid } from '../../../src/entities/entity.js';
import { floorWorld, FRAME } from '../ai/floorWorld.js';

function projectile(entities: ReturnType<typeof floorWorld>['entities'], movetype: MoveType, origin = { x: 0, y: 0, z: 50 }) {
  const e = entities.spawn();
  e.classname = 'test_projectile';
  e.movetype = movetype;
  e.solid = Solid.BoundingBox;
  e.origin = origin;
  e.mins = { x: -2, y: -2, z: -2 };
  e.maxs = { x: 2, y: 2, z: 2 };
  entities.linkentity(e);
  return e;
}

describe('SV_Physics_Toss', () => {
  it('a missile flies straight, with no gravity, until it hits a wall and touches it', () => {
    const { entities, run } = floorWorld('', { walls: [200] });
    const bolt = projectile(entities, MoveType.FlyMissile);
    bolt.velocity = { x: 1000, y: 0, z: 0 };
    const touch = vi.fn((self) => entities.free(self));
    bolt.touch = touch;
    run(FRAME);
    expect(bolt.origin.x).toBeCloseTo(25, 3);
    expect(bolt.origin.z).toBeCloseTo(50, 3);
    run(0.5);
    expect(touch).toHaveBeenCalledTimes(1);
    expect(touch.mock.calls[0][1]).toBe(entities.world);
    // It stopped at the wall face, not beyond it.
    expect(bolt.inUse).toBe(false);
  });

  it('a tossed gib falls, lands on the floor and comes to rest on it', () => {
    const { entities, run } = floorWorld('');
    const gib = projectile(entities, MoveType.Toss, { x: 0, y: 0, z: 100 });
    gib.velocity = { x: 50, y: 0, z: 0 };
    run(2);
    expect(gib.groundentity).toBe(entities.world);
    expect(gib.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(gib.origin.z).toBeGreaterThanOrEqual(2);
    expect(gib.origin.z).toBeLessThan(3);
  });

  it('a bouncing grenade comes back up off the floor', () => {
    const { entities, run } = floorWorld('');
    const grenade = projectile(entities, MoveType.Bounce, { x: 0, y: 0, z: 20 });
    grenade.velocity = { x: 0, y: 0, z: -600 };
    let rose = false;
    for (let i = 0; i < 20 && !rose; i++) {
      run(FRAME);
      if (grenade.velocity.z > 0) rose = true;
    }
    expect(rose).toBe(true);
    expect(grenade.origin.z).toBeGreaterThan(0);
  });
});
