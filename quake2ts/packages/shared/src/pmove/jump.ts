import type { Vec3 } from '../math/vec3.js';
import { WaterLevel, type PmFlags, PmFlag, PmType, PlayerButton, addPmFlag, removePmFlag } from './constants.js';

const DEFAULT_JUMP_HEIGHT = 270;

export interface CheckJumpParams {
  readonly pmFlags: PmFlags;
  readonly pmType: PmType;
  readonly buttons: number;
  readonly waterlevel: WaterLevel;
  readonly onGround: boolean;
  readonly velocity: Vec3;
  readonly jumpHeight?: number;
}

export interface CheckJumpResult {
  readonly pmFlags: PmFlags;
  readonly onGround: boolean;
  readonly velocity: Vec3;
  readonly jumpSound: boolean;
  readonly jumped: boolean;
}

function hasButton(buttons: number, button: PlayerButton): boolean {
  return (buttons & button) !== 0;
}

/**
 * Pure translation of the rerelease `PM_CheckJump` helper from `p_move.cpp`.
 * The function takes in the minimal pmove state that the original C++ logic
 * touches and returns the updated flag/origin/velocity tuple so callers can
 * apply the same semantics on both the server and client.
 */
export function checkJump(params: CheckJumpParams): CheckJumpResult {
  const { pmFlags, pmType, buttons, waterlevel, onGround, velocity, jumpHeight = DEFAULT_JUMP_HEIGHT } = params;

  // PM_CheckJump immediately bails while the landing timer is active.
  if (pmFlags & PmFlag.TimeLand) {
    return { pmFlags, onGround, velocity, jumpSound: false, jumped: false };
  }

  const holdingJump = hasButton(buttons, PlayerButton.Jump);
  let nextFlags = pmFlags;
  let nextOnGround = onGround;
  let jumpSound = false;
  let jumped = false;
  let nextVelocity = velocity;

  if (!holdingJump) {
    nextFlags = removePmFlag(nextFlags, PmFlag.JumpHeld);
    return { pmFlags: nextFlags, onGround: nextOnGround, velocity: nextVelocity, jumpSound, jumped };
  }

  if (hasPmJumpHold(nextFlags)) {
    return { pmFlags: nextFlags, onGround: nextOnGround, velocity: nextVelocity, jumpSound, jumped };
  }

  if (pmType === PmType.Dead) {
    return { pmFlags: nextFlags, onGround: nextOnGround, velocity: nextVelocity, jumpSound, jumped };
  }

  if (waterlevel >= WaterLevel.Waist) {
    nextOnGround = false;
    return { pmFlags: nextFlags, onGround: nextOnGround, velocity: nextVelocity, jumpSound, jumped };
  }

  if (!nextOnGround) {
    return { pmFlags: nextFlags, onGround: nextOnGround, velocity: nextVelocity, jumpSound, jumped };
  }

  nextFlags = addPmFlag(nextFlags, PmFlag.JumpHeld);
  nextFlags = removePmFlag(nextFlags, PmFlag.OnGround);
  nextOnGround = false;
  jumpSound = true;
  jumped = true;

  const z = velocity.z + jumpHeight;
  const finalZ = z < jumpHeight ? jumpHeight : z;
  nextVelocity = { ...velocity, z: finalZ };

  return { pmFlags: nextFlags, onGround: nextOnGround, velocity: nextVelocity, jumpSound, jumped };
}

function hasPmJumpHold(flags: PmFlags): boolean {
  return (flags & PmFlag.JumpHeld) !== 0;
}
