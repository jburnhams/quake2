import type { Vec3 } from '../math/vec3.js';
import { addVec3, dotVec3, lengthVec3, normalizeVec3, scaleVec3 } from '../math/vec3.js';
import { angleVectors } from '../math/angles.js';
import type {
  PmoveAccelerateParams,
  PmoveCmd,
  PmoveFrictionParams,
  PmoveWishParams,
  PmoveWishResult,
  PmoveState,
  PmoveImports,
  PmoveTraceResult
} from './types.js';
import { PlayerButton, PmFlag, PmType, addPmFlag, removePmFlag } from './constants.js';
import { checkJump } from './jump.js';
import { applyPmoveAirMove, applyPmoveWaterMove, applyPmoveWalkMove } from './move.js';
import { categorizePosition } from './categorize.js';
import { checkDuckState, DuckTraceParams } from './duck.js';
// import { updateViewOffsets } from './view.js';

const FRAMETIME = 0.025; // Define FRAMETIME here or import if available in constants? Using local definition for now as per previous context.

/**
 * Pure version of PM_Friction from rerelease p_move.cpp.
 * Handles ground and water friction and returns a new velocity.
 */
export function applyPmoveFriction(params: PmoveFrictionParams): Vec3 {
  const {
    velocity,
    frametime,
    onGround,
    groundIsSlick,
    onLadder,
    waterlevel,
    pmFriction,
    pmStopSpeed,
    pmWaterFriction,
  } = params;

  const speed = lengthVec3(velocity);

  // Matches the "if (speed < 1)" early-out: clears X/Y but preserves Z.
  if (speed < 1) {
    return { x: 0, y: 0, z: velocity.z };
  }

  let drop = 0;

  // Ground friction (or ladder)
  if ((onGround && !groundIsSlick) || onLadder) {
    const control = speed < pmStopSpeed ? pmStopSpeed : speed;
    const friction = pmFriction;
    drop += control * friction * frametime;
  }

  // Water friction (only when not on ladder)
  if (waterlevel > 0 && !onLadder) {
    drop += speed * pmWaterFriction * waterlevel * frametime;
  }

  let newspeed = speed - drop;
  if (newspeed < 0) {
    newspeed = 0;
  }

  if (newspeed === speed) {
    return velocity;
  }

  const scale = newspeed / speed;
  return scaleVec3(velocity, scale);
}

/**
 * Pure version of PM_Accelerate from rerelease p_move.cpp.
 * Returns a new velocity with wishdir/wishspeed acceleration applied.
 */
export function applyPmoveAccelerate(params: PmoveAccelerateParams): Vec3 {
  const { velocity, wishdir, wishspeed, accel, frametime } = params;

  const currentSpeed = dotVec3(velocity, wishdir);
  const addSpeed = wishspeed - currentSpeed;

  if (addSpeed <= 0) {
    return velocity;
  }

  let accelSpeed = accel * frametime * wishspeed;
  if (accelSpeed > addSpeed) {
    accelSpeed = addSpeed;
  }

  return {
    x: velocity.x + wishdir.x * accelSpeed,
    y: velocity.y + wishdir.y * accelSpeed,
    z: velocity.z + wishdir.z * accelSpeed,
  };
}

/**
 * Mirrors PM_AirAccelerate in rerelease `p_move.cpp` (lines ~612-636): wishspeed is clamped
 * to 30 for the addspeed calculation but the acceleration magnitude still uses the full wishspeed.
 */
export function applyPmoveAirAccelerate(params: PmoveAccelerateParams): Vec3 {
  const { velocity, wishdir, wishspeed, accel, frametime } = params;

  const wishspd = Math.min(wishspeed, 30);
  const currentSpeed = dotVec3(velocity, wishdir);
  const addSpeed = wishspd - currentSpeed;

  if (addSpeed <= 0) {
    return velocity;
  }

  let accelSpeed = accel * wishspeed * frametime;
  if (accelSpeed > addSpeed) {
    accelSpeed = addSpeed;
  }

  return {
    x: velocity.x + wishdir.x * accelSpeed,
    y: velocity.y + wishdir.y * accelSpeed,
    z: velocity.z + wishdir.z * accelSpeed,
  };
}

/**
 * Pure mirror of PM_CmdScale from rerelease `p_move.cpp`. Computes the scalar applied to
 * the command directional inputs so that the resulting wish velocity caps at `maxSpeed`
 * regardless of the directional mix.
 */
export function pmoveCmdScale(cmd: PmoveCmd, maxSpeed: number): number {
  const forward = Math.abs(cmd.forwardmove);
  const side = Math.abs(cmd.sidemove);
  const up = Math.abs(cmd.upmove);

  const max = Math.max(forward, side, up);
  if (max === 0) {
    return 0;
  }

  const total = Math.sqrt(cmd.forwardmove * cmd.forwardmove + cmd.sidemove * cmd.sidemove + cmd.upmove * cmd.upmove);
  return (maxSpeed * max) / (127 * total);
}

/**
 * Computes wishdir/wishspeed for ground/air movement as done in PM_AirMove and
 * PM_GroundMove. Z is forced to zero and wishspeed is clamped to maxSpeed, matching
 * the rerelease p_move.cpp helpers before they call PM_Accelerate/PM_AirAccelerate.
 */
export function buildAirGroundWish(params: PmoveWishParams): PmoveWishResult {
  const { forward, right, cmd, maxSpeed } = params;

  let wishvel = {
    x: forward.x * cmd.forwardmove + right.x * cmd.sidemove,
    y: forward.y * cmd.forwardmove + right.y * cmd.sidemove,
    z: 0,
  } satisfies Vec3;

  let wishspeed = lengthVec3(wishvel);
  if (wishspeed > maxSpeed) {
    const scale = maxSpeed / wishspeed;
    wishvel = scaleVec3(wishvel, scale);
    wishspeed = maxSpeed;
  }

  return {
    wishdir: wishspeed === 0 ? wishvel : normalizeVec3(wishvel),
    wishspeed,
  };
}

/**
 * Computes the wishdir/wishspeed mix for water movement, matching PM_WaterMove in
 * rerelease p_move.cpp: includes the upward bias when no strong upmove is requested,
 * clamps wishspeed to maxSpeed, and halves the returned wishspeed before acceleration.
 */
export function buildWaterWish(params: PmoveWishParams): PmoveWishResult {
  const { forward, right, cmd, maxSpeed } = params;

  // Use full 3D components for water movement
  let wishvel = {
    x: forward.x * cmd.forwardmove + right.x * cmd.sidemove,
    y: forward.y * cmd.forwardmove + right.y * cmd.sidemove,
    z: forward.z * cmd.forwardmove + right.z * cmd.sidemove,
  } satisfies Vec3;

  if (cmd.upmove > 10) {
    wishvel = addVec3(wishvel, { x: 0, y: 0, z: cmd.upmove });
  } else if (cmd.upmove < -10) {
    wishvel = addVec3(wishvel, { x: 0, y: 0, z: cmd.upmove });
  } else if (Math.abs(cmd.forwardmove) < 10 && Math.abs(cmd.sidemove) < 10) {
    // Standard drift down when no vertical input AND no significant horizontal input
    // Matches Quake 2 rerelease behavior (sinking slowly)
    wishvel = addVec3(wishvel, { x: 0, y: 0, z: -60 });
  } else {
    // When moving horizontally but not vertically, drift slightly up
    // This matches the "else { wishvel[2] += 10 }" logic in PM_WaterMove
    wishvel = addVec3(wishvel, { x: 0, y: 0, z: 10 });
  }

  let wishspeed = lengthVec3(wishvel);
  if (wishspeed > maxSpeed) {
    const scale = maxSpeed / wishspeed;
    wishvel = scaleVec3(wishvel, scale);
    wishspeed = maxSpeed;
  }

  wishspeed *= 0.5;

  return {
    wishdir: wishspeed === 0 ? wishvel : normalizeVec3(wishvel),
    wishspeed,
  };
}

/**
 * Runs the full player movement simulation for a single frame.
 */
export function runPmove(state: PmoveState, imports: PmoveImports): PmoveState {
  if (state.pmType === PmType.Dead) {
    return state;
  }

  let nextState = { ...state };

  // Categorize Position
  const catResult = categorizePosition({
    pmType: nextState.pmType,
    pmFlags: nextState.pmFlags,
    pmTime: 0,
    n64Physics: false,
    velocity: nextState.velocity,
    startVelocity: nextState.velocity,
    origin: nextState.origin,
    mins: nextState.mins,
    maxs: nextState.maxs,
    viewheight: nextState.viewHeight,
    trace: imports.trace,
    pointContents: imports.pointcontents
  });

  // Merge result back to state
  nextState.pmFlags = catResult.pmFlags;
  nextState.waterlevel = catResult.waterlevel;
  nextState.watertype = catResult.watertype;

  // Check Ducking (Before Jump)
  const duckResult = checkDuckState({
    pmType: nextState.pmType,
    pmFlags: nextState.pmFlags,
    buttons: nextState.cmd.buttons,
    waterlevel: nextState.waterlevel,
    hasGroundEntity: (nextState.pmFlags & PmFlag.OnGround) !== 0,
    onLadder: false,
    n64Physics: false,
    origin: nextState.origin,
    mins: nextState.mins,
    maxs: nextState.maxs,
    trace: (params: DuckTraceParams): PmoveTraceResult => {
      // Adapter from DuckTraceFn (obj) to PmoveTraceFn (args)
      return imports.trace(params.start, params.end, params.mins, params.maxs);
    }
  });

  nextState.pmFlags = duckResult.pmFlags;
  nextState.mins = duckResult.mins;
  nextState.maxs = duckResult.maxs;
  nextState.viewHeight = duckResult.viewheight;

  // Check Jump
  const jumpResult = checkJump({
    pmFlags: nextState.pmFlags,
    pmType: nextState.pmType,
    buttons: nextState.cmd.buttons,
    waterlevel: nextState.waterlevel,
    onGround: (nextState.pmFlags & PmFlag.OnGround) !== 0,
    velocity: nextState.velocity,
    origin: nextState.origin
  });

  nextState.pmFlags = jumpResult.pmFlags;
  nextState.velocity = jumpResult.velocity;
  nextState.origin = jumpResult.origin;

  if (jumpResult.onGround !== ((nextState.pmFlags & PmFlag.OnGround) !== 0)) {
     if (jumpResult.onGround) {
       nextState.pmFlags = addPmFlag(nextState.pmFlags, PmFlag.OnGround);
     } else {
       nextState.pmFlags = removePmFlag(nextState.pmFlags, PmFlag.OnGround);
     }
  }

  // Frictional movement
  const onGround = (nextState.pmFlags & PmFlag.OnGround) !== 0;

  // Apply friction
  const velocityBeforeFriction = nextState.velocity;
  nextState.velocity = applyPmoveFriction({
      velocity: nextState.velocity,
      frametime: FRAMETIME,
      onGround,
      groundIsSlick: false,
      onLadder: false, // Defaulting to false for now as ladder logic is complex
      waterlevel: nextState.waterlevel,
      pmFriction: 6, // Default
      pmStopSpeed: 100, // Default
      pmWaterFriction: 1 // Default
  });

  // Calculate view vectors from angles
  const { forward, right } = angleVectors(nextState.viewAngles);

  if (nextState.pmType === PmType.NoClip) {
    // PM_NoclipMove
    // Simplified noclip
    const wishvel = {
         x: forward.x * nextState.cmd.forwardmove + right.x * nextState.cmd.sidemove,
         y: forward.y * nextState.cmd.forwardmove + right.y * nextState.cmd.sidemove,
         z: nextState.cmd.upmove
    };
    const scale = FRAMETIME; // Just move by velocity
    // Actually we need to apply velocity based on input
    // But sticking to just what's needed for jumping/movement:
    nextState.velocity = wishvel; // Simple override for noclip
    nextState.origin = {
        x: nextState.origin.x + wishvel.x * scale,
        y: nextState.origin.y + wishvel.y * scale,
        z: nextState.origin.z + wishvel.z * scale
    };

  } else if (nextState.waterlevel >= 2) {
    const outcome = applyPmoveWaterMove({
        origin: nextState.origin,
        velocity: nextState.velocity,
        frametime: FRAMETIME,
        mins: nextState.mins,
        maxs: nextState.maxs,
        trace: imports.trace,
        cmd: nextState.cmd,
        forward,
        right,
        pmFlags: nextState.pmFlags,
        onGround,
        pmMaxSpeed: 300,
        pmDuckSpeed: 100,
        pmWaterAccelerate: 4,
        pmWaterSpeed: 400,
        onLadder: false,
        watertype: nextState.watertype,
        groundContents: 0, // Should be passed in?
        waterlevel: nextState.waterlevel,
        viewPitch: nextState.viewAngles.x,
        ladderMod: 1
    });
    nextState.origin = outcome.origin;
    nextState.velocity = outcome.velocity;

  } else if ((nextState.pmFlags & PmFlag.OnGround) === 0) {
     const outcome = applyPmoveAirMove({
        origin: nextState.origin,
        velocity: nextState.velocity,
        frametime: FRAMETIME,
        mins: nextState.mins,
        maxs: nextState.maxs,
        trace: imports.trace,
        cmd: nextState.cmd,
        forward,
        right,
        pmFlags: nextState.pmFlags,
        onGround,
        gravity: nextState.gravity,
        pmType: nextState.pmType,
        pmAccelerate: 10,
        pmAirAccelerate: 1,
        pmMaxSpeed: 300,
        pmDuckSpeed: 100,
        onLadder: false,
        waterlevel: nextState.waterlevel,
        watertype: nextState.watertype,
        groundContents: 0,
        viewPitch: nextState.viewAngles.x,
        ladderMod: 1,
        pmWaterSpeed: 400
    });
    nextState.origin = outcome.origin;
    nextState.velocity = outcome.velocity;

  } else {
     const outcome = applyPmoveWalkMove({
        origin: nextState.origin,
        velocity: nextState.velocity,
        frametime: FRAMETIME,
        mins: nextState.mins,
        maxs: nextState.maxs,
        trace: imports.trace,
        cmd: nextState.cmd,
        forward,
        right,
        pmFlags: nextState.pmFlags,
        onGround,
        gravity: nextState.gravity,
        pmType: nextState.pmType,
        pmAccelerate: 10,
        pmMaxSpeed: 300,
        pmDuckSpeed: 100,
        onLadder: false,
        waterlevel: nextState.waterlevel,
        watertype: nextState.watertype,
        groundContents: 0,
        viewPitch: nextState.viewAngles.x,
        ladderMod: 1,
        pmWaterSpeed: 400
    });
    nextState.origin = outcome.origin;
    nextState.velocity = outcome.velocity;
  }

  // Categorize Position again at end of frame
  const catResultEnd = categorizePosition({
    pmType: nextState.pmType,
    pmFlags: nextState.pmFlags,
    pmTime: 0,
    n64Physics: false,
    velocity: nextState.velocity,
    startVelocity: nextState.velocity,
    origin: nextState.origin,
    mins: nextState.mins,
    maxs: nextState.maxs,
    viewheight: nextState.viewHeight,
    trace: imports.trace,
    pointContents: imports.pointcontents
  });

  nextState.pmFlags = catResultEnd.pmFlags;
  nextState.waterlevel = catResultEnd.waterlevel;
  nextState.watertype = catResultEnd.watertype;

  // Update view offsets (bobbing, etc)
  // nextState = updateViewOffsets(nextState);

  return nextState;
}
