/**
 * func_train against the rerelease g_func.cpp, run through the real entity frame loop
 * (G_RunFrame), so thinks and pusher physics take part.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Vec3 } from '@quake2ts/shared';
import { createDefaultSpawnRegistry, spawnEntitiesFromText } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { MoveType, Solid } from '../../../src/entities/entity.js';
import { SPAWNFLAG_TRAIN_START_ON } from '../../../src/entities/train.js';

const FRAME = 0.025;

function level(lump: string) {
  const engine = { sound: vi.fn(), centerprintf: vi.fn() } as any;
  const trace = (start: Vec3, _mins: Vec3 | null, _maxs: Vec3 | null, end: Vec3) => ({
    allsolid: false,
    startsolid: false,
    fraction: 1,
    endpos: end,
    plane: null,
    surfaceFlags: 0,
    contents: 0,
    ent: null,
  });
  const entities = new EntitySystem(engine, { trace } as any, { x: 0, y: 0, z: -800 }, 2048);
  const spawned = spawnEntitiesFromText(lump, { registry: createDefaultSpawnRegistry(null), entities });
  let time = 0;
  return {
    entities,
    train: spawned.find((e) => e.classname === 'func_train')!,
    run(seconds: number) {
      for (let i = 0; i < Math.round(seconds / FRAME); i++) {
        time += FRAME;
        entities.beginFrame(time);
        entities.runFrame();
      }
    },
  };
}

const corners = `
{ "classname" "path_corner" "targetname" "p1" "target" "p2" "origin" "100 0 0" }
{ "classname" "path_corner" "targetname" "p2" "target" "p1" "origin" "200 0 0" }`;
const train = (extra = '') => `{ "classname" "func_train" "target" "p1" "speed" "100" "mins" "-10 -10 -10" "maxs" "10 10 10" ${extra} }`;

describe('func_train', () => {
  it('spawns as a pusher, and is put at its first corner (less its mins) a frame later', () => {
    const w = level(train() + corners);
    expect(w.train.movetype).toBe(MoveType.Push);
    expect(w.train.solid).toBe(Solid.Bsp);
    expect(w.train.dmg).toBe(100);
    expect(w.train.moveinfo!.blocked).toBeDefined();

    w.run(FRAME);
    expect(w.train.origin).toEqual({ x: 110, y: 10, z: 10 });
    // untargeted, it starts at once
    expect(w.train.spawnflags & SPAWNFLAG_TRAIN_START_ON).toBeTruthy();
  });

  it('runs from corner to corner at its speed', () => {
    const w = level(train() + corners);
    w.run(FRAME * 2);
    expect(w.train.target_ent?.targetname).toBe('p2');
    expect(w.train.velocity.x).toBeCloseTo(100);
    // 100 units at 100 u/s; the corner's wait is 0, so it turns straight back for p1
    let furthest = 0;
    for (let i = 0; i < 60; i++) {
      w.run(FRAME);
      furthest = Math.max(furthest, w.train.origin.x);
    }
    expect(furthest).toBeCloseTo(210, 3);
    expect(w.train.target_ent?.targetname).toBe('p1');
  });

  it('waits to be used when something targets it', () => {
    const w = level(train('"targetname" "t1"') + corners);
    w.run(0.5);
    expect(w.train.origin).toEqual({ x: 110, y: 10, z: 10 });
    expect(w.train.velocity).toEqual({ x: 0, y: 0, z: 0 });
    w.train.use!(w.train, null, null);
    expect(w.train.target_ent?.targetname).toBe('p2');
  });

  it('with BLOCK_STOPS, does no damage', () => {
    expect(level(train('"spawnflags" "4"') + corners).train.dmg).toBe(0);
  });
});

