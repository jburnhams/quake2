
import { PmoveCmd, PmoveTraceFn } from './types.js';
import { Vec3 } from '../math/vec3.js';

import { applyPmoveAccelerate, applyPmoveFriction, buildAirGroundWish, buildWaterWish } from './pmove.js';
import { PlayerState } from '../protocol/player-state.js';

const FRAMETIME = 0.025;

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
  point.z += state.mins.z + 1;
  const contents = pointContents(point);
  if (contents & 0x2000000) {
    return { ...state, waterLevel: 1 };
  }
  return { ...state, waterLevel: 0 };
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

  const { origin, velocity, onGround, waterLevel } = newState;

  const wish = waterLevel >= 2
    ? buildWaterWish({
        forward: { x: 1, y: 0, z: 0 },
        right: { x: 0, y: 1, z: 0 },
        cmd,
        maxSpeed: 320,
      })
    : buildAirGroundWish({
        forward: { x: 1, y: 0, z: 0 },
        right: { x: 0, y: 1, z: 0 },
        cmd,
        maxSpeed: 320,
      });

  const newVelocity = applyPmoveAccelerate({
    velocity,
    wishdir: wish.wishdir,
    wishspeed: wish.wishspeed,
    accel: onGround ? 10 : 1,
    frametime: FRAMETIME,
  });

  const finalVelocity = applyPmoveFriction({
    velocity: newVelocity,
    frametime: FRAMETIME,
    onGround,
    groundIsSlick: false,
    onLadder: false,
    waterlevel: waterLevel,
    pmFriction: 6,
    pmStopSpeed: 100,
    pmWaterFriction: 1,
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
