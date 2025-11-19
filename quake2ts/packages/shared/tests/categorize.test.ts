import { describe, expect, it } from 'vitest';
import {
  CONTENTS_SOLID,
  CONTENTS_WATER,
  PmFlag,
  PmType,
  WaterLevel,
  categorizePosition,
  type CategorizePositionParams,
  type PmoveTraceFn,
  type PmoveTraceResult,
  type Vec3,
} from '../src/index.js';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 32 };
const MINS: Vec3 = { x: -16, y: -16, z: -24 };
const MAXS: Vec3 = { x: 16, y: 16, z: 32 };
const FLAT_NORMAL: Vec3 = { x: 0, y: 0, z: 1 };
const SLOPE_NORMAL: Vec3 = { x: 0.6, y: 0, z: 0.5 };

function constantTrace(result: PmoveTraceResult): PmoveTraceFn {
  return () => result;
}

function scriptedTrace(results: readonly PmoveTraceResult[]): PmoveTraceFn {
  let index = 0;
  return () => {
    const current = results[index] ?? results[results.length - 1];
    if (index < results.length - 1) {
      index += 1;
    }
    return current;
  };
}

function traceResult(overrides: Partial<PmoveTraceResult> = {}): PmoveTraceResult {
  return {
    fraction: overrides.fraction ?? 0,
    endpos: overrides.endpos ?? ORIGIN,
    planeNormal: overrides.planeNormal,
    allsolid: overrides.allsolid ?? false,
    startsolid: overrides.startsolid ?? false,
    contents: overrides.contents,
    surfaceFlags: overrides.surfaceFlags,
  } satisfies PmoveTraceResult;
}

function dryPointContents(): CategorizePositionParams['pointContents'] {
  return () => 0;
}

function createParams(overrides: Partial<CategorizePositionParams> = {}): CategorizePositionParams {
  const baseTrace = traceResult({ planeNormal: FLAT_NORMAL, contents: CONTENTS_SOLID });
  return {
    pmType: PmType.Normal,
    pmFlags: overrides.pmFlags ?? 0,
    pmTime: overrides.pmTime ?? 0,
    n64Physics: overrides.n64Physics ?? false,
    velocity: overrides.velocity ?? { x: 0, y: 0, z: -10 },
    startVelocity: overrides.startVelocity ?? { x: 0, y: 0, z: -10 },
    origin: overrides.origin ?? ORIGIN,
    mins: overrides.mins ?? MINS,
    maxs: overrides.maxs ?? MAXS,
    viewheight: overrides.viewheight ?? 22,
    trace: overrides.trace ?? constantTrace(baseTrace),
    pointContents: overrides.pointContents ?? dryPointContents(),
  } satisfies CategorizePositionParams;
}

function underwaterContents(): CategorizePositionParams['pointContents'] {
  return () => CONTENTS_WATER;
}

describe('categorizePosition', () => {
  it('forces airborne state when grappling or blasting upward', () => {
    const trace = constantTrace(
      traceResult({ planeNormal: FLAT_NORMAL, contents: CONTENTS_SOLID }),
    );
    const base = createParams({ trace, pointContents: dryPointContents() });

    const grappled = categorizePosition({ ...base, pmType: PmType.Grapple });
    expect(grappled.onGround).toBe(false);
    expect(grappled.pmFlags & PmFlag.OnGround).toBe(0);

    const fastRise = categorizePosition({ ...base, velocity: { x: 0, y: 0, z: 181 } });
    expect(fastRise.onGround).toBe(false);
  });

  it('clears waterjump timers and records impact delta when landing', () => {
    const trace = constantTrace(
      traceResult({
        fraction: 0,
        planeNormal: FLAT_NORMAL,
        contents: CONTENTS_SOLID,
      }),
    );

    const params = createParams({
      pmFlags:
        PmFlag.TimeWaterJump | PmFlag.TimeTeleport | PmFlag.TimeLand | PmFlag.TimeTrick,
      velocity: { x: 0, y: 0, z: -120 },
      startVelocity: { x: 0, y: 0, z: 200 },
      trace,
      pointContents: dryPointContents(),
    });

    const result = categorizePosition(params);

    expect(result.onGround).toBe(true);
    expect(result.pmFlags & PmFlag.OnGround).not.toBe(0);
    expect(result.pmFlags & PmFlag.TimeWaterJump).toBe(0);
    expect(result.pmFlags & PmFlag.TimeTeleport).toBe(0);
    expect(result.pmFlags & PmFlag.TimeTrick).toBe(0);
    expect(result.pmTime).toBe(0);
    expect(result.groundTrace?.contents).toBe(CONTENTS_SOLID);
    expect(result.impactDelta).toBeCloseTo(198.8, 5);
  });

  it('rejects shallow slopes unless wedged against a wall', () => {
    const sloped = traceResult({
      fraction: 0,
      planeNormal: SLOPE_NORMAL,
      contents: CONTENTS_SOLID,
    });

    const openTrace = scriptedTrace([
      sloped,
      traceResult({ fraction: 1, planeNormal: SLOPE_NORMAL }),
    ]);
    const openSlope = categorizePosition({
      ...createParams({ trace: openTrace, pointContents: dryPointContents() }),
      pmFlags: PmFlag.OnGround,
    });
    expect(openSlope.onGround).toBe(false);

    const wedgeTrace = scriptedTrace([
      sloped,
      traceResult({ fraction: 0, planeNormal: FLAT_NORMAL, contents: CONTENTS_SOLID }),
    ]);
    const wedged = categorizePosition({
      ...createParams({ trace: wedgeTrace, pointContents: dryPointContents() }),
      pmFlags: 0,
    });
    expect(wedged.onGround).toBe(true);
  });

  it('starts the trick timer when landing while moving upward on flat ground', () => {
    const params = createParams({
      velocity: { x: 0, y: 0, z: 120 },
      startVelocity: { x: 0, y: 0, z: 220 },
      pointContents: dryPointContents(),
    });

    const result = categorizePosition(params);

    expect(result.pmFlags & PmFlag.TimeTrick).not.toBe(0);
    expect(result.pmTime).toBe(64);
    expect(result.impactDelta).toBeCloseTo(221.2, 5);
  });

  it('applies the landing timer immediately when ducked or using N64 physics', () => {
    const ducked = categorizePosition({
      ...createParams({
        pmFlags: PmFlag.Ducked,
        pointContents: dryPointContents(),
      }),
    });

    expect(ducked.pmFlags & PmFlag.TimeLand).not.toBe(0);
    expect(ducked.pmTime).toBe(128);

    const n64 = categorizePosition({
      ...createParams({ n64Physics: true, pointContents: dryPointContents() }),
    });
    expect(n64.pmFlags & PmFlag.TimeLand).not.toBe(0);
    expect(n64.pmTime).toBe(128);
  });

  it('reports the current waterlevel/watertype using the shared probe helper', () => {
    const result = categorizePosition({
      ...createParams({ pointContents: underwaterContents() }),
    });

    expect(result.waterlevel).toBe(WaterLevel.Under);
    expect(result.watertype).toBe(CONTENTS_WATER);
  });
});
