// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBsp } from '@quake2ts/formats';
import { Library } from '../src/library/library';
import { DEFAULT_LAB_TUNING, RELEASE_FRAME, simulateRun, summarise, worldFromMap, type MovementWorld } from '../src/labs/movement/simulate';
import { demoPak } from './setup';

// The movement lab's run on demo1, through the game's own runPmove and the map's collision.
let world: MovementWorld;

beforeAll(async () => {
  const library = new Library();
  library.mount('pak.pak', demoPak.buffer.slice(demoPak.byteOffset, demoPak.byteOffset + demoPak.byteLength) as ArrayBuffer);
  world = worldFromMap(parseBsp(await library.read('maps/demo1.bsp')));
});

describe('movement lab run', () => {
  it('starts at demo1\'s info_player_start and runs, jumps and stops as the game does', () => {
    const frames = simulateRun(world);
    const s = summarise(frames);
    expect(world.start.yaw).toBe(135);
    expect(s.topSpeed).toBeGreaterThanOrEqual(299);
    expect(s.peakHeight).toBeGreaterThan(30);
    expect(s.airtime).toBeGreaterThan(0.5);
    expect(frames.at(-1)!.speed).toBeLessThan(frames[RELEASE_FRAME - 1]!.speed);
  });

  it('is the same run every time', () => {
    expect(simulateRun(world)).toEqual(simulateRun(world));
  });

  it('changes with each constant the sliders move', () => {
    const base = summarise(simulateRun(world));
    expect(summarise(simulateRun(world, { ...DEFAULT_LAB_TUNING, gravity: 400 })).peakHeight).toBeGreaterThan(base.peakHeight);
    expect(summarise(simulateRun(world, { ...DEFAULT_LAB_TUNING, jumpSpeed: 150 })).peakHeight).toBeLessThan(base.peakHeight);
    expect(summarise(simulateRun(world, { ...DEFAULT_LAB_TUNING, maxSpeed: 150 })).topSpeed).toBeLessThan(base.topSpeed - 100);
    // After letting go, less friction slides the player further.
    expect(summarise(simulateRun(world, { ...DEFAULT_LAB_TUNING, friction: 2 })).distance).toBeGreaterThan(base.distance);
  });
});
