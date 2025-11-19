import type { ContentsFlag } from '../bsp/contents.js';
import type { Vec3 } from '../math/vec3.js';
import type { PmovePointContentsFn, PmoveTraceFn, PmoveTraceResult } from './types.js';
import { getWaterLevel } from './water.js';
import type { WaterLevelResult } from './water.js';

const DEFAULT_MAX_GROUND_VELOCITY = 180;
const DEFAULT_MIN_GROUND_NORMAL_Z = 0.7;

export interface CategorizePositionParams {
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly viewheight: number;
  readonly pointContents: PmovePointContentsFn;
  readonly trace: PmoveTraceFn;
  readonly skipGroundCheck?: boolean;
  readonly maxGroundVelocity?: number;
  readonly minGroundNormalZ?: number;
}

export interface CategorizePositionResult extends WaterLevelResult {
  readonly onGround: boolean;
  readonly groundTrace?: PmoveTraceResult;
  readonly groundContents?: ContentsFlag;
  readonly groundSurfaceFlags?: number;
  readonly groundEntityNum?: number;
}

export function categorizePosition(params: CategorizePositionParams): CategorizePositionResult {
  const {
    origin,
    velocity,
    mins,
    maxs,
    viewheight,
    pointContents,
    trace,
    skipGroundCheck = false,
    maxGroundVelocity = DEFAULT_MAX_GROUND_VELOCITY,
    minGroundNormalZ = DEFAULT_MIN_GROUND_NORMAL_Z,
  } = params;

  let groundTrace: PmoveTraceResult | undefined;
  let onGround = false;

  if (!skipGroundCheck && velocity.z <= maxGroundVelocity) {
    const downPoint: Vec3 = { x: origin.x, y: origin.y, z: origin.z - 0.25 };
    groundTrace = trace(origin, downPoint, mins, maxs);

    const plane = groundTrace.planeNormal;
    let slantedGround =
      !!plane && groundTrace.fraction < 1 && plane.z < minGroundNormalZ;

    if (slantedGround) {
      const slantEnd: Vec3 = {
        x: origin.x + plane!.x,
        y: origin.y + plane!.y,
        z: origin.z + plane!.z,
      };
      const slantTrace = trace(origin, slantEnd, mins, maxs);
      if (slantTrace.fraction < 1 && !slantTrace.startsolid) {
        slantedGround = false;
      }
    }

    if (groundTrace.fraction !== 1 && (!slantedGround || groundTrace.startsolid)) {
      onGround = true;
    }
  }

  const water = getWaterLevel({ origin, mins, viewheight, pointContents });

  return {
    ...water,
    onGround,
    groundTrace,
    groundContents: groundTrace?.contents,
    groundSurfaceFlags: groundTrace?.surfaceFlags,
    groundEntityNum: groundTrace?.entityNum,
  };
}
