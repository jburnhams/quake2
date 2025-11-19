import { describe, expect, it, vi } from 'vitest';
import {
  CONTENTS_NONE,
  CONTENTS_SLIME,
  CONTENTS_SOLID,
  SURF_SLICK,
  WaterLevel,
  categorizePosition,
  type Vec3,
} from '../src/index.js';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 64 };
const MINS: Vec3 = { x: -16, y: -16, z: -24 };
const MAXS: Vec3 = { x: 16, y: 16, z: 32 };
const VIEWHEIGHT = 22;

function makeTraceResult(overrides: Partial<ReturnType<typeof baseTrace>>) {
  return { ...baseTrace(), ...overrides };
}

function baseTrace() {
  return {
    fraction: 0,
    endpos: { ...ORIGIN, z: ORIGIN.z - 0.25 },
    planeNormal: { x: 0, y: 0, z: 1 },
    allsolid: false,
    startsolid: false,
    contents: CONTENTS_SOLID,
    surfaceFlags: SURF_SLICK,
    entityNum: 42,
  };
}

describe('categorizePosition', () => {
  it('reports ground contact when tracing onto a solid plane', () => {
    const trace = vi
      .fn()
      .mockReturnValueOnce(baseTrace());

    const result = categorizePosition({
      origin: ORIGIN,
      velocity: { x: 0, y: 0, z: 0 },
      mins: MINS,
      maxs: MAXS,
      viewheight: VIEWHEIGHT,
      pointContents: () => CONTENTS_NONE,
      trace,
    });

    expect(trace).toHaveBeenCalledTimes(1);
    expect(result.onGround).toBe(true);
    expect(result.groundTrace?.planeNormal).toEqual({ x: 0, y: 0, z: 1 });
    expect(result.groundContents).toBe(CONTENTS_SOLID);
    expect(result.groundSurfaceFlags).toBe(SURF_SLICK);
    expect(result.groundEntityNum).toBe(42);
  });

  it('skips the ground trace when moving upward quickly', () => {
    const trace = vi.fn();

    const result = categorizePosition({
      origin: ORIGIN,
      velocity: { x: 0, y: 0, z: 181 },
      mins: MINS,
      maxs: MAXS,
      viewheight: VIEWHEIGHT,
      pointContents: () => CONTENTS_NONE,
      trace,
    });

    expect(trace).not.toHaveBeenCalled();
    expect(result.onGround).toBe(false);
  });

  it('rejects steep slopes unless a wall is immediately behind the player', () => {
    const slopeTrace = makeTraceResult({
      planeNormal: { x: 0, y: 1, z: 0.2 },
    });

    const noWallTrace = makeTraceResult({ fraction: 1 });

    const trace = vi
      .fn()
      .mockReturnValueOnce(slopeTrace)
      .mockReturnValueOnce(noWallTrace);

    const result = categorizePosition({
      origin: ORIGIN,
      velocity: { x: 0, y: 0, z: 0 },
      mins: MINS,
      maxs: MAXS,
      viewheight: VIEWHEIGHT,
      pointContents: () => CONTENTS_NONE,
      trace,
    });

    expect(result.onGround).toBe(false);
  });

  it('allows standing on steep slopes when wedged against a wall', () => {
    const slopeTrace = makeTraceResult({
      planeNormal: { x: 0, y: 1, z: 0.2 },
    });

    const wallTrace = makeTraceResult({ fraction: 0.5 });

    const trace = vi
      .fn()
      .mockReturnValueOnce(slopeTrace)
      .mockReturnValueOnce(wallTrace);

    const result = categorizePosition({
      origin: ORIGIN,
      velocity: { x: 0, y: 0, z: 0 },
      mins: MINS,
      maxs: MAXS,
      viewheight: VIEWHEIGHT,
      pointContents: () => CONTENTS_NONE,
      trace,
    });

    expect(result.onGround).toBe(true);
  });

  it('reuses getWaterLevel so watertype and level stay consistent', () => {
    const trace = vi.fn().mockReturnValue(baseTrace());
    const pointContents = vi.fn(() => CONTENTS_SLIME);

    const result = categorizePosition({
      origin: ORIGIN,
      velocity: { x: 0, y: 0, z: 0 },
      mins: MINS,
      maxs: MAXS,
      viewheight: VIEWHEIGHT,
      pointContents,
      trace,
    });

    expect(result.waterlevel).toBe(WaterLevel.Under);
    expect(result.watertype).toBe(CONTENTS_SLIME);
    expect(pointContents).toHaveBeenCalled();
  });
});
