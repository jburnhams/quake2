import { describe, it, expect } from 'vitest';
import { checkJump, CheckJumpParams } from '../../../src/pmove/jump.js';
import { PmFlag, PmType, PlayerButton, WaterLevel } from '../../../src/pmove/constants.js';
import type { Vec3 } from '../../../src/math/vec3.js';

describe('checkJump', () => {
  const baseParams: CheckJumpParams = {
    pmFlags: 0,
    pmType: PmType.Normal,
    buttons: 0,
    waterlevel: WaterLevel.None,
    onGround: true,
    velocity: { x: 0, y: 0, z: 0 },
    origin: { x: 0, y: 0, z: 0 },
    jumpHeight: 270
  };

  it('should not jump if Jump button is not held', () => {
    const result = checkJump({ ...baseParams, buttons: 0 });
    expect(result.jumped).toBe(false);
    expect(result.velocity.z).toBe(0);
    expect(result.origin.z).toBe(0);
  });

  it('should not jump if already in air', () => {
    const result = checkJump({ ...baseParams, buttons: PlayerButton.Jump, onGround: false });
    expect(result.jumped).toBe(false);
  });

  it('should not jump if dead', () => {
    const result = checkJump({ ...baseParams, buttons: PlayerButton.Jump, pmType: PmType.Dead });
    expect(result.jumped).toBe(false);
  });

  it('should not jump if TimeLand flag is set', () => {
    const result = checkJump({ ...baseParams, buttons: PlayerButton.Jump, pmFlags: PmFlag.TimeLand });
    expect(result.jumped).toBe(false);
  });

  it('should not jump if waterlevel >= 2', () => {
    const result = checkJump({ ...baseParams, buttons: PlayerButton.Jump, waterlevel: WaterLevel.Waist });
    expect(result.jumped).toBe(false);
  });

  it('should jump if conditions are met', () => {
    const result = checkJump({ ...baseParams, buttons: PlayerButton.Jump });
    expect(result.jumped).toBe(true);
    expect(result.pmFlags & PmFlag.JumpHeld).toBeTruthy();
    expect(result.onGround).toBe(false);
    expect(result.velocity.z).toBe(270);
    expect(result.origin.z).toBe(1); // The nudge!
  });

  it('should clamp velocity.z if it was already negative', () => {
    const result = checkJump({ ...baseParams, buttons: PlayerButton.Jump, velocity: { x: 0, y: 0, z: -100 } });
    expect(result.velocity.z).toBe(270);
  });

  it('should add to velocity.z if it was positive (e.g. jumppad)', () => {
    const result = checkJump({ ...baseParams, buttons: PlayerButton.Jump, velocity: { x: 0, y: 0, z: 100 } });
    expect(result.velocity.z).toBe(370);
  });
});
