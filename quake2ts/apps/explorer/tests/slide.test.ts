// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBsp } from '@quake2ts/formats';
import { Library } from '../src/library/library';
import { worldFromMap, type LabWorld } from '../src/labs/world';
import { DEFAULT_SLIDE, runSlide } from '../src/labs/slide/slide';
import { PLACES } from '../src/labs/slide/SlideLab';
import { demoPak } from './setup';

let world: LabWorld;
beforeAll(async () => {
  const library = new Library();
  library.mount('pak.pak', demoPak.buffer.slice(demoPak.byteOffset, demoPak.byteOffset + demoPak.byteLength) as ArrayBuffer);
  world = worldFromMap(parseBsp(await library.read('maps/demo1.bsp')));
});

// The slide and step lab's run: the game's runPmove from a place in demo1, every trace recorded.
describe('slide and step lab run', () => {
  it('slides along the wall at 45° instead of stopping, keeping about 71% of its speed', () => {
    const frames = runSlide(world, PLACES.wall!, DEFAULT_SLIDE);
    const hit = frames.find((f) => f.planes.some((n) => Math.abs(n.z) < 0.01))!;
    expect(hit).toBeDefined();
    const wall = hit.planes.find((n) => Math.abs(n.z) < 0.01)!;
    const yaw = (PLACES.wall!.yaw * Math.PI) / 180;
    expect(-(wall.x * Math.cos(yaw) + wall.y * Math.sin(yaw))).toBeCloseTo(Math.SQRT1_2, 2);
    const sweep = hit.traces.find((t) => t.role === 'slide' && t.normal)!;
    expect(sweep.fraction).toBeLessThan(1);
    const later = frames.slice(hit.frame, hit.frame + 10);
    expect(later.every((f) => f.speedAfter > 150)).toBe(true);
  });

  it('climbs the staircase a step at a time, and stops at the first step without STEPSIZE', () => {
    const frames = runSlide(world, PLACES.stairs!, DEFAULT_SLIDE);
    const steps = frames.filter((f) => f.after.z - f.before.z > 6 && f.traces.some((t) => t.role === 'slide' && t.normal && Math.abs(t.normal.z) < 0.01));
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps[0]!.traces.some((t) => t.role === 'up')).toBe(true);
    expect(frames.at(-1)!.after.z - PLACES.stairs!.origin.z).toBeGreaterThan(64);

    const flat = runSlide(world, PLACES.stairs!, { ...DEFAULT_SLIDE, stepSize: 0 });
    expect(flat.filter((f) => f.rise > 4).length).toBe(0);
    expect(flat.at(-1)!.after.z).toBeLessThan(PLACES.stairs!.origin.z + 1);
  });

  it('records pmove asking only through traces: sweeps, the step up and down, and ground checks', () => {
    const frames = runSlide(world, PLACES.stairs!, DEFAULT_SLIDE);
    const roles = new Set(frames.flatMap((f) => f.traces.map((t) => t.role)));
    for (const r of ['slide', 'up', 'down', 'ground'] as const) expect(roles).toContain(r);
  });
});
