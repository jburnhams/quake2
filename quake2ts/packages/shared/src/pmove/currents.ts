import type { ContentsFlag } from '../bsp/contents.js';
import {
  CONTENTS_CURRENT_0,
  CONTENTS_CURRENT_180,
  CONTENTS_CURRENT_270,
  CONTENTS_CURRENT_90,
  CONTENTS_CURRENT_DOWN,
  CONTENTS_CURRENT_UP,
  CONTENTS_LADDER,
  MASK_CURRENT,
} from '../bsp/contents.js';
import { addVec3, crossVec3, normalizeVec3, scaleVec3, ZERO_VEC3, type Vec3 } from '../math/vec3.js';
import { PlayerButton, WaterLevel, isAtLeastWaistDeep } from './constants.js';
import type { PmoveCmd, PmoveTraceFn } from './types.js';

export interface WaterCurrentParams {
  readonly watertype: ContentsFlag;
  readonly waterlevel: WaterLevel;
  readonly onGround: boolean;
  readonly waterSpeed: number;
}

export interface GroundCurrentParams {
  readonly groundContents: ContentsFlag;
  readonly scale?: number;
}

export interface AddCurrentsParams {
  readonly wishVelocity: Vec3;
  readonly onLadder: boolean;
  readonly onGround: boolean;
  readonly waterlevel: WaterLevel;
  readonly watertype: ContentsFlag;
  readonly groundContents: ContentsFlag;
  readonly cmd: PmoveCmd;
  readonly viewPitch: number;
  readonly maxSpeed: number;
  readonly ladderMod: number;
  readonly waterSpeed: number;
  readonly forward: Vec3;
  readonly origin: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly trace?: PmoveTraceFn;
}

const DEFAULT_GROUND_CURRENT_SCALE = 100;
const DEFAULT_FORWARD_LADDER_CLAMP = 200;
const DEFAULT_SIDE_LADDER_CLAMP = 150;
const LADDER_HORIZONTAL_CAP = 25;
const LADDER_ASCEND_PITCH_THRESHOLD = 15;
const LADDER_TRACE_DISTANCE = 1;
const UP_VECTOR: Vec3 = { x: 0, y: 0, z: 1 };

const DEFAULT_TRACE: PmoveTraceFn = (_, end) => ({
  fraction: 1,
  endpos: end,
  allsolid: false,
  startsolid: false,
});

/**
 * Mirrors the rerelease pattern in `p_move.cpp` (lines 730-765) that turns the
 * directional CONTENTS_CURRENT_* flags into a unit-ish direction vector.
 */
export function currentVectorFromContents(contents: ContentsFlag): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;

  if (contents & CONTENTS_CURRENT_0) {
    x += 1;
  }
  if (contents & CONTENTS_CURRENT_90) {
    y += 1;
  }
  if (contents & CONTENTS_CURRENT_180) {
    x -= 1;
  }
  if (contents & CONTENTS_CURRENT_270) {
    y -= 1;
  }
  if (contents & CONTENTS_CURRENT_UP) {
    z += 1;
  }
  if (contents & CONTENTS_CURRENT_DOWN) {
    z -= 1;
  }

  if (x === 0 && y === 0 && z === 0) {
    return ZERO_VEC3;
  }

  return { x, y, z };
}

/**
 * Computes the velocity contribution from water currents using the same rules
 * as `PM_WaterMove`: the CONTENTS_CURRENT_* bits are turned into a direction
 * vector, scaled by `pm_waterspeed`, and halved when the player only has their
 * feet submerged while standing on solid ground.
 */
export function waterCurrentVelocity(params: WaterCurrentParams): Vec3 {
  const { watertype, waterlevel, onGround, waterSpeed } = params;

  if ((watertype & MASK_CURRENT) === 0) {
    return ZERO_VEC3;
  }

  const direction = currentVectorFromContents(watertype);
  if (direction === ZERO_VEC3) {
    return ZERO_VEC3;
  }

  let scale = waterSpeed;
  if (waterlevel === WaterLevel.Feet && onGround) {
    scale *= 0.5;
  }

  return scaleVec3(direction, scale);
}

/**
 * Computes the conveyor-style velocity that should be applied while touching a
 * ground plane that carries CONTENTS_CURRENT_* bits. The rerelease multiplies
 * the direction vector by 100 units per second, so we expose the same default
 * while allowing callers to override the scalar for tests.
 */
export function groundCurrentVelocity(params: GroundCurrentParams): Vec3 {
  const { groundContents, scale = DEFAULT_GROUND_CURRENT_SCALE } = params;

  const direction = currentVectorFromContents(groundContents);
  if (direction === ZERO_VEC3) {
    return ZERO_VEC3;
  }

  return scaleVec3(direction, scale);
}

/**
 * Pure mirror of PM_AddCurrents from rerelease `p_move.cpp`: handles ladder
 * specific motion tweaks, water currents, and conveyor-style ground currents
 * before pmove acceleration is applied.
 */
export function applyPmoveAddCurrents(params: AddCurrentsParams): Vec3 {
  const {
    wishVelocity,
    onLadder,
    onGround,
    waterlevel,
    watertype,
    groundContents,
    cmd,
    viewPitch,
    maxSpeed,
    ladderMod,
    waterSpeed,
    forward,
    origin,
    mins,
    maxs,
    trace = DEFAULT_TRACE,
  } = params;

  let adjusted = wishVelocity;

  if (onLadder) {
    adjusted = applyLadderAdjustments({
      wishVelocity: adjusted,
      cmd,
      waterlevel,
      viewPitch,
      maxSpeed,
      ladderMod,
      onGround,
      forward,
      origin,
      mins,
      maxs,
      trace,
    });
  }

  const waterVelocity = waterCurrentVelocity({ watertype, waterlevel, onGround, waterSpeed });
  if (waterVelocity !== ZERO_VEC3) {
    adjusted = addVec3(adjusted, waterVelocity);
  }

  if (onGround) {
    const groundVelocity = groundCurrentVelocity({ groundContents });
    if (groundVelocity !== ZERO_VEC3) {
      adjusted = addVec3(adjusted, groundVelocity);
    }
  }

  return adjusted;
}

interface LadderAdjustParams {
  readonly wishVelocity: Vec3;
  readonly cmd: PmoveCmd;
  readonly waterlevel: WaterLevel;
  readonly viewPitch: number;
  readonly maxSpeed: number;
  readonly ladderMod: number;
  readonly onGround: boolean;
  readonly forward: Vec3;
  readonly origin: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly trace: PmoveTraceFn;
}

function applyLadderAdjustments(params: LadderAdjustParams): Vec3 {
  const { wishVelocity, cmd, waterlevel, viewPitch, maxSpeed, ladderMod, onGround, forward, origin, mins, maxs, trace } = params;
  const buttons = cmd.buttons ?? 0;
  let adjusted = { ...wishVelocity };

  if ((buttons & (PlayerButton.Jump | PlayerButton.Crouch)) !== 0) {
    const ladderSpeed = isAtLeastWaistDeep(waterlevel) ? maxSpeed : DEFAULT_FORWARD_LADDER_CLAMP;
    adjusted = {
      ...adjusted,
      z: buttons & PlayerButton.Jump ? ladderSpeed : -ladderSpeed,
    };
  } else if (cmd.forwardmove) {
    const clamped = clamp(cmd.forwardmove, -DEFAULT_FORWARD_LADDER_CLAMP, DEFAULT_FORWARD_LADDER_CLAMP);
    if (cmd.forwardmove > 0) {
      const climb = viewPitch < LADDER_ASCEND_PITCH_THRESHOLD ? clamped : -clamped;
      adjusted = { ...adjusted, z: climb };
    } else {
      if (!onGround) {
        adjusted = { ...adjusted, x: 0, y: 0 };
      }
      adjusted = { ...adjusted, z: clamped };
    }
  } else {
    adjusted = { ...adjusted, z: 0 };
  }

  if (!onGround) {
    if (cmd.sidemove) {
      let sideSpeed = clamp(cmd.sidemove, -DEFAULT_SIDE_LADDER_CLAMP, DEFAULT_SIDE_LADDER_CLAMP);
      if (waterlevel < WaterLevel.Waist) {
        sideSpeed *= ladderMod;
      }

      const flatForward = normalizeVec3({ x: forward.x, y: forward.y, z: 0 });
      if (flatForward.x !== 0 || flatForward.y !== 0) {
        const spot = addVec3(origin, scaleVec3(flatForward, LADDER_TRACE_DISTANCE));
        const tr = trace(origin, spot, mins, maxs);
        if (
          tr.fraction !== 1 &&
          !tr.allsolid &&
          tr.contents !== undefined &&
          (tr.contents & CONTENTS_LADDER) !== 0 &&
          tr.planeNormal
        ) {
          const right = crossVec3(tr.planeNormal, UP_VECTOR);
          adjusted = { ...adjusted, x: 0, y: 0 };
          adjusted = addVec3(adjusted, scaleVec3(right, -sideSpeed));
        }
      }
    } else {
      adjusted = {
        ...adjusted,
        x: clampHorizontal(adjusted.x),
        y: clampHorizontal(adjusted.y),
      };
    }
  }

  return adjusted;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampHorizontal(value: number): number {
  if (value < -LADDER_HORIZONTAL_CAP) {
    return -LADDER_HORIZONTAL_CAP;
  }
  if (value > LADDER_HORIZONTAL_CAP) {
    return LADDER_HORIZONTAL_CAP;
  }
  return value;
}
