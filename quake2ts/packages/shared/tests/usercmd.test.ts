import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORWARD_SPEED,
  DEFAULT_PITCH_SPEED,
  DEFAULT_SIDE_SPEED,
  DEFAULT_UP_SPEED,
  DEFAULT_YAW_SPEED,
  addViewAngles,
  mouseDeltaToViewDelta,
} from '../src/protocol/usercmd.js';

describe('usercmd defaults mirror rerelease movement tuning', () => {
  it('matches the canonical speed constants from the C++ client', () => {
    expect(DEFAULT_FORWARD_SPEED).toBe(200);
    expect(DEFAULT_SIDE_SPEED).toBe(200);
    expect(DEFAULT_UP_SPEED).toBe(200);
    expect(DEFAULT_YAW_SPEED).toBe(140);
    expect(DEFAULT_PITCH_SPEED).toBe(150);
  });
});

describe('addViewAngles', () => {
  it('wraps yaw/roll while clamping pitch to the rerelease bounds', () => {
    const base = { x: 80, y: 350, z: 358 } as const;
    const delta = { x: 20, y: 30, z: 10 } as const;

    const result = addViewAngles(base, delta);

    // Pitch should clamp to +89 (matches CL_UpdateCmdAngles)
    expect(result.x).toBe(89);
    // Yaw and roll wrap using angleMod to the [0, 360) range
    expect(result.y).toBe(20);
    expect(result.z).toBe(8);
  });

  it('clamps negative pitch to -89 via the 271-degree sentinel', () => {
    const result = addViewAngles({ x: -80, y: 10, z: 0 }, { x: -30, y: -40, z: -10 });
    expect(result.x).toBe(271);
    expect(result.y).toBe(330); // 10 - 40 underflows and wraps
    expect(result.z).toBe(350);
  });
});

describe('mouseDeltaToViewDelta', () => {
  it('scales deltas uniformly when no axis overrides are set', () => {
    const delta = mouseDeltaToViewDelta({ deltaX: 10, deltaY: -4 }, { sensitivity: 3, invertY: false });
    expect(delta.y).toBe(30); // yaw
    expect(delta.x).toBe(-12); // pitch
    expect(delta.z).toBe(0);
  });

  it('honors axis-specific sensitivity and invertY for pitch', () => {
    const delta = mouseDeltaToViewDelta(
      { deltaX: -5, deltaY: 6 },
      { sensitivity: 3, sensitivityX: 4, sensitivityY: 2, invertY: true },
    );

    expect(delta.y).toBe(-20); // -5 * 4 yaw scale
    expect(delta.x).toBe(-12); // 6 * (2 * -1) pitch scale with invert
  });
});
