// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBsp } from '@quake2ts/formats';
import { Library } from '../src/library/library';
import { worldFromMap, type LabWorld } from '../src/labs/world';
import { DEFAULT_TRACE, sweep, traceBounds } from '../src/labs/traces/trace';
import { CONTENTS_SOLID } from '@quake2ts/shared/bsp/contents';
import { demoPak } from './setup';

const SURF_SKY = 0x4;

// The traces lab's sweep on demo1, through the game's own traceBox and the map's collision.
let world: LabWorld;

beforeAll(async () => {
  const library = new Library();
  library.mount('pak.pak', demoPak.buffer.slice(demoPak.byteOffset, demoPak.byteOffset + demoPak.byteLength) as ArrayBuffer);
  world = worldFromMap(parseBsp(await library.read('maps/demo1.bsp')));
});

describe('traces lab sweep', () => {
  it("stops the player's box on the wall ahead of demo1's start", () => {
    const t = sweep(world, DEFAULT_TRACE, 'solid');
    expect(t.fraction).toBeGreaterThan(0.4);
    expect(t.fraction).toBeLessThan(0.7);
    expect(t.slope).toBeCloseTo(90, 0);
    expect(t.contents & CONTENTS_SOLID).toBeTruthy();
    expect(t.startsolid).toBe(false);
    expect(t.travelled).toBeCloseTo(t.fraction * DEFAULT_TRACE.length, 6);
  });

  it('lets a point get further than a box down the same line', () => {
    const box = sweep(world, DEFAULT_TRACE, 'solid');
    const point = sweep(world, { ...DEFAULT_TRACE, size: 0 }, 'solid');
    expect(point.travelled).toBeGreaterThan(box.travelled + 50);
    expect(traceBounds(16)).toEqual({ mins: { x: -16, y: -16, z: -24 }, maxs: { x: 16, y: 16, z: 32 } });
  });

  it('lands on the floor looking down and on the sky looking up', () => {
    const down = sweep(world, { ...DEFAULT_TRACE, pitch: 89 }, 'solid');
    expect(down.normal!.z).toBeCloseTo(1, 3);
    expect(down.slope).toBeCloseTo(0, 0);
    // The box starts 9 units up (the spawn's lift), so it falls only a little before the floor.
    expect(down.travelled).toBeLessThan(20);
    const up = sweep(world, { ...DEFAULT_TRACE, pitch: -89 }, 'solid');
    expect(up.slope).toBeCloseTo(180, 0);
    expect(up.surfaceFlags & SURF_SKY).toBeTruthy();
  });

  it('passes through walls when only liquid stops it', () => {
    expect(sweep(world, { ...DEFAULT_TRACE, length: 2048 }, 'water').fraction).toBe(1);
  });

  it('is the same sweep every time', () => {
    expect(sweep(world, DEFAULT_TRACE, 'player')).toEqual(sweep(world, DEFAULT_TRACE, 'player'));
  });
});
