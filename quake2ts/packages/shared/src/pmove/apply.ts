
import { PmoveCmd, PmoveTraceFn } from './types.js';
import { Vec3 } from '../math/vec3.js';

import { applyPmoveAccelerate, applyPmoveFriction, buildAirGroundWish, buildWaterWish } from './pmove.js';
import { PlayerState } from '../protocol/player-state.js';
import { angleVectors } from '../math/angles.js';
import { MASK_WATER } from '../bsp/contents.js';

const FRAMETIME = 0.025;

// Local definition to avoid dependency issues if constants.ts is missing
// Matches packages/shared/src/pmove/constants.ts
const WaterLevel = {
  None: 0,
  Feet: 1,
  Waist: 2,
  Under: 3,
} as const;

const categorizePosition = (state: PlayerState, trace: PmoveTraceFn): PlayerState => {
  const point = { ...state.origin };
  point.z -= 0.25;
  const traceResult = trace(state.origin, point);

  return {
    ...state,
    onGround: traceResult.fraction < 1,
  };
};

const checkWater = (state: PlayerState, pointContents: (point: Vec3) => number): PlayerState => {
  const point = { ...state.origin };
  const { mins, maxs } = state;

  // Default to feet
  point.z = state.origin.z + mins.z + 1;

  const feetContents = pointContents(point);

  if (!(feetContents & MASK_WATER)) {
    return { ...state, waterLevel: WaterLevel.None, watertype: 0 };
  }

  let waterLevel: number = WaterLevel.Feet;
  let watertype = feetContents;

  // Check waist
  const waist = state.origin.z + (mins.z + maxs.z) * 0.5;
  point.z = waist;
  const waistContents = pointContents(point);

  if (waistContents & MASK_WATER) {
    waterLevel = WaterLevel.Waist;
    watertype = waistContents;

    // Check head (eyes)
    // Standard Quake 2 viewheight is 22. maxs.z is typically 32.
    // So eyes are roughly at origin.z + 22.
    // We'll use origin.z + 22 to check if eyes are underwater.
    // If viewheight was available in PlayerState, we'd use that.
    const head = state.origin.z + 22;
    point.z = head;
    const headContents = pointContents(point);

    if (headContents & MASK_WATER) {
      waterLevel = WaterLevel.Under;
      watertype = headContents;
    }
  }

  return { ...state, waterLevel, watertype };
};


export const applyPmove = (
  state: PlayerState,
  cmd: PmoveCmd,
  trace: PmoveTraceFn,
  pointContents: (point: Vec3) => number
): PlayerState => {
  let newState = { ...state };
  newState = categorizePosition(newState, trace);
  newState = checkWater(newState, pointContents);

  const { origin, velocity, onGround, waterLevel, viewAngles } = newState;

  // Calculate forward and right vectors from view angles
  // For water movement, use full view angles including pitch
  // For ground/air movement, reduce pitch influence by dividing by 3
  // See: rerelease/p_move.cpp lines 1538, 1686-1691, 800, 858
  const adjustedAngles = waterLevel >= 2
    ? viewAngles
    : {
        // For ground/air movement, reduce pitch influence (rerelease/p_move.cpp:1689)
        x: viewAngles.x > 180 ? (viewAngles.x - 360) / 3 : viewAngles.x / 3,
        y: viewAngles.y,
        z: viewAngles.z,
      };

  const { forward, right } = angleVectors(adjustedAngles);

  // Apply friction BEFORE acceleration to match original Quake 2 rerelease behavior
  // See: rerelease/src/game/player/pmove.c lines 1678 (PM_Friction) then 1693 (PM_AirMove->PM_Accelerate)
  const frictionedVelocity = applyPmoveFriction({
    velocity,
    frametime: FRAMETIME,
    onGround,
    groundIsSlick: false,
    onLadder: false,
    waterlevel: waterLevel,
    pmFriction: 6,
    pmStopSpeed: 100,
    pmWaterFriction: 1,
  });

  const wish = waterLevel >= 2
    ? buildWaterWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      })
    : buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

  const finalVelocity = applyPmoveAccelerate({
    velocity: frictionedVelocity,
    wishdir: wish.wishdir,
    wishspeed: wish.wishspeed,
    // Water movement uses ground acceleration (10), not air acceleration (1)
    accel: (onGround || waterLevel >= 2) ? 10 : 1,
    frametime: FRAMETIME,
  });

  const traceResult = trace(origin, {
    x: origin.x + finalVelocity.x * FRAMETIME,
    y: origin.y + finalVelocity.y * FRAMETIME,
    z: origin.z + finalVelocity.z * FRAMETIME,
  });

  return {
    ...newState,
    origin: traceResult.endpos,
    velocity: finalVelocity,
  };
};
