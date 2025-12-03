import { describe, expect, it } from 'vitest';
import {
  PmFlag,
  PlayerButton,
  WaterLevel,
  checkJump,
  PmType,
  addPmFlag,
} from '../src/index.js';

const BASE_STATE = {
  pmFlags: PmFlag.OnGround as number,
  pmType: PmType.Normal,
  buttons: PlayerButton.Jump,
  waterlevel: WaterLevel.None,
  onGround: true,
  velocity: { x: 0, y: 0, z: 0 },
  origin: { x: 0, y: 0, z: 0 }, // Added origin to match CheckJumpParams
};

describe('checkJump', () => {
  it('clears jump-held when jump button is released', () => {
    const state = { ...BASE_STATE, pmFlags: addPmFlag(PmFlag.OnGround, PmFlag.JumpHeld), buttons: PlayerButton.None };
    const result = checkJump(state);
    expect(result.pmFlags & PmFlag.JumpHeld).toBe(0);
    expect(result.jumped).toBe(false);
  });

  it('refuses to jump while PMF_TIME_LAND is active', () => {
    const state = { ...BASE_STATE, pmFlags: addPmFlag(PmFlag.TimeLand, PmFlag.OnGround) };
    const result = checkJump(state);
    expect(result.jumped).toBe(false);
    expect(result.pmFlags & PmFlag.TimeLand).not.toBe(0);
    expect(result.velocity).toBe(state.velocity);
  });

  it('prevents re-triggering while PMF_JUMP_HELD is set', () => {
    const state = { ...BASE_STATE, pmFlags: addPmFlag(PmFlag.JumpHeld, PmFlag.OnGround) };
    const result = checkJump(state);
    expect(result.jumped).toBe(false);
    expect(result.pmFlags & PmFlag.JumpHeld).not.toBe(0);
  });

  it('drops to air control when waist-deep in water', () => {
    const state = { ...BASE_STATE, waterlevel: WaterLevel.Waist };
    const result = checkJump(state);
    expect(result.jumped).toBe(false);
    expect(result.onGround).toBe(false);
  });

  it('requires being on the ground', () => {
    const state = { ...BASE_STATE, onGround: false };
    const result = checkJump(state);
    expect(result.jumped).toBe(false);
  });

  it('applies the jump height, sets flags, and triggers jump sound', () => {
    const velocity = { x: 10, y: -5, z: 20 };
    const state = { ...BASE_STATE, velocity };
    const result = checkJump(state);

    expect(result.jumped).toBe(true);
    expect(result.jumpSound).toBe(true);
    expect(result.pmFlags & PmFlag.JumpHeld).not.toBe(0);
    expect(result.pmFlags & PmFlag.OnGround).toBe(0);
    expect(result.onGround).toBe(false);
    expect(result.velocity.z).toBeGreaterThanOrEqual(270);
    expect(result.velocity).not.toBe(velocity);
  });

  it('supports overriding the jump height', () => {
    const state = { ...BASE_STATE, velocity: { x: 0, y: 0, z: 0 }, jumpHeight: 320 };
    const result = checkJump(state);
    expect(result.velocity.z).toBe(320);
  });
});
