import { describe, expect, it } from 'vitest';
import {
  STOP_EPSILON,
  ZERO_VEC3,
  addVec3,
  dotVec3,
  lengthVec3,
  normalizeVec3,
  scaleVec3,
} from '../../src/index.js';
import {
  applyPmoveAccelerate,
  applyPmoveAirAccelerate,
  applyPmoveFriction,
  buildAirGroundWish,
  buildWaterWish,
  pmoveCmdScale,
} from '../../src/pmove/pmove.js';

describe('pmove helpers (friction/accelerate)', () => {
  it('applies ground friction matching PM_Friction semantics', () => {
    const velocity = { x: 300, y: 0, z: 0 };
    const frametime = 0.1; // 100 ms frame
    const pmFriction = 6;
    const pmStopSpeed = 100;
    const pmWaterFriction = 1;

    const result = applyPmoveFriction({
      velocity,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction,
    });

    // Compute expected speed drop as in PM_Friction
    const speed = lengthVec3(velocity);
    const control = speed < pmStopSpeed ? pmStopSpeed : speed;
    const drop = control * pmFriction * frametime;
    const expectedSpeed = Math.max(speed - drop, 0);

    expect(lengthVec3(result)).toBeCloseTo(expectedSpeed, 4);
    // Direction should be preserved (pure scaling)
    const dirOriginal = normalizeVec3(velocity);
    const dirResult = normalizeVec3(result);
    expect(dirResult.x).toBeCloseTo(dirOriginal.x, 4);
    expect(dirResult.y).toBeCloseTo(dirOriginal.y, 4);
    expect(dirResult.z).toBeCloseTo(dirOriginal.z, 4);
  });

  it('applies water friction and preserves Z when speed is very low', () => {
    const velocity = { x: 0.3, y: 0.4, z: -0.1 };

    const resultLowSpeed = applyPmoveFriction({
      velocity,
      frametime: 0.05,
      onGround: false,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: 0,
      pmFriction: 6,
      pmStopSpeed: 100,
      pmWaterFriction: 1,
    });

    // When speed < 1, PM_Friction zeros x/y but leaves z unchanged
    expect(resultLowSpeed).toEqual({ x: 0, y: 0, z: velocity.z });

    // Now test water friction with a larger speed
    const fastVelocity = { x: 0, y: 200, z: 0 };
    const frametime = 0.1;
    const pmWaterFriction = 1;
    const waterlevel = 2;

    const resultWater = applyPmoveFriction({
      velocity: fastVelocity,
      frametime,
      onGround: false,
      groundIsSlick: false,
      onLadder: false,
      waterlevel,
      pmFriction: 6,
      pmStopSpeed: 100,
      pmWaterFriction,
    });

    const speed = lengthVec3(fastVelocity);
    const drop = speed * pmWaterFriction * waterlevel * frametime;
    const expectedSpeed = Math.max(speed - drop, 0);

    expect(lengthVec3(resultWater)).toBeCloseTo(expectedSpeed, 4);
  });

  it('accelerates along wishdir matching PM_Accelerate behavior', () => {
    const velocity = ZERO_VEC3;
    const wishdir = normalizeVec3({ x: 1, y: 1, z: 0 });
    const wishspeed = 400;
    const accel = 10;
    const frametime = 0.1;

    const result = applyPmoveAccelerate({
      velocity,
      wishdir,
      wishspeed,
      accel,
      frametime,
    });

    // PM_Accelerate: accelspeed = accel * frametime * wishspeed
    const expectedAccelSpeed = accel * frametime * wishspeed;

    const delta = addVec3(result, { x: -velocity.x, y: -velocity.y, z: -velocity.z });
    expect(lengthVec3(delta)).toBeCloseTo(expectedAccelSpeed, 4);
    // Direction should match wishdir
    const dir = normalizeVec3(result);
    expect(dir.x).toBeCloseTo(wishdir.x, 4);
    expect(dir.y).toBeCloseTo(wishdir.y, 4);
    expect(dir.z).toBeCloseTo(wishdir.z, 4);
  });

  it('does not accelerate when already at or above wishspeed', () => {
    const wishdir = normalizeVec3({ x: 1, y: 0, z: 0 });
    const wishspeed = 200;
    const accel = 10;
    const frametime = 0.1;

    // Set velocity so that dot(vel, wishdir) >= wishspeed
    const baseVelocity = { x: 250, y: 0, z: 0 };

    const result = applyPmoveAccelerate({
      velocity: baseVelocity,
      wishdir,
      wishspeed,
      accel,
      frametime,
    });

    expect(result).toEqual(baseVelocity);
  });

  it('caps acceleration to addspeed when accelspeed would overshoot', () => {
    const velocity = { x: 100, y: 0, z: 0 };
    const wishdir = normalizeVec3({ x: 1, y: 0, z: 0 });
    const wishspeed = 120;
    const accel = 1000; // deliberately huge
    const frametime = 1;

    const result = applyPmoveAccelerate({
      velocity,
      wishdir,
      wishspeed,
      accel,
      frametime,
    });

    // Addspeed should be wishspeed - currentSpeed = 20
    expect(lengthVec3(addVec3(result, { x: -velocity.x, y: -velocity.y, z: -velocity.z }))).toBeCloseTo(20, 4);
  });

  it('respects ladder friction flag similar to PM_Friction', () => {
    const velocity = { x: 150, y: 0, z: 0 };
    const frametime = 0.1;
    const pmFriction = 6;
    const pmStopSpeed = 100;

    const groundResult = applyPmoveFriction({
      velocity,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction: 1,
    });

    const ladderResult = applyPmoveFriction({
      velocity,
      frametime,
      onGround: false,
      groundIsSlick: false,
      onLadder: true,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction: 1,
    });

    // Both cases should see similar friction since both include the ground/ladder path.
    expect(lengthVec3(groundResult)).toBeCloseTo(lengthVec3(ladderResult), 4);

    // Slick ground should have no friction at all.
    const slickResult = applyPmoveFriction({
      velocity,
      frametime,
      onGround: true,
      groundIsSlick: true,
      onLadder: false,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction: 1,
    });

    // With no other friction sources, velocity should remain effectively unchanged.
    expect(lengthVec3(addVec3(slickResult, { x: -velocity.x, y: -velocity.y, z: -velocity.z }))).toBeLessThan(
      STOP_EPSILON,
    );
  });
});

describe('pmove helpers (air acceleration)', () => {
  it('accelerates using the full wishspeed even though addspeed clamps to 30', () => {
    const wishdir = normalizeVec3({ x: 1, y: 0, z: 0 });

    const result = applyPmoveAirAccelerate({
      velocity: ZERO_VEC3,
      wishdir,
      wishspeed: 400,
      accel: 0.1,
      frametime: 0.1,
    });

    // accelspeed = accel * wishspeed * frametime = 4
    expect(lengthVec3(result)).toBeCloseTo(4, 4);
  });

  it('caps the dot product to 30 even when accel would overshoot', () => {
    const wishdir = normalizeVec3({ x: 1, y: 0, z: 0 });
    const startingVelocity = scaleVec3(wishdir, 25);

    const result = applyPmoveAirAccelerate({
      velocity: startingVelocity,
      wishdir,
      wishspeed: 1000,
      accel: 500,
      frametime: 1,
    });

    expect(dotVec3(result, wishdir)).toBeCloseTo(30, 4);
  });

  it('does not accelerate past the clamp when already at or above 30', () => {
    const wishdir = normalizeVec3({ x: 1, y: 0, z: 0 });
    const startingVelocity = scaleVec3(wishdir, 35);

    const result = applyPmoveAirAccelerate({
      velocity: startingVelocity,
      wishdir,
      wishspeed: 200,
      accel: 10,
      frametime: 1,
    });

    expect(result).toEqual(startingVelocity);
  });

  it('limits acceleration when addspeed is small but accelSpeed uses the full wishspeed', () => {
    const wishdir = normalizeVec3({ x: 1, y: 0, z: 0 });
    const startingVelocity = scaleVec3(wishdir, 28);

    const result = applyPmoveAirAccelerate({
      velocity: startingVelocity,
      wishdir,
      wishspeed: 80,
      accel: 0.2,
      frametime: 0.1,
    });

    const expectedDelta = 0.2 * 0.1 * 80; // uses raw wishspeed even though clamp would be 30
    const delta = dotVec3(result, wishdir) - dotVec3(startingVelocity, wishdir);
    expect(delta).toBeCloseTo(expectedDelta, 4);
  });
});

describe('pmove helpers (wishdir/wishspeed builders)', () => {
  const forward = normalizeVec3({ x: 1, y: 0, z: 0 });
  const right = normalizeVec3({ x: 0, y: 1, z: 0 });
  const maxSpeed = 320;

  it('computes air/ground wishdir with z forced to zero and clamps to max speed', () => {
    const result = buildAirGroundWish({
      forward,
      right,
      cmd: { forwardmove: 400, sidemove: 0, upmove: 0 },
      maxSpeed,
    });

    expect(result.wishdir).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.wishspeed).toBeCloseTo(320, 4); // clamped to maxSpeed
  });

  it('returns the unclamped wishspeed when under the cap', () => {
    const result = buildAirGroundWish({
      forward,
      right,
      cmd: { forwardmove: 50, sidemove: -50, upmove: 0 },
      maxSpeed,
    });

    expect(result.wishdir.x).toBeCloseTo(0.707106, 4);
    expect(result.wishdir.y).toBeCloseTo(-0.707106, 4);
    expect(result.wishdir.z).toBe(0);
    expect(result.wishspeed).toBeCloseTo(Math.sqrt(50 * 50 + 50 * 50), 4);
  });

  it('matches PM_WaterMove z bias and wishspeed halving', () => {
    const result = buildWaterWish({
      forward,
      right,
      cmd: { forwardmove: 200, sidemove: 0, upmove: 0 },
      maxSpeed,
    });

    // Should bias upward by 10 since upmove is between -10 and 10.
    expect(result.wishdir.z).toBeGreaterThan(0);
    const expectedWishvel = {
      x: forward.x * 200,
      y: forward.y * 200,
      z: 10,
    };
    // Base wishspeed is length of the wishvel before halving.
    const expectedLength = lengthVec3(expectedWishvel);
    expect(result.wishspeed).toBeCloseTo(expectedLength * 0.5, 4);
  });

  it('honors explicit upmove values instead of the upward bias', () => {
    const upward = buildWaterWish({
      forward,
      right,
      cmd: { forwardmove: 0, sidemove: 0, upmove: 20 },
      maxSpeed,
    });

    expect(upward.wishdir.z).toBeCloseTo(1, 4);

    const downward = buildWaterWish({
      forward,
      right,
      cmd: { forwardmove: 0, sidemove: 0, upmove: -20 },
      maxSpeed,
    });

    expect(downward.wishdir.z).toBeCloseTo(-1, 4);
  });
});

describe('pmove helpers (command scaling)', () => {
  it('returns zero scale when there is no input', () => {
    expect(pmoveCmdScale({ forwardmove: 0, sidemove: 0, upmove: 0 }, 320)).toBe(0);
  });

  it('matches PM_CmdScale for cardinal movement', () => {
    const maxSpeed = 320;
    const scale = pmoveCmdScale({ forwardmove: 127, sidemove: 0, upmove: 0 }, maxSpeed);
    const wishspeed = 127 * scale;

    expect(wishspeed).toBeCloseTo(maxSpeed, 4);
  });

  it('preserves max speed on diagonals and vertical mixes', () => {
    const maxSpeed = 320;

    const diagonalScale = pmoveCmdScale({ forwardmove: 127, sidemove: 127, upmove: 0 }, maxSpeed);
    const diagonalTotal = Math.sqrt(127 * 127 + 127 * 127);
    expect(diagonalTotal * diagonalScale).toBeCloseTo(maxSpeed, 4);

    const verticalScale = pmoveCmdScale({ forwardmove: 64, sidemove: 32, upmove: 96 }, maxSpeed);
    const verticalTotal = Math.sqrt(64 * 64 + 32 * 32 + 96 * 96);
    expect(verticalTotal * verticalScale).toBeCloseTo(maxSpeed * (96 / 127), 4);
  });
});

describe('pmove order of operations (friction before acceleration)', () => {
  it('applies friction BEFORE acceleration to match Quake 2 rerelease pmove.c', () => {
    // This test verifies the correct order as seen in rerelease/src/game/player/pmove.c:
    // Line 1678: PM_Friction() is called first
    // Line 1693: PM_AirMove() -> PM_Accelerate() is called second
    //
    // The order matters because friction reduces speed, and acceleration adds speed.
    // If you accelerate first, then apply friction, you get different results.

    const initialVelocity = { x: 200, y: 0, z: 0 };
    const wishdir = normalizeVec3({ x: 1, y: 0, z: 0 });
    const wishspeed = 300;
    const accel = 10;
    const frametime = 0.1;
    const pmFriction = 6;
    const pmStopSpeed = 100;

    // CORRECT ORDER: Friction THEN Acceleration (matches original C code)
    const frictionedVelocity = applyPmoveFriction({
      velocity: initialVelocity,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction: 1,
    });

    const correctResult = applyPmoveAccelerate({
      velocity: frictionedVelocity,
      wishdir,
      wishspeed,
      accel,
      frametime,
    });

    // INCORRECT ORDER: Acceleration THEN Friction (bug in old implementation)
    const acceleratedVelocity = applyPmoveAccelerate({
      velocity: initialVelocity,
      wishdir,
      wishspeed,
      accel,
      frametime,
    });

    const incorrectResult = applyPmoveFriction({
      velocity: acceleratedVelocity,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction: 1,
    });

    // The results should be different, proving order matters
    expect(lengthVec3(correctResult)).not.toBeCloseTo(lengthVec3(incorrectResult), 1);

    // Let's verify the correct physics:
    // 1. Initial speed: 200
    const initialSpeed = lengthVec3(initialVelocity);
    expect(initialSpeed).toBe(200);

    // 2. After friction: speed - (control * friction * frametime)
    const control = initialSpeed < pmStopSpeed ? pmStopSpeed : initialSpeed;
    const drop = control * pmFriction * frametime;
    const expectedSpeedAfterFriction = Math.max(initialSpeed - drop, 0);
    expect(lengthVec3(frictionedVelocity)).toBeCloseTo(expectedSpeedAfterFriction, 4);

    // 3. After acceleration: should be higher than after friction alone
    const correctSpeed = lengthVec3(correctResult);
    expect(correctSpeed).toBeGreaterThan(expectedSpeedAfterFriction);
  });

  it('demonstrates prediction drift when orders differ between client and server', () => {
    // This test shows why the order mismatch causes prediction drift.
    // If client applies friction-then-acceleration but server applies acceleration-then-friction,
    // they will compute different velocities even with identical inputs.

    const startVelocity = { x: 250, y: 150, z: 0 };
    const wishdir = normalizeVec3({ x: 1, y: 0.5, z: 0 });
    const wishspeed = 320;
    const accel = 10;
    const frametime = 0.025; // 25ms frame (40 FPS)
    const pmFriction = 6;
    const pmStopSpeed = 100;

    // Client order (CORRECT - friction first)
    const clientFriction = applyPmoveFriction({
      velocity: startVelocity,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction: 1,
    });
    const clientVelocity = applyPmoveAccelerate({
      velocity: clientFriction,
      wishdir,
      wishspeed,
      accel,
      frametime,
    });

    // Server order (WRONG - acceleration first)
    const serverAccel = applyPmoveAccelerate({
      velocity: startVelocity,
      wishdir,
      wishspeed,
      accel,
      frametime,
    });
    const serverVelocity = applyPmoveFriction({
      velocity: serverAccel,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction: 1,
    });

    // Compute the prediction error
    const errorX = Math.abs(clientVelocity.x - serverVelocity.x);
    const errorY = Math.abs(clientVelocity.y - serverVelocity.y);
    const totalError = Math.sqrt(errorX * errorX + errorY * errorY);

    // With mismatched order, there should be noticeable drift
    expect(totalError).toBeGreaterThan(1); // More than 1 unit/sec of drift

    // This drift accumulates every frame, causing client corrections
    console.log(`Prediction drift per frame: ${totalError.toFixed(2)} units/sec`);
    console.log(`Client velocity: (${clientVelocity.x.toFixed(2)}, ${clientVelocity.y.toFixed(2)})`);
    console.log(`Server velocity: (${serverVelocity.x.toFixed(2)}, ${serverVelocity.y.toFixed(2)})`);
  });

  it('verifies friction-then-acceleration produces physically correct deceleration', () => {
    // When moving in the same direction you're already going, friction should slow you down
    // before acceleration speeds you back up. This creates the characteristic Quake movement feel.

    const movingFast = { x: 400, y: 0, z: 0 }; // Moving faster than max speed
    const wishdir = normalizeVec3({ x: 1, y: 0, z: 0 }); // Same direction
    const wishspeed = 320; // Standard max speed
    const accel = 10;
    const frametime = 0.1;
    const pmFriction = 6;
    const pmStopSpeed = 100;

    // Apply correct order
    const afterFriction = applyPmoveFriction({
      velocity: movingFast,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction: 1,
    });

    const afterAcceleration = applyPmoveAccelerate({
      velocity: afterFriction,
      wishdir,
      wishspeed,
      accel,
      frametime,
    });

    // The physics works like this:
    // 1. Friction significantly reduces the high speed (400 -> ~160)
    expect(lengthVec3(afterFriction)).toBeLessThan(lengthVec3(movingFast));

    // 2. After friction reduces speed below wishspeed (320), acceleration adds it back
    // The final speed should be at or approaching the wishspeed
    expect(lengthVec3(afterAcceleration)).toBeGreaterThan(lengthVec3(afterFriction));
    expect(lengthVec3(afterAcceleration)).toBeLessThanOrEqual(wishspeed);

    // But overall, we should still have decelerated from the original overspeed
    expect(lengthVec3(afterAcceleration)).toBeLessThan(lengthVec3(movingFast));
  });

  it('handles perpendicular acceleration correctly after friction', () => {
    // When changing direction, friction first reduces speed in current direction,
    // then acceleration adds speed in the new direction.

    const velocity = { x: 300, y: 0, z: 0 }; // Moving along X
    const wishdir = normalizeVec3({ x: 0, y: 1, z: 0 }); // Want to move along Y
    const wishspeed = 320;
    const accel = 10;
    const frametime = 0.1;
    const pmFriction = 6;
    const pmStopSpeed = 100;

    // Correct order
    const afterFriction = applyPmoveFriction({
      velocity,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: 0,
      pmFriction,
      pmStopSpeed,
      pmWaterFriction: 1,
    });

    const afterAcceleration = applyPmoveAccelerate({
      velocity: afterFriction,
      wishdir,
      wishspeed,
      accel,
      frametime,
    });

    // After friction, X velocity should be reduced
    expect(lengthVec3(afterFriction)).toBeLessThan(lengthVec3(velocity));

    // After acceleration, we should have gained Y velocity
    expect(afterAcceleration.y).toBeGreaterThan(0);

    // The X component should still be reduced from friction
    expect(Math.abs(afterAcceleration.x)).toBeLessThan(Math.abs(velocity.x));
  });
});
